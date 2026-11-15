"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Download, Filter, Sparkles, Gift, Users, Coins } from "lucide-react";
import { SUPPORT_TIER_LABELS } from "@/lib/constants";

interface ReportPayload {
  summary: {
    totalDeliveries: number;
    uniqueRecipients: number;
    totalValueVnd: number;
  };
  byVillage: Array<{ villageName: string; deliveries: number; totalVnd: number }>;
  deliveries: Array<{
    id: number;
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
    citizenId: number;
    citizenCode: string;
    fullName: string;
    birthYear: number;
    villageName: string;
    groupsText: string;
    hardshipSummary: string;
    baseScore: number;
    bonusScore: number;
    penaltyScore: number;
    totalScore: number;
    receivedCountThisYear: number;
    receivedInWindow: boolean;
    warningMessage: string | null;
  }>;
}

interface VillageOption {
  id: number;
  code: string;
  name: string;
}

const KIND_LABELS: Record<string, string> = {
  GIFT: "Quà / Hiện vật",
  CASH: "Tiền mặt",
  SCHOLARSHIP: "Học bổng",
  OTHER: "Khác",
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportPayload | null>(null);
  const [villages, setVillages] = useState<VillageOption[]>([]);
  const [tab, setTab] = useState<"deliveries" | "nextWave">("deliveries");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [villageId, setVillageId] = useState("");
  const [supportKind, setSupportKind] = useState("");
  const [nextSlots, setNextSlots] = useState(20);

  const buildQueryString = useCallback(() => {
    const p = new URLSearchParams();
    if (fromDate) p.set("from", fromDate);
    if (toDate) p.set("to", toDate);
    if (villageId) p.set("villageId", villageId);
    if (supportKind) p.set("supportKind", supportKind);
    p.set("nextSlots", String(nextSlots));
    return p.toString();
  }, [fromDate, toDate, villageId, supportKind, nextSlots]);

  const loadReports = useCallback(() => {
    fetch(`/api/reports?${buildQueryString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setData(d);
      });
  }, [buildQueryString]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.villages) setVillages(d.villages);
      });
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Báo cáo Cấp phát &amp; Đề xuất Đợt tiếp theo
            </h1>
            <p className="text-xs text-slate-500">
              Thống kê chi tiết các lượt đã phát quà/tiền, lọc theo thời gian/thôn
              và tự động đề xuất danh sách ưu tiên đợt kế tiếp
            </p>
          </div>
          <a
            href={`/api/reports/export?${buildQueryString()}`}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            <Download className="h-4 w-4" />
            <span>Xuất Excel Báo cáo &amp; Đề xuất (3 sheet)</span>
          </a>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-xs sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block font-semibold text-slate-600">
              Từ ngày
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-slate-600">
              Đến ngày
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-slate-600">
              Thôn
            </label>
            <select
              value={villageId}
              onChange={(e) => setVillageId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
            >
              <option value="">Toàn xã</option>
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} — {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-semibold text-slate-600">
              Loại hỗ trợ
            </label>
            <select
              value={supportKind}
              onChange={(e) => setSupportKind(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
            >
              <option value="">Tất cả loại</option>
              <option value="GIFT">Quà / Hiện vật</option>
              <option value="CASH">Tiền mặt</option>
              <option value="SCHOLARSHIP">Học bổng</option>
              <option value="OTHER">Khác</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block font-semibold text-slate-600">
              Số suất đề xuất đợt tới
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={nextSlots}
              onChange={(e) => setNextSlots(Number(e.target.value) || 20)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Tổng lượt đã cấp phát</span>
              <Gift className="h-4 w-4 text-blue-700" />
            </div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900">
              {data?.summary.totalDeliveries ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Số người đã nhận hỗ trợ</span>
              <Users className="h-4 w-4 text-indigo-700" />
            </div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900">
              {data?.summary.uniqueRecipients ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Tổng giá trị hỗ trợ</span>
              <Coins className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="mt-1.5 text-2xl font-bold text-emerald-700">
              {(data?.summary.totalValueVnd ?? 0).toLocaleString("vi-VN")} đ
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <button
            onClick={() => setTab("deliveries")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 ${
              tab === "deliveries"
                ? "bg-blue-800 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>
              Chi tiết đã cấp phát ({data?.deliveries.length ?? 0})
            </span>
          </button>
          <button
            onClick={() => setTab("nextWave")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 ${
              tab === "nextWave"
                ? "bg-blue-800 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              Đề xuất ưu tiên đợt tiếp theo ({data?.nextWaveRecommendations.length ?? 0})
            </span>
          </button>
        </div>

        {tab === "deliveries" ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2.5">Ngày nhận</th>
                  <th className="px-3 py-2.5">Đối tượng</th>
                  <th className="px-3 py-2.5">Thôn</th>
                  <th className="px-3 py-2.5">Đợt / Tài trợ</th>
                  <th className="px-3 py-2.5">Loại &amp; Tên quà / Tiền</th>
                  <th className="px-3 py-2.5 text-right">Giá trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.deliveries ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      Chưa có lượt cấp phát nào phù hợp điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  data!.deliveries.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                        {new Date(d.receivedAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-900">
                          {d.citizenName} ({d.birthYear})
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {d.citizenCode} • {d.groupsText}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{d.villageName}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-800">
                          {d.programTitle}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {d.donorName}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-800">
                          {KIND_LABELS[d.supportKind] ?? d.supportKind}
                        </span>
                        <div className="mt-0.5 text-slate-700">
                          {d.giftDetails || d.programTitle}
                        </div>
                        {d.note && (
                          <div className="text-[11px] italic text-slate-500">
                            {d.note}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                        {d.valueVnd.toLocaleString("vi-VN")} đ
                        <div className="text-[10px] font-normal text-slate-500">
                          {SUPPORT_TIER_LABELS[d.tier] ?? d.tier}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-200 bg-blue-50/70 px-4 py-2.5 text-xs text-blue-900">
              Hệ thống tự động xếp hạng theo <b>Điểm ưu tiên 3 lớp</b> (điểm nền
              nhiều nhóm + điểm cộng địa phương − điểm trừ đã nhận trong 3 tháng)
              để đề xuất danh sách công bằng cho đợt hỗ trợ tiếp theo.
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2.5">Hạng</th>
                  <th className="px-3 py-2.5">Đối tượng</th>
                  <th className="px-3 py-2.5">Thôn</th>
                  <th className="px-3 py-2.5">Nhóm &amp; Hoàn cảnh</th>
                  <th className="px-3 py-2.5">Điểm ưu tiên</th>
                  <th className="px-3 py-2.5">Số lần nhận năm nay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.nextWaveRecommendations ?? []).map((r, idx) => (
                  <tr key={r.citizenId} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-bold text-blue-800">
                      #{idx + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">
                        {r.fullName} ({r.birthYear})
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {r.citizenCode}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{r.villageName}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-800">
                        {r.groupsText}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {r.hardshipSummary}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">
                      {r.totalScore}{" "}
                      <span className="font-normal text-slate-500">
                        ({r.baseScore}+{r.bonusScore}-{r.penaltyScore})
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.receivedCountThisYear} lần
                      {r.warningMessage && (
                        <div className="text-[11px] text-amber-700">
                          {r.warningMessage}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
