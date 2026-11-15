import { NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, setSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";
import type { UserRole } from "@/lib/constants";

export async function POST(req: Request) {
  const current = await getCurrentUser();
  if (!current || current.role !== "OWNER") {
    return NextResponse.json(
      { error: "Chỉ Chủ quản hệ thống hiện tại mới được chuyển quyền quản lý" },
      { status: 403 }
    );
  }

  const body = (await req.json()) as {
    targetUserId?: number;
    currentPassword?: string;
    demoteRole?: "LEADER" | "DEPT_HEAD" | "AUDITOR";
    disconnectDrive?: boolean;
    reason?: string;
  };

  if (!body.targetUserId || !body.currentPassword) {
    return NextResponse.json(
      { error: "Vui lòng chọn người nhận bàn giao và nhập mật khẩu xác nhận" },
      { status: 400 }
    );
  }
  if (body.targetUserId === current.id) {
    return NextResponse.json(
      { error: "Không thể tự chuyển quyền cho chính mình" },
      { status: 400 }
    );
  }

  const [currentRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, current.id))
    .limit(1);

  if (
    !currentRow ||
    !(await verifyPassword(body.currentPassword, currentRow.passwordHash))
  ) {
    return NextResponse.json(
      { error: "Mật khẩu xác nhận không đúng" },
      { status: 400 }
    );
  }

  const [targetRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, body.targetUserId))
    .limit(1);

  if (!targetRow || !targetRow.isActive) {
    return NextResponse.json(
      { error: "Nhân sự tiếp nhận không tồn tại hoặc đang bị khóa" },
      { status: 404 }
    );
  }

  const newRoleForOldOwner: UserRole = body.demoteRole ?? "LEADER";

  // Promote target user to OWNER, clear village scope so they manage whole commune
  await db
    .update(users)
    .set({ role: "OWNER", villageId: null, updatedAt: new Date() })
    .where(eq(users.id, targetRow.id));

  // Demote previous OWNER
  await db
    .update(users)
    .set({ role: newRoleForOldOwner, updatedAt: new Date() })
    .where(eq(users.id, current.id));

  if (body.disconnectDrive) {
    const sRows = await db.select().from(systemSettings).limit(1);
    if (sRows[0]) {
      await db
        .update(systemSettings)
        .set({
          driveConnected: false,
          driveEmail: null,
          driveEncryptedRefreshToken: null,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.id, sRows[0].id));
    }
  }

  await writeAuditLog({
    actorId: current.id,
    actorName: current.fullName,
    action: "TRANSFER_OWNERSHIP",
    entity: "users",
    entityId: targetRow.id,
    oldValue: `${current.username} (OWNER)`,
    newValue: `${targetRow.username} (OWNER) | Drive disconnected: ${Boolean(body.disconnectDrive)}`,
    reason: body.reason || "Bàn giao quyền quản lý hệ thống",
  });

  // Update cookie for current user so their session reflects their new role immediately
  await setSessionCookie({
    id: currentRow.id,
    username: currentRow.username,
    fullName: currentRow.fullName,
    unitName: currentRow.unitName,
    role: newRoleForOldOwner,
    villageId: currentRow.villageId,
    mustChangePassword: currentRow.mustChangePassword,
    isActive: currentRow.isActive,
  });

  return NextResponse.json({
    ok: true,
    newOwner: targetRow.fullName,
    yourNewRole: newRoleForOldOwner,
  });
}
