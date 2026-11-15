import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/db";
import {
  citizenChanges,
  citizenGroups,
  citizens,
  supportGroups,
  systemSettings,
  villages,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { canEditCitizens, getCurrentUser } from "@/lib/auth";
import { buildCitizenTemplateWorkbook } from "@/lib/excel";
import { formatCitizenCode, normalizeVietnameseName } from "@/lib/scoring";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const buf = await buildCitizenTemplateWorkbook();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Mau_Nhap_DoiTuong_AnSinh.xlsx"`,
    },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canEditCitizens(user.role)) {
    return NextResponse.json({ error: "Không có quyền import" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Vui lòng chọn file Excel (.xlsx)" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) {
    return NextResponse.json({ error: "File Excel trống" }, { status: 400 });
  }

  const [settingsRows, villageRows, groupRows] = await Promise.all([
    db.select().from(systemSettings).limit(1),
    db.select().from(villages),
    db.select().from(supportGroups),
  ]);
  const communeCode = settingsRows[0]?.communeCode || "BA";
  const vByCode = new Map(villageRows.map((v) => [v.code.toUpperCase(), v]));
  const gByCode = new Map(groupRows.map((g) => [g.code.toUpperCase(), g]));

  let importedCount = 0;
  const skippedRows: Array<{ row: number; reason: string }> = [];

  for (let rowNum = 2; rowNum <= ws.rowCount; rowNum++) {
    const row = ws.getRow(rowNum);
    const fullName = String(row.getCell(1).value ?? "").trim();
    if (!fullName) continue;

    const birthYear = Number(row.getCell(2).value);
    const genderRaw = String(row.getCell(3).value ?? "KHAC").trim().toUpperCase();
    const villageCode = String(row.getCell(4).value ?? "").trim().toUpperCase();
    const recordTypeRaw = String(row.getCell(5).value ?? "CA_NHAN").trim().toUpperCase();
    const groupCodesRaw = String(row.getCell(6).value ?? "").trim();
    const addressDetail = String(row.getCell(7).value ?? "").trim();
    const phone = String(row.getCell(8).value ?? "").trim();
    const hardshipSummary = String(row.getCell(9).value ?? "").trim();
    const guardianNote = String(row.getCell(10).value ?? "").trim();

    if (!birthYear || birthYear < 1900 || birthYear > new Date().getFullYear()) {
      skippedRows.push({ row: rowNum, reason: "Năm sinh không hợp lệ" });
      continue;
    }

    const v = vByCode.get(villageCode);
    if (!v) {
      skippedRows.push({ row: rowNum, reason: `Mã thôn '${villageCode}' không tồn tại` });
      continue;
    }

    if (user.role === "VILLAGE_HEAD" && user.villageId !== v.id) {
      skippedRows.push({ row: rowNum, reason: "Không thuộc thôn phụ trách" });
      continue;
    }

    const groupCodes = groupCodesRaw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const matchedGroups = groupCodes
      .map((c) => gByCode.get(c))
      .filter((g): g is NonNullable<typeof g> => Boolean(g));
    if (matchedGroups.length === 0) {
      skippedRows.push({ row: rowNum, reason: "Không khớp mã nhóm đối tượng hợp lệ" });
      continue;
    }

    const normalizedName = normalizeVietnameseName(fullName);
    const dupes = await db
      .select({ id: citizens.id })
      .from(citizens)
      .where(
        and(
          eq(citizens.normalizedName, normalizedName),
          eq(citizens.birthYear, birthYear),
          eq(citizens.villageId, v.id)
        )
      )
      .limit(1);

    if (dupes.length > 0 && !guardianNote) {
      skippedRows.push({
        row: rowNum,
        reason: "Trùng tên + năm sinh + thôn nhưng thiếu Ghi chú cha/mẹ/giám hộ",
      });
      continue;
    }

    const existingInVillage = await db
      .select({ id: citizens.id })
      .from(citizens)
      .where(eq(citizens.villageId, v.id));
    let seq = existingInVillage.length + 1;
    let citizenCode = formatCitizenCode(communeCode, v.code, seq);
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
      citizenCode = formatCitizenCode(communeCode, v.code, seq);
    }

    const [created] = await db
      .insert(citizens)
      .values({
        citizenCode,
        recordType:
          recordTypeRaw === "HO_THIEN_TAI" ? "HOUSEHOLD_DISASTER" : "INDIVIDUAL",
        fullName,
        normalizedName,
        birthYear,
        gender: ["NAM", "NU"].includes(genderRaw) ? genderRaw : "KHAC",
        villageId: v.id,
        addressDetail,
        phone: phone || null,
        guardianNote: guardianNote || null,
        hardshipSummary:
          hardshipSummary || matchedGroups.map((g) => g.name).join(", "),
        status: "ACTIVE",
        createdById: user.id,
        updatedById: user.id,
      })
      .returning();

    await db.insert(citizenGroups).values(
      matchedGroups.map((g) => ({
        citizenId: created.id,
        groupId: g.id,
      }))
    );

    await db.insert(citizenChanges).values({
      citizenId: created.id,
      changeType: "CREATED",
      summary: `Import Excel: ${created.citizenCode}`,
      actorId: user.id,
    });

    importedCount++;
  }

  await writeAuditLog({
    actorId: user.id,
    actorName: user.fullName,
    action: "IMPORT_EXCEL",
    entity: "citizens",
    entityId: "bulk",
    newValue: `Imported ${importedCount}, skipped ${skippedRows.length}`,
  });

  return NextResponse.json({
    ok: true,
    importedCount,
    skippedRows,
  });
}
