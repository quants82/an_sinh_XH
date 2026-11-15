import { NextResponse } from "next/server";
import { db, ensureDbReady } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/crypto";
import { setSessionCookie } from "@/lib/auth";
import type { UserRole } from "@/lib/constants";

export async function POST(req: Request) {
  await ensureDbReady();
  const body = (await req.json()) as { username?: string; password?: string };
  const username = body.username?.trim().toLowerCase() || "";
  const password = body.password || "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu" },
      { status: 400 }
    );
  }

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const user = rows[0];

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Tên đăng nhập hoặc mật khẩu không đúng" },
      { status: 401 }
    );
  }

  if (!user.isActive) {
    return NextResponse.json(
      { error: "Tài khoản này đã bị tạm khóa bởi quản trị viên" },
      { status: 403 }
    );
  }

  await setSessionCookie({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    unitName: user.unitName,
    role: user.role as UserRole,
    villageId: user.villageId,
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive,
  });

  return NextResponse.json({
    ok: true,
    mustChangePassword: user.mustChangePassword,
    role: user.role,
  });
}
