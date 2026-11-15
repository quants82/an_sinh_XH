import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, ensureDbReady } from "@/db";
import { supportGroups } from "@/db/schema";
import { canLockPrograms, getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  buildScoringRulesWorkbook,
  parseScoringRulesWorkbook,
} from "@/lib/excel";

export async function GET() {
  await ensureDbReady();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const groupRows = await db
    .select()
    .from(supportGroups)
    .orderBy(asc(supportGroups.sortOrder));

  const buf = await buildScoringRulesWorkbook(
    groupRows.map((g) => ({
      code: g.code,
      name: g.name,
      baseScore: g.baseScore,
      isActive: g.isActive,
      defaultDurationMonths: g.defaultDurationMonths,
    }))
  );

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Bang_Diem_Doi_Tuong_Lanh_Dao.xlsx"`,
    },
  });
}

export async function POST(req: Request) {
  await ensureDbReady();
  const user = await getCurrentUser();
  if (!user || !canLockPrograms(user.role)) {
    return NextResponse.json(
      { error: "Chỉ Lãnh đạo / Trưởng phòng mới có quyền nhập Bảng điểm" },
      { status: 403 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Vui lòng chọn file Excel Bảng điểm (.xlsx)" },
      { status: 400 }
    );
  }

  let parsedRows;
  try {
    const arrBuf = await file.arrayBuffer();
    parsedRows = await parseScoringRulesWorkbook(arrBuf);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "File Bảng điểm không hợp lệ" },
      { status: 400 }
    );
  }

  const existing = await db.select().from(supportGroups);
  const byCode = new Map(existing.map((g) => [g.code.toUpperCase(), g]));
  let maxSort = existing.reduce((m, g) => Math.max(m, g.sortOrder), 0);

  let updatedCount = 0;
  let createdCount = 0;

  for (const r of parsedRows) {
    const cur = byCode.get(r.code);
    if (cur) {
      await db
        .update(supportGroups)
        .set({
          name: r.name,
          baseScore: r.baseScore,
          isActive: r.isActive,
          defaultDurationMonths: r.defaultDurationMonths,
        })
        .where(eq(supportGroups.id, cur.id));
      updatedCount++;
    } else {
      maxSort++;
      const [inserted] = await db
        .insert(supportGroups)
        .values({
          code: r.code,
          name: r.name,
          baseScore: r.baseScore,
          isActive: r.isActive,
          defaultDurationMonths: r.defaultDurationMonths,
          isTemporaryDefault: Boolean(r.defaultDurationMonths),
          isPhase2Optional: false,
          sortOrder: maxSort,
        })
        .returning();
      byCode.set(r.code, inserted);
      createdCount++;
    }
  }

  await writeAuditLog({
    actorId: user.id,
    actorName: user.fullName,
    action: "IMPORT_SCORING_TABLE",
    entity: "support_groups",
    entityId: "bulk",
    newValue: `Cập nhật ${updatedCount} nhóm, thêm mới ${createdCount} nhóm (tự động áp dụng điểm)`,
  });

  return NextResponse.json({
    ok: true,
    updatedCount,
    createdCount,
    totalProcessed: updatedCount + createdCount,
  });
}
