import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { GET as getReportsData } from "../route";
import { getCurrentUser } from "@/lib/auth";
import { SUPPORT_TIER_LABELS } from "@/lib/constants";

const KIND_LABELS: Record<string, string> = {
  GIFT: "Quà / Hiện vật",
  CASH: "Tiền mặt",
  SCHOLARSHIP: "Học bổng",
  OTHER: "Khác",
};

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === "VILLAGE_HEAD") {
    return NextResponse.json({ error: "Không có quyền xuất báo cáo" }, { status: 403 });
  }

  const res = await getReportsData(req);
  if (!res.ok) return res;
  const data = (await res.json()) as {
    summary: { totalDeliveries: number; uniqueRecipients: number; totalValueVnd: number };
    byVillage: Array<{ villageName: string; deliveries: number; totalVnd: number }>;
    deliveries: Array<{
      citizenCode: string;
      citizenName: string;
      birthYear: number;
      villageName: string;
      groupsText: string;
      programCode: string;
      programTitle: string;
      donorName: string;
      supportKind: string;
      giftDetails: string;
      valueVnd: number;
      tier: string;
      receivedAt: string;
      note: string | null;
    }>;
    nextWaveRecommendations: Array<{
      citizenCode: string;
      fullName: string;
      birthYear: number;
      villageName: string;
      groupsText: string;
      hardshipSummary: string;
      totalScore: number;
      receivedCountThisYear: number;
      warningMessage: string | null;
    }>;
  };

  const wb = new ExcelJS.Workbook();

  // Sheet 1: Tổng hợp theo thôn
  const ws1 = wb.addWorksheet("TongHop_TheoThon");
  ws1.addRow(["BÁO CÁO TỔNG HỢP CẤP PHÁT HỖ TRỢ AN SINH XÃ HỘI"]).font = {
    bold: true,
    size: 13,
  };
  ws1.addRow([
    `Tổng lượt cấp phát: ${data.summary.totalDeliveries} | Số người đã nhận: ${data.summary.uniqueRecipients} | Tổng giá trị: ${data.summary.totalValueVnd.toLocaleString("vi-VN")} đ`,
  ]);
  ws1.addRow([]);
  ws1.addRow(["STT", "Thôn", "Số lượt cấp phát", "Tổng giá trị (VNĐ)"]).font = {
    bold: true,
  };
  data.byVillage.forEach((v, idx) => {
    ws1.addRow([idx + 1, v.villageName, v.deliveries, v.totalVnd]);
  });

  // Sheet 2: Chi tiết cấp phát
  const ws2 = wb.addWorksheet("ChiTiet_CapPhat");
  ws2.addRow([
    "STT",
    "Ngày nhận",
    "Mã công dân",
    "Họ và tên",
    "Năm sinh",
    "Thôn",
    "Nhóm đối tượng",
    "Đợt / Chương trình",
    "Đơn vị tài trợ",
    "Loại hỗ trợ",
    "Tên quà / Chi tiết",
    "Số tiền / Giá trị (VNĐ)",
    "Mức hỗ trợ",
    "Ghi chú",
  ]).font = { bold: true };
  data.deliveries.forEach((d, idx) => {
    ws2.addRow([
      idx + 1,
      new Date(d.receivedAt).toLocaleDateString("vi-VN"),
      d.citizenCode,
      d.citizenName,
      d.birthYear,
      d.villageName,
      d.groupsText,
      `${d.programCode} - ${d.programTitle}`,
      d.donorName,
      KIND_LABELS[d.supportKind] ?? d.supportKind,
      d.giftDetails,
      d.valueVnd,
      SUPPORT_TIER_LABELS[d.tier] ?? d.tier,
      d.note || "",
    ]);
  });

  // Sheet 3: Đề xuất đợt tiếp theo
  const ws3 = wb.addWorksheet("DeXuat_DotTiepTheo");
  ws3.addRow([
    "STT",
    "Mã công dân",
    "Họ và tên",
    "Năm sinh",
    "Thôn",
    "Nhóm đối tượng",
    "Hoàn cảnh khó khăn",
    "Điểm ưu tiên 3 lớp",
    "Số lần đã nhận trong năm",
    "Lưu ý",
  ]).font = { bold: true };
  data.nextWaveRecommendations.forEach((r, idx) => {
    ws3.addRow([
      idx + 1,
      r.citizenCode,
      r.fullName,
      r.birthYear,
      r.villageName,
      r.groupsText,
      r.hardshipSummary,
      r.totalScore,
      r.receivedCountThisYear,
      r.warningMessage || "Ưu tiên đề xuất đợt tới",
    ]);
  });

  const arrBuf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(arrBuf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="BaoCao_DeXuat_AnSinh_${stamp}.xlsx"`,
    },
  });
}
