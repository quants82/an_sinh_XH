"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, type CurrentUserClient } from "@/components/AppShell";
import {
  Plus,
  RefreshCw,
  Lock,
  CheckCircle2,
  Unlock,
  Download,
  Printer,
  HardDrive,
  AlertTriangle,
  X,
} from "lucide-react";
import { PROGRAM_STATUS_LABELS, SUPPORT_TIER_LABELS } from "@/lib/constants";

interface ProgramSummary {
  id: number;
  programCode: string;
  title: string;
  occasionKey: string;
  donorName: string;
  supportKind: string;
  unitValue: number;
  tier: string;
  totalSlots: number;
  status: string;
  counts: { primary: number; reserve: number; warnings: number };
}

interface AllocationRow {
  id: number;
  citizenId: number;
  citizenCode: string;
  fullName: string;
  birthYear: number;
  villageName: string;
  hardshipSummary: string;
  groupsText: string;
  allocationType: string;
  baseScore: number;
  bonusScore: number;
  penaltyScore: number;
  totalScore: number;
  receivedCountThisYear: number;
  receivedInWindow: boolean;
  warningFlag: string;
  warningMessage: string | null;
  leaderExceptionApproved: boolean;
  exceptionReason: string | null;
  isDelivered: boolean;
  deliveredAt: string | null;
  deliveredSupportKind: string | null;
  deliveredGiftDetails: string | null;
  deliveredValueVnd: number | null;
  deliveryNote: string | null;
}

interface SupportGroupOption {
  id: number;
  name: string;
  isActive: boolean;
}

interface VillageOption {
  id: number;
  code: string;
  name: string;
}

