export function normalizeVietnameseName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function formatCitizenCode(
  communeCode: string,
  villageCode: string,
  sequenceNumber: number
): string {
  const cleanCommune = communeCode.trim().toUpperCase() || "BA";
  const cleanVillage = villageCode.trim().toUpperCase() || "T00";
  const paddedSeq = String(sequenceNumber).padStart(6, "0");
  return `${cleanCommune}-${cleanVillage}-${paddedSeq}`;
}

export function classifySupportTier(
  valueVnd: number,
  smallMax = 500000,
  mediumMax = 2000000
): "SMALL" | "MEDIUM" | "LARGE" {
  if (valueVnd < smallMax) return "SMALL";
  if (valueVnd <= mediumMax) return "MEDIUM";
  return "LARGE";
}

export interface ScoringCandidate {
  citizenId: number;
  citizenCode: string;
  fullName: string;
  birthYear: number;
  villageId: number;
  villageCode: string;
  villageName: string;
  hardshipSummary: string;
  status: string;
  localBonusScore: number;
  groupIds: number[];
  groupNames: string[];
  groupScores: number[];
}

export interface CandidateHistoryItem {
  citizenId: number;
  occasionKey: string;
  valueVnd: number;
  tier: string;
  receivedAt: Date;
}

export interface ScoringConfig {
  duplicateCheckMonths: number;
  smallSupportPenalty: number;
  largeSupportPenalty: number;
  yearlyWarningThreshold: number;
}

export interface ProgramAllocationResult {
  citizenId: number;
  allocationType: "PRIMARY" | "RESERVE_SECOND_ROUND" | "EXCLUDED";
  baseScore: number;
  bonusScore: number;
  penaltyScore: number;
  totalScore: number;
  receivedCountThisYear: number;
  receivedInWindow: boolean;
  warningFlag: string;
  warningMessage: string | null;
}

export function computeProgramAllocations(params: {
  candidates: ScoringCandidate[];
  histories: CandidateHistoryItem[];
  programOccasionKey: string;
  programUnitValue: number;
  totalSlots: number;
  filterGroupIds: number[];
  filterVillageIds: number[];
  config: ScoringConfig;
  now?: Date;
}): ProgramAllocationResult[] {
  const now = params.now ?? new Date();
  const windowCutoff = new Date(now);
  windowCutoff.setMonth(windowCutoff.getMonth() - params.config.duplicateCheckMonths);
  const currentYear = now.getFullYear();

  const historyByCitizen = new Map<number, CandidateHistoryItem[]>();
  for (const h of params.histories) {
    const arr = historyByCitizen.get(h.citizenId) ?? [];
    arr.push(h);
    historyByCitizen.set(h.citizenId, arr);
  }

  // Filter eligible active/temporary citizens matching donor criteria
  const eligible = params.candidates.filter((c) => {
    if (c.status !== "ACTIVE" && c.status !== "TEMPORARY") {
      return false;
    }
    if (
      params.filterVillageIds.length > 0 &&
      !params.filterVillageIds.includes(c.villageId)
    ) {
      return false;
    }
    if (
      params.filterGroupIds.length > 0 &&
      !c.groupIds.some((gid) => params.filterGroupIds.includes(gid))
    ) {
      return false;
    }
    return true;
  });

  type Evaluated = ProgramAllocationResult & {
    sameOccasionReceived: boolean;
    groupCount: number;
  };

  const evaluated: Evaluated[] = eligible.map((c) => {
    const baseScore = c.groupScores.reduce((acc, s) => acc + s, 0);
    const bonusScore = c.localBonusScore || 0;
    const citizenHist = historyByCitizen.get(c.citizenId) ?? [];

    const histThisYear = citizenHist.filter(
      (h) => new Date(h.receivedAt).getFullYear() === currentYear
    );
    const receivedCountThisYear = histThisYear.length;

    const histInWindow = citizenHist.filter(
      (h) => new Date(h.receivedAt) >= windowCutoff
    );
    const receivedInWindow = histInWindow.length > 0;

    let penaltyScore = 0;
    if (receivedInWindow) {
      const hasLargeOrMedium = histInWindow.some(
        (h) => h.tier === "LARGE" || h.tier === "MEDIUM"
      );
      penaltyScore = hasLargeOrMedium
        ? params.config.largeSupportPenalty
        : params.config.smallSupportPenalty;
    }

    const sameOccasionItems = citizenHist.filter(
      (h) => h.occasionKey.toLowerCase() === params.programOccasionKey.toLowerCase()
    );
    const sameOccasionReceived = sameOccasionItems.length > 0;

    let warningFlag = "NONE";
    const warnings: string[] = [];

    if (sameOccasionReceived) {
      const maxSameOccasion = Math.max(
        ...sameOccasionItems.map((i) => i.valueVnd)
      );
      if (params.programUnitValue > maxSameOccasion) {
        warningFlag = "SAME_OCCASION_LOWER";
        warnings.push(
          `Đã nhận suất ${maxSameOccasion.toLocaleString("vi-VN")}đ trong cùng dịp ${params.programOccasionKey} (đợt mới giá trị cao hơn -> xét dự phòng lần 2)`
        );
      } else {
        warningFlag = "SAME_OCCASION_HIGHER_OR_EQUAL";
        warnings.push(
          `Đã nhận suất ${maxSameOccasion.toLocaleString("vi-VN")}đ trong cùng dịp ${params.programOccasionKey}`
        );
      }
    }

    if (receivedCountThisYear >= params.config.yearlyWarningThreshold) {
      if (warningFlag === "NONE") warningFlag = "OVER_3_YEAR";
      warnings.push(
        `Đã nhận hỗ trợ ${receivedCountThisYear} lần trong năm ${currentYear}`
      );
    } else if (receivedInWindow) {
      if (warningFlag === "NONE") warningFlag = "RECENT_3_MONTHS";
      warnings.push(
        `Đã nhận hỗ trợ trong ${params.config.duplicateCheckMonths} tháng gần đây`
      );
    }

    const totalScore = baseScore + bonusScore - penaltyScore;

    return {
      citizenId: c.citizenId,
      allocationType: "EXCLUDED",
      baseScore,
      bonusScore,
      penaltyScore,
      totalScore,
      receivedCountThisYear,
      receivedInWindow,
      warningFlag,
      warningMessage: warnings.length > 0 ? warnings.join("; ") : null,
      sameOccasionReceived,
      groupCount: c.groupIds.length,
    };
  });

  // Sort by totalScore desc, then multi-group count desc, then fewer receipts this year
  evaluated.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.groupCount !== a.groupCount) return b.groupCount - a.groupCount;
    return a.receivedCountThisYear - b.receivedCountThisYear;
  });

  // Priority 1: Fill PRIMARY slots with people who haven't received in the same occasion
  let remainingSlots = Math.max(0, params.totalSlots);
  for (const item of evaluated) {
    if (!item.sameOccasionReceived && remainingSlots > 0) {
      item.allocationType = "PRIMARY";
      remainingSlots--;
    }
  }

  // Priority 2: If slots remain after exhausting non-duplicate candidates, put same-occasion candidates into RESERVE_SECOND_ROUND
  for (const item of evaluated) {
    if (item.sameOccasionReceived) {
      item.allocationType = "RESERVE_SECOND_ROUND";
    }
  }

  return evaluated.map(
    ({ sameOccasionReceived: _s, groupCount: _g, ...rest }) => rest
  );
}
