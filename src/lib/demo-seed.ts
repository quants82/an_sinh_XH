import { db } from "@/db";
import {
  citizenChanges,
  citizenGroups,
  citizens,
  supportGroups,
  supportHistory,
  supportPrograms,
  systemSettings,
  tasks,
  villages,
} from "@/db/schema";
import { formatCitizenCode, normalizeVietnameseName } from "./scoring";
import { writeAuditLog } from "./audit";
import { runAllocationForProgram } from "@/lib/program-allocator";

interface SampleCitizenSpec {
  fullName: string;
  birthYear: number;
  gender: "NAM" | "NU" | "KHAC";
  villageCode: string;
  recordType: "INDIVIDUAL" | "HOUSEHOLD_DISASTER";
  groupCodes: string[];
  hardshipSummary: string;
  localBonusScore: number;
  localBonusReason?: string;
  status?: "ACTIVE" | "TEMPORARY" | "PENDING_REVIEW";
  guardianNote?: string;
}

const SAMPLE_CITIZENS: SampleCitizenSpec[] = [
  {
    fullName: "Nguyễn Văn An (Mẫu)",
    birthYear: 1948,
    gender: "NAM",
    villageCode: "T01",
    recordType: "INDIVIDUAL",
    groupCodes: ["NCC", "HO_NGHEO", "BENH_HN"],
    hardshipSummary: "Người có công, hộ nghèo, bệnh hiểm nghèo",
    localBonusScore: 5,
    localBonusReason: "Không còn khả năng lao động, sống một mình",
  },
  {
    fullName: "Trần Thị Bình (Mẫu)",
    birthYear: 1954,
    gender: "NU",
    villageCode: "T01",
    recordType: "INDIVIDUAL",
    groupCodes: ["TNLS", "GIA_NEO_DON"],
    hardshipSummary: "Thân nhân liệt sĩ, người cao tuổi neo đơn",
    localBonusScore: 4,
    localBonusReason: "Tuổi cao, đi lại khó khăn",
  },
  {
    fullName: "Lê Minh Châu (Mẫu)",
    birthYear: 2015,
    gender: "NU",
    villageCode: "T02",
    recordType: "INDIVIDUAL",
    groupCodes: ["TRE_MO_COI", "HO_NGHEO"],
    hardshipSummary: "Trẻ mồ côi cha mẹ, ở với bà nội hộ nghèo",
    localBonusScore: 5,
    localBonusReason: "Hoàn cảnh đặc biệt khó khăn",
    guardianNote: "Người giám hộ: Bà nội Phạm Thị Lan",
  },
  {
    fullName: "Phạm Văn Dũng (Mẫu)",
    birthYear: 1978,
    gender: "NAM",
    villageCode: "T02",
    recordType: "INDIVIDUAL",
    groupCodes: ["KT_DBN", "HO_NGHEO"],
    hardshipSummary: "Khuyết tật đặc biệt nặng, hộ nghèo",
    localBonusScore: 3,
    localBonusReason: "Không có nguồn thu nhập ổn định",
  },
  {
    fullName: "Hoàng Thị Én (Mẫu)",
    birthYear: 1966,
    gender: "NU",
    villageCode: "T03",
    recordType: "HOUSEHOLD_DISASTER",
    groupCodes: ["HOA_HOAN", "CAN_NGHEO"],
    hardshipSummary: "Hộ cận nghèo bị hỏa hoạn thiệt hại nhà ở",
    localBonusScore: 4,
    localBonusReason: "Thiệt hại nặng tài sản sinh hoạt",
    status: "TEMPORARY",
  },
  {
    fullName: "Vũ Đình Giang (Mẫu)",
    birthYear: 1982,
    gender: "NAM",
    villageCode: "T03",
    recordType: "INDIVIDUAL",
    groupCodes: ["TNLD", "CAN_NGHEO"],
    hardshipSummary: "Tai nạn lao động giảm khả năng lao động, hộ cận nghèo",
    localBonusScore: 3,
    localBonusReason: "Nuôi 2 con nhỏ đang đi học",
  },
  {
    fullName: "Đặng Thị Hoa (Mẫu)",
    birthYear: 1950,
    gender: "NU",
    villageCode: "T04",
    recordType: "INDIVIDUAL",
    groupCodes: ["GIA_NEO_DON", "BENH_HN"],
    hardshipSummary: "Người cao tuổi neo đơn mắc bệnh hiểm nghèo",
    localBonusScore: 4,
    localBonusReason: "Nhà có người bệnh nặng thường xuyên",
  },
  {
    fullName: "Bùi Văn Khải (Mẫu)",
    birthYear: 1972,
    gender: "NAM",
    villageCode: "T04",
    recordType: "HOUSEHOLD_DISASTER",
    groupCodes: ["THIEN_TAI", "HO_NGHEO"],
    hardshipSummary: "Hộ nghèo bị ngập úng mất trắng hoa màu",
    localBonusScore: 3,
    localBonusReason: "Mất nguồn thu vụ mùa",
    status: "PENDING_REVIEW",
  },
  {
    fullName: "Ngô Thị Liên (Mẫu)",
    birthYear: 1988,
    gender: "NU",
    villageCode: "T05",
    recordType: "INDIVIDUAL",
    groupCodes: ["HO_NGHEO", "KT_NANG"],
    hardshipSummary: "Hộ nghèo, khuyết tật nặng",
    localBonusScore: 2,
  },
  {
    fullName: "Đỗ Văn Mạnh (Mẫu)",
    birthYear: 1961,
    gender: "NAM",
    villageCode: "T05",
    recordType: "INDIVIDUAL",
    groupCodes: ["NCC", "BENH_NN"],
    hardshipSummary: "Người có công, mắc bệnh nghề nghiệp",
    localBonusScore: 2,
  },
  {
    fullName: "Phan Thị Nga (Mẫu)",
    birthYear: 2013,
    gender: "NU",
    villageCode: "T06",
    recordType: "INDIVIDUAL",
    groupCodes: ["TRE_MO_COI", "KT_NANG"],
    hardshipSummary: "Trẻ em mồ côi, khuyết tật nặng",
    localBonusScore: 5,
    guardianNote: "Người giám hộ: Bác ruột Phan Văn Hùng",
  },
  {
    fullName: "Lý Văn Oanh (Mẫu)",
    birthYear: 1975,
    gender: "NAM",
    villageCode: "T07",
    recordType: "HOUSEHOLD_DISASTER",
    groupCodes: ["DICH_BENH", "CAN_NGHEO"],
    hardshipSummary: "Hộ cận nghèo thiệt hại chăn nuôi do dịch bệnh",
    localBonusScore: 2,
    status: "TEMPORARY",
  },
  {
    fullName: "Trịnh Thị Phúc (Mẫu)",
    birthYear: 1945,
    gender: "NU",
    villageCode: "T08",
    recordType: "INDIVIDUAL",
    groupCodes: ["GIA_NEO_DON", "HO_NGHEO"],
    hardshipSummary: "Cụ bà neo đơn, hộ nghèo",
    localBonusScore: 4,
  },
  {
    fullName: "Mai Văn Quân (Mẫu)",
    birthYear: 1985,
    gender: "NAM",
    villageCode: "T09",
    recordType: "INDIVIDUAL",
    groupCodes: ["BTXH", "CAN_NGHEO"],
    hardshipSummary: "Đối tượng bảo trợ xã hội, hộ cận nghèo",
    localBonusScore: 1,
  },
  {
    fullName: "Nguyễn Thị Rạng (Mẫu)",
    birthYear: 1969,
    gender: "NU",
    villageCode: "T10",
    recordType: "INDIVIDUAL",
    groupCodes: ["HO_NGHEO", "BENH_HN"],
    hardshipSummary: "Hộ nghèo, điều trị bệnh hiểm nghèo dài ngày",
    localBonusScore: 4,
  },
  {
    fullName: "Cao Văn Sơn (Mẫu)",
    birthYear: 1958,
    gender: "NAM",
    villageCode: "T11",
    recordType: "INDIVIDUAL",
    groupCodes: ["NCC"],
    hardshipSummary: "Người có công với cách mạng",
    localBonusScore: 1,
  },
  {
    fullName: "Đinh Thị Tâm (Mẫu)",
    birthYear: 1990,
    gender: "NU",
    villageCode: "T12",
    recordType: "INDIVIDUAL",
    groupCodes: ["KT_DBN", "CAN_NGHEO"],
    hardshipSummary: "Khuyết tật đặc biệt nặng, cận nghèo",
    localBonusScore: 3,
  },
  {
    fullName: "Tạ Văn Uy (Mẫu)",
    birthYear: 1974,
    gender: "NAM",
    villageCode: "T13",
    recordType: "INDIVIDUAL",
    groupCodes: ["HO_NGHEO"],
    hardshipSummary: "Hộ nghèo thiếu đất sản xuất",
    localBonusScore: 2,
  },
  {
    fullName: "Hồ Thị Vân (Mẫu)",
    birthYear: 1963,
    gender: "NU",
    villageCode: "T14",
    recordType: "INDIVIDUAL",
    groupCodes: ["CAN_NGHEO", "BENH_HN"],
    hardshipSummary: "Hộ cận nghèo, mắc bệnh hiểm nghèo",
    localBonusScore: 3,
  },
  {
    fullName: "Dương Văn Xuân (Mẫu)",
    birthYear: 2016,
    gender: "NAM",
    villageCode: "T15",
    recordType: "INDIVIDUAL",
    groupCodes: ["TRE_MO_COI"],
    hardshipSummary: "Trẻ mồ côi cha, gia đình khó khăn",
    localBonusScore: 3,
    guardianNote: "Mẹ: Lê Thị Mai",
  },
];

