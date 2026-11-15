import { NextResponse } from "next/server";
import { db } from "@/db";
import { citizens, evidenceFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canEditCitizens, getCurrentUser } from "@/lib/auth";
import { getActiveDriveContext, uploadBufferToDrive } from "@/lib/drive";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canEditCitizens(user.role)) {
    return NextResponse.json(
      { error: "Không có quyền tải lên minh chứng" },
      { status: 403 }
    );
  }

  const driveCtx = await getActiveDriveContext();
  if (!driveCtx || !driveCtx.settings.driveEvidenceFolderId) {
    return NextResponse.json(
      {
        error:
          "Chưa kết nối Google Drive. Vui lòng nhờ Lãnh đạo (Chủ quản) kết nối Google Drive tại mục Quản trị trước khi lưu hồ sơ minh chứng.",
      },
      { status: 412 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const citizenIdRaw = formData.get("citizenId");
  const programIdRaw = formData.get("programId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu tệp tải lên" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Kích thước tệp tối đa 10MB" },
      { status: 400 }
    );
  }

  const citizenId = citizenIdRaw ? Number(citizenIdRaw) : null;
  const programId = programIdRaw ? Number(programIdRaw) : null;

  let prefix = "MINHCHUNG";
  if (citizenId) {
    const [c] = await db
      .select()
      .from(citizens)
      .where(eq(citizens.id, citizenId))
      .limit(1);
    if (!c) {
      return NextResponse.json({ error: "Không tìm thấy công dân" }, { status: 404 });
    }
    if (user.role === "VILLAGE_HEAD" && user.villageId !== c.villageId) {
      return NextResponse.json(
        { error: "Không có quyền tải minh chứng cho thôn khác" },
        { status: 403 }
      );
    }
    prefix = c.citizenCode;
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const folderId =
    programId && driveCtx.settings.driveProgramsFolderId
      ? driveCtx.settings.driveProgramsFolderId
      : driveCtx.settings.driveEvidenceFolderId;

  const cleanName = `${prefix}_${Date.now()}_${file.name}`;
  const uploaded = await uploadBufferToDrive({
    accessToken: driveCtx.accessToken,
    folderId,
    fileName: cleanName,
    mimeType: file.type || "application/octet-stream",
    buffer: buf,
  });

  const [saved] = await db
    .insert(evidenceFiles)
    .values({
      citizenId,
      programId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      driveFileId: uploaded.id,
      uploadedById: user.id,
    })
    .returning();

  await writeAuditLog({
    actorId: user.id,
    actorName: user.fullName,
    action: "UPLOAD_EVIDENCE",
    entity: "evidence_files",
    entityId: saved.id,
    newValue: `${file.name} -> Drive:${uploaded.id}`,
  });

  return NextResponse.json({ ok: true, evidence: saved });
}
