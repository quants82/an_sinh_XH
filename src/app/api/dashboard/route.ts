import { NextResponse } from "next/server";
import { db, ensureDbReady } from "@/db";
import {
  citizenGroups,
  citizens,
  supportGroups,
  supportHistory,
  supportPrograms,
  systemSettings,
  tasks,
  villages,
} from "@/db/schema";
import { and, desc, eq, lt } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  await ensureDbReady();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  // Update expired temporary citizens automatically
  await db
    .update(citizens)
    .set({ status: "PENDING_REVIEW", updatedAt: new Date() })
    .where(
      and(
        eq(citizens.status, "TEMPORARY"),
        lt(citizens.tempExpiresAt, new Date())
      )
    );

  const [
    settingsRows,
    citizenRows,
    villageRows,
    groupRows,
    cgRows,
    historyRows,
    programRows,
    taskRows,
  ] = await Promise.all([
    db.select().from(systemSettings).limit(1),
    db.select().from(citizens),
    db.select().from(villages),
    db.select().from(supportGroups),
    db.select().from(citizenGroups),
    db.select().from(supportHistory),
    db.select().from(supportPrograms).orderBy(desc(supportPrograms.id)).limit(5),
    db.select().from(tasks),
  ]);

  const isVillageScoped = user.role === "VILLAGE_HEAD";
  const scopedCitizens = isVillageScoped && user.villageId
    ? citizenRows.filter((c) => c.villageId === user.villageId)
    : citizenRows;

  const activeCount = scopedCitizens.filter(
    (c) => c.status === "ACTIVE" || c.status === "TEMPORARY"
  ).length;
  const pendingReviewCount = scopedCitizens.filter(
    (c) => c.status === "PENDING_REVIEW"
  ).length;

  const currentYear = new Date().getFullYear();
  const historiesThisYear = historyRows.filter(
    (h) => new Date(h.receivedAt).getFullYear() === currentYear
  );
  const totalValueThisYear = historiesThisYear.reduce(
    (sum, h) => sum + h.valueVnd,
    0
  );

  const myPendingTasks = taskRows.filter((t) => {
    if (t.status === "DONE") return false;
    if (isVillageScoped || user.role === "STAFF") {
      return t.assignedToId === user.id;
    }
    return true;
  }).length;

  // Village breakdown
  const countByVillage = new Map<number, number>();
  for (const c of scopedCitizens) {
    if (c.status === "ACTIVE" || c.status === "TEMPORARY" || c.status === "PENDING_REVIEW") {
      countByVillage.set(c.villageId, (countByVillage.get(c.villageId) ?? 0) + 1);
    }
  }
  const villageStats = villageRows
    .filter((v) => !isVillageScoped || v.id === user.villageId)
    .map((v) => ({
      id: v.id,
      code: v.code,
      name: v.name,
      count: countByVillage.get(v.id) ?? 0,
    }));

  // Group breakdown
  const scopedIds = new Set(scopedCitizens.map((c) => c.id));
  const countByGroup = new Map<number, number>();
  for (const cg of cgRows) {
    if (scopedIds.has(cg.citizenId)) {
      countByGroup.set(cg.groupId, (countByGroup.get(cg.groupId) ?? 0) + 1);
    }
  }
  const groupStats = groupRows
    .filter((g) => g.isActive)
    .map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      count: countByGroup.get(g.id) ?? 0,
    }))
    .filter((g) => g.count > 0);

  const s = settingsRows[0];
  return NextResponse.json({
    communeName: s?.communeName || "Xã Bình An",
    driveConnected: s?.driveConnected ?? false,
    driveEmail: s?.driveEmail ?? null,
    lastBackupAt: s?.lastBackupAt ?? null,
    summary: {
      totalCitizens: scopedCitizens.length,
      activeCount,
      pendingReviewCount,
      deliveriesThisYear: isVillageScoped ? 0 : historiesThisYear.length,
      totalValueThisYear: isVillageScoped ? 0 : totalValueThisYear,
      openTasks: myPendingTasks,
    },
    villageStats,
    groupStats,
    recentPrograms: isVillageScoped ? [] : programRows,
  });
}
