import { NextResponse } from "next/server";
import { db } from "@/db";
import { citizens, evidenceFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { fetchFileFromDrive, getActiveDriveContext } from "@/lib/drive";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await context.params;
  const evId = Number(id);
  const [ev] = await db
    .select()
    .from(evidenceFiles)
    .where(eq(evidenceFiles.id, evId))
    .limit(1);

  if (!ev) {
    return NextResponse.json({ error: "Không tìm thấy tệp" }, { status: 404 });
  }

  if (ev.citizenId && user.role === "VILLAGE_HEAD") {
    const [c] = await db
      .select({ villageId: citizens.villageId })
      .from(citizens)
      .where(eq(citizens.id, ev.citizenId))
      .limit(1);
    if (!c || c.villageId !== user.villageId) {
      return NextResponse.json(
        { error: "Không có quyền xem minh chứng thôn khác" },
        { status: 403 }
      );
    }
  }

  const driveCtx = await getActiveDriveContext();
  if (!driveCtx) {
    return NextResponse.json(
      { error: "Google Drive hiện chưa được kết nối" },
      { status: 503 }
    );
  }

  const driveRes = await fetchFileFromDrive(driveCtx.accessToken, ev.driveFileId);
  const arrBuf = await driveRes.arrayBuffer();

  return new NextResponse(new Uint8Array(arrBuf), {
    headers: {
      "Content-Type": ev.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(ev.fileName)}"`,
    },
  });
}
