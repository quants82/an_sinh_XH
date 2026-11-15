"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, type CurrentUserClient } from "@/components/AppShell";
import {
  Users,
  AlertTriangle,
  Gift,
  ClipboardList,
  HardDrive,
  Download,
  RefreshCw,
  PlusCircle,
  Sparkles,
} from "lucide-react";
import { PROGRAM_STATUS_LABELS } from "@/lib/constants";

interface DashboardData {
  communeName: string;
  driveConnected: boolean;
  driveEmail: string | null;
  lastBackupAt: string | null;
  summary: {
    totalCitizens: number;
    activeCount: number;
    pendingReviewCount: number;
    deliveriesThisYear: number;
    totalValueThisYear: number;
    openTasks: number;
  };
  villageStats: Array<{ id: number; code: string; name: string; count: number }>;
  groupStats: Array<{ id: number; code: string; name: string; count: number }>;
  recentPrograms: Array<{
    id: number;
    programCode: string;
    title: string;
    donorName: string;
    totalSlots: number;
    unitValue: number;
    status: string;
  }>;
}

export default function DashboardPage() {
  const [user, setUser] = useState<CurrentUserClient | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");

  const loadData = useCallback(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setData(d);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleBackupNow(downloadOnly = false) {
    setBackingUp(true);
    setBackupMsg("");
    try {
      if (downloadOnly) {
        window.location.href = "/api/drive/backup?download=1";
        return;
      }
      const res = await fetch("/api/drive/backup", { method: "POST" });
      if (
        res.headers
          .get("content-type")
          ?.includes("application/vnd.openxmlformats")
      ) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `BACKUP_ANSINH_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        setBackupMsg("Đã tải xuống bản sao lưu Excel (do Drive chưa kết nối).");
      } else {
        const d = await res.json();
        if (res.ok && d.uploadedToDrive) {
          setBackupMsg(`Đã sao lưu thành công lên Google Drive: ${d.fileName}`);
          loadData();
        } else {
          setBackupMsg(d.error || "Sao lưu thất bại");
        }
      }
    } finally {
      setBackingUp(false);
    }
  }

  return (
    <AppShell onReady={({ user: u }) => setUser(u)}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Tổng quan An sinh Xã hội
            </h1>
            <p className="text-xs text-slate-500">
              Số liệu tổng hợp theo thời gian thực và cảnh báo hồ sơ cần xử lý
            </p>
          </div>
          {user &&
            (user.role === "OWNER" ||
              user.role === "LEADER" ||
              user.role === "DEPT_HEAD") && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleBackupNow(false)}
                  disabled={backingUp}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-800 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${backingUp ? "animate-spin" : ""}`}
                  />
                  <span>
                    {data?.driveConnected
                      ? "Sao lưu lên Google Drive"
                      : "Xuất file sao lưu Excel"}
                  </span>
                </button>
                <button
                  onClick={() => handleBackupNow(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Tải bản sao lưu</span>
                </button>
              </div>
            )}
        </div>

        {backupMsg && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-900">
            {backupMsg}
          </div>
        )}

        {/* Giao diện siêu đơn giản ưu tiên cho Trưởng thôn trên điện thoại */}
        {user?.role === "VILLAGE_HEAD" && (
          <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/70 p-4">
            <h2 className="mb-3 text-sm font-bold text-blue-950">
              Thao tác nhanh dành cho Trưởng thôn
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Link
                href="/citizens?new=1"
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 py-4 text-sm font-bold text-white shadow-xs hover:bg-blue-900"
              >
                <PlusCircle className="h-5 w-5" />
                <span>+ Báo trường hợp mới ở thôn</span>
              </Link>
              <Link
                href="/citizens"
                className="flex items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-4 text-sm font-bold text-blue-900 hover:bg-blue-50"
              >
                <Users className="h-5 w-5" />
                <span>Xem danh sách thôn của tôi</span>
              </Link>
              <Link
                href="/tasks"
                className="flex items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-4 text-sm font-bold text-blue-900 hover:bg-blue-50"
              >
                <ClipboardList className="h-5 w-5" />
                <span>Việc Lãnh đạo giao ({data?.summary.openTasks ?? 0})</span>
              </Link>
            </div>
          </div>
        )}

        {/* Nạp dữ liệu mẫu nhanh khi mới khởi tạo */}
        {(user?.role === "OWNER" || user?.role === "LEADER") &&
          data &&
          data.summary.totalCitizens === 0 && (
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 sm:flex-row sm:items-center">
              <div className="text-xs text-indigo-950">
                <div className="font-bold">
                  Hệ thống chưa có dữ liệu — Bạn muốn nạp dữ liệu mẫu giả định để
                  chạy thử?
                </div>
                <div className="mt-0.5 text-indigo-800">
                  Sẽ tạo sẵn 20 hồ sơ yếu thế (đã gán điểm 3 lớp phù hợp), lịch sử
                  nhận quà mẫu và 2 đợt hỗ trợ để kiểm tra bộ lọc &amp; báo cáo.
                </div>
              </div>
              <button
                onClick={async () => {
                  const res = await fetch("/api/admin/seed-demo", {
                    method: "POST",
                  });
                  const d = await res.json();
                  setBackupMsg(d.message || d.error || "");
                  loadData();
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-800"
              >
                <Sparkles className="h-4 w-4" />
                <span>Nạp dữ liệu mẫu ngay</span>
              </button>
            </div>
          )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Tổng hồ sơ quản lý</span>
              <Users className="h-4 w-4 text-blue-700" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {data?.summary.totalCitizens ?? 0}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Đang hoạt động: {data?.summary.activeCount ?? 0}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Chờ rà soát lại (hết hạn tạm)</span>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-700">
              {data?.summary.pendingReviewCount ?? 0}
            </div>
            <Link
              href="/citizens?status=PENDING_REVIEW"
              className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline"
            >
              Xem danh sách rà soát →
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Nhiệm vụ đang mở</span>
              <ClipboardList className="h-4 w-4 text-indigo-700" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {data?.summary.openTasks ?? 0}
            </div>
            <Link
              href="/tasks"
              className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline"
            >
              Đi tới bảng nhiệm vụ →
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>
                {user?.role === "VILLAGE_HEAD"
                  ? "Kết nối Google Drive"
                  : "Lượt hỗ trợ đã trao năm nay"}
              </span>
              {user?.role === "VILLAGE_HEAD" ? (
                <HardDrive className="h-4 w-4 text-emerald-700" />
              ) : (
                <Gift className="h-4 w-4 text-emerald-700" />
              )}
            </div>
            {user?.role === "VILLAGE_HEAD" ? (
              <div className="mt-2 text-sm font-bold text-slate-800">
                {data?.driveConnected ? "Đã kết nối" : "Chưa kết nối"}
              </div>
            ) : (
              <>
                <div className="mt-2 text-2xl font-bold text-emerald-700">
                  {data?.summary.deliveriesThisYear ?? 0}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Tổng giá trị:{" "}
                  {(data?.summary.totalValueThisYear ?? 0).toLocaleString("vi-VN")} đ
                </div>
              </>
            )}
          </div>
        </div>

        {/* Breakdown grids */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Village chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="mb-4 text-sm font-bold text-slate-800">
              Phân bố đối tượng theo Thôn
            </h2>
            <div className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
              {(data?.villageStats ?? []).map((v) => {
                const max = Math.max(
                  1,
                  ...(data?.villageStats.map((x) => x.count) ?? [1])
                );
                const pct = Math.round((v.count / max) * 100);
                return (
                  <div key={v.id} className="text-xs">
                    <div className="mb-1 flex justify-between">
                      <span className="font-medium text-slate-700">
                        {v.code} — {v.name}
                      </span>
                      <span className="font-bold text-slate-900">{v.count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-blue-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Group stats + Recent programs */}
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="mb-3 text-sm font-bold text-slate-800">
                Thống kê theo Nhóm đối tượng
              </h2>
              {data && data.groupStats.length > 0 ? (
                <div className="space-y-2">
                  {data.groupStats.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-slate-700">
                        {g.name}
                      </span>
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-bold text-blue-800">
                        {g.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Chưa có dữ liệu đối tượng. Hãy thêm hồ sơ hoặc Import từ Excel ở
                  mục Đối tượng an sinh.
                </p>
              )}
            </div>

            {user?.role !== "VILLAGE_HEAD" && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-800">
                    Đợt hỗ trợ gần đây
                  </h2>
                  <Link
                    href="/programs"
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    Quản lý tất cả →
                  </Link>
                </div>
                {data && data.recentPrograms.length > 0 ? (
                  <div className="space-y-2">
                    {data.recentPrograms.map((p) => (
                      <Link
                        key={p.id}
                        href={`/programs?id=${p.id}`}
                        className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5 text-xs hover:bg-slate-50"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {p.programCode} — {p.title}
                          </div>
                          <div className="text-slate-500">
                            {p.donorName} • {p.totalSlots} suất (
                            {p.unitValue.toLocaleString("vi-VN")}đ)
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                          {PROGRAM_STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Chưa có đợt hỗ trợ nào được tạo.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
