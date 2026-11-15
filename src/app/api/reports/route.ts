import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  citizenGroups,
  citizens,
  supportGroups,
  supportHistory,
  systemSettings,
  villages,
} from "@/db/schema";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { computeProgramAllocations } from "@/lib/scoring";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === "VILLAGE_HEAD") {
    return NextResponse.json({ error: "Không có quyền xem báo cáo tổng hợp" }, { status: 403 });
  }

  const url = new URL(req.url);
  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");
  const villageId = url.searchParams.get("villageId");
  const supportKind = url.searchParams.get("supportKind");
  const occasionKey = url.searchParams.get("occasionKey")?.trim().toUpperCase();
  const nextSlots = Math.max(1, Math.min(200, Number(url.searchParams.get("nextSlots") || "20")));
  const nextOccasion = url.searchParams.get("nextOccasion")?.trim().toUpperCase() || "DOT_TIEP_THEO";

  const [settingsRows, citizenRows, villageRows, groupRows, cgRows, historyRows] =
    await Promise.all([
      db.select().from(systemSettings).limit(1),
      db.select().from(citizens),
      db.select().from(villages),
      db.select().from(supportGroups),
      db.select().from(citizenGroups),
      db.select().from(supportHistory).orderBy(desc(supportHistory.receivedAt)),
    ]);

  const s = settingsRows[0];
  const cMap = new Map(citizenRows.map((c) => [c.id, c]));
  const vMap = new Map(villageRows.map((v) => [v.id, v]));
  const gMap = new Map(groupRows.map((g) => [g.id, g]));

  const groupsByCitizen = new Map<number, Array<typeof supportGroups.$inferSelect>>();
  for (const cg of cgRows) {
    const g = gMap.get(cg.groupId);
    if (!g) continue;
    const arr = groupsByCitizen.get(cg.citizenId) ?? [];
    arr.push(g);
    groupsByCitizen.set(cg.citizenId, arr);
  }

  const filteredHistories = historyRows.filter((h) => {
    const dt = new Date(h.receivedAt);
    if (fromDate && dt < new Date(fromDate)) return false;
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      if (dt > end) return false;
    }
    const c = cMap.get(h.citizenId);
    if (villageId && c?.villageId !== Number(villageId)) return false;
    if (supportKind && h.supportKind !== supportKind) return false;
    if (occasionKey && h.occasionKey.toUpperCase() !== occasionKey) return false;
    return true;
  });

  const totalDeliveries = filteredHistories.length;
  const totalValueVnd = filteredHistories.reduce((sum, h) => sum + h.valueVnd, 0);
  const uniqueRecipients = new Set(filteredHistories.map((h) => h.citizenId)).size;

  const byVillageMap = new Map<number, { villageName: string; deliveries: number; totalVnd: number }>();
  for (const h of filteredHistories) {
    const c = cMap.get(h.citizenId);
    if (!c) continue;
    const v = vMap.get(c.villageId);
    const cur = byVillageMap.get(c.villageId) ?? {
      villageName: v?.name || "Khác",
      deliveries: 0,
      totalVnd: 0,
    };
    cur.deliveries++;
    cur.totalVnd += h.valueVnd;
    byVillageMap.set(c.villageId, cur);
  }

  // Đề xuất đợt tiếp theo: ưu tiên người có điểm 3 lớp cao nhất, chưa nhận trong mốc tháng & ít lượt nhận nhất
  const candidates = citizenRows.map((c) => {
    const v = vMap.get(c.villageId);
    const cGroups = groupsByCitizen.get(c.id) ?? [];
    return {
      citizenId: c.id,
      citizenCode: c.citizenCode,
      fullName: c.fullName,
      birthYear: c.birthYear,
      villageId: c.villageId,
      villageCode: v?.code || "",
      villageName: v?.name || "",
      hardshipSummary: c.hardshipSummary,
      status: c.status,
      localBonusScore: c.localBonusScore,
      groupIds: cGroups.map((g) => g.id),
      groupNames: cGroups.map((g) => g.name),
      groupScores: cGroups.map((g) => g.baseScore),
    };
  });

  const allocations = computeProgramAllocations({
    candidates,
    histories: historyRows.map((h) => ({
      citizenId: h.citizenId,
      occasionKey: h.occasionKey,
      valueVnd: h.valueVnd,
      tier: h.tier,
      receivedAt: new Date(h.receivedAt),
    })),
    programOccasionKey: nextOccasion,
    programUnitValue: 500000,
    totalSlots: nextSlots,
    filterGroupIds: [],
    filterVillageIds: villageId ? [Number(villageId)] : [],
    config: {
      duplicateCheckMonths: s?.duplicateCheckMonths ?? 3,
      smallSupportPenalty: s?.smallSupportPenalty ?? 5,
      largeSupportPenalty: s?.largeSupportPenalty ?? 10,
      yearlyWarningThreshold: s?.yearlyWarningThreshold ?? 3,
    },
  });

  const nextWaveRecommendations = allocations
    .filter((a) => a.allocationType === "PRIMARY")
    .map((a) => {
      const c = cMap.get(a.citizenId)!;
      const v = vMap.get(c.villageId);
      const cGroups = groupsByCitizen.get(c.id) ?? [];
      return {
        citizenId: c.id,
        citizenCode: c.citizenCode,
        fullName: c.fullName,
        birthYear: c.birthYear,
        villageName: v?.name || "",
        groupsText: cGroups.map((g) => g.name).join(", "),
        hardshipSummary: c.hardshipSummary,
        baseScore: a.baseScore,
        bonusScore: a.bonusScore,
        penaltyScore: a.penaltyScore,
        totalScore: a.totalScore,
        receivedCountThisYear: a.receivedCountThisYear,
        receivedInWindow: a.receivedInWindow,
        warningMessage: a.warningMessage,
      };
    });

  return NextResponse.json({
    summary: {
      totalDeliveries,
      uniqueRecipients,
      totalValueVnd,
    },
    byVillage: Array.from(byVillageMap.values()),
    deliveries: filteredHistories.map((h) => {
      const c = cMap.get(h.citizenId);
      const v = c ? vMap.get(c.villageId) : undefined;
      return {
        ...h,
        citizenCode: c?.citizenCode || "",
        citizenName: c?.fullName || "",
        birthYear: c?.birthYear || 0,
        villageName: v?.name || "",
        groupsText: (groupsByCitizen.get(h.citizenId) ?? [])
          .map((g) => g.name)
          .join(", "),
      };
    }),
    nextWaveRecommendations,
  });
}
