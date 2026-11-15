import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  citizenGroups,
  citizens,
  supportAllocations,
  supportGroups,
  supportPrograms,
  systemSettings,
  villages,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import {
  buildInternalProgramWorkbook,
  buildSignoffWorkbook,
} from "@/lib/excel";
import { getActiveDriveContext, uploadBufferToDrive } from "@/lib/drive";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role === "VILLAGE_HEAD") {
    return NextResponse.json({ error: "Không có quyền xuất file" }, { status: 403 });
  }

  const { id } = await context.params;
  const programId = Number(id);
  const url = new URL(req.url);
  const type = url.searchParams.get("type") === "signoff" ? "signoff" : "internal";
  const saveToDrive = url.searchParams.get("saveToDrive") === "1";

  const [program] = await db
    .select()
    .from(supportPrograms)
    .where(eq(supportPrograms.id, programId))
    .limit(1);
  if (!program) {
    return NextResponse.json({ error: "Không tìm thấy chương trình" }, { status: 404 });
  }

  const [settingsRows, allocRows, citizenRows, villageRows, groupRows, cgRows] =
    await Promise.all([
      db.select().from(systemSettings).limit(1),
      db
        .select()
        .from(supportAllocations)
        .where(eq(supportAllocations.programId, programId))
        .orderBy(desc(supportAllocations.totalScore)),
      db.select().from(citizens),
      db.select().from(villages),
      db.select().from(supportGroups),
      db.select().from(citizenGroups),
    ]);

  const communeName = settingsRows[0]?.communeName || "Xã Bình An";
  const cMap = new Map(citizenRows.map((c) => [c.id, c]));
  const vMap = new Map(villageRows.map((v) => [v.id, v]));
  const gMap = new Map(groupRows.map((g) => [g.id, g]));

  const groupsByCitizen = new Map<number, string[]>();
  for (const cg of cgRows) {
    const g = gMap.get(cg.groupId);
    if (!g) continue;
    const arr = groupsByCitizen.get(cg.citizenId) ?? [];
    arr.push(g.name);
    groupsByCitizen.set(cg.citizenId, arr);
  }

  let buffer: Buffer;
  let fileName: string;

  if (type === "signoff") {
    const primaries = allocRows.filter(
      (a) => a.allocationType === "PRIMARY" || a.leaderExceptionApproved
    );
    buffer = await buildSignoffWorkbook({
      communeName,
      programCode: program.programCode,
      programTitle: program.title,
      donorName: program.donorName,
      rows: primaries.map((a, idx) => {
        const c = cMap.get(a.citizenId);
        const v = c ? vMap.get(c.villageId) : undefined;
        return {
          stt: idx + 1,
          fullName: c?.fullName || "",
          birthYear: c?.birthYear || 0,
          villageName: v?.name || "",
          hardshipSummary: c?.hardshipSummary || "",
        };
      }),
    });
    fileName = `DS_KY_NHAN_${program.programCode}.xlsx`;
  } else {
    buffer = await buildInternalProgramWorkbook({
      communeName,
      programCode: program.programCode,
      programTitle: program.title,
      donorName: program.donorName,
      unitValue: program.unitValue,
      rows: allocRows.map((a, idx) => {
        const c = cMap.get(a.citizenId);
        const v = c ? vMap.get(c.villageId) : undefined;
        return {
          stt: idx + 1,
          citizenCode: c?.citizenCode || "",
          fullName: c?.fullName || "",
          birthYear: c?.birthYear || 0,
          villageName: v?.name || "",
          groupsText: (groupsByCitizen.get(a.citizenId) ?? []).join(", "),
          hardshipSummary: c?.hardshipSummary || "",
          allocationType: a.allocationType,
          baseScore: a.baseScore,
          bonusScore: a.bonusScore,
          penaltyScore: a.penaltyScore,
          totalScore: a.totalScore,
          receivedCountThisYear: a.receivedCountThisYear,
          warningMessage: a.warningMessage || "",
          leaderExceptionApproved: a.leaderExceptionApproved,
          exceptionReason: a.exceptionReason || "",
        };
      }),
    });
    fileName = `DS_NOI_BO_${program.programCode}.xlsx`;
  }

  if (saveToDrive) {
    const driveCtx = await getActiveDriveContext();
    if (!driveCtx || !driveCtx.settings.driveProgramsFolderId) {
      return NextResponse.json(
        { error: "Chưa kết nối Google Drive" },
        { status: 412 }
      );
    }
    const uploaded = await uploadBufferToDrive({
      accessToken: driveCtx.accessToken,
      folderId: driveCtx.settings.driveProgramsFolderId,
      fileName,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    });
    return NextResponse.json({ ok: true, driveFile: uploaded });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
