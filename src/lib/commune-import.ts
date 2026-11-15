import ExcelJS from "exceljs";
import { normalizeVietnameseName } from "./scoring";

export interface SupportGroupLookup {
  id?: number;
  code: string;
  name: string;
  baseScore?: number;
}

export interface ParsedCitizenRow {
  sheetName: string;
  rowNumber: number;
  stt: string;
  bookNumber: string;
  fullName: string;
  normalizedName: string;
  birthYear: number;
  birthDateRaw: string;
  birthYearValid: boolean;
  gender: "NAM" | "NU" | "KHAC";
  rawVillage: string;
  resolvedVillageName: string;
  sectionTitle: string;
  matchedGroupCodes: string[];
  recordType: "INDIVIDUAL" | "HOUSEHOLD_DISASTER";
  addressDetail: string;
  phone: string;
  hardshipSummary: string;
  guardianNote: string;
  isReducedOrPaused: boolean;
  reductionNote: string;
  warnings: string[];
}

export interface ParsedImportSummary {
  format: "VHXH_WELFARE" | "STANDARD_TEMPLATE";
  totalRowsRead: number;
  reducedOrPausedCount: number;
  invalidBirthYearCount: number;
  missingVillageCount: number;
  unmatchedGroupCount: number;
  bySheet: Array<{ sheetName: string; count: number }>;
  byGroup: Array<{ groupCode: string; rawSection: string; count: number }>;
  byVillage: Array<{ villageName: string; count: number }>;
  rows: ParsedCitizenRow[];
}

const VILLAGE_ALIAS_MAP: Record<string, string> = {
  "phu lac": "Phú Lạc",
  "kien long": "Kiên Long",
  "kien ngai": "Kiên Ngãi",
  "an dong": "Kiên Ngãi",
  "truong dinh": "Trường Định",
  "truong dinh 1": "Trường Định",
  "truong dinh 2": "Trường Định",
  "truung dinh": "Trường Định",
  "truung dinh 1": "Trường Định",
  "truung dinh 2": "Trường Định",
  "van tuong": "Trường Định",
  "vinh loc": "Vĩnh Lộc",
  "kien thanh": "Vĩnh Lộc",
  "an chanh": "An Chánh",
  "my an": "Mỹ An",
  "my thuan": "Mỹ Thuận",
  "an vinh": "An Vinh",
  "nhon thuan": "An Vinh",
  "binh duc": "Bỉnh Đức",
};

/**
 * Chuẩn hóa tên thôn (gồm xử lý chính tả hoa/thường/dấu & sáp nhập theo Xã Bình An).
 */
