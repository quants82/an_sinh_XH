import { NextResponse } from "next/server";
import { db, ensureDbReady } from "@/db";
import { supportGroups, systemSettings, villages } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { canLockPrograms, getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { isDriveOAuthConfigured } from "@/lib/drive";

export async function GET() {
  await ensureDbReady();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const [sRows, villageRows, groupRows] = await Promise.all([
    db.select().from(systemSettings).limit(1),
    db.select().from(villages).orderBy(asc(villages.sortOrder)),
    db.select().from(supportGroups).orderBy(asc(supportGroups.sortOrder)),
  ]);

  const s = sRows[0];
  return NextResponse.json({
    settings: s
      ? {
          id: s.id,
          communeName: s.communeName,
          communeCode: s.communeCode,
          requireDriveToSave: s.requireDriveToSave,
          driveConnected: s.driveConnected,
          driveEmail: s.driveEmail,
          driveOAuthConfigured: isDriveOAuthConfigured(),
          duplicateCheckMonths: s.duplicateCheckMonths,
          smallSupportMax: s.smallSupportMax,
          mediumSupportMax: s.mediumSupportMax,
          smallSupportPenalty: s.smallSupportPenalty,
          largeSupportPenalty: s.largeSupportPenalty,
          yearlyWarningThreshold: s.yearlyWarningThreshold,
          lastBackupAt: s.lastBackupAt,
        }
      : null,
    villages: villageRows,
    supportGroups: groupRows,
  });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canLockPrograms(user.role)) {
    return NextResponse.json(
      { error: "Không có quyền thay đổi cấu hình" },
      { status: 403 }
    );
  }

  const body = (await req.json()) as {
    communeName?: string;
    communeCode?: string;
    requireDriveToSave?: boolean;
    duplicateCheckMonths?: number;
    smallSupportMax?: number;
    mediumSupportMax?: number;
    smallSupportPenalty?: number;
    largeSupportPenalty?: number;
    yearlyWarningThreshold?: number;
    villageUpdates?: Array<{ id?: number; code: string; name: string; isActive: boolean }>;
    groupUpdates?: Array<{
      id: number;
      name?: string;
      baseScore: number;
      isActive: boolean;
      defaultDurationMonths: number | null;
    }>;
    newGroup?: {
      code: string;
      name: string;
      baseScore: number;
      defaultDurationMonths?: number | null;
    };
  };

  const sRows = await db.select().from(systemSettings).limit(1);
  if (sRows[0]) {
    await db
      .update(systemSettings)
      .set({
        communeName: body.communeName?.trim() || sRows[0].communeName,
        communeCode:
          body.communeCode?.trim().toUpperCase() || sRows[0].communeCode,
        requireDriveToSave:
          typeof body.requireDriveToSave === "boolean"
            ? body.requireDriveToSave
            : sRows[0].requireDriveToSave,
        duplicateCheckMonths:
          body.duplicateCheckMonths ?? sRows[0].duplicateCheckMonths,
        smallSupportMax: body.smallSupportMax ?? sRows[0].smallSupportMax,
        mediumSupportMax: body.mediumSupportMax ?? sRows[0].mediumSupportMax,
        smallSupportPenalty:
          body.smallSupportPenalty ?? sRows[0].smallSupportPenalty,
        largeSupportPenalty:
          body.largeSupportPenalty ?? sRows[0].largeSupportPenalty,
        yearlyWarningThreshold:
          body.yearlyWarningThreshold ?? sRows[0].yearlyWarningThreshold,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.id, sRows[0].id));
  }

  if (body.villageUpdates) {
    for (const v of body.villageUpdates) {
      if (v.id) {
        await db
          .update(villages)
          .set({ name: v.name.trim(), isActive: v.isActive })
          .where(eq(villages.id, v.id));
      } else {
        await db.insert(villages).values({
          code: v.code.trim().toUpperCase(),
          name: v.name.trim(),
          isActive: v.isActive,
          sortOrder: 99,
        });
      }
    }
  }

  if (body.groupUpdates) {
    for (const g of body.groupUpdates) {
      await db
        .update(supportGroups)
        .set({
          ...(g.name?.trim() ? { name: g.name.trim() } : {}),
          baseScore: g.baseScore,
          isActive: g.isActive,
          defaultDurationMonths: g.defaultDurationMonths,
        })
        .where(eq(supportGroups.id, g.id));
    }
  }

  if (body.newGroup?.code && body.newGroup?.name) {
    const cleanCode = body.newGroup.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const exists = await db
      .select({ id: supportGroups.id })
      .from(supportGroups)
      .where(eq(supportGroups.code, cleanCode))
      .limit(1);
    if (exists.length > 0) {
      return NextResponse.json(
        { error: `Mã nhóm '${cleanCode}' đã tồn tại` },
        { status: 400 }
      );
    }
    const curGroups = await db.select({ sortOrder: supportGroups.sortOrder }).from(supportGroups);
    const nextSort = curGroups.reduce((m, x) => Math.max(m, x.sortOrder), 0) + 1;
    await db.insert(supportGroups).values({
      code: cleanCode,
      name: body.newGroup.name.trim(),
      baseScore: Number(body.newGroup.baseScore) || 5,
      defaultDurationMonths: body.newGroup.defaultDurationMonths ?? null,
      isTemporaryDefault: Boolean(body.newGroup.defaultDurationMonths),
      isPhase2Optional: false,
      isActive: true,
      sortOrder: nextSort,
    });
  }

  await writeAuditLog({
    actorId: user.id,
    actorName: user.fullName,
    action: "UPDATE_SETTINGS",
    entity: "system_settings",
    entityId: "1",
  });

  return NextResponse.json({ ok: true });
}
