import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  citizenChanges,
  citizenGroups,
  citizens,
  evidenceFiles,
  supportGroups,
  supportHistory,
  systemSettings,
  villages,
} from "@/db/schema";
import { and, desc, eq, lt } from "drizzle-orm";
import { canEditCitizens, getCurrentUser } from "@/lib/auth";
import { formatCitizenCode, normalizeVietnameseName } from "@/lib/scoring";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const CreateCitizenSchema = z.object({
  recordType: z.enum(["INDIVIDUAL", "HOUSEHOLD_DISASTER"]).default("INDIVIDUAL"),
  fullName: z.string().min(2, "Họ tên tối thiểu 2 ký tự"),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()),
  gender: z.enum(["NAM", "NU", "KHAC"]).default("KHAC"),
  villageId: z.number().int().positive(),
  addressDetail: z.string().optional().default(""),
  phone: z.string().optional().nullable(),
  guardianNote: z.string().optional().nullable(),
  hardshipSummary: z.string().optional().default(""),
  status: z
    .enum(["ACTIVE", "TEMPORARY", "PENDING_REVIEW", "ENDED", "MOVED_OUT", "DECEASED"])
    .default("ACTIVE"),
  localBonusScore: z.number().int().min(0).max(50).optional().default(0),
  localBonusReason: z.string().optional().nullable(),
  tempExpiresAt: z.string().optional().nullable(),
  groupIds: z.array(z.number().int().positive()).min(1, "Chọn ít nhất 1 nhóm đối tượng"),
});

