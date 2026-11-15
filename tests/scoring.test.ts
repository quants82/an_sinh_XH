import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifySupportTier,
  computeProgramAllocations,
  formatCitizenCode,
  normalizeVietnameseName,
} from "../src/lib/scoring";
import { decryptSecret, encryptSecret } from "../src/lib/crypto";

describe("Citizen coding & name normalization", () => {
  it("normalizes Vietnamese names without accents", () => {
    assert.equal(
      normalizeVietnameseName("  Nguyễn   Văn  Đức "),
      "nguyen van duc"
    );
  });

  it("formats citizen code independent of village name length", () => {
    assert.equal(formatCitizenCode("BA", "T01", 1), "BA-T01-000001");
    assert.equal(formatCitizenCode("ba", "T17", 125), "BA-T17-000125");
  });

  it("classifies support tiers properly", () => {
    assert.equal(classifySupportTier(300000), "SMALL");
    assert.equal(classifySupportTier(500000), "MEDIUM");
    assert.equal(classifySupportTier(2000000), "MEDIUM");
    assert.equal(classifySupportTier(2500000), "LARGE");
  });
});

describe("AES-256-GCM token encryption", () => {
  it("encrypts and decrypts Google Drive refresh tokens safely", () => {
    const token = "1//0gFakeRefreshTokenForTesting123456";
    const encrypted = encryptSecret(token);
    assert.notEqual(encrypted, token);
    assert.equal(decryptSecret(encrypted), token);
  });
});

describe("3-layer priority scoring & same-occasion deduplication", () => {
  const baseConfig = {
    duplicateCheckMonths: 3,
    smallSupportPenalty: 5,
    largeSupportPenalty: 10,
    yearlyWarningThreshold: 3,
  };

  it("prioritizes multi-group candidates and pushes same-occasion recipients to reserve", () => {
    const now = new Date("2026-01-20T00:00:00Z");
    const candidates = [
      {
        citizenId: 1,
        citizenCode: "BA-T01-000001",
        fullName: "Ông A (nhiều nhóm, chưa nhận Tết)",
        birthYear: 1955,
        villageId: 1,
        villageCode: "T01",
        villageName: "Thôn 1",
        hardshipSummary: "Người có công + Hộ nghèo",
        status: "ACTIVE",
        localBonusScore: 3,
        groupIds: [1, 3],
        groupNames: ["Người có công", "Hộ nghèo"],
        groupScores: [10, 10],
      },
      {
        citizenId: 2,
        citizenCode: "BA-T01-000002",
        fullName: "Bà B (đã nhận 500k dịp Tết)",
        birthYear: 1960,
        villageId: 1,
        villageCode: "T01",
        villageName: "Thôn 1",
        hardshipSummary: "Người có công + Hộ nghèo + Bệnh hiểm nghèo",
        status: "ACTIVE",
        localBonusScore: 5,
        groupIds: [1, 3, 7],
        groupNames: ["Người có công", "Hộ nghèo", "Bệnh hiểm nghèo"],
        groupScores: [10, 10, 9],
      },
      {
        citizenId: 3,
        citizenCode: "BA-T02-000001",
        fullName: "Anh C (1 nhóm, chưa nhận Tết)",
        birthYear: 1980,
        villageId: 2,
        villageCode: "T02",
        villageName: "Thôn 2",
        hardshipSummary: "Hộ cận nghèo",
        status: "ACTIVE",
        localBonusScore: 0,
        groupIds: [4],
        groupNames: ["Hộ cận nghèo"],
        groupScores: [6],
      },
    ];

    const histories = [
      {
        citizenId: 2,
        occasionKey: "TET_2026",
        valueVnd: 500000,
        tier: "MEDIUM",
        receivedAt: new Date("2026-01-10T00:00:00Z"),
      },
    ];

    const results = computeProgramAllocations({
      candidates,
      histories,
      programOccasionKey: "TET_2026",
      programUnitValue: 1000000,
      totalSlots: 2,
      filterGroupIds: [],
      filterVillageIds: [],
      config: baseConfig,
      now,
    });

    const a = results.find((r) => r.citizenId === 1)!;
    const b = results.find((r) => r.citizenId === 2)!;
    const c = results.find((r) => r.citizenId === 3)!;

    assert.equal(a.allocationType, "PRIMARY");
    assert.equal(a.totalScore, 23);

    // Bà B dù tổng điểm cao hơn nhưng đã nhận trong cùng dịp TET_2026 -> vào dự phòng lần 2
    assert.equal(b.allocationType, "RESERVE_SECOND_ROUND");
    assert.equal(b.warningFlag, "SAME_OCCASION_LOWER");

    // Anh C chưa nhận -> được ưu tiên suất chính thức thứ 2
    assert.equal(c.allocationType, "PRIMARY");
  });

  it("flags >3 receipts per year", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const candidates = [
      {
        citizenId: 10,
        citizenCode: "BA-T03-000001",
        fullName: "Hộ D",
        birthYear: 1970,
        villageId: 3,
        villageCode: "T03",
        villageName: "Thôn 3",
        hardshipSummary: "Hộ nghèo",
        status: "ACTIVE",
        localBonusScore: 0,
        groupIds: [3],
        groupNames: ["Hộ nghèo"],
        groupScores: [10],
      },
    ];
    const histories = [
      { citizenId: 10, occasionKey: "Q1", valueVnd: 300000, tier: "SMALL", receivedAt: new Date("2026-01-15") },
      { citizenId: 10, occasionKey: "Q2", valueVnd: 300000, tier: "SMALL", receivedAt: new Date("2026-04-15") },
      { citizenId: 10, occasionKey: "Q3", valueVnd: 300000, tier: "SMALL", receivedAt: new Date("2026-08-20") },
    ];
    const results = computeProgramAllocations({
      candidates,
      histories,
      programOccasionKey: "Q4",
      programUnitValue: 500000,
      totalSlots: 5,
      filterGroupIds: [],
      filterVillageIds: [],
      config: baseConfig,
      now,
    });
    assert.equal(results[0].receivedCountThisYear, 3);
    assert.equal(results[0].warningFlag, "OVER_3_YEAR");
    assert.equal(results[0].penaltyScore, 5);
  });
});
