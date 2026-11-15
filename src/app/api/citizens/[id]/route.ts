import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  citizenChanges,
  citizenGroups,
  citizens,
  evidenceFiles,
  supportGroups,
  supportHistory,
  villages,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { canEditCitizens, getCurrentUser } from "@/lib/auth";
import { normalizeVietnameseName } from "@/lib/scoring";
import { diffAndAuditFields, writeAuditLog } from "@/lib/audit";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await context.params;
  const citizenId = Number(id);
  const [citizen] = await db
    .select()
    .from(citizens)
    .where(eq(citizens.id, citizenId))
    .limit(1);

  if (!citizen) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ" }, { status: 404 });
  }
  if (user.role === "VILLAGE_HEAD" && user.villageId !== citizen.villageId) {
    return NextResponse.json(
      { error: "Không có quyền xem hồ sơ thôn khác" },
      { status: 403 }
    );
  }

  const [villageRows, cgRows, allGroups, histories, changes, evidences] =
    await Promise.all([
      db.select().from(villages).where(eq(villages.id, citizen.villageId)),
      db
        .select()
        .from(citizenGroups)
        .where(eq(citizenGroups.citizenId, citizenId)),
      db.select().from(supportGroups),
      db
        .select()
        .from(supportHistory)
        .where(eq(supportHistory.citizenId, citizenId))
        .orderBy(desc(supportHistory.receivedAt)),
      db
        .select()
        .from(citizenChanges)
        .where(eq(citizenChanges.citizenId, citizenId))
        .orderBy(desc(citizenChanges.createdAt)),
      db
        .select()
        .from(evidenceFiles)
        .where(eq(evidenceFiles.citizenId, citizenId))
        .orderBy(desc(evidenceFiles.createdAt)),
    ]);

  const gMap = new Map(allGroups.map((g) => [g.id, g]));
  const groups = cgRows
    .map((cg) => gMap.get(cg.groupId))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  return NextResponse.json({
    citizen: {
      ...citizen,
      villageName: villageRows[0]?.name ?? "",
      groups,
    },
    histories: user.role === "VILLAGE_HEAD" ? [] : histories,
    changes,
    evidences,
  });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !canEditCitizens(user.role)) {
    return NextResponse.json(
      { error: "Không có quyền chỉnh sửa hồ sơ" },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const citizenId = Number(id);
  const [existing] = await db
    .select()
    .from(citizens)
    .where(eq(citizens.id, citizenId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ" }, { status: 404 });
  }
  if (user.role === "VILLAGE_HEAD" && user.villageId !== existing.villageId) {
    return NextResponse.json(
      { error: "Trưởng thôn chỉ được sửa hồ sơ thuộc thôn mình" },
      { status: 403 }
    );
  }

  const body = (await req.json()) as {
    fullName?: string;
    birthYear?: number;
    gender?: string;
    addressDetail?: string;
    phone?: string | null;
    guardianNote?: string | null;
    hardshipSummary?: string;
    status?: string;
    localBonusScore?: number;
    localBonusReason?: string | null;
    tempExpiresAt?: string | null;
    groupIds?: number[];
    reason?: string;
  };

  const allowBonus =
    user.role === "OWNER" ||
    user.role === "LEADER" ||
    user.role === "DEPT_HEAD";

  const nextData = {
    fullName: body.fullName?.trim() || existing.fullName,
    normalizedName: body.fullName
      ? normalizeVietnameseName(body.fullName)
      : existing.normalizedName,
    birthYear: body.birthYear ?? existing.birthYear,
    gender: body.gender ?? existing.gender,
    addressDetail: body.addressDetail?.trim() ?? existing.addressDetail,
    phone: body.phone !== undefined ? body.phone?.trim() || null : existing.phone,
    guardianNote:
      body.guardianNote !== undefined
        ? body.guardianNote?.trim() || null
        : existing.guardianNote,
    hardshipSummary: body.hardshipSummary?.trim() ?? existing.hardshipSummary,
    status: body.status ?? existing.status,
    localBonusScore: allowBonus
      ? body.localBonusScore ?? existing.localBonusScore
      : existing.localBonusScore,
    localBonusReason: allowBonus
      ? body.localBonusReason !== undefined
        ? body.localBonusReason?.trim() || null
        : existing.localBonusReason
      : existing.localBonusReason,
    tempExpiresAt:
      body.tempExpiresAt !== undefined
        ? body.tempExpiresAt
          ? new Date(body.tempExpiresAt)
          : null
        : existing.tempExpiresAt,
    updatedById: user.id,
    updatedAt: new Date(),
  };

  await db.update(citizens).set(nextData).where(eq(citizens.id, citizenId));

  const changedFields = await diffAndAuditFields({
    actorId: user.id,
    actorName: user.fullName,
    entity: "citizens",
    entityId: citizenId,
    before: existing as unknown as Record<string, unknown>,
    after: nextData as unknown as Record<string, unknown>,
    fields: [
      "fullName",
      "birthYear",
      "gender",
      "addressDetail",
      "phone",
      "guardianNote",
      "hardshipSummary",
      "status",
      "localBonusScore",
      "localBonusReason",
    ],
    reason: body.reason,
  });

  if (body.groupIds && body.groupIds.length > 0) {
    const oldCg = await db
      .select()
      .from(citizenGroups)
      .where(eq(citizenGroups.citizenId, citizenId));
    const oldIds = oldCg.map((x) => x.groupId).sort().join(",");
    const newIds = [...body.groupIds].sort().join(",");
    if (oldIds !== newIds) {
      await db
        .delete(citizenGroups)
        .where(eq(citizenGroups.citizenId, citizenId));
      await db.insert(citizenGroups).values(
        body.groupIds.map((gid) => ({
          citizenId,
          groupId: gid,
        }))
      );
      await writeAuditLog({
        actorId: user.id,
        actorName: user.fullName,
        action: "UPDATE",
        entity: "citizens",
        entityId: citizenId,
        fieldName: "groupIds",
        oldValue: oldIds,
        newValue: newIds,
        reason: body.reason,
      });
      changedFields.push("nhóm đối tượng");
    }
  }

  if (changedFields.length > 0) {
    await db.insert(citizenChanges).values({
      citizenId,
      changeType: changedFields.includes("status")
        ? "STATUS_CHANGE"
        : "PROFILE_UPDATE",
      summary: `Cập nhật: ${changedFields.join(", ")}${body.reason ? ` (${body.reason})` : ""}`,
      actorId: user.id,
    });
  }

  return NextResponse.json({ ok: true, changedFields });
}
