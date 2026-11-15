import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canManageUsers, getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current || !canManageUsers(current.role)) {
    return NextResponse.json(
      { error: "Không có quyền cập nhật nhân viên" },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const targetId = Number(id);
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);
  const target = rows[0];
  if (!target) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
  }
  if (target.role === "OWNER" && current.id !== target.id) {
    return NextResponse.json(
      { error: "Không thể sửa tài khoản Chủ quản bằng thao tác này" },
      { status: 403 }
    );
  }

  const body = (await req.json()) as {
    fullName?: string;
    unitName?: string;
    role?: string;
    villageId?: number | null;
    isActive?: boolean;
    resetPassword?: string;
  };

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (body.fullName?.trim()) updateFields.fullName = body.fullName.trim();
  if (body.unitName?.trim()) updateFields.unitName = body.unitName.trim();
  if (typeof body.isActive === "boolean" && target.role !== "OWNER") {
    updateFields.isActive = body.isActive;
  }
  if (body.role && target.role !== "OWNER") {
    if (body.role === "LEADER" && current.role !== "OWNER") {
      return NextResponse.json(
        { error: "Chỉ Chủ quản mới được cấp quyền Lãnh đạo" },
        { status: 403 }
      );
    }
    updateFields.role = body.role;
    updateFields.villageId =
      body.role === "VILLAGE_HEAD" ? body.villageId ?? target.villageId : null;
  } else if (body.villageId !== undefined && target.role === "VILLAGE_HEAD") {
    updateFields.villageId = body.villageId;
  }

  if (body.resetPassword && body.resetPassword.length >= 6) {
    updateFields.passwordHash = await hashPassword(body.resetPassword);
    updateFields.mustChangePassword = true;
  }

  await db.update(users).set(updateFields).where(eq(users.id, targetId));

  await writeAuditLog({
    actorId: current.id,
    actorName: current.fullName,
    action: "UPDATE_USER",
    entity: "users",
    entityId: targetId,
    newValue: JSON.stringify({
      role: updateFields.role ?? target.role,
      isActive: updateFields.isActive ?? target.isActive,
      passwordReset: Boolean(body.resetPassword),
    }),
  });

  return NextResponse.json({ ok: true });
}