export function resolveBinhAnVillageName(rawVillage: string): string {
  const norm = normalizeVietnameseName(rawVillage)
    .replace(/^(thon|xom|ap)\s+/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  if (!norm) return "";
  if (VILLAGE_ALIAS_MAP[norm]) return VILLAGE_ALIAS_MAP[norm];

  // Fallback khớp tiền tố nếu có số phụ như "Truong Dinh 3"
  for (const [alias, canonical] of Object.entries(VILLAGE_ALIAS_MAP)) {
    if (norm === alias) return canonical;
  }
  return rawVillage.replace(/\s+/g, " ").trim();
}

const SECTION_RULES: Array<{ code: string; test: (norm: string) => boolean }> = [
  {
    code: "HT_70_75_HN",
    test: (s) =>
      s.includes("tu du 70") && (s.includes("75") || s.includes("ho ngèo") || s.includes("ho ngheo")),
  },
  {
    code: "HT_75_TRO_LEN",
    test: (s) => s.includes("tu du 75 tuoi tro len"),
  },
  {
    code: "NCT_60_80_HN",
    test: (s) => s.includes("nguoi cao tuoi") && s.includes("60") && s.includes("80"),
  },
  {
    code: "CHAM_SOC_KT_DBN",
    test: (s) =>
      s.includes("chi phi cham soc") &&
      (s.includes("khuyet tat dac biet nang") || s.includes("nguoi khuyet tat")),
  },
  {
    code: "CHAM_SOC_MO_COI",
    test: (s) => s.includes("chi phi cham soc") && s.includes("tre mo coi"),
  },
  {
    code: "NCT_KT_DBN",
    test: (s) => s.includes("nguoi cao tuoi") && s.includes("khuyet tat dac biet nang"),
  },
  {
    code: "NCT_KT_NANG",
    test: (s) =>
      s.includes("nguoi cao tuoi") &&
      s.includes("khuyet tat nang") &&
      !s.includes("dac biet"),
  },
  {
    code: "TE_KT_DBN",
    test: (s) => s.includes("tre em") && s.includes("khuyet tat dac biet nang"),
  },
  {
    code: "TE_KT_NANG",
    test: (s) =>
      s.includes("tre em") && s.includes("khuyet tat nang") && !s.includes("dac biet"),
  },
  {
    code: "KT_DBN",
    test: (s) =>
      s.includes("nguoi khuyet tat dac biet nang") && !s.includes("chi phi cham soc"),
  },
  {
    code: "KT_NANG",
    test: (s) =>
      s.includes("nguoi khuyet tat nang") &&
      !s.includes("dac biet") &&
      !s.includes("chi phi cham soc"),
  },
  {
    code: "TRE_MO_COI_DUOI_4",
    test: (s) => s.includes("tre mo coi") && s.includes("duoi 4 tuoi"),
  },
  {
    code: "TRE_MO_COI_4_16",
    test: (s) =>
      s.includes("tre mo coi") && s.includes("4") && s.includes("16 tuoi") && !s.includes("cham soc"),
  },
  {
    code: "MO_COI_16_22_HOC",
    test: (s) => s.includes("16") && s.includes("22 tuoi") && s.includes("mo coi"),
  },
  {
    code: "DON_THAN_1_CON",
    test: (s) => s.includes("don than") && s.includes("01 con"),
  },
  {
    code: "DON_THAN_2_CON",
    test: (s) => s.includes("don than") && s.includes("02 con"),
  },
  {
    code: "DON_THAN_3_CON",
    test: (s) => s.includes("don than") && s.includes("03 con"),
  },
  {
    code: "DON_THAN_4_CON",
    test: (s) => s.includes("don than") && s.includes("04 con"),
  },
];

/**
 * Ánh xạ dòng tiêu đề nhóm ngang trong danh sách Phòng VH-XH sang mã nhóm đối tượng của hệ thống.
 */
export function resolveWelfareGroupCode(
  rawSectionTitle: string,
  customGroups: SupportGroupLookup[] = []
): string | null {
  const norm = normalizeVietnameseName(rawSectionTitle)
    .replace(/^[,.\s-]+/, "")
    .replace(/duoi/g, "duoi")
    .trim();
  if (!norm) return null;

  for (const rule of SECTION_RULES) {
    if (rule.test(norm)) return rule.code;
  }

  for (const g of customGroups) {
    if (normalizeVietnameseName(g.code) === norm || normalizeVietnameseName(g.name) === norm) {
      return g.code.toUpperCase();
    }
  }
  return null;
}

/**
 * Chuẩn hóa năm sinh từ Date, số nguyên, hoặc chuỗi DD/MM/YYYY, YYYY-MM-DD, MM/YYYY.
 */
export function parseFlexibleBirthYear(
  rawDob: unknown,
  currentYear = new Date().getFullYear()
): { birthYear: number; rawText: string; valid: boolean; warning?: string } {
  if (rawDob instanceof Date && !Number.isNaN(rawDob.getTime())) {
    const y = rawDob.getFullYear();
    const valid = y >= 1900 && y <= currentYear;
    return {
      birthYear: valid ? y : 1900,
      rawText: rawDob.toISOString().slice(0, 10),
      valid,
      warning: valid ? undefined : `Năm sinh không hợp lệ (${y})`,
    };
  }

  const rawText = extractCellText(rawDob);
  if (!rawText) {
    return { birthYear: 1900, rawText: "", valid: false, warning: "Thiếu ngày/năm sinh" };
  }

  // Kiểm tra chuỗi 4 chữ số chuẩn ở cuối hoặc đầu (DD/MM/YYYY, YYYY-MM-DD, MM/YYYY, YYYY)
  const ddmmyyyy = rawText.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4,5})\b/);
  if (ddmmyyyy) {
    const yearStr = ddmmyyyy[3];
    if (yearStr.length === 4) {
      const y = Number(yearStr);
      if (y >= 1900 && y <= currentYear) {
        return { birthYear: y, rawText, valid: true };
      }
      return {
        birthYear: 1900,
        rawText,
        valid: false,
        warning: `Năm sinh ngoài phạm vi (${rawText})`,
      };
    }
    // Lỗi thừa 1 số ở cuối như "08/06/20078"
    const trimmedY = Number(yearStr.slice(0, 4));
    if (trimmedY >= 1900 && trimmedY <= currentYear) {
      return {
        birthYear: trimmedY,
        rawText,
        valid: true,
        warning: `Tự chuẩn hóa năm sinh '${rawText}' → ${trimmedY}`,
      };
    }
  }

  const yyyymmdd = rawText.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (yyyymmdd) {
    const y = Number(yyyymmdd[1]);
    if (y >= 1900 && y <= currentYear) return { birthYear: y, rawText, valid: true };
    return { birthYear: 1900, rawText, valid: false, warning: `Năm sinh ngoài phạm vi (${rawText})` };
  }

  const mmyyyy = rawText.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (mmyyyy) {
    const y = Number(mmyyyy[2]);
    if (y >= 1900 && y <= currentYear) return { birthYear: y, rawText, valid: true };
  }

  const plainYear = rawText.match(/^(\d{4})$/);
  if (plainYear) {
    const y = Number(plainYear[1]);
    if (y >= 1900 && y <= currentYear) return { birthYear: y, rawText, valid: true };
  }

  return {
    birthYear: 1900,
    rawText,
    valid: false,
    warning: `Ngày/năm sinh cần kiểm tra (${rawText})`,
  };
}

