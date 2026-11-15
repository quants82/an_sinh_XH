import { NextResponse } from "next/server";
import { db, ensureDbReady } from "@/db";
import {
  citizenChanges,
  citizenGroups,
  citizens,
  supportGroups,
  systemSettings,
  villages,
} from "@/db/schema";
import { canEditCitizens, getCurrentUser } from "@/lib/auth";
import { buildCitizenTemplateWorkbook } from "@/lib/excel";
import { formatCitizenCode, normalizeVietnameseName } from "@/lib/scoring";
import { writeAuditLog } from "@/lib/audit";
import { parseCommuneWorkbook, type ParsedCitizenRow } from "@/lib/commune-import";

const CHUNK_SIZE = 200;

export async function GET() {
  await ensureDbReady();
  const buf = await buildCitizenTemplateWorkbook();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Mau_Nhap_DoiTuong_AnSinh.xlsx"`,
    },
  });
}

function parseBoolFlag(val: FormDataEntryValue | null, defaultValue: boolean): boolean {
  if (val === null || val === undefined) return defaultValue;
  const s = String(val).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return defaultValue;
}

export async function POST(req: Request) {
  await ensureDbReady();
  const user = await getCurrentUser();
  if (!user || !canEditCitizens(user.role)) {
    return NextResponse.json({ error: "Không có quyền import" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Vui lòng chọn file Excel (.xlsx)" },
      { status: 400 }
    );
  }

  const mode = String(formData.get("mode") ?? "commit").toLowerCase();
  const skipReducedPaused = parseBoolFlag(formData.get("skipReducedPaused"), false);
  const attachGroupOnDuplicate = parseBoolFlag(
    formData.get("attachGroupOnDuplicate"),
    true
  );
  const fallbackVillageIdRaw = formData.get("fallbackVillageId");
  const fallbackVillageId = fallbackVillageIdRaw ? Number(fallbackVillageIdRaw) : 0;

  const [settingsRows, villageRows, groupRows, existingCitizens, existingLinks] =
    await Promise.all([
      db.select().from(systemSettings).limit(1),
      db.select().from(villages),
      db.select().from(supportGroups),
      db
        .select({
          id: citizens.id,
          normalizedName: citizens.normalizedName,
          birthYear: citizens.birthYear,
          villageId: citizens.villageId,
          citizenCode: citizens.citizenCode,
        })
        .from(citizens),
      db
        .select({
          citizenId: citizenGroups.citizenId,
          groupId: citizenGroups.groupId,
        })
        .from(citizenGroups),
    ]);

  const vByCode = new Map(villageRows.map((v) => [v.code.toUpperCase(), v]));
  const vByNormName = new Map(
    villageRows.map((v) => [normalizeVietnameseName(v.name), v])
  );
  const vById = new Map(villageRows.map((v) => [v.id, v]));
  const villageNameByCode = new Map(
    villageRows.map((v) => [v.code.toUpperCase(), v.name])
  );
  const gByCode = new Map(groupRows.map((g) => [g.code.toUpperCase(), g]));

  const arrayBuffer = await file.arrayBuffer();
  let parsed;
  try {
    parsed = await parseCommuneWorkbook(arrayBuffer, {
      customGroups: groupRows,
      villageNameByCode,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Không đọc được file Excel (.xlsx)",
      },
      { status: 400 }
    );
  }

  const defaultAllowIncompleteDob = parsed.format === "VHXH_WELFARE";
  const allowIncompleteDob = parseBoolFlag(
    formData.get("allowIncompleteDob"),
    defaultAllowIncompleteDob
  );

  // Build in-memory indexes for fast O(1) dedup & code generation
  const citizenIdByKey = new Map<string, number>();
  const seqByVillageId = new Map<number, number>();
  const usedCodes = new Set<string>();
  const existingGroupSetByCitizenId = new Map<number, Set<number>>();

  for (const c of existingCitizens) {
    const key = `${c.normalizedName}|${c.birthYear}|${c.villageId}`;
    if (!citizenIdByKey.has(key)) citizenIdByKey.set(key, c.id);
    seqByVillageId.set(c.villageId, (seqByVillageId.get(c.villageId) ?? 0) + 1);
    usedCodes.add(c.citizenCode);
  }
  for (const link of existingLinks) {
    let set = existingGroupSetByCitizenId.get(link.citizenId);
    if (!set) {
      set = new Set<number>();
      existingGroupSetByCitizenId.set(link.citizenId, set);
    }
    set.add(link.groupId);
  }

  interface PlannedInsert {
    source: ParsedCitizenRow;
    citizenCode: string;
    villageId: number;
    status: string;
    groupIds: number[];
    hardshipSummary: string;
  }

  const plannedInserts: PlannedInsert[] = [];
  const plannedInsertsByKey = new Map<string, PlannedInsert>();
  const plannedExtraLinks: Array<{ citizenId: number; groupId: number; note: string }> =
    [];

  const skippedRows: Array<{ sheet: string; row: number; name: string; reason: string }> =
    [];
  let skippedReducedCount = 0;
  let skippedMissingVillageCount = 0;
  let skippedInvalidDobCount = 0;
  let skippedPermissionCount = 0;
  let skippedDuplicateCount = 0;
  let willMergeGroupCount = 0;
  let reviewFlaggedCount = 0;

  const communeCode = settingsRows[0]?.communeCode || "BA";

  for (const r of parsed.rows) {
    if (r.isReducedOrPaused && skipReducedPaused) {
      skippedReducedCount++;
      skippedRows.push({
        sheet: r.sheetName,
        row: r.rowNumber,
        name: r.fullName,
        reason: `Đã giảm / Tạm dừng chi (${r.reductionNote || "G.T*"})`,
      });
      continue;
    }

    if (!r.birthYearValid && !allowIncompleteDob) {
      skippedInvalidDobCount++;
      skippedRows.push({
        sheet: r.sheetName,
        row: r.rowNumber,
        name: r.fullName,
        reason: `Năm sinh không hợp lệ (${r.birthDateRaw || "trống"})`,
      });
      continue;
    }

    let village =
      vByNormName.get(normalizeVietnameseName(r.resolvedVillageName)) ??
      vByCode.get(r.rawVillage.trim().toUpperCase());
    if (!village && fallbackVillageId > 0) {
      village = vById.get(fallbackVillageId);
    }

    if (!village) {
      skippedMissingVillageCount++;
      skippedRows.push({
        sheet: r.sheetName,
        row: r.rowNumber,
        name: r.fullName,
        reason: r.rawVillage
          ? `Không khớp thôn '${r.rawVillage}'`
          : "Thiếu tên thôn",
      });
      continue;
    }

    if (user.role === "VILLAGE_HEAD" && user.villageId !== village.id) {
      skippedPermissionCount++;
      skippedRows.push({
        sheet: r.sheetName,
        row: r.rowNumber,
        name: r.fullName,
        reason: "Không thuộc thôn phụ trách",
      });
      continue;
    }

    const matchedGroups = r.matchedGroupCodes
      .map((c) => gByCode.get(c.toUpperCase()))
      .filter((g): g is NonNullable<typeof g> => Boolean(g));
    if (matchedGroups.length === 0) {
      const fallbackGroup = gByCode.get("BTXH");
      if (fallbackGroup && parsed.format === "VHXH_WELFARE") {
        matchedGroups.push(fallbackGroup);
      } else {
        skippedRows.push({
          sheet: r.sheetName,
          row: r.rowNumber,
          name: r.fullName,
          reason: "Không khớp mã nhóm đối tượng hợp lệ",
        });
        continue;
      }
    }

    const dedupeKey = `${r.normalizedName}|${r.birthYear}|${village.id}`;
    const existingCitizenId = citizenIdByKey.get(dedupeKey);

    if (existingCitizenId) {
      if (attachGroupOnDuplicate) {
        let linked = existingGroupSetByCitizenId.get(existingCitizenId);
        if (!linked) {
          linked = new Set<number>();
          existingGroupSetByCitizenId.set(existingCitizenId, linked);
        }
        let mergedAny = false;
        for (const g of matchedGroups) {
          if (!linked.has(g.id)) {
            linked.add(g.id);
            plannedExtraLinks.push({
              citizenId: existingCitizenId,
              groupId: g.id,
              note: `Bổ sung từ import (${r.sheetName})`,
            });
            mergedAny = true;
          }
        }
        if (mergedAny) {
          willMergeGroupCount++;
          continue;
        }
      }
      skippedDuplicateCount++;
      skippedRows.push({
        sheet: r.sheetName,
        row: r.rowNumber,
        name: r.fullName,
        reason: "Đã tồn tại hồ sơ trùng tên + năm sinh + thôn",
      });
      continue;
    }

    const inBatchExisting = plannedInsertsByKey.get(dedupeKey);
    if (inBatchExisting && !r.guardianNote) {
      if (attachGroupOnDuplicate) {
        let addedInBatch = false;
        for (const g of matchedGroups) {
          if (!inBatchExisting.groupIds.includes(g.id)) {
            inBatchExisting.groupIds.push(g.id);
            addedInBatch = true;
          }
        }
        if (addedInBatch) {
          willMergeGroupCount++;
          continue;
        }
      }
      skippedDuplicateCount++;
      skippedRows.push({
        sheet: r.sheetName,
        row: r.rowNumber,
        name: r.fullName,
        reason: "Trùng dòng trong cùng tệp Excel",
      });
      continue;
    }

    let seq = (seqByVillageId.get(village.id) ?? 0) + 1;
    let citizenCode = formatCitizenCode(communeCode, village.code, seq);
    while (usedCodes.has(citizenCode)) {
      seq++;
      citizenCode = formatCitizenCode(communeCode, village.code, seq);
    }
    seqByVillageId.set(village.id, seq);
    usedCodes.add(citizenCode);

    const needsReview = !r.birthYearValid || !r.resolvedVillageName;
    if (needsReview) reviewFlaggedCount++;

    const status = r.isReducedOrPaused
      ? "ENDED"
      : needsReview
        ? "PENDING_REVIEW"
        : "ACTIVE";

    const hardshipText = [
      r.hardshipSummary || matchedGroups.map((g) => g.name).join(", "),
      r.warnings.length > 0 ? `[${r.warnings.join("; ")}]` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const item: PlannedInsert = {
      source: r,
      citizenCode,
      villageId: village.id,
      status,
      groupIds: matchedGroups.map((g) => g.id),
      hardshipSummary: hardshipText,
    };
    plannedInserts.push(item);
    if (!inBatchExisting) plannedInsertsByKey.set(dedupeKey, item);
  }

  const enrichedGroups = parsed.byGroup.map((bg) => {
    const g = gByCode.get(bg.groupCode);
    return {
      groupCode: bg.groupCode,
      groupName: g?.name ?? bg.rawSection,
      rawSection: bg.rawSection,
      baseScore: g?.baseScore ?? 0,
      isActive: g?.isActive ?? true,
      count: bg.count,
    };
  });

  if (mode === "preview") {
    return NextResponse.json({
      ok: true,
      mode: "preview",
      format: parsed.format,
      totalRowsRead: parsed.totalRowsRead,
      willInsertCount: plannedInserts.length,
      willMergeGroupCount,
      reviewFlaggedCount,
      skippedTotal: skippedRows.length,
      breakdown: {
        skippedReducedCount,
        skippedMissingVillageCount,
        skippedInvalidDobCount,
        skippedPermissionCount,
        skippedDuplicateCount,
      },
      bySheet: parsed.bySheet,
      byGroup: enrichedGroups,
      byVillage: parsed.byVillage,
      sampleWarnings: skippedRows.slice(0, 25),
    });
  }

  // Commit in fast batches
  const insertedIds: Array<{ id: number; citizenCode: string; groupIds: number[]; sheet: string }> =
    [];

  for (let i = 0; i < plannedInserts.length; i += CHUNK_SIZE) {
    const chunk = plannedInserts.slice(i, i + CHUNK_SIZE);
    const createdRows = await db
      .insert(citizens)
      .values(
        chunk.map((item) => ({
          citizenCode: item.citizenCode,
          recordType: item.source.recordType,
          fullName: item.source.fullName,
          normalizedName: item.source.normalizedName,
          birthYear: item.source.birthYear,
          gender: item.source.gender,
          villageId: item.villageId,
          addressDetail: item.source.addressDetail,
          phone: item.source.phone || null,
          guardianNote: item.source.guardianNote || null,
          hardshipSummary: item.hardshipSummary,
          status: item.status,
          createdById: user.id,
          updatedById: user.id,
        }))
      )
      .returning({ id: citizens.id, citizenCode: citizens.citizenCode });

    createdRows.forEach((cr, idx) => {
      insertedIds.push({
        id: cr.id,
        citizenCode: cr.citizenCode,
        groupIds: chunk[idx].groupIds,
        sheet: chunk[idx].source.sheetName,
      });
    });
  }

  const groupLinkValues: Array<{ citizenId: number; groupId: number; note?: string }> = [];
  const changeValues: Array<{
    citizenId: number;
    changeType: string;
    summary: string;
    actorId: number;
  }> = [];

  for (const ins of insertedIds) {
    for (const gid of ins.groupIds) {
      groupLinkValues.push({ citizenId: ins.id, groupId: gid });
    }
    changeValues.push({
      citizenId: ins.id,
      changeType: "CREATED",
      summary: `Import Excel (${ins.sheet}): ${ins.citizenCode}`,
      actorId: user.id,
    });
  }

  for (const extra of plannedExtraLinks) {
    groupLinkValues.push({
      citizenId: extra.citizenId,
      groupId: extra.groupId,
      note: extra.note,
    });
  }

  for (let i = 0; i < groupLinkValues.length; i += CHUNK_SIZE) {
    await db.insert(citizenGroups).values(groupLinkValues.slice(i, i + CHUNK_SIZE));
  }

  for (let i = 0; i < changeValues.length; i += CHUNK_SIZE) {
    await db.insert(citizenChanges).values(changeValues.slice(i, i + CHUNK_SIZE));
  }

  await writeAuditLog({
    actorId: user.id,
    actorName: user.fullName,
    action: "IMPORT_EXCEL",
    entity: "citizens",
    entityId: "bulk",
    newValue: `Format ${parsed.format}: Nhập mới ${insertedIds.length}, bổ sung nhóm ${willMergeGroupCount}, bỏ qua ${skippedRows.length}`,
  });

  return NextResponse.json({
    ok: true,
    mode: "commit",
    format: parsed.format,
    importedCount: insertedIds.length,
    mergedGroupCount: willMergeGroupCount,
    reviewFlaggedCount,
    skippedCount: skippedRows.length,
    skippedRows: skippedRows.slice(0, 50),
  });
}
