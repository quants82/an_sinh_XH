"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";

interface PrintPayload {
  program: {
    programCode: string;
    title: string;
    donorName: string;
    unitValue: number;
    totalSlots: number;
  };
  allocations: Array<{
    id: number;
    fullName: string;
    birthYear: number;
    villageName: string;
    hardshipSummary: string;
    allocationType: string;
    leaderExceptionApproved: boolean;
  }>;
}

export default function ProgramPrintPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<PrintPayload | null>(null);
  const [communeName, setCommuneName] = useState("Xã Bình An");
  const [tab, setTab] = useState<"signoff" | "handover">("signoff");

  useEffect(() => {
    fetch(`/api/programs/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d));
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((s) => {
        if (s.settings?.communeName) setCommuneName(s.settings.communeName);
      });
  }, [params.id]);

  if (!data) {
    return (
      <div className="p-8 text-center text-sm text-slate-600">
        Đang tải biểu mẫu in...
      </div>
    );
  }

  const primaries = data.allocations.filter(
    (a) => a.allocationType === "PRIMARY" || a.leaderExceptionApproved
  );

  return (
    <div className="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-4xl items-center justify-between rounded-xl bg-white p-3 shadow-xs">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("signoff")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === "signoff"
                ? "bg-blue-800 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Danh sách ký nhận (6 cột)
          </button>
          <button
            onClick={() => setTab("handover")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === "handover"
                ? "bg-blue-800 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Biên bản bàn giao
          </button>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
        >
          <Printer className="h-4 w-4" />
          In A4 / Lưu PDF
        </button>
      </div>

      <div className="mx-auto max-w-4xl bg-white p-8 shadow-sm print:shadow-none">
        {/* Quốc hiệu tiêu ngữ */}
        <div className="mb-6 grid grid-cols-2 text-center text-xs">
          <div>
            <div className="font-bold uppercase">
              UBND — MTTQ {communeName.toUpperCase()}
            </div>
            <div className="mt-1 font-semibold">
              Mã đợt: {data.program.programCode}
            </div>
          </div>
          <div>
            <div className="font-bold uppercase">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </div>
            <div className="font-semibold underline">
              Độc lập - Tự do - Hạnh phúc
            </div>
          </div>
        </div>

        {tab === "signoff" ? (
          <>
            <h1 className="mb-1 text-center text-base font-bold uppercase">
              DANH SÁCH KÝ NHẬN HỖ TRỢ
            </h1>
            <p className="mb-4 text-center text-xs italic">
              Chương trình: {data.program.title} — Đơn vị tài trợ:{" "}
              {data.program.donorName}
            </p>

            <table className="w-full border-collapse border border-slate-800 text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-800 px-2 py-2 text-center">
                    STT
                  </th>
                  <th className="border border-slate-800 px-2 py-2 text-left">
                    Họ và tên
                  </th>
                  <th className="border border-slate-800 px-2 py-2 text-center">
                    Năm sinh
                  </th>
                  <th className="border border-slate-800 px-2 py-2 text-left">
                    Thôn
                  </th>
                  <th className="border border-slate-800 px-2 py-2 text-left">
                    Hoàn cảnh khó khăn
                  </th>
                  <th className="w-32 border border-slate-800 px-2 py-2 text-center">
                    Ký nhận
                  </th>
                </tr>
              </thead>
              <tbody>
                {primaries.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="border border-slate-800 px-2 py-2.5 text-center">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-800 px-2 py-2.5 font-semibold">
                      {r.fullName}
                    </td>
                    <td className="border border-slate-800 px-2 py-2.5 text-center">
                      {r.birthYear}
                    </td>
                    <td className="border border-slate-800 px-2 py-2.5">
                      {r.villageName}
                    </td>
                    <td className="border border-slate-800 px-2 py-2.5">
                      {r.hardshipSummary}
                    </td>
                    <td className="border border-slate-800 px-2 py-2.5" />
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-8 grid grid-cols-2 text-center text-xs">
              <div>
                <div className="font-bold uppercase">
                  ĐẠI DIỆN ĐƠN VỊ TÀI TRỢ
                </div>
                <div className="mt-1 italic">(Ký, ghi rõ họ tên)</div>
              </div>
              <div>
                <div className="font-bold uppercase">
                  TM. UBND / MTTQ {communeName.toUpperCase()}
                </div>
                <div className="mt-1 italic">(Ký tên, đóng dấu)</div>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4 text-xs leading-relaxed">
            <h1 className="text-center text-base font-bold uppercase">
              BIÊN BẢN BÀN GIAO VÀ TIẾP NHẬN HỖ TRỢ
            </h1>
            <p>
              Hôm nay, ngày ..... tháng ..... năm ............, tại UBND{" "}
              {communeName}, chúng tôi gồm có:
            </p>
            <p>
              <b>1. Bên trao tài trợ:</b> {data.program.donorName}
            </p>
            <p>
              <b>2. Bên tiếp nhận và điều phối:</b> Đại diện UBND / Ủy ban MTTQ{" "}
              {communeName}
            </p>
            <p>
              Cùng thống nhất bàn giao và trao hỗ trợ cho{" "}
              <b>{primaries.length} đối tượng</b> thuộc diện ưu tiên an sinh xã
              hội trong chương trình <b>{data.program.title}</b> (Mã đợt:{" "}
              {data.program.programCode}), mức mỗi suất:{" "}
              <b>{data.program.unitValue.toLocaleString("vi-VN")} đồng</b>.
            </p>
            <p>
              Danh sách chi tiết đã được kiểm tra chéo, đảm bảo đúng đối tượng,
              công bằng và không trùng lặp trái quy định. Danh sách ký nhận thực tế
              được đính kèm theo biên bản này.
            </p>
            <div className="mt-10 grid grid-cols-3 text-center">
              <div>
                <div className="font-bold uppercase">BÊN TÀI TRỢ</div>
                <div className="mt-1 italic">(Ký, ghi rõ họ tên)</div>
              </div>
              <div>
                <div className="font-bold uppercase">PHÒNG VHXH / LẬP BIỂU</div>
                <div className="mt-1 italic">(Ký, ghi rõ họ tên)</div>
              </div>
              <div>
                <div className="font-bold uppercase">LÃNH ĐẠO PHÊ DUYỆT</div>
                <div className="mt-1 italic">(Ký tên, đóng dấu)</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