export function extractCellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const obj = v as { richText?: Array<{ text: string }>; result?: unknown; text?: unknown };
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((x) => x.text).join("").replace(/\s+/g, " ").trim();
    }
    if ("result" in obj) return extractCellText(obj.result);
    if ("text" in obj) return String(obj.text).replace(/\s+/g, " ").trim();
  }
  return String(v).replace(/\s+/g, " ").trim();
}

function isAdministrativeBannerOrTotal(text: string): boolean {
  return /^(ubnd |phong |danh sach|dieu chinh|theo nghi dinh|\(kem theo|tong cong|tong so doi tuong|so tien bang chu|ben nhan|ben giao|ngay .* thang|nguoi chi tra|thu truong|cong hoa|doc lap|he so tro cap|muc tro cap|ty le)/i.test(
    normalizeVietnameseName(text)
  );
}

function isFooterMarker(joinedText: string): boolean {
  const norm = normalizeVietnameseName(joinedText);
  return (
    norm.includes("tong so doi tuong") ||
    norm.includes("so tien bang chu") ||
    norm.includes("ben nhan chi tra") ||
    norm.includes("ben giao chi tra") ||
    norm.includes("thu truong don vi") ||
    norm.includes("nguoi chi tra")
  );
}

function detectHorizontalSectionBanner(
  cStt: string,
  cName: string,
  cDob: string,
  cVillage: string
): string | null {
  // Tiêu đề nhóm ngang thường gộp ô qua nhiều cột (STT..Nơi ở hoặc Họ tên..Nơi ở)
  const mergedNameWithNeighbour =
    cName.length > 18 &&
    (cName === cDob || cName === cVillage || (cStt !== "" && cStt === cName));
  if (mergedNameWithNeighbour && !isAdministrativeBannerOrTotal(cName)) {
    return cName;
  }

  // Hoặc STT mang nguyên chuỗi tiêu đề nhóm dài, cột Họ và tên trống
  if (!cName && cStt.length > 18 && !/^\d+$/.test(cStt) && !isAdministrativeBannerOrTotal(cStt)) {
    return cStt;
  }

  // Hoặc cột Họ và tên là mô tả nhóm dài mà không có năm sinh / số sổ / STT số
  if (
    cName.length > 28 &&
    !cDob &&
    !/^\d+$/.test(cStt) &&
    !isAdministrativeBannerOrTotal(cName) &&
    resolveWelfareGroupCode(cName) !== null
  ) {
    return cName;
  }

  return null;
}

function parseVhxhSheet(
  ws: ExcelJS.Worksheet,
  customGroups: SupportGroupLookup[]
): ParsedCitizenRow[] {
  const rowsOut: ParsedCitizenRow[] = [];
  let colMap: { stt: number; soSo: number; name: number; dob: number; village: number } | null =
    null;
  let currentSectionTitle = "";
  let inFooter = false;

  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    const scanCols = Math.max(10, Math.min(ws.columnCount || 10, 42));
    for (let c = 1; c <= 8; c++) cells.push(extractCellText(row.getCell(c).value));

    const frontJoined = cells.slice(0, 6).join(" ").trim();
    if (!frontJoined) continue;

    // Nhận diện dòng tiêu đề bảng cột (STT, Số sổ, Họ và tên...)
    const nameIdx = cells.findIndex((v) => /^họ và tên/i.test(v));
    if (nameIdx >= 0) {
      const sttIdx = cells.findIndex((v) => /^stt$/i.test(v));
      const soSoIdx = cells.findIndex((v) => /^số sổ/i.test(v));
      const dobIdx = cells.findIndex((v) => /(ngày.*năm sinh|năm sinh)/i.test(v));
      const villageIdx = cells.findIndex((v) =>
        /(nơi thường trú|nơi ở|thôn mới)/i.test(v)
      );
      colMap = {
        stt: sttIdx >= 0 ? sttIdx : 0,
        soSo: soSoIdx >= 0 ? soSoIdx : 1,
        name: nameIdx,
        dob: dobIdx >= 0 ? dobIdx : nameIdx + 1,
        village: villageIdx >= 0 ? villageIdx : nameIdx + 2,
      };
      inFooter = false;
      continue;
    }

    if (!colMap) continue;

    if (isFooterMarker(frontJoined)) {
      inFooter = true;
      continue;
    }
    if (inFooter) continue;

    const cStt = cells[colMap.stt] ?? "";
    const cSo = cells[colMap.soSo] ?? "";
    const cName = cells[colMap.name] ?? "";
    const rawDobCell = row.getCell(colMap.dob + 1).value;
    const cDob = extractCellText(rawDobCell);
    const cVillage = cells[colMap.village] ?? "";

    if (isAdministrativeBannerOrTotal(cStt) || isAdministrativeBannerOrTotal(cName)) {
      continue;
    }

    const sectionBanner = detectHorizontalSectionBanner(cStt, cName, cDob, cVillage);
    if (sectionBanner) {
      currentSectionTitle = sectionBanner.replace(/^[,.\s]+/, "").trim();
      continue;
    }

    if (!cName || /^[\d.,]+$/.test(cName)) continue;

    // Quét các cột ghi chú/kênh chi trả phía sau
    const trailingNotes: string[] = [];
    for (let c = colMap.village + 2; c <= scanCols; c++) {
      const v = extractCellText(row.getCell(c).value);
      if (
        v &&
        !/^[\d.,\s-]+$/.test(v) &&
        !/^[xX]$/.test(v) &&
        !/^(tm|ari|vtin|vt|bđ|bð|ck)$/i.test(v)
      ) {
        trailingNotes.push(v);
      }
    }
    const noteJoined = trailingNotes.join("; ");
    const isReducedOrPaused =
      /\bG\s*\.\s*T\d+/i.test(noteJoined) || /tạm dừng|dừng chi|giảm\s*tháng/i.test(noteJoined);

    const parsedDob = parseFlexibleBirthYear(rawDobCell);
    const resolvedVillage = resolveBinhAnVillageName(cVillage);
    const matchedCode = currentSectionTitle
      ? resolveWelfareGroupCode(currentSectionTitle, customGroups)
      : null;

    const warnings: string[] = [];
    if (parsedDob.warning) warnings.push(parsedDob.warning);
    if (!resolvedVillage) warnings.push("Thiếu tên thôn");
    if (!matchedCode && currentSectionTitle) {
      warnings.push(`Chưa ánh xạ nhóm '${currentSectionTitle}'`);
    }

    rowsOut.push({
      sheetName: ws.name,
      rowNumber: r,
      stt: cStt,
      bookNumber: cSo,
      fullName: cName,
      normalizedName: normalizeVietnameseName(cName),
      birthYear: parsedDob.birthYear,
      birthDateRaw: parsedDob.rawText,
      birthYearValid: parsedDob.valid,
      gender: "KHAC",
      rawVillage: cVillage,
      resolvedVillageName: resolvedVillage,
      sectionTitle: currentSectionTitle,
      matchedGroupCodes: matchedCode ? [matchedCode] : [],
      recordType: "INDIVIDUAL",
      addressDetail:
        cVillage && resolvedVillage && cVillage !== resolvedVillage ? cVillage : "",
      phone: "",
      hardshipSummary: [
        currentSectionTitle,
        cSo ? `Số sổ: ${cSo}` : "",
        noteJoined,
      ]
        .filter(Boolean)
        .join(" | "),
      guardianNote: "",
      isReducedOrPaused,
      reductionNote: isReducedOrPaused ? noteJoined : "",
      warnings,
    });
  }

  return rowsOut;
}

