import { NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") {
    return NextResponse.json(
      { error: "Chỉ Chủ quản hệ thống mới được ngắt kết nối Drive." },
      { status: 403 }
    );
  }

  const rows = await db.select().from(systemSettings).limit(1);
  const s = rows[0];
  if (s) {
    const oldEmail = s.driveEmail;
    await db
      .update(systemSettings)
      .set({
        driveConnected: false,
        driveEmail: null,
        driveEncryptedRefreshToken: null,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.id, s.id));

    await writeAuditLog({
      actorId: user.id,
      actorName: user.fullName,
      action: "DISCONNECT_DRIVE",
      entity: "system_settings",
      entityId: "1",
      oldValue: oldEmail,
    });
  }

  return NextResponse.json({ ok: true });
}
