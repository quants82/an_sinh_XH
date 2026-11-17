import { db } from "@/db";
import {
  citizenGroups,
  citizens,
  supportAllocations,
  supportGroups,
  supportHistory,
  supportPrograms,
  systemSettings,
  villages,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { computeProgramAllocations } from "@/lib/scoring";

export async function runAllocationForProgram(programId: number) {
  const [program] = await db
    .select()
    .from(supportPrograms)
    .where(eq(supportPrograms.id, programId))
    .limit(1);
  if (!program) return [];

  const [
    settingsRows,
    citizenRows,
    villageRows,
    groupRows,
    cgRows,
    historyRows,
    otherAllocRows,
    allPrograms,
    currentAllocs,
  ] = await Promise.all([
    db.select().from(systemSettings).limit(1),
    db.select().from(citizens),
    db.select().from(villages),
    db.select().from(supportGroups),
    db.select().from(citizenGroups),
    db.select().from(supportHistory),
    db.select().from(supportAllocations),
    db.select().from(supportPrograms),
    db
      .select()
      .from(supportAllocations)
      .where(eq(supportAllocations.programId, programId)),
  ]);

  const preservedExceptions = new Map(
    currentAllocs
      .filter((a) => a.leaderExceptionApproved)
      .map((a) => [a.citizenId, a])
  );

  const s = settingsRows[0];
  const vMap = new Map(villageRows.map((v) => [v.id, v]));
  const gMap = new Map(groupRows.map((g) => [g.id, g]));

  const groupsByCitizen = new Map<
    number,
    Array<typeof supportGroups.$inferSelect>
  >();
  for (const cg of cgRows) {
    const g = gMap.get(cg.groupId);
    if (!g) continue;
    const arr = groupsByCitizen.get(cg.citizenId) ?? [];
    arr.push(g);
    groupsByCitizen.set(cg.citizenId, arr);
  }

  const programMap = new Map(allPrograms.map((p) => [p.id, p]));
  const combinedHistories = historyRows.map((h) => ({
    citizenId: h.citizenId,
    occasionKey: h.occasionKey,
    valueVnd: h.valueVnd,
    tier: h.tier,
    receivedAt: new Date(h.receivedAt),
  }));

  for (const alloc of otherAllocRows) {
    if (alloc.programId === programId) continue;
    if (alloc.allocationType !== "PRIMARY" && !alloc.leaderExceptionApproved) {
      continue;
    }
    const otherProg = programMap.get(alloc.programId);
    if (!otherProg) continue;
    if (
      otherProg.status === "LOCKED" ||
      otherProg.status === "APPROVED" ||
      otherProg.status === "PENDING_APPROVAL"
    ) {
      const alreadyInHist = historyRows.some(
        (h) => h.programId === otherProg.id && h.citizenId === alloc.citizenId
      );
      if (!alreadyInHist) {
        combinedHistories.push({
          citizenId: alloc.citizenId,
          occasionKey: otherProg.occasionKey,
          valueVnd: otherProg.unitValue,
          tier: otherProg.tier,
          receivedAt: otherProg.createdAt,
        });
      }
    }
  }

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

  const filterGroupIds = JSON.parse(
    program.filterGroupIdsJson || "[]"
  ) as number[];
  const filterVillageIds = JSON.parse(
    program.filterVillageIdsJson || "[]"
  ) as number[];

  const results = computeProgramAllocations({
    candidates,
    histories: combinedHistories,
    programOccasionKey: program.occasionKey,
    programUnitValue: program.unitValue,
    totalSlots: program.totalSlots,
    filterGroupIds,
    filterVillageIds,
    config: {
      duplicateCheckMonths: s?.duplicateCheckMonths ?? 3,
      smallSupportPenalty: s?.smallSupportPenalty ?? 5,
      largeSupportPenalty: s?.largeSupportPenalty ?? 10,
      yearlyWarningThreshold: s?.yearlyWarningThreshold ?? 3,
    },
  });

  await db
    .delete(supportAllocations)
    .where(eq(supportAllocations.programId, programId));

  const seenCitizenIds = new Set<number>();
  const rowsToInsert = results.map((r) => {
    seenCitizenIds.add(r.citizenId);
    const prev = preservedExceptions.get(r.citizenId);
    return {
      programId,
      citizenId: r.citizenId,
      allocationType: prev ? "PRIMARY" : r.allocationType,
      baseScore: r.baseScore,
      bonusScore: r.bonusScore,
      penaltyScore: r.penaltyScore,
      totalScore: r.totalScore,
      receivedCountThisYear: r.receivedCountThisYear,
      receivedInWindow: r.receivedInWindow,
      warningFlag: r.warningFlag,
      warningMessage: r.warningMessage,
      leaderExceptionApproved: Boolean(prev),
      exceptionReason: prev?.exceptionReason ?? null,
    };
  });

  // Giữ lại các trường hợp đặc biệt/phát sinh được bổ sung tay ngoài bộ lọc
  for (const [cid, prev] of preservedExceptions.entries()) {
    if (!seenCitizenIds.has(cid)) {
      rowsToInsert.push({
        programId,
        citizenId: prev.citizenId,
        allocationType: "PRIMARY",
        baseScore: prev.baseScore,
        bonusScore: prev.bonusScore,
        penaltyScore: prev.penaltyScore,
        totalScore: prev.totalScore,
        receivedCountThisYear: prev.receivedCountThisYear,
        receivedInWindow: prev.receivedInWindow,
        warningFlag: prev.warningFlag,
        warningMessage: prev.warningMessage,
        leaderExceptionApproved: true,
        exceptionReason: prev.exceptionReason ?? "Bổ sung trực tiếp vào đợt",
      });
    }
  }

  for (let i = 0; i < rowsToInsert.length; i += 300) {
    await db.insert(supportAllocations).values(rowsToInsert.slice(i, i + 300));
  }

  return results;
}