function parseStandardTemplateSheet(
  ws: ExcelJS.Worksheet,
  villageLookupByCode: Map<string, string>
): ParsedCitizenRow[] {
  const rowsOut: ParsedCitizenRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const fullName = extractCellText(row.getCell(1).value);
    if (!fullName) continue;

    const dob = parseFlexibleBirthYear(row.getCell(2).value);
    const genderRaw = extractCellText(row.getCell(3).value).toUpperCase();
    const villageRaw = extractCellText(row.getCell(4).value);
    const recordTypeRaw = extractCellText(row.getCell(5).value).toUpperCase();
    const groupCodesRaw = extractCellText(row.getCell(6).value);
    const addressDetail = extractCellText(row.getCell(7).value);
    const phone = extractCellText(row.getCell(8).value);
    const hardshipSummary = extractCellText(row.getCell(9).value);
    const guardianNote = extractCellText(row.getCell(10).value);

    const mappedVillage =
      villageLookupByCode.get(villageRaw.toUpperCase()) ??
      resolveBinhAnVillageName(villageRaw);

    const matchedGroupCodes = groupCodesRaw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const warnings: string[] = [];
    if (dob.warning) warnings.push(dob.warning);
    if (!mappedVillage) warnings.push(`Mã/tên thôn '${villageRaw}' không tồn tại`);
    if (matchedGroupCodes.length === 0) warnings.push("Thiếu mã nhóm đối tượng");

    rowsOut.push({
      sheetName: ws.name,
      rowNumber: r,
      stt: String(r - 1),
      bookNumber: "",
      fullName,
      normalizedName: normalizeVietnameseName(fullName),
      birthYear: dob.birthYear,
      birthDateRaw: dob.rawText,
      birthYearValid: dob.valid,
      gender: genderRaw === "NAM" || genderRaw === "NU" ? genderRaw : "KHAC",
      rawVillage: villageRaw,
      resolvedVillageName: mappedVillage,
      sectionTitle: matchedGroupCodes.join(", "),
      matchedGroupCodes,
      recordType: recordTypeRaw === "HO_THIEN_TAI" ? "HOUSEHOLD_DISASTER" : "INDIVIDUAL",
      addressDetail,
      phone,
      hardshipSummary,
      guardianNote,
      isReducedOrPaused: false,
      reductionNote: "",
      warnings,
    });
  }
  return rowsOut;
}

