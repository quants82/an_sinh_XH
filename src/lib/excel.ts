import ExcelJS from "exceljs";
import {
  CITIZEN_STATUS_LABELS,
  SUPPORT_TIER_LABELS,
} from "./constants";

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
