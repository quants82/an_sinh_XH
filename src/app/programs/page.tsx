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
  Edit3,
  UserPlus,
  Search,
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
  filterGroupIdsJson?: string;
  filterVillageIdsJson?: string;
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
  isActive?: boolean;
}

export default function ProgramsPage() {
  const [user, setUser] = useState<CurrentUserClient | null>(null);
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailProgram, setDetailProgram] = useState<ProgramSummary | null>(null);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [groups, setGroups] = useState<SupportGroupOption[]>([]);
  const [villages, setVillages] = useState<VillageOption[]>([]);
  const [customSupportKinds, setCustomSupportKinds] = useState<string[]>([]);
  const [driveConnected, setDriveConnected] = useState(false);

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<number | null>(null);
  const [programCode, setProgramCode] = useState("HT-2026-TET-01");
  const [title, setTitle] = useState("");
  const [occasionKey, setOccasionKey] = useState("TET_2026");
  const [donorName, setDonorName] = useState("");
  const [supportKind, setSupportKind] = useState("GIFT");
  const [customSupportKindText, setCustomSupportKindText] = useState("");
  const [savingCustomKind, setSavingCustomKind] = useState(false);
  const [unitValue, setUnitValue] = useState(500000);
  const [totalSlots, setTotalSlots] = useState(20);
  const [filterGroupIds, setFilterGroupIds] = useState<number[]>([]);
  const [filterVillageIds, setFilterVillageIds] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  // Thêm nhanh tiêu chí nhóm mới trong modal
  const [newCritName, setNewCritName] = useState("");
  const [newCritScore, setNewCritScore] = useState(8);
  const [addingCrit, setAddingCrit] = useState(false);

  // Modal bổ sung người cụ thể / mới phát sinh trực tiếp vào đợt
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualTab, setManualTab] = useState<"existing" | "new">("existing");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: number;
      citizenCode: string;
      fullName: string;
      birthYear: number;
      villageName: string;
      estimatedScore?: number;
      groups: Array<{ id: number; name: string }>;
    }>
  >([]);
  const [manualReason, setManualReason] = useState("Bổ sung trường hợp mới phát sinh");
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonYear, setNewPersonYear] = useState(1975);
  const [newPersonVillageId, setNewPersonVillageId] = useState(0);
  const [newPersonGroupIds, setNewPersonGroupIds] = useState<number[]>([]);
  const [newPersonHardship, setNewPersonHardship] = useState("");
  const [newPersonBonus, setNewPersonBonus] = useState(2);
  const [savingManual, setSavingManual] = useState(false);

  // Modal ghi nhận phát quà từng dòng khi tick checkbox
  const [deliveryModalRow, setDeliveryModalRow] = useState<AllocationRow | null>(null);
  const [delDate, setDelDate] = useState("");
  const [delKind, setDelKind] = useState("GIFT");
  const [delCustomKindText, setDelCustomKindText] = useState("");
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
        const activeVillages = (d.villages || []).filter(
          (v: VillageOption) => v.isActive !== false
        );
        setVillages(activeVillages);
        if (activeVillages[0]) setNewPersonVillageId(activeVillages[0].id);
        setCustomSupportKinds(d.customSupportKinds || []);
        setDriveConnected(Boolean(d.settings?.driveConnected));
      });
  }, [loadPrograms]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  function openCreateProgramModal() {
    setEditingProgramId(null);
    setProgramCode(`HT-${new Date().getFullYear()}-${String(programs.length + 1).padStart(2, "0")}`);
    setTitle("");
    setOccasionKey("TET_2026");
    setDonorName("");
    setSupportKind("GIFT");
    setCustomSupportKindText("");
    setUnitValue(500000);
    setTotalSlots(20);
    setFilterGroupIds([]);
    setFilterVillageIds([]);
    setErrMsg("");
    setModalOpen(true);
  }

  function openEditProgramModal(p: ProgramSummary) {
    setEditingProgramId(p.id);
    setProgramCode(p.programCode);
    setTitle(p.title);
    setOccasionKey(p.occasionKey);
    setDonorName(p.donorName);
    setSupportKind(p.supportKind);
    setCustomSupportKindText("");
    setUnitValue(p.unitValue);
    setTotalSlots(p.totalSlots);
    try {
      setFilterGroupIds(JSON.parse(p.filterGroupIdsJson || "[]"));
    } catch {
      setFilterGroupIds([]);
    }
    try {
      setFilterVillageIds(JSON.parse(p.filterVillageIdsJson || "[]"));
    } catch {
      setFilterVillageIds([]);
    }
    setErrMsg("");
    setModalOpen(true);
  }

  async function handleSaveProgram(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg("");
    setCreating(true);
    try {
      const res = editingProgramId
        ? await fetch(`/api/programs/${editingProgramId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "UPDATE_PROGRAM",
              title,
              occasionKey,
              donorName,
              supportKind,
              customSupportKind:
                supportKind === "OTHER" ? customSupportKindText : undefined,
              unitValue: Number(unitValue),
              totalSlots: Number(totalSlots),
              filterGroupIds,
              filterVillageIds,
            }),
          })
        : await fetch("/api/programs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              programCode,
              title,
              occasionKey,
              donorName,
              supportKind,
              customSupportKind:
                supportKind === "OTHER" ? customSupportKindText : undefined,
              unitValue: Number(unitValue),
              totalSlots: Number(totalSlots),
              filterGroupIds,
              filterVillageIds,
            }),
          });
      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.error || "Lưu đợt hỗ trợ thất bại");
      } else {
        const targetId = editingProgramId ?? data.program.id;
        if (supportKind === "OTHER" && customSupportKindText.trim()) {
          const clean = customSupportKindText.trim();
          setCustomSupportKinds((prev) =>
            prev.some((k) => k.toLowerCase() === clean.toLowerCase())
              ? prev
              : [...prev, clean]
          );
          setCustomSupportKindText("");
        }
        setModalOpen(false);
        setSelectedId(targetId);
        setActionMsg(
          editingProgramId
            ? "Đã cập nhật tiêu chí đợt hỗ trợ và lọc lại danh sách."
            : "Đã tạo đợt hỗ trợ mới và lọc danh sách ưu tiên."
        );
        loadPrograms();
        loadDetail(targetId);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveCustomSupportKind(
    label: string,
    applyTarget: "program" | "delivery"
  ) {
    const clean = label.trim();
    if (!clean) return;
    setSavingCustomKind(true);
    setErrMsg("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSupportKind: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.error || "Không lưu được hình thức mới");
      } else {
        setCustomSupportKinds(data.customSupportKinds || []);
        if (applyTarget === "program") {
          setSupportKind(data.createdKind || clean);
          setCustomSupportKindText("");
        } else {
          setDelKind(data.createdKind || clean);
          setDelCustomKindText("");
        }
      }
    } finally {
      setSavingCustomKind(false);
    }
  }

  async function handleQuickAddCriterion() {
    if (!newCritName.trim()) {
      setErrMsg("Vui lòng nhập tên nhóm/trường hợp phát sinh mới.");
      return;
    }
    setErrMsg("");
    setAddingCrit(true);
    try {
      const code = `PS_${Date.now().toString(36).toUpperCase()}`;
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newGroup: {
            code,
            name: newCritName.trim(),
            baseScore: Number(newCritScore) || 8,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.createdGroup) {
        setErrMsg(data.error || "Không thêm được tiêu chí mới");
      } else {
        const created: SupportGroupOption = data.createdGroup;
        setGroups((prev) => [...prev, created]);
        setFilterGroupIds((prev) => [...prev, created.id]);
        setNewCritName("");
      }
    } finally {
      setAddingCrit(false);
    }
  }

  async function handleSearchExisting(query: string) {
    setSearchQ(query);
    const params = new URLSearchParams({ q: query, page: "1", pageSize: "15" });
    const res = await fetch(`/api/citizens?${params.toString()}`);
    if (res.ok) {
      const d = await res.json();
      setSearchResults(d.citizens || []);
    }
  }

  async function handleAddExistingToProgram(citizenId: number) {
    if (!selectedId) return;
    setSavingManual(true);
    try {
      const res = await fetch(`/api/programs/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_MANUAL_CITIZEN",
          citizenId,
          reason: manualReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(data.error || "Không thể bổ sung đối tượng");
      } else {
        setManualModalOpen(false);
        setActionMsg("Đã bổ sung đối tượng vào Danh sách chính thức của đợt.");
        loadPrograms();
        loadDetail(selectedId);
      }
    } finally {
      setSavingManual(false);
    }
  }

  async function handleCreateEmergingCitizenAndAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSavingManual(true);
    try {
      const res = await fetch(`/api/programs/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_MANUAL_CITIZEN",
          reason: manualReason || newPersonHardship,
          newCitizen: {
            fullName: newPersonName,
            birthYear: Number(newPersonYear),
            villageId: Number(newPersonVillageId),
            groupIds: newPersonGroupIds,
            hardshipSummary: newPersonHardship,
            localBonusScore: Number(newPersonBonus) || 0,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(data.error || "Không thể tạo & bổ sung đối tượng");
      } else {
        setManualModalOpen(false);
        setNewPersonName("");
        setNewPersonHardship("");
        setActionMsg("Đã tạo hồ sơ phát sinh mới và đưa vào Danh sách chính thức của đợt.");
        loadPrograms();
        loadDetail(selectedId);
      }
    } finally {
      setSavingManual(false);
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
              onClick={openCreateProgramModal}
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
                    {(() => {
                      let gIds: number[] = [];
                      let vIds: number[] = [];
                      try {
                        gIds = JSON.parse(detailProgram.filterGroupIdsJson || "[]");
                      } catch {}
                      try {
                        vIds = JSON.parse(detailProgram.filterVillageIdsJson || "[]");
                      } catch {}
                      const gNames = groups
                        .filter((g) => gIds.includes(g.id))
                        .map((g) => g.name);
                      const vNames = villages
                        .filter((v) => vIds.includes(v.id))
                        .map((v) => `${v.code} (${v.name})`);
                      return (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                          <span className="rounded bg-slate-100 px-2 py-0.5">
                            <b>Nhóm lọc:</b>{" "}
                            {gNames.length > 0 ? gNames.join(", ") : "Tất cả nhóm"}
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-0.5">
                            <b>Thôn:</b>{" "}
                            {vNames.length > 0 ? vNames.join(", ") : "Toàn xã"}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Workflow Actions */}
                  <div className="flex flex-wrap items-start gap-2">
                    {user?.role !== "AUDITOR" &&
                      (detailProgram.status === "DRAFT" ||
                        detailProgram.status === "PENDING_APPROVAL" ||
                        detailProgram.status === "REOPENED") && (
                      <>
                        <button
                          onClick={() => openEditProgramModal(detailProgram)}
                          className="flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Chỉnh sửa đợt &amp; Tiêu chí
                        </button>
                        <button
                          onClick={() => runProgramAction("REFRESH_ALLOCATIONS")}
                          className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Lọc lại
                        </button>
                        {detailProgram.status !== "PENDING_APPROVAL" && (
                          <button
                            onClick={() => runProgramAction("SUBMIT_FOR_LOCK")}
                            className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Trình khóa kỳ
                          </button>
                        )}
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
                  <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <h3 className="text-xs font-bold uppercase text-slate-700">
                      1. Danh sách chính thức ({primaries.length}/
                      {detailProgram.totalSlots} suất)
                    </h3>
                    {user?.role !== "AUDITOR" &&
                      (detailProgram.status === "DRAFT" ||
                        detailProgram.status === "PENDING_APPROVAL" ||
                        detailProgram.status === "REOPENED") && (
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              setNewPersonGroupIds(
                                JSON.parse(detailProgram.filterGroupIdsJson || "[]")
                              );
                            } catch {
                              setNewPersonGroupIds([]);
                            }
                            setManualTab("existing");
                            setManualModalOpen(true);
                            handleSearchExisting("");
                          }}
                          className="flex items-center gap-1 self-start rounded-lg border border-emerald-600 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>+ Thêm trường hợp phát sinh / bổ sung vào đợt</span>
                        </button>
                      )}
                  </div>
                  {primaries.length < detailProgram.totalSlots &&
                    (detailProgram.status === "DRAFT" ||
                      detailProgram.status === "PENDING_APPROVAL" ||
                      detailProgram.status === "REOPENED") && (
                      <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                        Đang lọc được <b>{primaries.length}/{detailProgram.totalSlots}</b> suất theo tiêu chí hiện tại. Bạn có thể bấm <b>&ldquo;Chỉnh sửa đợt &amp; Tiêu chí&rdquo;</b> để tích chọn thêm nhóm/thôn khác, hoặc bấm <b>&ldquo;+ Thêm trường hợp phát sinh / bổ sung vào đợt&rdquo;</b>.
                      </div>
                    )}
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
                {editingProgramId
                  ? "Chỉnh sửa Đợt hỗ trợ & Tiêu chí lọc"
                  : "Tạo Đợt hỗ trợ & Lọc danh sách tự động"}
              </h2>
              <button onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSaveProgram} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Mã chương trình (*)
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingProgramId)}
                    value={programCode}
                    onChange={(e) => setProgramCode(e.target.value.toUpperCase())}
                    placeholder="HT-2026-TET-01"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
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
                    {customSupportKinds.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                    <option value="OTHER">Khác (nhập thêm mới...)</option>
                  </select>
                  {supportKind === "OTHER" && (
                    <div className="mt-2 flex gap-1.5 rounded-lg border border-dashed border-blue-300 bg-blue-50/60 p-2">
                      <input
                        type="text"
                        value={customSupportKindText}
                        onChange={(e) => setCustomSupportKindText(e.target.value)}
                        placeholder="Nhập hình thức mới (vd: Thẻ BHYT, Xe đạp)..."
                        className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
                      />
                      <button
                        type="button"
                        disabled={savingCustomKind || !customSupportKindText.trim()}
                        onClick={() =>
                          handleSaveCustomSupportKind(customSupportKindText, "program")
                        }
                        className="shrink-0 rounded bg-blue-700 px-2.5 py-1 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                      >
                        {savingCustomKind ? "Đang lưu..." : "Lưu vào hệ thống"}
                      </button>
                    </div>
                  )}
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
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-2">
                  <input
                    type="text"
                    value={newCritName}
                    onChange={(e) => setNewCritName(e.target.value)}
                    placeholder="+ Thêm tiêu chí/nhóm mới phát sinh (vd: Hộ khó khăn đột xuất)..."
                    className="min-w-48 flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={newCritScore}
                    onChange={(e) => setNewCritScore(Number(e.target.value))}
                    title="Điểm ưu tiên của nhóm mới"
                    className="w-16 rounded border border-slate-300 bg-white px-2 py-1.5 text-center font-bold"
                  />
                  <button
                    type="button"
                    disabled={addingCrit}
                    onClick={handleQuickAddCriterion}
                    className="rounded-lg bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {addingCrit ? "Đang thêm..." : "+ Thêm tiêu chí"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Phạm vi thôn (để trống = toàn xã)
                </label>
                <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2.5 sm:grid-cols-3">
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
                      <span>
                        <strong className="font-mono text-blue-900">{v.code}</strong> — {v.name}
                      </span>
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
                  {creating
                    ? "Đang lọc..."
                    : editingProgramId
                      ? "Lưu thay đổi & Lọc lại"
                      : "Tạo & Lọc danh sách"}
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
                    customSupportKind:
                      delKind === "OTHER" ? delCustomKindText : undefined,
                    giftDetails: delGiftDetails,
                    valueVnd: Number(delValueVnd),
                    note: delNote,
                  });
                  if (delKind === "OTHER" && delCustomKindText.trim()) {
                    const clean = delCustomKindText.trim();
                    setCustomSupportKinds((prev) =>
                      prev.some((k) => k.toLowerCase() === clean.toLowerCase())
                        ? prev
                        : [...prev, clean]
                    );
                    setDelCustomKindText("");
                  }
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
                    {customSupportKinds.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                    <option value="OTHER">Khác (nhập thêm mới...)</option>
                  </select>
                  {delKind === "OTHER" && (
                    <div className="mt-1.5 flex gap-1">
                      <input
                        type="text"
                        value={delCustomKindText}
                        onChange={(e) => setDelCustomKindText(e.target.value)}
                        placeholder="Nhập loại mới..."
                        className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        disabled={savingCustomKind || !delCustomKindText.trim()}
                        onClick={() =>
                          handleSaveCustomSupportKind(delCustomKindText, "delivery")
                        }
                        className="shrink-0 rounded bg-blue-700 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                      >
                        Lưu
                      </button>
                    </div>
                  )}
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

      {/* Modal bổ sung người cụ thể / mới phát sinh trực tiếp vào đợt */}
      {manualModalOpen && detailProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl text-xs">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Bổ sung đối tượng / Trường hợp phát sinh vào đợt
                </h2>
                <p className="text-slate-500">
                  {detailProgram.programCode} — {detailProgram.title}
                </p>
              </div>
              <button onClick={() => setManualModalOpen(false)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setManualTab("existing")}
                className={`rounded-lg px-3 py-2 font-semibold ${
                  manualTab === "existing"
                    ? "bg-blue-800 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
              >
                Chọn người đã có trong hệ thống
              </button>
              <button
                type="button"
                onClick={() => setManualTab("new")}
                className={`rounded-lg px-3 py-2 font-semibold ${
                  manualTab === "new"
                    ? "bg-blue-800 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
              >
                + Nhập trường hợp MỚI phát sinh
              </button>
            </div>

            <div className="mb-3">
              <label className="mb-1 block font-semibold text-slate-700">
                Lý do bổ sung vào đợt
              </label>
              <input
                type="text"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder="vd: Hộ mới phát sinh khó khăn đột xuất"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            {manualTab === "existing" ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQ}
                    onChange={(e) => handleSearchExisting(e.target.value)}
                    placeholder="Gõ tên hoặc mã công dân cần thêm vào đợt..."
                    className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9"
                  />
                </div>
                <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">
                      Không tìm thấy đối tượng phù hợp.
                    </div>
                  ) : (
                    searchResults.map((c) => {
                      const alreadyIn = allocations.some(
                        (a) =>
                          a.citizenId === c.id &&
                          (a.allocationType === "PRIMARY" || a.leaderExceptionApproved)
                      );
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between gap-2 p-2.5 hover:bg-slate-50"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">
                              {c.fullName} ({c.birthYear}) — {c.villageName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {c.citizenCode} • {c.groups.map((g) => g.name).join(", ")} •{" "}
                              <b>{c.estimatedScore ?? 0} điểm</b>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={alreadyIn || savingManual}
                            onClick={() => handleAddExistingToProgram(c.id)}
                            className="shrink-0 rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-500"
                          >
                            {alreadyIn ? "Đã có trong đợt" : "+ Thêm vào đợt"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateEmergingCitizenAndAdd} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block font-semibold">Họ và tên (*)</label>
                    <input
                      type="text"
                      required
                      value={newPersonName}
                      onChange={(e) => setNewPersonName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold">Năm sinh (*)</label>
                    <input
                      type="number"
                      required
                      min={1900}
                      max={new Date().getFullYear()}
                      value={newPersonYear}
                      onChange={(e) => setNewPersonYear(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-semibold">Thôn (*)</label>
                    <select
                      value={newPersonVillageId}
                      onChange={(e) => setNewPersonVillageId(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      {villages.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.code} — {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold">Điểm cộng thêm</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={newPersonBonus}
                      onChange={(e) => setNewPersonBonus(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-semibold">
                    Nhóm đối tượng (* chọn ít nhất 1)
                  </label>
                  <div className="grid max-h-32 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
                    {groups.map((g) => (
                      <label key={g.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newPersonGroupIds.includes(g.id)}
                          onChange={(e) =>
                            setNewPersonGroupIds(
                              e.target.checked
                                ? [...newPersonGroupIds, g.id]
                                : newPersonGroupIds.filter((id) => id !== g.id)
                            )
                          }
                        />
                        <span>{g.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-semibold">
                    Hoàn cảnh cụ thể / ghi chú phát sinh
                  </label>
                  <input
                    type="text"
                    value={newPersonHardship}
                    onChange={(e) => setNewPersonHardship(e.target.value)}
                    placeholder="vd: Hộ mới phát sinh do bệnh đột xuất / thiệt hại bão"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setManualModalOpen(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={savingManual || newPersonGroupIds.length === 0}
                    className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {savingManual ? "Đang lưu..." : "Lưu hồ sơ & Đưa vào đợt"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