let lastTempSweepAt = 0;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  // Auto-transition expired temporary records at most once per 5 minutes per worker
  const nowMs = Date.now();
  if (nowMs - lastTempSweepAt > 5 * 60 * 1000) {
    lastTempSweepAt = nowMs;
    await db
      .update(citizens)
      .set({ status: "PENDING_REVIEW", updatedAt: new Date() })
      .where(
        and(
          eq(citizens.status, "TEMPORARY"),
          lt(citizens.tempExpiresAt, new Date())
        )
      );
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("q")?.trim().toLowerCase() || "";
  const villageFilter = url.searchParams.get("villageId");
  const statusFilter = url.searchParams.get("status");
  const groupFilter = url.searchParams.get("groupId");
  const pageRaw = url.searchParams.get("page");
  const pageSizeRaw = url.searchParams.get("pageSize");
  const page = pageRaw ? Math.max(1, Number(pageRaw) || 1) : null;
  const pageSize = pageSizeRaw ? Math.min(200, Math.max(10, Number(pageSizeRaw) || 50)) : 50;

  const [citizenRows, villageRows, groupRows, cgRows, historyRows, evidenceRows] =
    await Promise.all([
      db.select().from(citizens).orderBy(desc(citizens.id)),
      db.select().from(villages),
      db.select().from(supportGroups),
      db.select().from(citizenGroups),
      db.select().from(supportHistory),
      db.select().from(evidenceFiles),
    ]);

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

  const historyCountByCitizen = new Map<number, number>();
  const currentYear = new Date().getFullYear();
  for (const h of historyRows) {
    if (new Date(h.receivedAt).getFullYear() === currentYear) {
      historyCountByCitizen.set(
        h.citizenId,
        (historyCountByCitizen.get(h.citizenId) ?? 0) + 1
      );
    }
  }

  const evidenceCountByCitizen = new Map<number, number>();
  for (const ev of evidenceRows) {
    if (ev.citizenId) {
      evidenceCountByCitizen.set(
        ev.citizenId,
        (evidenceCountByCitizen.get(ev.citizenId) ?? 0) + 1
      );
    }
  }

  const isVillageScoped = user.role === "VILLAGE_HEAD";
  const filtered = citizenRows.filter((c) => {
    if (isVillageScoped && user.villageId && c.villageId !== user.villageId) {
      return false;
    }
    if (villageFilter && c.villageId !== Number(villageFilter)) {
      return false;
    }
    if (statusFilter && c.status !== statusFilter) {
      return false;
    }
    const cGroups = groupsByCitizen.get(c.id) ?? [];
    if (groupFilter && !cGroups.some((g) => g.id === Number(groupFilter))) {
      return false;
    }
    if (search) {
      const hay = `${c.citizenCode} ${c.fullName} ${c.normalizedName} ${c.hardshipSummary}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const total = filtered.length;
  const totalPages = page ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const targetRows = page
    ? filtered.slice((page - 1) * pageSize, page * pageSize)
    : filtered;

  const items = targetRows.map((c) => {
    const v = vMap.get(c.villageId);
    const cGroups = groupsByCitizen.get(c.id) ?? [];
    const baseScore = cGroups.reduce((s, g) => s + g.baseScore, 0);

    // Trưởng thôn chỉ xem thông tin tối giản đúng theo quy định Link 2
    if (isVillageScoped) {
      return {
        id: c.id,
        citizenCode: c.citizenCode,
        recordType: c.recordType,
        fullName: c.fullName,
        birthYear: c.birthYear,
        gender: c.gender,
        villageId: c.villageId,
        villageName: v?.name ?? "",
        addressDetail: c.addressDetail,
        guardianNote: c.guardianNote,
        hardshipSummary: c.hardshipSummary,
        status: c.status,
        groups: cGroups.map((g) => ({ id: g.id, name: g.name, code: g.code })),
        evidenceCount: evidenceCountByCitizen.get(c.id) ?? 0,
      };
    }

    return {
      id: c.id,
      citizenCode: c.citizenCode,
      recordType: c.recordType,
      fullName: c.fullName,
      birthYear: c.birthYear,
      gender: c.gender,
      villageId: c.villageId,
      villageName: v?.name ?? "",
      villageCode: v?.code ?? "",
      addressDetail: c.addressDetail,
      phone: c.phone,
      guardianNote: c.guardianNote,
      hardshipSummary: c.hardshipSummary,
      status: c.status,
      localBonusScore: c.localBonusScore,
      localBonusReason: c.localBonusReason,
      baseScore,
      estimatedScore: baseScore + c.localBonusScore,
      tempExpiresAt: c.tempExpiresAt,
      groups: cGroups.map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        baseScore: g.baseScore,
      })),
      receivedCountThisYear: historyCountByCitizen.get(c.id) ?? 0,
      evidenceCount: evidenceCountByCitizen.get(c.id) ?? 0,
      updatedAt: c.updatedAt,
    };
  });

  return NextResponse.json({
    citizens: items,
    total,
    page: page ?? 1,
    pageSize: page ? pageSize : total,
    totalPages,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canEditCitizens(user.role)) {
    return NextResponse.json(
      { error: "Không có quyền thêm đối tượng" },
      { status: 403 }
    );
  }

  const [settingsRows] = await db.select().from(systemSettings).limit(1);
  if (settingsRows?.requireDriveToSave && !settingsRows.driveConnected) {
    return NextResponse.json(
      {
        error:
          "Hệ thống đang bật yêu cầu Lãnh đạo kết nối Google Drive trước khi lưu dữ liệu.",
      },
      { status: 412 }
    );
  }

  const body = await req.json();
  const parsed = CreateCitizenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (user.role === "VILLAGE_HEAD" && user.villageId !== data.villageId) {
    return NextResponse.json(
      { error: "Trưởng thôn chỉ được phép nhập hồ sơ thuộc thôn mình." },
      { status: 403 }
    );
  }

  const normalizedName = normalizeVietnameseName(data.fullName);

  // Kiểm tra trùng: cùng Tên chuẩn hóa + Năm sinh + Thôn
  const duplicates = await db
    .select({ id: citizens.id, citizenCode: citizens.citizenCode, fullName: citizens.fullName })
    .from(citizens)
    .where(
      and(
        eq(citizens.normalizedName, normalizedName),
        eq(citizens.birthYear, data.birthYear),
        eq(citizens.villageId, data.villageId)
      )
    );

  if (duplicates.length > 0 && !data.guardianNote?.trim()) {
    return NextResponse.json(
      {
        error: `Phát hiện hồ sơ trùng Họ tên + Năm sinh + Thôn (${duplicates[0].citizenCode}). Để tiếp tục lưu, bắt buộc bổ sung tên Cha/Mẹ hoặc Người giám hộ vào cột Ghi chú.`,
        duplicateDetected: true,
        existingCode: duplicates[0].citizenCode,
      },
      { status: 409 }
    );
  }

  const [villageRow] = await db
    .select()
    .from(villages)
    .where(eq(villages.id, data.villageId))
    .limit(1);

  if (!villageRow) {
    return NextResponse.json({ error: "Thôn không tồn tại" }, { status: 400 });
  }

  // Generate unique citizen code BA-T01-000001
  const existingInVillage = await db
    .select({ id: citizens.id })
    .from(citizens)
    .where(eq(citizens.villageId, data.villageId));

  let seq = existingInVillage.length + 1;
  let citizenCode = formatCitizenCode(
    settingsRows?.communeCode || "BA",
    villageRow.code,
    seq
  );
  // Ensure uniqueness even if deleted rows existed
  while (
    (
      await db
        .select({ id: citizens.id })
        .from(citizens)
        .where(eq(citizens.citizenCode, citizenCode))
        .limit(1)
    ).length > 0
  ) {
    seq++;
    citizenCode = formatCitizenCode(
      settingsRows?.communeCode || "BA",
      villageRow.code,
      seq
    );
  }

  // Check if any selected group defaults to temporary duration
  const allGroups = await db.select().from(supportGroups);
  const selectedGroups = allGroups.filter((g) => data.groupIds.includes(g.id));
  let finalStatus = data.status;
  let tempExpiresAt: Date | null = data.tempExpiresAt
    ? new Date(data.tempExpiresAt)
    : null;

  const tempGroup = selectedGroups.find(
    (g) => g.isTemporaryDefault && g.defaultDurationMonths
  );
  if (tempGroup && !tempExpiresAt && finalStatus === "ACTIVE") {
    finalStatus = "TEMPORARY";
    const d = new Date();
    d.setMonth(d.getMonth() + (tempGroup.defaultDurationMonths ?? 6));
    tempExpiresAt = d;
  }

  const allowBonus =
    user.role === "OWNER" ||
    user.role === "LEADER" ||
    user.role === "DEPT_HEAD";

  const [created] = await db
    .insert(citizens)
    .values({
      citizenCode,
      recordType: data.recordType,
      fullName: data.fullName.trim(),
      normalizedName,
      birthYear: data.birthYear,
      gender: data.gender,
      villageId: data.villageId,
      addressDetail: data.addressDetail.trim(),
      phone: data.phone?.trim() || null,
      guardianNote: data.guardianNote?.trim() || null,
      hardshipSummary:
        data.hardshipSummary.trim() ||
        selectedGroups.map((g) => g.name).join(", "),
      status: finalStatus,
      localBonusScore: allowBonus ? data.localBonusScore : 0,
      localBonusReason: allowBonus ? data.localBonusReason?.trim() || null : null,
      tempExpiresAt,
      createdById: user.id,
      updatedById: user.id,
    })
    .returning();

  await db.insert(citizenGroups).values(
    selectedGroups.map((g) => ({
      citizenId: created.id,
      groupId: g.id,
    }))
  );

  await db.insert(citizenChanges).values({
    citizenId: created.id,
    changeType: "CREATED",
    summary: `Tạo mới hồ sơ ${created.citizenCode} (${selectedGroups.map((g) => g.name).join(", ")})`,
    actorId: user.id,
  });

  await writeAuditLog({
    actorId: user.id,
    actorName: user.fullName,
    action: "CREATE_CITIZEN",
    entity: "citizens",
    entityId: created.id,
    newValue: `${created.citizenCode} - ${created.fullName}`,
  });

  return NextResponse.json({ ok: true, citizen: created });
}
