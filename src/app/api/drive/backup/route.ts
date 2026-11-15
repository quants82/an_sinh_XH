import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  citizens,
  citizenGroups,
  supportGroups,
  supportHistory,
  systemSettings,
  villages,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, canLockPrograms } from "@/lib/auth";
import { buildBackupWorkbook } from "@/lib/excel";
import { getActiveDriveContext, uploadBufferToDrive } from "@/lib/drive";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canLockPrograms(user.role)) {
    return NextResponse.json({ error: "Không có quyền sao lưu" }, { status: 403 });
  }

  const url = new URL(req.url);
  const downloadOnly = url.searchParams.get("download") === "1";

  const [settingsRows, villageRows, groupRows, citizenRows, cgRows, historyRows] =
    await Promise.all([
      db.select().from(systemSettings).limit(1),
      db.select().from(villages),
      db.select().from(supportGroups),
      db.select().from(citizens),
      db.select().from(citizenGroups),
      db.select().from(supportHistory),
    ]);

  const s = settingsRows[0];
  const villageMap = new Map(villageRows.map((v) => [v.id, v]));
  const groupMap = new Map(groupRows.map((g) => [g.id, g]));
  const citizenMap = new Map(citizenRows.map((c) => [c.id, c]));

  const groupsByCitizen = new Map<number, string[]>();
  for (const cg of cgRows) {
    const g = groupMap.get(cg.groupId);
    if (!g) continue;
    const arr = groupsByCitizen.get(cg.citizenId) ?? [];
    arr.push(g.name);
    groupsByCitizen.set(cg.citizenId, arr);
  }

  const wbBuffer = await buildBackupWorkbook({
    communeName: s?.communeName || "Xã Bình An",
    citizens: citizenRows.map((c) => {
      const v = villageMap.get(c.villageId);
      return {
        citizenCode: c.citizenCode,
        recordType: c.recordType,
        fullName: c.fullName,
        birthYear: c.birthYear,
        gender: c.gender,
        villageCode: v?.code || "",
        villageName: v?.name || "",
        addressDetail: c.addressDetail,
        phone: c.phone,
        guardianNote: c.guardianNote,
        hardshipSummary: c.hardshipSummary,
        status: c.status,
        groupsText: (groupsByCitizen.get(c.id) ?? []).join(", "),
        localBonusScore: c.localBonusScore,
      };
    }),
    histories: historyRows.map((h) => {
      const c = citizenMap.get(h.citizenId);
      return {
        citizenCode: c?.citizenCode || "",
        citizenName: c?.fullName || "",
        programCode: h.programCode,
        programTitle: h.programTitle,
        occasionKey: h.occasionKey,
        donorName: h.donorName,
        valueVnd: h.valueVnd,
        tier: h.tier,
        receivedAt: new Date(h.receivedAt).toISOString().slice(0, 10),
      };
    }),
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `BACKUP_ANSINH_${s?.communeCode || "BA"}_${stamp}.xlsx`;

  if (!downloadOnly) {
    const driveCtx = await getActiveDriveContext();
    if (driveCtx && driveCtx.settings.driveBackupFolderId) {
      const uploaded = await uploadBufferToDrive({
        accessToken: driveCtx.accessToken,
        folderId: driveCtx.settings.driveBackupFolderId,
        fileName,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: wbBuffer,
      });

      await db
        .update(systemSettings)
        .set({ lastBackupAt: new Date(), updatedAt: new Date() })
        .where(eq(systemSettings.id, driveCtx.settings.id));

      await writeAuditLog({
        actorId: user.id,
        actorName: user.fullName,
        action: "BACKUP_TO_DRIVE",
        entity: "system_settings",
        entityId: "1",
        newValue: `${uploaded.name} (${uploaded.id})`,
      });

      return NextResponse.json({
        ok: true,
        uploadedToDrive: true,
        fileName: uploaded.name,
        driveFileId: uploaded.id,
      });
    }
  }

  return new NextResponse(new Uint8Array(wbBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
