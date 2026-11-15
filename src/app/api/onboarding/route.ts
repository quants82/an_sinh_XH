import { NextResponse } from "next/server";
import { db, ensureDbReady } from "@/db";
import { systemSettings, users, villages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/crypto";
import { setSessionCookie } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const OnboardingSchema = z.object({
  communeName: z.string().min(2, "Tên xã/phường tối thiểu 2 ký tự"),
  communeCode: z.string().min(2).max(6),
  leaderFullName: z.string().min(2, "Họ tên lãnh đạo không được trống"),
  leaderUnitName: z.string().min(2).default("UBND Xã"),
  username: z.string().min(3, "Tên đăng nhập tối thiểu 3 ký tự").regex(/^[a-zA-Z0-9._-]+$/, "Tên đăng nhập chỉ chứa chữ, số, ., _, -"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  villageNames: z.array(z.string().min(1)).optional(),
});

export async function POST(req: Request) {
  await ensureDbReady();
  const existingOwners = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "OWNER"))
    .limit(1);

  if (existingOwners.length > 0) {
    return NextResponse.json(
      { error: "Hệ thống đã được khởi tạo chủ quản trước đó." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = OnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const cleanCommuneCode = data.communeCode.trim().toUpperCase();

  // Update system settings
  const settingsRows = await db.select().from(systemSettings).limit(1);
  if (settingsRows[0]) {
    await db
      .update(systemSettings)
      .set({
        communeName: data.communeName.trim(),
        communeCode: cleanCommuneCode,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.id, settingsRows[0].id));
  }

  // Update village names if provided
  if (data.villageNames && data.villageNames.length > 0) {
    const existingVillages = await db.select().from(villages);
    for (let i = 0; i < data.villageNames.length; i++) {
      const code = `T${String(i + 1).padStart(2, "0")}`;
      const match = existingVillages.find((v) => v.code === code);
      if (match) {
        await db
          .update(villages)
          .set({ name: data.villageNames[i].trim() })
          .where(eq(villages.id, match.id));
      } else {
        await db.insert(villages).values({
          code,
          name: data.villageNames[i].trim(),
          sortOrder: i + 1,
          isActive: true,
        });
      }
    }
  }

  const passwordHash = await hashPassword(data.password);
  const [created] = await db
    .insert(users)
    .values({
      username: data.username.trim().toLowerCase(),
      fullName: data.leaderFullName.trim(),
      unitName: data.leaderUnitName.trim(),
      role: "OWNER",
      villageId: null,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
    })
    .returning();

  await writeAuditLog({
    actorId: created.id,
    actorName: created.fullName,
    action: "ONBOARDING",
    entity: "system",
    entityId: "1",
    newValue: `${data.communeName} (${cleanCommuneCode}) - OWNER: ${created.username}`,
  });

  await setSessionCookie({
    id: created.id,
    username: created.username,
    fullName: created.fullName,
    unitName: created.unitName,
    role: "OWNER",
    villageId: null,
    mustChangePassword: false,
    isActive: true,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: created.id,
      username: created.username,
      fullName: created.fullName,
      role: created.role,
    },
  });
}
