import ExcelJS from "exceljs";
import {
  CITIZEN_STATUS_LABELS,
  SUPPORT_TIER_LABELS,
} from "./constants";
import { extractCellText } from "./commune-import";

export interface ProgramInternalExportRow {
  stt: number;
  citizenCode: string;
  fullName: string;
  birthYear: number;
  villageName: string;
  groupsText: string;
  hardshipSummary: string;
  allocationType: string;
  baseScore: number;
  bonusScore: number;
  penaltyScore: number;
  totalScore: number;
  receivedCountThisYear: number;
  warningMessage: string;
  leaderExceptionApproved: boolean;
  exceptionReason: string;
}

export async function buildInternalProgramWorkbook(params: {
  communeName: string;
  programCode: string;
  programTitle: string;
  donorName: string;
  unitValue: number;
  rows: ProgramInternalExportRow[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hệ thống An sinh Xã hội số";
  const ws = wb.addWorksheet("Danh sach quan ly noi bo");

  ws.mergeCells("A1:N1");
  ws.getCell("A1").value = `${params.communeName.toUpperCase()} - DANH SÁCH QUẢN LÝ NỘI BỘ ĐỢT HỖ TRỢ`;
  ws.getCell("A1").font = { bold: true, size: 13 };
  ws.getCell("A1").alignment = { horizontal: "center" };

  ws.mergeCells("A2:N2");
  ws.getCell("A2").value = `Chương trình: ${params.programCode} - ${params.programTitle} | Tài trợ: ${params.donorName} | Mức suất: ${params.unitValue.toLocaleString("vi-VN")} đ`;
  ws.getCell("A2").font = { italic: true, size: 11 };
  ws.getCell("A2").alignment = { horizontal: "center" };

  const headers = [
    "STT",
    "Mã công dân",
    "Họ và tên",
    "Năm sinh",
    "Thôn",
    "Nhóm đối tượng",
    "Hoàn cảnh khó khăn",
    "Phân loại danh sách",
    "Điểm nền",
    "Điểm cộng",
    "Điểm trừ",
    "Tổng điểm",
    "Số lần nhận trong năm",
    "Cảnh báo / Lý do duyệt ngoại lệ",
  ];

  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  const allocLabel: Record<string, string> = {
    PRIMARY: "Chính thức",
    RESERVE_SECOND_ROUND: "Dự phòng nhận lần 2",
    EXCLUDED: "Không chọn",
  };

  for (const r of params.rows) {
    const warnText = [
      r.warningMessage,
      r.leaderExceptionApproved
        ? `[Đã duyệt ngoại lệ: ${r.exceptionReason || "Lãnh đạo phê duyệt"}]`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    const row = ws.addRow([
      r.stt,
      r.citizenCode,
      r.fullName,
      r.birthYear,
      r.villageName,
      r.groupsText,
      r.hardshipSummary,
      allocLabel[r.allocationType] ?? r.allocationType,
      r.baseScore,
      r.bonusScore,
      r.penaltyScore,
      r.totalScore,
      r.receivedCountThisYear,
      warnText,
    ]);

    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });

    if (r.warningMessage) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEF3C7" },
        };
      });
    }
  }

  ws.columns = [
    { width: 6 },
    { width: 16 },
    { width: 24 },
    { width: 10 },
    { width: 14 },
    { width: 28 },
    { width: 28 },
    { width: 20 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
    { width: 34 },
  ];

  const arrBuf = await wb.xlsx.writeBuffer();
  return Buffer.from(arrBuf);
}

export interface SignoffExportRow {
  stt: number;
  fullName: string;
  birthYear: number;
  villageName: string;
  hardshipSummary: string;
}

/**
 * Danh sách in sẵn ký nhận rút gọn: CHỈ 6 CỘT theo yêu cầu bảo mật tối đa:
 * STT | Họ tên | Năm sinh | Thôn | Hoàn cảnh khó khăn | Ký nhận
 */