export default function ProgramsPage() {
  const [user, setUser] = useState<CurrentUserClient | null>(null);
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailProgram, setDetailProgram] = useState<ProgramSummary | null>(null);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [groups, setGroups] = useState<SupportGroupOption[]>([]);
  const [villages, setVillages] = useState<VillageOption[]>([]);
  const [driveConnected, setDriveConnected] = useState(false);

  // Create modal
  const [modalOpen, setModalOpen] = useState(false);
  const [programCode, setProgramCode] = useState("HT-2026-TET-01");
  const [title, setTitle] = useState("");
  const [occasionKey, setOccasionKey] = useState("TET_2026");
  const [donorName, setDonorName] = useState("");
  const [supportKind, setSupportKind] = useState("GIFT");
  const [unitValue, setUnitValue] = useState(500000);
  const [totalSlots, setTotalSlots] = useState(20);
  const [filterGroupIds, setFilterGroupIds] = useState<number[]>([]);
  const [filterVillageIds, setFilterVillageIds] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  // Modal ghi nhận phát quà từng dòng khi tick checkbox
  const [deliveryModalRow, setDeliveryModalRow] = useState<AllocationRow | null>(null);
  const [delDate, setDelDate] = useState("");
  const [delKind, setDelKind] = useState("GIFT");
  const [delGiftDetails, setDelGiftDetails] = useState("");
  const [delValueVnd, setDelValueVnd] = useState(500000);
  const [delNote, setDelNote] = useState("");
  const [delSaving, setDelSaving] = useState(false);

  const loadPrograms = useCallback(() => {
    fetch("/api/programs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.programs) {
          setPrograms(d.programs);
          if (!selectedId && d.programs[0]) {
            setSelectedId(d.programs[0].id);
          }
        }
      });
  }, [selectedId]);

  const loadDetail = useCallback((id: number) => {
    fetch(`/api/programs/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setDetailProgram(d.program);
          setAllocations(d.allocations || []);
        }
      });
  }, []);

  useEffect(() => {
    loadPrograms();
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setGroups((d.supportGroups || []).filter((g: SupportGroupOption) => g.isActive));
        setVillages(d.villages || []);
        setDriveConnected(Boolean(d.settings?.driveConnected));
      });
  }, [loadPrograms]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function handleCreateProgram(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg("");
    setCreating(true);
    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programCode,
          title,
          occasionKey,
          donorName,
          supportKind,
          unitValue: Number(unitValue),
          totalSlots: Number(totalSlots),
          filterGroupIds,
          filterVillageIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.error || "Tạo đợt hỗ trợ thất bại");
      } else {
        setModalOpen(false);
        setSelectedId(data.program.id);
        loadPrograms();
        loadDetail(data.program.id);
      }
    } finally {
      setCreating(false);
    }
  }

  async function runProgramAction(
    action: string,
    extra: Record<string, unknown> = {}
  ) {
    if (!selectedId) return;
    setActionMsg("");
    const res = await fetch(`/api/programs/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionMsg(data.error || "Thao tác thất bại");
    } else {
      setActionMsg(
        action === "MARK_DELIVERED"
          ? `Đã chốt trao quà và ghi lịch sử cho ${data.count} đối tượng.`
          : "Đã cập nhật trạng thái chương trình."
      );
      loadPrograms();
      loadDetail(selectedId);
    }
  }

  async function saveExportToDrive(type: "internal" | "signoff") {
    if (!selectedId) return;
    const res = await fetch(
      `/api/programs/${selectedId}/export?type=${type}&saveToDrive=1`
    );
    const data = await res.json();
    if (res.ok) {
      setActionMsg(`Đã lưu file lên Google Drive: ${data.driveFile.name}`);
    } else {
      setActionMsg(data.error || "Lưu Drive thất bại");
    }
  }

  const canLock =
    user?.role === "OWNER" ||
    user?.role === "LEADER" ||
    user?.role === "DEPT_HEAD";
  const canApprove = user?.role === "OWNER" || user?.role === "LEADER";

  const primaries = allocations.filter(
    (a) => a.allocationType === "PRIMARY" || a.leaderExceptionApproved
  );
  const reserves = allocations.filter(
    (a) => a.allocationType === "RESERVE_SECOND_ROUND" && !a.leaderExceptionApproved
  );

  return (
    <AppShell onReady={({ user: u }) => setUser(u)}>
      <div className="space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Đợt hỗ trợ &amp; Bộ lọc Ưu tiên 3 lớp
            </h1>
            <p className="text-xs text-slate-500">
              Tự động chấm điểm, loại trùng cùng dịp (giữ suất cao nhất), cảnh
              báo nhận nhiều lần và xuất 2 loại danh sách tách biệt
            </p>
          </div>
          {user?.role !== "AUDITOR" && user?.role !== "VILLAGE_HEAD" && (
            <button
              onClick={() => {
                setErrMsg("");
                setModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-blue-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-900"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo đợt hỗ trợ mới</span>
            </button>
          )}
        </div>

        {actionMsg && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-900">
            {actionMsg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Program List */}
          <div className="space-y-2 lg:col-span-4">
            {programs.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                Chưa có đợt hỗ trợ nào. Bấm &ldquo;Tạo đợt hỗ trợ mới&rdquo; để
                lọc danh sách.
              </div>
            ) : (
              programs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full rounded-xl border p-3.5 text-left text-xs transition ${
                    selectedId === p.id
                      ? "border-blue-700 bg-blue-50/70 shadow-xs"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-blue-900">
                      {p.programCode}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {PROGRAM_STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    {p.title}
                  </div>
                  <div className="mt-1 text-slate-500">
                    Tài trợ: {p.donorName} • Dịp: <b>{p.occasionKey}</b>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">
                      {p.counts.primary}/{p.totalSlots} suất chính thức
                    </span>
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                      {p.counts.reserve} dự phòng lần 2
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Selected Program Details */}
          <div className="lg:col-span-8">
            {detailProgram ? (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-800">
                        {detailProgram.programCode}
                      </span>
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
                        {SUPPORT_TIER_LABELS[detailProgram.tier] ?? detailProgram.tier} (
                        {detailProgram.unitValue.toLocaleString("vi-VN")} đ)
                      </span>
                    </div>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">
                      {detailProgram.title}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Trạng thái:{" "}
                      <b>
                        {PROGRAM_STATUS_LABELS[detailProgram.status] ??
                          detailProgram.status}
                      </b>{" "}
                      • Tài trợ: {detailProgram.donorName}
                    </p>
                  </div>

                  {/* Workflow Actions */}
                  <div className="flex flex-wrap items-start gap-2">
                    {(detailProgram.status === "DRAFT" ||
                      detailProgram.status === "REOPENED") && (
                      <>
                        <button
                          onClick={() => runProgramAction("REFRESH_ALLOCATIONS")}
                          className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Lọc lại
                        </button>
                        <button
                          onClick={() => runProgramAction("SUBMIT_FOR_LOCK")}
                          className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Trình khóa kỳ
                        </button>
                      </>
                    )}

                    {canLock &&
                      (detailProgram.status === "DRAFT" ||
                        detailProgram.status === "PENDING_APPROVAL" ||
                        detailProgram.status === "REOPENED") && (
                        <button
                          onClick={() => runProgramAction("LOCK")}
                          className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          <Lock className="h-3.5 w-3.5" /> Khóa danh sách
                        </button>
                      )}

                    {canApprove && detailProgram.status === "LOCKED" && (
                      <button
                        onClick={() => runProgramAction("APPROVE")}
                        className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Phê duyệt chính thức
                      </button>
                    )}

                    {canApprove &&
                      (detailProgram.status === "LOCKED" ||
                        detailProgram.status === "APPROVED") && (
                        <button
                          onClick={() => {
                            const reason = window.prompt(
                              "Nhập lý do bắt buộc khi mở lại kỳ đã khóa:"
                            );
                            if (reason) runProgramAction("REOPEN", { reason });
                          }}
                          className="flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-700"
                        >
                          <Unlock className="h-3.5 w-3.5" /> Mở lại
                        </button>
                      )}

                    {canLock &&
                      (detailProgram.status === "LOCKED" ||
                        detailProgram.status === "APPROVED") && (
                        <button
                          onClick={() => runProgramAction("MARK_DELIVERED")}
                          className="rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Xác nhận đã trao quà (Lưu lịch sử)
                        </button>
                      )}
                  </div>
                </div>

                {/* Export toolbar */}
                <div className="flex flex-wrap gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                  <a
                    href={`/api/programs/${detailProgram.id}/export?type=internal`}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Download className="h-3.5 w-3.5 text-blue-700" />
                    Excel Quản lý Nội bộ (đầy đủ)
                  </a>
                  <a
                    href={`/api/programs/${detailProgram.id}/export?type=signoff`}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-700" />
                    Excel Ký nhận rút gọn (6 cột)
                  </a>
                  <Link
                    href={`/programs/${detailProgram.id}/print`}
                    target="_blank"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Printer className="h-3.5 w-3.5 text-indigo-700" />
                    In A4 Ký nhận &amp; Biên bản bàn giao
                  </Link>
                  {driveConnected && (
                    <button
                      onClick={() => saveExportToDrive("internal")}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 font-semibold text-blue-800 hover:bg-blue-100"
                    >
                      <HardDrive className="h-3.5 w-3.5" />
                      Lưu lên Google Drive
                    </button>
                  )}
                </div>

                {/* Primary Allocations */}
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase text-slate-700">
                    1. Danh sách chính thức ({primaries.length}/
                    {detailProgram.totalSlots} suất)
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-2.5 py-2 text-center">Đã nhận</th>
                          <th className="px-2.5 py-2">STT</th>
                          <th className="px-2.5 py-2">Họ tên / Mã</th>
                          <th className="px-2.5 py-2">Thôn</th>
                          <th className="px-2.5 py-2">Điểm (Nền+Cộng-Trừ)</th>
                          <th className="px-2.5 py-2">Cảnh báo / Ghi nhận phát</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {primaries.map((a, idx) => (
                          <tr
                            key={a.id}
                            className={
                              a.isDelivered
                                ? "bg-emerald-50/50"
                                : a.warningFlag !== "NONE"
                                ? "bg-amber-50/70"
                                : ""
                            }
                          >
                            <td className="px-2.5 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={a.isDelivered}
                                disabled={
                                  detailProgram.status !== "LOCKED" &&
                                  detailProgram.status !== "APPROVED"
                                }
                                title={
                                  detailProgram.status !== "LOCKED" &&
                                  detailProgram.status !== "APPROVED"
                                    ? "Khóa hoặc phê duyệt danh sách trước khi tick ghi nhận phát quà"
                                    : "Tick để ghi nhận ngày, loại quà, số tiền đã cấp phát"
                                }
                                onChange={(e) => {
                                  if (e.target.checked || a.isDelivered) {
                                    setDeliveryModalRow(a);
                                    setDelDate(
                                      a.deliveredAt
                                        ? a.deliveredAt.slice(0, 10)
                                        : new Date().toISOString().slice(0, 10)
                                    );
                                    setDelKind(
                                      a.deliveredSupportKind ||
                                        detailProgram.supportKind
                                    );
                                    setDelGiftDetails(
                                      a.deliveredGiftDetails || detailProgram.title
                                    );
                                    setDelValueVnd(
                                      a.deliveredValueVnd ?? detailProgram.unitValue
                                    );
                                    setDelNote(a.deliveryNote || "");
                                  }
                                }}
                                className="h-4 w-4 cursor-pointer accent-emerald-700"
                              />
                            </td>
                            <td className="px-2.5 py-2">{idx + 1}</td>
                            <td className="px-2.5 py-2">
                              <div className="font-semibold text-slate-900">
                                {a.fullName} ({a.birthYear})
                              </div>
                              <div className="font-mono text-[10px] text-slate-500">
                                {a.citizenCode} • {a.groupsText}
                              </div>
                            </td>
                            <td className="px-2.5 py-2">{a.villageName}</td>
                            <td className="px-2.5 py-2 font-bold text-blue-900">
                              {a.totalScore}{" "}
                              <span className="font-normal text-slate-500">
                                ({a.baseScore}+{a.bonusScore}-{a.penaltyScore})
                              </span>
                            </td>
                            <td className="px-2.5 py-2">
                              {a.warningMessage ? (
                                <div className="flex items-start gap-1 text-amber-800">
                                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                  <span>{a.warningMessage}</span>
                                </div>
                              ) : (
                                <span className="text-emerald-700">
                                  Đủ điều kiện
                                </span>
                              )}
                              {a.isDelivered && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeliveryModalRow(a);
                                    setDelDate(
                                      a.deliveredAt
                                        ? a.deliveredAt.slice(0, 10)
                                        : new Date().toISOString().slice(0, 10)
                                    );
                                    setDelKind(
                                      a.deliveredSupportKind ||
                                        detailProgram.supportKind
                                    );
                                    setDelGiftDetails(
                                      a.deliveredGiftDetails || detailProgram.title
                                    );
                                    setDelValueVnd(
                                      a.deliveredValueVnd ?? detailProgram.unitValue
                                    );
                                    setDelNote(a.deliveryNote || "");
                                  }}
                                  className="mt-1 block text-left text-[11px] font-semibold text-emerald-700 underline"
                                >
                                  ✓ Đã nhận{" "}
                                  {a.deliveredAt
                                    ? new Date(a.deliveredAt).toLocaleDateString(
                                        "vi-VN"
                                      )
                                    : ""}
                                  {a.deliveredGiftDetails
                                    ? ` (${a.deliveredGiftDetails} — ${(
                                        a.deliveredValueVnd ?? detailProgram.unitValue
                                      ).toLocaleString("vi-VN")}đ)`
                                    : ""}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Reserve Second Round */}
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase text-amber-800">
                    2. Danh sách dự phòng nhận lần 2 / Trùng cùng dịp (
                    {reserves.length})
                  </h3>
                  {reserves.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Không có trường hợp trùng trong dịp {detailProgram.occasionKey}.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-amber-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-amber-50 text-amber-900">
                          <tr>
                            <th className="px-2.5 py-2">Họ tên</th>
                            <th className="px-2.5 py-2">Thôn</th>
                            <th className="px-2.5 py-2">Điểm</th>
                            <th className="px-2.5 py-2">Lý do cảnh báo</th>
                            <th className="px-2.5 py-2 text-right">Duyệt ngoại lệ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                          {reserves.map((a) => (
                            <tr key={a.id}>
                              <td className="px-2.5 py-2 font-semibold">
                                {a.fullName} ({a.birthYear})
                              </td>
                              <td className="px-2.5 py-2">{a.villageName}</td>
                              <td className="px-2.5 py-2 font-bold">
                                {a.totalScore}
                              </td>
                              <td className="px-2.5 py-2 text-amber-900">
                                {a.warningMessage}
                              </td>
                              <td className="px-2.5 py-2 text-right">
                                {canLock && (
                                  <button
                                    onClick={() => {
                                      const reason = window.prompt(
                                        "Nhập lý do duyệt nhận ngoại lệ / nhận suất dư:"
                                      );
                                      if (reason)
                                        runProgramAction("APPROVE_EXCEPTION", {
                                          allocationId: a.id,
                                          reason,
                                        });
                                    }}
                                    className="rounded bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
                                  >
                                    Duyệt nhận lần 2
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
                Chọn một đợt hỗ trợ bên trái để xem danh sách lọc thông minh.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Program Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Tạo Đợt hỗ trợ &amp; Lọc danh sách tự động
              </h2>
              <button onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreateProgram} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Mã chương trình (*)
                  </label>
                  <input
                    type="text"
                    required
                    value={programCode}
                    onChange={(e) => setProgramCode(e.target.value.toUpperCase())}
                    placeholder="HT-2026-TET-01"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Mã dịp (check trùng cùng dịp) (*)
                  </label>
                  <input
                    type="text"
                    required
                    value={occasionKey}
                    onChange={(e) => setOccasionKey(e.target.value.toUpperCase())}
                    placeholder="TET_2026"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Tên chương trình hỗ trợ (*)
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="vd: Tặng quà Tết Bính Ngọ 2026"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Đơn vị tài trợ (*)
                  </label>
                  <input
                    type="text"
                    required
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="vd: Hội Chữ thập đỏ / Doanh nghiệp A"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Hình thức hỗ trợ
                  </label>
                  <select
                    value={supportKind}
                    onChange={(e) => setSupportKind(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="GIFT">Quà / Hiện vật</option>
                    <option value="CASH">Tiền mặt</option>
                    <option value="SCHOLARSHIP">Học bổng</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Giá trị mỗi suất (VNĐ) (*)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={50000}
                    value={unitValue}
                    onChange={(e) => setUnitValue(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Số lượng suất cần lọc (*)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={totalSlots}
                    onChange={(e) => setTotalSlots(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Tiêu chí nhóm đối tượng (để trống = lọc tất cả nhóm)
                </label>
                <div className="grid max-h-32 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
                  {groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filterGroupIds.includes(g.id)}
                        onChange={(e) =>
                          setFilterGroupIds(
                            e.target.checked
                              ? [...filterGroupIds, g.id]
                              : filterGroupIds.filter((id) => id !== g.id)
                          )
                        }
                      />
                      <span>{g.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Phạm vi thôn (để trống = toàn xã)
                </label>
                <div className="grid max-h-24 grid-cols-3 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-4">
                  {villages.map((v) => (
                    <label key={v.id} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={filterVillageIds.includes(v.id)}
                        onChange={(e) =>
                          setFilterVillageIds(
                            e.target.checked
                              ? [...filterVillageIds, v.id]
                              : filterVillageIds.filter((id) => id !== v.id)
                          )
                        }
                      />
                      <span>{v.code}</span>
                    </label>
                  ))}
                </div>
              </div>

              {errMsg && (
                <div className="rounded-lg bg-red-50 p-2.5 text-red-700">
                  {errMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white hover:bg-blue-900"
                >
                  {creating ? "Đang lọc..." : "Tạo & Lọc danh sách"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Per-row Delivery Capture Modal */}
      {deliveryModalRow && detailProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-xs">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div>
                <div className="font-bold text-blue-800">
                  Ghi nhận Cấp phát Thực tế
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {deliveryModalRow.fullName} ({deliveryModalRow.birthYear}) —{" "}
                  {deliveryModalRow.villageName}
                </div>
              </div>
              <button onClick={() => setDeliveryModalRow(null)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setDelSaving(true);
                try {
                  await runProgramAction("TOGGLE_ROW_DELIVERY", {
                    allocationId: deliveryModalRow.id,
                    isDelivered: true,
                    deliveredAt: delDate,
                    supportKind: delKind,
                    giftDetails: delGiftDetails,
                    valueVnd: Number(delValueVnd),
                    note: delNote,
                  });
                  setDeliveryModalRow(null);
                } finally {
                  setDelSaving(false);
                }
              }}
              className="space-y-3"
            >
              <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-700">
                <div>
                  <b>Mã ĐD:</b> {deliveryModalRow.citizenCode}
                </div>
                <div>
                  <b>Nhóm đối tượng:</b> {deliveryModalRow.groupsText}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Ngày nhận thực tế (*)
                  </label>
                  <input
                    type="date"
                    required
                    value={delDate}
                    onChange={(e) => setDelDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Loại hỗ trợ (*)
                  </label>
                  <select
                    value={delKind}
                    onChange={(e) => setDelKind(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2"
                  >
                    <option value="GIFT">Quà / Hiện vật</option>
                    <option value="CASH">Tiền mặt</option>
                    <option value="SCHOLARSHIP">Học bổng</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Tên loại quà / chi tiết hỗ trợ (*)
                </label>
                <input
                  type="text"
                  required
                  value={delGiftDetails}
                  onChange={(e) => setDelGiftDetails(e.target.value)}
                  placeholder="vd: 10kg gạo + 1 thùng mì + 300k tiền mặt"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Số tiền / Giá trị quy đổi (VNĐ) (*)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step={10000}
                  value={delValueVnd}
                  onChange={(e) => setDelValueVnd(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Ghi chú thêm (người nhận thay nếu có)
                </label>
                <input
                  type="text"
                  value={delNote}
                  onChange={(e) => setDelNote(e.target.value)}
                  placeholder="vd: Con gái ký nhận thay"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="flex flex-wrap justify-between gap-2 pt-2">
                {deliveryModalRow.isDelivered ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await runProgramAction("TOGGLE_ROW_DELIVERY", {
                        allocationId: deliveryModalRow.id,
                        isDelivered: false,
                        reason: delNote || "Hủy tick nhầm",
                      });
                      setDeliveryModalRow(null);
                    }}
                    className="rounded-lg border border-red-300 px-3 py-2 font-semibold text-red-700"
                  >
                    Bỏ đánh dấu đã nhận
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryModalRow(null)}
                    className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={delSaving}
                    className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
                  >
                    {delSaving ? "Đang lưu..." : "Lưu ghi nhận"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
