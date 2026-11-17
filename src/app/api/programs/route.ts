import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  supportAllocations,
  supportPrograms,
  systemSettings,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { canEditCitizens, getCurrentUser } from "@/lib/auth";
import { classifySupportTier } from "@/lib/scoring";
import { runAllocationForProgram } from "@/lib/program-allocator";
import { writeAuditLog } from "@/lib/audit";
import { persistCustomSupportKind } from "@/lib/support-kinds";
import { z } from "zod";

const CreateProgramSchema = z.object({
  programCode: z.string().min(3, "Mã chương trình tối thiểu 3 ký tự"),
  title: z.string().min(3, "Tên chương trình tối thiểu 3 ký tự"),
  occasionKey: z.string().min(2, "Mã dịp hỗ trợ không được trống (vd: TET_2026)"),
  donorName: z.string().min(2, "Tên đơn vị tài trợ không được trống"),
  supportKind: z.string().trim().min(1).default("GIFT"),
  customSupportKind: z.string().optional(),
  unitValue: z.number().int().min(0),
  totalSlots: z.number().int().min(1).max(5000),
  filterGroupIds: z.array(z.number().int().positive()).default([]),
  filterVillageIds: z.array(z.number().int().positive()).default([]),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  if (user.role === "VILLAGE_HEAD") {
    return NextResponse.json(
      { error: "Trưởng thôn không xem danh sách tổng hợp toàn xã" },
      { status: 403 }
    );
  }

  const [programRows, allocRows] = await Promise.all([
    db.select().from(supportPrograms).orderBy(desc(supportPrograms.id)),
    db.select().from(supportAllocations),
  ]);

  const countsByProgram = new Map<
    number,
    { primary: number; reserve: number; warnings: number }
  >();
  for (const a of allocRows) {
    const cur = countsByProgram.get(a.programId) ?? {
      primary: 0,
      reserve: 0,
      warnings: 0,
    };
    if (a.allocationType === "PRIMARY" || a.leaderExceptionApproved) {
      cur.primary++;
    } else if (a.allocationType === "RESERVE_SECOND_ROUND") {
      cur.reserve++;
    }
    if (a.warningFlag !== "NONE") cur.warnings++;
    countsByProgram.set(a.programId, cur);
  }

  return NextResponse.json({
    programs: programRows.map((p) => ({
      ...p,
      counts: countsByProgram.get(p.id) ?? {
        primary: 0,
        reserve: 0,
        warnings: 0,
      },
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canEditCitizens(user.role) || user.role === "VILLAGE_HEAD") {
    return NextResponse.json(
      { error: "Chỉ cán bộ cấp xã trở lên được tạo đợt hỗ trợ" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = CreateProgramSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const cleanCode = data.programCode.trim().toUpperCase();
  const existing = await db
    .select({ id: supportPrograms.id })
    .from(supportPrograms)
    .where(eq(supportPrograms.programCode, cleanCode))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Mã chương trình đã tồn tại" },
      { status: 409 }
    );
  }

  const [s] = await db.select().from(systemSettings).limit(1);
  const tier = classifySupportTier(
    data.unitValue,
    s?.smallSupportMax ?? 500000,
    s?.mediumSupportMax ?? 2000000
  );

  let resolvedSupportKind = data.supportKind;
  if (resolvedSupportKind === "OTHER" && data.customSupportKind?.trim()) {
    const saved = await persistCustomSupportKind(data.customSupportKind);
    resolvedSupportKind = saved.savedLabel;
  }

  const [created] = await db
    .insert(supportPrograms)
    .values({
      programCode: cleanCode,
      title: data.title.trim(),
      occasionKey: data.occasionKey.trim().toUpperCase(),
      donorName: data.donorName.trim(),
      supportKind: resolvedSupportKind,
      unitValue: data.unitValue,
      tier,
      totalSlots: data.totalSlots,
      filterGroupIdsJson: JSON.stringify(data.filterGroupIds),
      filterVillageIdsJson: JSON.stringify(data.filterVillageIds),
      status: "DRAFT",
      createdById: user.id,
    })
    .returning();

  await runAllocationForProgram(created.id);

  await writeAuditLog({
    actorId: user.id,
    actorName: user.fullName,
    action: "CREATE_PROGRAM",
    entity: "support_programs",
    entityId: created.id,
    newValue: `${created.programCode} (${created.totalSlots} suất)`,
  });

  return NextResponse.json({ ok: true, program: created });
}