/**
 * Đọc và phân tích tự động cả File mẫu hệ thống lẫn File 4 sheet của Phòng VH-XH (NĐ 176/20/335).
 */
export async function parseCommuneWorkbook(
  buffer: ArrayBuffer | Buffer,
  options?: {
    customGroups?: SupportGroupLookup[];
    villageNameByCode?: Map<string, string>;
  }
): Promise<ParsedImportSummary> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);

  const firstWs = wb.worksheets[0];
  if (!firstWs) {
    throw new Error("File Excel trống");
  }

  // Nhận diện file mẫu chuẩn 10 cột (cột 1 dòng 1 là "Họ và tên (*)")
  const r1c1 = extractCellText(firstWs.getRow(1).getCell(1).value);
  const r1c6 = extractCellText(firstWs.getRow(1).getCell(6).value);
  const isStandardTemplate =
    /^họ và tên/i.test(r1c1) && /mã nhóm/i.test(r1c6);

  const rows: ParsedCitizenRow[] = [];
  const bySheetMap = new Map<string, number>();

  if (isStandardTemplate) {
    const sheetRows = parseStandardTemplateSheet(
      firstWs,
      options?.villageNameByCode ?? new Map()
    );
    rows.push(...sheetRows);
    bySheetMap.set(firstWs.name, sheetRows.length);
  } else {
    for (const ws of wb.worksheets) {
      const sheetRows = parseVhxhSheet(ws, options?.customGroups ?? []);
      if (sheetRows.length > 0) {
        rows.push(...sheetRows);
        bySheetMap.set(ws.name, sheetRows.length);
      }
    }
  }

  const byGroupMap = new Map<string, { groupCode: string; rawSection: string; count: number }>();
  const byVillageMap = new Map<string, number>();

  let reducedOrPausedCount = 0;
  let invalidBirthYearCount = 0;
  let missingVillageCount = 0;
  let unmatchedGroupCount = 0;

  for (const r of rows) {
    if (r.isReducedOrPaused) reducedOrPausedCount++;
    if (!r.birthYearValid) invalidBirthYearCount++;
    if (!r.resolvedVillageName) missingVillageCount++;
    if (r.matchedGroupCodes.length === 0) unmatchedGroupCount++;

    const gKey = r.matchedGroupCodes[0] || `UNMATCHED:${r.sectionTitle}`;
    const existingG = byGroupMap.get(gKey);
    if (existingG) {
      existingG.count++;
    } else {
      byGroupMap.set(gKey, {
        groupCode: r.matchedGroupCodes[0] || "CHUA_KHOP",
        rawSection: r.sectionTitle || "(Không có tiêu đề nhóm)",
        count: 1,
      });
    }

    const vKey = r.resolvedVillageName || "(Chưa rõ thôn)";
    byVillageMap.set(vKey, (byVillageMap.get(vKey) ?? 0) + 1);
  }

  return {
    format: isStandardTemplate ? "STANDARD_TEMPLATE" : "VHXH_WELFARE",
    totalRowsRead: rows.length,
    reducedOrPausedCount,
    invalidBirthYearCount,
    missingVillageCount,
    unmatchedGroupCount,
    bySheet: [...bySheetMap.entries()].map(([sheetName, count]) => ({
      sheetName,
      count,
    })),
    byGroup: [...byGroupMap.values()].sort((a, b) => b.count - a.count),
    byVillage: [...byVillageMap.entries()]
      .map(([villageName, count]) => ({ villageName, count }))
      .sort((a, b) => a.villageName.localeCompare(b.villageName, "vi")),
    rows,
  };
}
