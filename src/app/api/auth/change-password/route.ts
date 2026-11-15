import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = (await req.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!body.currentPassword || !body.newPassword || body.newPassword.length < 6) {
    return NextResponse.json(
      { error: "Mật khẩu mới phải có ít nhất 6 ký tự" },
      { status: 400 }
    );
  }

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const dbUser = rows[0];
  if (!dbUser || !(await verifyPassword(body.currentPassword, dbUser.passwordHash))) {
    return NextResponse.json(
      { error: "Mật khẩu hiện tại không chính xác" },
      { status: 400 }
    );
  }

  const newHash = await hashPassword(body.newPassword);
  await db
    .update(users)
    .set({
      passwordHash: newHash,
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await writeAuditLog({
    actorId: user.id,
    actorName: user.fullName,
    action: "CHANGE_PASSWORD",
    entity: "users",
    entityId: user.id,
  });

  return NextResponse.json({ ok: true });
}
