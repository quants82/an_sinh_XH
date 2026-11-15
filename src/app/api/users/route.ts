import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, villages } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { canManageUsers, getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const CreateUserSchema = z.object({
  username: z
    .string()
    .min(3)
    .regex(/^[a-zA-Z0-9._-]+$/, "Tên đăng nhập chỉ gồm chữ, số, ., _, -"),
  fullName: z.string().min(2),
  unitName: z.string().min(2),
  role: z.enum(["LEADER", "DEPT_HEAD", "STAFF", "VILLAGE_HEAD", "AUDITOR"]),
  villageId: z.number().int().nullable().optional(),
  password: z.string().min(6),
});

export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const [userRows, villageRows] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        unitName: users.unitName,
        role: users.role,
        villageId: users.villageId,
        mustChangePassword: users.mustChangePassword,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.id)),
    db.select().from(villages),
  ]);

  const vMap = new Map(villageRows.map((v) => [v.id, v]));
  return NextResponse.json({
    users: userRows.map((u) => ({
      ...u,
      villageName: u.villageId ? vMap.get(u.villageId)?.name ?? null : null,
      villageCode: u.villageId ? vMap.get(u.villageId)?.code ?? null : null,
    })),
  });
}

export async function POST(req: Request) {
  const current = await getCurrentUser();
  if (!current || !canManageUsers(current.role)) {
    return NextResponse.json(
      { error: "Không có quyền thêm nhân viên" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (data.role === "LEADER" && current.role !== "OWNER") {
    return NextResponse.json(
      { error: "Chỉ Chủ quản hệ thống mới được cấp quyền Lãnh đạo" },
      { status: 403 }
    );
  }
  if (data.role === "VILLAGE_HEAD" && !data.villageId) {
    return NextResponse.json(
      { error: "Trưởng thôn bắt buộc phải gán phạm vi 1 thôn cụ thể" },
      { status: 400 }
    );
  }

  const cleanUsername = data.username.trim().toLowerCase();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, cleanUsername))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Tên đăng nhập đã tồn tại" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(data.password);
  const [created] = await db
    .insert(users)
    .values({
      username: cleanUsername,
      fullName: data.fullName.trim(),
      unitName: data.unitName.trim(),
      role: data.role,
      villageId: data.role === "VILLAGE_HEAD" ? data.villageId ?? null : null,
      passwordHash,
      mustChangePassword: true,
      isActive: true,
    })
    .returning();

  await writeAuditLog({
    actorId: current.id,
    actorName: current.fullName,
    action: "CREATE_USER",
    entity: "users",
    entityId: created.id,
    newValue: `${created.username} (${created.role})`,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: created.id,
      username: created.username,
      fullName: created.fullName,
      unitName: created.unitName,
      role: created.role,
      villageId: created.villageId,
      isActive: created.isActive,
    },
  });
}