export async function seedDemoDataset(actorId: number, actorName: string) {
  const existing = await db.select({ id: citizens.id }).from(citizens).limit(1);
  if (existing.length > 0) {
    return {
      alreadyHasData: true,
      citizensCreated: 0,
      message: "Hệ thống đã có dữ liệu hồ sơ. Không ghi đè dữ liệu hiện có.",
    };
  }

  const [settingsRows, villageRows, groupRows] = await Promise.all([
    db.select().from(systemSettings).limit(1),
    db.select().from(villages),
    db.select().from(supportGroups),
  ]);

  const communeCode = settingsRows[0]?.communeCode || "BA";
  const vByCode = new Map(villageRows.map((v) => [v.code, v]));
  const gByCode = new Map(groupRows.map((g) => [g.code, g]));

  const countPerVillage = new Map<string, number>();
  const createdCitizens: Array<{ id: number; fullName: string; villageId: number }> = [];

  for (const spec of SAMPLE_CITIZENS) {
    const v = vByCode.get(spec.villageCode) ?? villageRows[0];
    const seq = (countPerVillage.get(v.code) ?? 0) + 1;
    countPerVillage.set(v.code, seq);
    const citizenCode = formatCitizenCode(communeCode, v.code, seq);

    const tempExpiresAt =
      spec.status === "TEMPORARY"
        ? new Date(Date.now() + 120 * 24 * 3600 * 1000)
        : spec.status === "PENDING_REVIEW"
        ? new Date(Date.now() - 5 * 24 * 3600 * 1000)
        : null;

    const [created] = await db
      .insert(citizens)
      .values({
        citizenCode,
        recordType: spec.recordType,
        fullName: spec.fullName,
        normalizedName: normalizeVietnameseName(spec.fullName),
        birthYear: spec.birthYear,
        gender: spec.gender,
        villageId: v.id,
        addressDetail: `Xóm 1, ${v.name}`,
        guardianNote: spec.guardianNote ?? null,
        hardshipSummary: spec.hardshipSummary,
        status: spec.status ?? "ACTIVE",
        localBonusScore: spec.localBonusScore,
        localBonusReason: spec.localBonusReason ?? null,
        tempExpiresAt,
        createdById: actorId,
        updatedById: actorId,
      })
      .returning();

    const groupEntities = spec.groupCodes
      .map((code) => gByCode.get(code))
      .filter((g): g is NonNullable<typeof g> => Boolean(g));

    if (groupEntities.length > 0) {
      await db.insert(citizenGroups).values(
        groupEntities.map((g) => ({
          citizenId: created.id,
          groupId: g.id,
        }))
      );
    }

    await db.insert(citizenChanges).values({
      citizenId: created.id,
      changeType: "CREATED",
      summary: `Nạp hồ sơ mẫu giả định (${groupEntities.map((g) => g.name).join(", ")})`,
      actorId,
    });

    createdCitizens.push({
      id: created.id,
      fullName: created.fullName,
      villageId: v.id,
    });
  }

  // Tạo sẵn 1 chương trình đã trao quà để minh họa lịch sử & chống trùng cùng dịp
  const now = new Date();
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const fourMonthsAgo = new Date(now);
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

  const [pastProgram] = await db
    .insert(supportPrograms)
    .values({
      programCode: `HT-${now.getFullYear()}-TET-01`,
      title: "Tặng quà Tết Yêu Thương đợt 1 (Mẫu)",
      occasionKey: `TET_${now.getFullYear()}`,
      donorName: "Hội Chữ thập đỏ (Mẫu)",
      supportKind: "GIFT",
      unitValue: 500000,
      tier: "MEDIUM",
      totalSlots: 5,
      filterGroupIdsJson: "[]",
      filterVillageIdsJson: "[]",
      status: "APPROVED",
      lockedById: actorId,
      lockedAt: oneMonthAgo,
      approvedById: actorId,
      approvedAt: oneMonthAgo,
      createdById: actorId,
    })
    .returning();

  // Ghi nhận lịch sử nhận quà mẫu cho 4 người (trong đó người #0 nhận 3 lần trong năm để thấy cảnh báo đỏ!)
  if (createdCitizens.length >= 6) {
    await db.insert(supportHistory).values([
      {
        citizenId: createdCitizens[0].id,
        programId: pastProgram.id,
        programCode: pastProgram.programCode,
        programTitle: pastProgram.title,
        occasionKey: pastProgram.occasionKey,
        donorName: pastProgram.donorName,
        supportKind: "GIFT",
        giftDetails: "10kg gạo + 1 hộp bánh + 300.000đ tiền mặt",
        valueVnd: 500000,
        tier: "MEDIUM",
        receivedAt: oneMonthAgo,
        recordedById: actorId,
      },
      {
        citizenId: createdCitizens[0].id,
        programCode: `HT-${now.getFullYear()}-Q1-01`,
        programTitle: "Hỗ trợ khám chữa bệnh (Mẫu)",
        occasionKey: `Y_TE_${now.getFullYear()}`,
        donorName: "Quỹ Vì người nghèo",
        supportKind: "CASH",
        giftDetails: "Tiền mặt hỗ trợ thuốc men",
        valueVnd: 400000,
        tier: "SMALL",
        receivedAt: fourMonthsAgo,
        recordedById: actorId,
      },
      {
        citizenId: createdCitizens[0].id,
        programCode: `HT-${now.getFullYear()}-Q2-01`,
        programTitle: "Quà an sinh định kỳ (Mẫu)",
        occasionKey: `AN_SINH_${now.getFullYear()}`,
        donorName: "Nhóm Thiện nguyện Sen Hồng",
        supportKind: "GIFT",
        giftDetails: "Nhu yếu phẩm thiết yếu",
        valueVnd: 350000,
        tier: "SMALL",
        receivedAt: fourMonthsAgo,
        recordedById: actorId,
      },
      {
        citizenId: createdCitizens[1].id,
        programId: pastProgram.id,
        programCode: pastProgram.programCode,
        programTitle: pastProgram.title,
        occasionKey: pastProgram.occasionKey,
        donorName: pastProgram.donorName,
        supportKind: "GIFT",
        giftDetails: "Quà Tết 500.000đ",
        valueVnd: 500000,
        tier: "MEDIUM",
        receivedAt: oneMonthAgo,
        recordedById: actorId,
      },
      {
        citizenId: createdCitizens[4].id,
        programId: pastProgram.id,
        programCode: pastProgram.programCode,
        programTitle: pastProgram.title,
        occasionKey: pastProgram.occasionKey,
        donorName: pastProgram.donorName,
        supportKind: "CASH",
        giftDetails: "Hỗ trợ khẩn cấp khắc phục hỏa hoạn",
        valueVnd: 2500000,
        tier: "LARGE",
        receivedAt: oneMonthAgo,
        recordedById: actorId,
      },
    ]);
  }

  // Tạo đợt hỗ trợ thứ 2 đang chờ lọc/duyệt (cùng dịp Tết, giá trị cao hơn 1.000.000đ để test tự động lọc trùng + dự phòng lần 2!)
  const [nextProgram] = await db
    .insert(supportPrograms)
    .values({
      programCode: `HT-${now.getFullYear()}-TET-02`,
      title: "Quà Doanh nghiệp tài trợ Tết đợt 2 (Mẫu 1.000.000đ)",
      occasionKey: `TET_${now.getFullYear()}`,
      donorName: "Công ty TNHH An Phát (Mẫu)",
      supportKind: "CASH",
      unitValue: 1000000,
      tier: "MEDIUM",
      totalSlots: 8,
      filterGroupIdsJson: "[]",
      filterVillageIdsJson: "[]",
      status: "LOCKED",
      lockedById: actorId,
      lockedAt: now,
      createdById: actorId,
    })
    .returning();

  await runAllocationForProgram(nextProgram.id);

  await db.insert(tasks).values([
    {
      title: "Rà soát lại hồ sơ hộ thiệt hại thiên tai hết hạn tạm thời (Thôn 4)",
      description:
        "Kiểm tra hộ ông Bùi Văn Khải (Mẫu) xem đã khắc phục sản xuất chưa để đề xuất gia hạn hoặc kết thúc.",
      taskType: "UPDATE_EXPIRED_TEMP",
      villageId: vByCode.get("T04")?.id ?? null,
      assignedToId: actorId,
      assignedById: actorId,
      priority: "HIGH",
      status: "NEW",
    },
  ]);

  await writeAuditLog({
    actorId,
    actorName,
    action: "SEED_DEMO_DATA",
    entity: "system",
    entityId: "demo",
    newValue: `Đã nạp ${createdCitizens.length} hồ sơ mẫu, 2 đợt hỗ trợ và lịch sử mẫu`,
  });

  return {
    alreadyHasData: false,
    citizensCreated: createdCitizens.length,
    message: `Đã nạp thành công ${createdCitizens.length} hồ sơ mẫu (đã gán điểm 3 lớp), lịch sử nhận quà và 2 đợt hỗ trợ mẫu!`,
  };
}