export async function buildSignoffWorkbook(params: {
  communeName: string;
  programCode: string;
  programTitle: string;
  donorName: string;
  rows: SignoffExportRow[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Danh sach ky nhan");

  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = `ỦY BAN NHÂN DÂN - MẶT TRẬN TỔ QUỐC ${params.communeName.toUpperCase()}`;
  ws.getCell("A1").font = { bold: true, size: 12 };
  ws.getCell("A1").alignment = { horizontal: "center" };

  ws.mergeCells("A2:F2");
  ws.getCell("A2").value = `DANH SÁCH KÝ NHẬN HỖ TRỢ: ${params.programTitle.toUpperCase()}`;
  ws.getCell("A2").font = { bold: true, size: 13 };
  ws.getCell("A2").alignment = { horizontal: "center" };

  ws.mergeCells("A3:F3");
  ws.getCell("A3").value = `Mã đợt: ${params.programCode} | Đơn vị tài trợ: ${params.donorName}`;
  ws.getCell("A3").font = { italic: true, size: 11 };
  ws.getCell("A3").alignment = { horizontal: "center" };

  const headers = [
    "STT",
    "Họ và tên",
    "Năm sinh",
    "Thôn",
    "Hoàn cảnh khó khăn",
    "Ký nhận",
  ];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  for (const r of params.rows) {
    const row = ws.addRow([
      r.stt,
      r.fullName,
      r.birthYear,
      r.villageName,
      r.hardshipSummary,
      "",
    ]);
    row.height = 24;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
  }

  ws.addRow([]);
  const sigRow = ws.addRow([
    "",
    "ĐẠI DIỆN ĐƠN VỊ TÀI TRỢ",
    "",
    "",
    "TM. UBND / MTTQ XÃ",
    "",
  ]);
  sigRow.font = { bold: true };

  ws.columns = [
    { width: 7 },
    { width: 26 },
    { width: 12 },
    { width: 16 },
    { width: 32 },
    { width: 18 },
  ];

  const arrBuf = await wb.xlsx.writeBuffer();
  return Buffer.from(arrBuf);
}

export async function buildBackupWorkbook(params: {
  communeName: string;
  citizens: Array<{
    citizenCode: string;
    recordType: string;
    fullName: string;
    birthYear: number;
    gender: string;
    villageCode: string;
    villageName: string;
    addressDetail: string;
    phone: string | null;
    guardianNote: string | null;
    hardshipSummary: string;
    status: string;
    groupsText: string;
    localBonusScore: number;
  }>;
  histories: Array<{
    citizenCode: string;
    citizenName: string;
    programCode: string;
    programTitle: string;
    occasionKey: string;
    donorName: string;
    valueVnd: number;
    tier: string;
    receivedAt: string;
  }>;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const ws1 = wb.addWorksheet("CongDan_DoiTuong");
  ws1.addRow([
    "Mã định danh",
    "Loại hồ sơ",
    "Họ tên",
    "Năm sinh",
    "Giới tính",
    "Mã thôn",
    "Tên thôn",
    "Địa chỉ chi tiết",
    "SĐT",
    "Ghi chú (Cha mẹ / Giám hộ)",
    "Nhóm đối tượng",
    "Tóm tắt hoàn cảnh",
    "Trạng thái",
    "Điểm cộng thực tế",
  ]).font = { bold: true };

  for (const c of params.citizens) {
    ws1.addRow([
      c.citizenCode,
      c.recordType === "HOUSEHOLD_DISASTER"
        ? "Hộ thiệt hại thiên tai/dịch bệnh/hỏa hoạn"
        : "Cá nhân độc lập",
      c.fullName,
      c.birthYear,
      c.gender,
      c.villageCode,
      c.villageName,
      c.addressDetail,
      c.phone || "",
      c.guardianNote || "",
      c.groupsText,
      c.hardshipSummary,
      CITIZEN_STATUS_LABELS[c.status] ?? c.status,
      c.localBonusScore,
    ]);
  }

  const ws2 = wb.addWorksheet("LichSu_HoTro");
  ws2.addRow([
    "Mã công dân",
    "Họ tên",
    "Mã chương trình",
    "Tên chương trình",
    "Dịp hỗ trợ",
    "Đơn vị tài trợ",
    "Giá trị (VNĐ)",
    "Phân loại",
    "Ngày nhận",
  ]).font = { bold: true };

  for (const h of params.histories) {
    ws2.addRow([
      h.citizenCode,
      h.citizenName,
      h.programCode,
      h.programTitle,
      h.occasionKey,
      h.donorName,
      h.valueVnd,
      SUPPORT_TIER_LABELS[h.tier] ?? h.tier,
      h.receivedAt,
    ]);
  }

  const arrBuf = await wb.xlsx.writeBuffer();
  return Buffer.from(arrBuf);
}

export async function buildCitizenTemplateWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Mau_Nhap_DoiTuong");
  const header = ws.addRow([
    "Họ và tên (*)",
    "Năm sinh (*)",
    "Giới tính (NAM/NU/KHAC)",
    "Mã thôn (* vd: T01)",
    "Loại (CA_NHAN / HO_THIEN_TAI)",
    "Mã nhóm đối tượng (* cách nhau dấu phẩy, vd: HO_NGHEO,BENH_HN)",
    "Địa chỉ / Xóm",
    "SĐT",
    "Tóm tắt hoàn cảnh khó khăn",
    "Ghi chú (Cha mẹ / Giám hộ nếu trùng tên)",
  ]);
  header.font = { bold: true };
  ws.addRow([
    "Nguyễn Văn Mẫu",
    1965,
    "NAM",
    "T01",
    "CA_NHAN",
    "HO_NGHEO,BENH_HN",
    "Xóm Đông",
    "0901234567",
    "Hộ nghèo, mắc bệnh hiểm nghèo",
    "",
  ]);
  ws.columns = Array.from({ length: 10 }, () => ({ width: 24 }));
  const arrBuf = await wb.xlsx.writeBuffer();
  return Buffer.from(arrBuf);
}

export interface ScoringRuleExcelRow {
  code: string;
  name: string;
  baseScore: number;
  isActive: boolean;
  defaultDurationMonths: number | null;
}

/**
 * Tạo tệp Excel Bảng điểm quy định riêng của Lãnh đạo (hỗ trợ tải về, duyệt/chỉnh sửa và nhập lại).
 */
export async function buildScoringRulesWorkbook(
  groups: ScoringRuleExcelRow[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hệ thống An sinh Xã hội số";
  const ws = wb.addWorksheet("Bang_Diem_Lanh_Dao");

  ws.mergeCells("A1:F1");
  ws.getCell("A1").value =
    "BẢNG ĐIỂM QUY ĐỊNH THEO NHÓM ĐỐI TƯỢNG (DO LÃNH ĐẠO BAN HÀNH)";
  ws.getCell("A1").font = { bold: true, size: 13 };
  ws.getCell("A1").alignment = { horizontal: "center" };

  ws.mergeCells("A2:F2");
  ws.getCell("A2").value =
    "Hướng dẫn: Sửa cột Điểm quy định và Trạng thái (AP_DUNG hoặc TAM_NGUNG). Không đổi Mã nhóm đối với nhóm có sẵn; có thể thêm dòng mới ở cuối.";
  ws.getCell("A2").font = { italic: true, size: 10 };

  const header = ws.addRow([
    "STT",
    "Mã nhóm đối tượng (*)",
    "Tên nhóm đối tượng (*)",
    "Điểm quy định (*)",
    "Trạng thái (AP_DUNG/TAM_NGUNG)",
    "Thời hạn tạm (tháng, bỏ trống nếu lâu dài)",
  ]);
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  groups.forEach((g, idx) => {
    const row = ws.addRow([
      idx + 1,
      g.code,
      g.name,
      g.baseScore,
      g.isActive ? "AP_DUNG" : "TAM_NGUNG",
      g.defaultDurationMonths ?? "",
    ]);
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(4).alignment = { horizontal: "center" };
    row.getCell(5).alignment = { horizontal: "center" };
    row.getCell(6).alignment = { horizontal: "center" };
  });

  ws.columns = [
    { width: 8 },
    { width: 24 },
    { width: 48 },
    { width: 18 },
    { width: 26 },
    { width: 22 },
  ];

  const arrBuf = await wb.xlsx.writeBuffer();
  return Buffer.from(arrBuf);
}

/**
 * Đọc tệp Excel Bảng điểm quy định do Lãnh đạo nhập riêng.
 */
export async function parseScoringRulesWorkbook(
  buffer: ArrayBuffer | Buffer
): Promise<ScoringRuleExcelRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File Excel Bảng điểm trống");

  // Tự tìm dòng tiêu đề có "Mã nhóm"
  let startRow = 2;
  let colMap = { code: 2, name: 3, score: 4, active: 5, duration: 6 };
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const cells = [1, 2, 3, 4, 5, 6].map((c) => extractCellText(row.getCell(c).value));
    const codeIdx = cells.findIndex((c) => /^mã nhóm/i.test(c));
    const scoreIdx = cells.findIndex((c) => /^điểm/i.test(c));
    if (codeIdx >= 0 && scoreIdx >= 0 && codeIdx !== scoreIdx) {
      startRow = r + 1;
      const nameIdx = cells.findIndex((c) => /^tên nhóm/i.test(c));
      const activeIdx = cells.findIndex((c) => /^trạng thái/i.test(c));
      const durIdx = cells.findIndex((c) => /^thời hạn/i.test(c));
      colMap = {
        code: codeIdx + 1,
        name: nameIdx >= 0 ? nameIdx + 1 : codeIdx + 2,
        score: scoreIdx + 1,
        active: activeIdx >= 0 ? activeIdx + 1 : codeIdx + 4,
        duration: durIdx >= 0 ? durIdx + 1 : codeIdx + 5,
      };
      break;
    }
  }

  const parsed: ScoringRuleExcelRow[] = [];
  for (let r = startRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const code = extractCellText(row.getCell(colMap.code).value).toUpperCase();
    const name = extractCellText(row.getCell(colMap.name).value);
    if (!code || !name) continue;

    const scoreRaw = extractCellText(row.getCell(colMap.score).value);
    const scoreNum = Number(scoreRaw.replace(",", "."));
    if (!Number.isFinite(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      throw new Error(`Dòng ${r}: Điểm quy định '${scoreRaw}' không hợp lệ (0–100)`);
    }

    const activeRaw = extractCellText(row.getCell(colMap.active).value).toUpperCase();
    const isActive = !(
      activeRaw.includes("NGUNG") ||
      activeRaw === "FALSE" ||
      activeRaw === "0" ||
      activeRaw === "NO"
    );

    const durRaw = extractCellText(row.getCell(colMap.duration).value);
    const durNum = durRaw ? Number(durRaw) : NaN;

    parsed.push({
      code,
      name,
      baseScore: Math.round(scoreNum),
      isActive,
      defaultDurationMonths:
        Number.isFinite(durNum) && durNum > 0 ? Math.round(durNum) : null,
    });
  }

  if (parsed.length === 0) {
    throw new Error("Không tìm thấy dòng nhóm đối tượng hợp lệ trong file Excel Bảng điểm");
  }
  return parsed;
}

export interface FilteredCitizenExportRow {
  citizenCode: string;
  fullName: string;
  birthYear: number;
  villageName: string;
  groupsText: string;
  baseScore: number;
  localBonusScore: number;
  estimatedScore: number;
  status: string;
  hardshipSummary: string;
}

/**
 * Xuất Excel Thống kê & Danh sách đối tượng theo bộ lọc hiện tại.
 */
export async function buildFilteredCitizensWorkbook(params: {
  communeName: string;
  filterDescription: string;
  rows: FilteredCitizenExportRow[];
  byVillage: Array<{ villageName: string; active: number; ended: number; total: number }>;
  byGroup: Array<{ groupName: string; baseScore: number; total: number }>;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hệ thống An sinh Xã hội số";

  // Sheet 1: Thống kê tổng hợp
  const wsSum = wb.addWorksheet("ThongKe_TongHop");
  wsSum.addRow([
    `${params.communeName.toUpperCase()} — BÁO CÁO THỐNG KÊ ĐỐI TƯỢNG AN SINH`,
  ]).font = { bold: true, size: 13 };
  wsSum.addRow([
    `Bộ lọc: ${params.filterDescription} | Tổng số hồ sơ: ${params.rows.length}`,
  ]);
  wsSum.addRow([]);

  wsSum.addRow(["I. THỐNG KÊ THEO THÔN"]).font = { bold: true };
  wsSum.addRow(["STT", "Thôn", "Đang hoạt động / Rà soát", "Đã giảm / Tạm dừng", "Tổng cộng"]).font = {
    bold: true,
  };
  params.byVillage.forEach((v, idx) => {
    wsSum.addRow([idx + 1, v.villageName, v.active, v.ended, v.total]);
  });

  wsSum.addRow([]);
  wsSum.addRow(["II. THỐNG KÊ THEO NHÓM ĐỐI TƯỢNG & BẢNG ĐIỂM"]).font = { bold: true };
  wsSum.addRow(["STT", "Nhóm đối tượng", "Điểm quy định", "Số lượt đối tượng"]).font = {
    bold: true,
  };
  params.byGroup.forEach((g, idx) => {
    wsSum.addRow([idx + 1, g.groupName, g.baseScore, g.total]);
  });
  wsSum.columns = [
    { width: 8 },
    { width: 42 },
    { width: 24 },
    { width: 22 },
    { width: 16 },
  ];

  // Sheet 2: Danh sách đối tượng chi tiết
  const wsList = wb.addWorksheet("DanhSach_DoiTuong");
  const hdr = wsList.addRow([
    "STT",
    "Mã công dân",
    "Họ và tên",
    "Năm sinh",
    "Thôn",
    "Nhóm đối tượng",
    "Điểm nhóm",
    "Điểm cộng",
    "Tổng điểm",
    "Trạng thái",
    "Chi tiết / Số sổ / Ghi chú",
  ]);
  hdr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hdr.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
  });

  params.rows.forEach((r, idx) => {
    wsList.addRow([
      idx + 1,
      r.citizenCode,
      r.fullName,
      r.birthYear,
      r.villageName,
      r.groupsText,
      r.baseScore,
      r.localBonusScore,
      r.estimatedScore,
      CITIZEN_STATUS_LABELS[r.status] ?? r.status,
      r.hardshipSummary,
    ]);
  });

  wsList.columns = [
    { width: 7 },
    { width: 16 },
    { width: 26 },
    { width: 10 },
    { width: 16 },
    { width: 34 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 18 },
    { width: 42 },
  ];

  const arrBuf = await wb.xlsx.writeBuffer();
  return Buffer.from(arrBuf);
}
