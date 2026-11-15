"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AppShell, type CurrentUserClient } from "@/components/AppShell";
import {
  Plus,
  Search,
  Upload,
  Download,
  FileText,
  AlertTriangle,
  Eye,
  X,
  Paperclip,
} from "lucide-react";
import { CITIZEN_STATUS_LABELS } from "@/lib/constants";

interface Village {
  id: number;
  code: string;
  name: string;
}

interface SupportGroup {
  id: number;
  code: string;
  name: string;
  baseScore: number;
  isActive: boolean;
  isPhase2Optional: boolean;
  isTemporaryDefault: boolean;
}

interface CitizenRow {
  id: number;
  citizenCode: string;
  recordType: string;
  fullName: string;
  birthYear: number;
  gender: string;
  villageId: number;
  villageName: string;
  addressDetail: string;
  phone?: string | null;
  guardianNote?: string | null;
  hardshipSummary: string;
  status: string;
  localBonusScore?: number;
  localBonusReason?: string | null;
  estimatedScore?: number;
  receivedCountThisYear?: number;
  evidenceCount: number;
  groups: Array<{ id: number; code: string; name: string }>;
}

interface CitizenDetailPayload {
  citizen: CitizenRow & { tempExpiresAt: string | null };
  histories: Array<{
    id: number;
    programCode: string;
    programTitle: string;
    donorName: string;
    valueVnd: number;
    receivedAt: string;
  }>;
  changes: Array<{
    id: number;
    changeType: string;
    summary: string;
    createdAt: string;
  }>;
  evidences: Array<{
    id: number;
    fileName: string;
    mimeType: string;
    fileSize: number;
    createdAt: string;
  }>;
}

export default function CitizensPage() {
  const [user, setUser] = useState<CurrentUserClient | null>(null);
  const [citizens, setCitizens] = useState<CitizenRow[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [groups, setGroups] = useState<SupportGroup[]>([]);
  const [driveConnected, setDriveConnected] = useState(false);

  const [q, setQ] = useState("");
  const [villageFilter, setVillageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");

  // Modal Create/Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [recordType, setRecordType] = useState<"INDIVIDUAL" | "HOUSEHOLD_DISASTER">("INDIVIDUAL");
  const [fullName, setFullName] = useState("");
  const [birthYear, setBirthYear] = useState(1965);
  const [gender, setGender] = useState<"NAM" | "NU" | "KHAC">("NAM");
  const [villageId, setVillageId] = useState<number>(1);
  const [addressDetail, setAddressDetail] = useState("");
  const [phone, setPhone] = useState("");
  const [guardianNote, setGuardianNote] = useState("");
  const [hardshipSummary, setHardshipSummary] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [localBonusScore, setLocalBonusScore] = useState(0);
  const [localBonusReason, setLocalBonusReason] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [editReason, setEditReason] = useState("");
  const [duplicateAlert, setDuplicateAlert] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Detail Drawer
  const [detail, setDetail] = useState<CitizenDetailPayload | null>(null);
  const [uploadingEv, setUploadingEv] = useState(false);
  const [evMsg, setEvMsg] = useState("");

  // Import Excel
  const [importMsg, setImportMsg] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [dragOverImport, setDragOverImport] = useState(false);
  const [skipReducedPaused, setSkipReducedPaused] = useState(false);
  const [attachGroupOnDuplicate, setAttachGroupOnDuplicate] = useState(true);
  const [allowIncompleteDob, setAllowIncompleteDob] = useState(true);
  const [fallbackVillageId, setFallbackVillageId] = useState<number>(0);
  const [importPreview, setImportPreview] = useState<{
    format: string;
    totalRowsRead: number;
    willInsertCount: number;
    willMergeGroupCount: number;
    reviewFlaggedCount: number;
    skippedTotal: number;
    bySheet: Array<{ sheetName: string; count: number }>;
    byGroup: Array<{
      groupCode: string;
      groupName: string;
      rawSection?: string;
      baseScore: number;
      count: number;
    }>;
    byVillage: Array<{ villageName: string; count: number }>;
    sampleWarnings: Array<{ sheet: string; row: number; name: string; reason: string }>;
  } | null>(null);

  const loadMeta = useCallback(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setVillages(d.villages || []);
        setGroups((d.supportGroups || []).filter((g: SupportGroup) => g.isActive));
        setDriveConnected(Boolean(d.settings?.driveConnected));
      });
  }, []);

  const loadCitizens = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (villageFilter) params.set("villageId", villageFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (groupFilter) params.set("groupId", groupFilter);
    fetch(`/api/citizens?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.citizens) setCitizens(d.citizens);
      });
  }, [q, villageFilter, statusFilter, groupFilter]);

  useEffect(() => {
    loadMeta();
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("status")) setStatusFilter(sp.get("status") || "");
    if (sp.get("new") === "1") setModalOpen(true);
  }, [loadMeta]);

  useEffect(() => {
    loadCitizens();
  }, [loadCitizens]);

  function openCreateModal() {
    setEditingId(null);
    setRecordType("INDIVIDUAL");
    setFullName("");
    setBirthYear(1965);
    setGender("NAM");
    setVillageId(user?.villageId || villages[0]?.id || 1);
    setAddressDetail("");
    setPhone("");
    setGuardianNote("");
    setHardshipSummary("");
    setStatus("ACTIVE");
    setLocalBonusScore(0);
    setLocalBonusReason("");
    setSelectedGroupIds([]);
    setEditReason("");
    setDuplicateAlert("");
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(c: CitizenRow) {
    setEditingId(c.id);
    setRecordType(
      c.recordType === "HOUSEHOLD_DISASTER"
        ? "HOUSEHOLD_DISASTER"
        : "INDIVIDUAL"
    );
    setFullName(c.fullName);
    setBirthYear(c.birthYear);
    setGender((c.gender as "NAM" | "NU" | "KHAC") || "KHAC");
    setVillageId(c.villageId);
    setAddressDetail(c.addressDetail);
    setPhone(c.phone || "");
    setGuardianNote(c.guardianNote || "");
    setHardshipSummary(c.hardshipSummary);
    setStatus(c.status);
    setLocalBonusScore(c.localBonusScore || 0);
    setLocalBonusReason(c.localBonusReason || "");
    setSelectedGroupIds(c.groups.map((g) => g.id));
    setEditReason("");
    setDuplicateAlert("");
    setFormError("");
    setModalOpen(true);
  }

  async function handleSaveCitizen(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setDuplicateAlert("");
    setSaving(true);
    try {
      const payload = {
        recordType,
        fullName,
        birthYear: Number(birthYear),
        gender,
        villageId: Number(villageId),
        addressDetail,
        phone: phone || null,
        guardianNote: guardianNote || null,
        hardshipSummary,
        status,
        localBonusScore: Number(localBonusScore),
        localBonusReason: localBonusReason || null,
        groupIds: selectedGroupIds,
        reason: editReason || undefined,
      };
      const res = await fetch(
        editingId ? `/api/citizens/${editingId}` : "/api/citizens",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        if (data.duplicateDetected) {
          setDuplicateAlert(data.error);
        } else {
          setFormError(data.error || "Lưu thất bại");
        }
      } else {
        setModalOpen(false);
        loadCitizens();
      }
    } finally {
      setSaving(false);
    }
  }

  async function openDetailDrawer(citizenId: number) {
    setEvMsg("");
    const res = await fetch(`/api/citizens/${citizenId}`);
    if (res.ok) {
      setDetail(await res.json());
    }
  }

  async function handleUploadEvidence(
    citizenId: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingEv(true);
    setEvMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("citizenId", String(citizenId));
      const res = await fetch("/api/evidence", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setEvMsg(data.error || "Tải lên thất bại");
      } else {
        setEvMsg("Đã tải minh chứng lên Google Drive thành công.");
        openDetailDrawer(citizenId);
        loadCitizens();
      }
    } finally {
      setUploadingEv(false);
      e.target.value = "";
    }
  }

  async function runImportRequest(
    file: File,
    mode: "preview" | "commit",
    opts?: {
      skipReducedPaused?: boolean;
      attachGroupOnDuplicate?: boolean;
      allowIncompleteDob?: boolean;
      fallbackVillageId?: number;
    }
  ) {
    setImportLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    fd.append(
      "skipReducedPaused",
      String(opts?.skipReducedPaused ?? skipReducedPaused)
    );
    fd.append(
      "attachGroupOnDuplicate",
      String(opts?.attachGroupOnDuplicate ?? attachGroupOnDuplicate)
    );
    fd.append(
      "allowIncompleteDob",
      String(opts?.allowIncompleteDob ?? allowIncompleteDob)
    );
    fd.append(
      "fallbackVillageId",
      String(opts?.fallbackVillageId ?? fallbackVillageId)
    );
    try {
      const res = await fetch("/api/citizens/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setImportMsg(data.error || "Import lỗi");
        if (mode === "preview") setImportFile(null);
      } else if (mode === "preview") {
        setImportPreview(data);
      } else {
        setImportMsg(
          `Đã nhập mới ${data.importedCount} hồ sơ${
            data.mergedGroupCount ? `, bổ sung nhóm cho ${data.mergedGroupCount} hồ sơ` : ""
          }${
            data.reviewFlaggedCount
              ? `, gắn cờ Chờ rà soát ${data.reviewFlaggedCount} dòng thiếu ngày sinh`
              : ""
          }${data.skippedCount ? `. Bỏ qua ${data.skippedCount} dòng.` : "."}`
        );
        setImportPreview(null);
        setImportFile(null);
        loadCitizens();
      }
    } finally {
      setImportLoading(false);
    }
  }

  async function handleDroppedOrSelectedFile(file: File | undefined | null) {
    if (!file) return;
    setImportMsg("");
    setImportFile(file);
    await runImportRequest(file, "preview");
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    await handleDroppedOrSelectedFile(e.target.files?.[0]);
    e.target.value = "";
  }

  const canEdit = user?.role !== "AUDITOR";
  const allowBonus =
    user?.role === "OWNER" ||
    user?.role === "LEADER" ||
    user?.role === "DEPT_HEAD";

  return (
    <AppShell onReady={({ user: u }) => setUser(u)}>
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Danh sách Đối tượng An sinh &amp; Hộ thiệt hại
            </h1>
            <p className="text-xs text-slate-500">
              Chỉ thu thập dữ liệu tối thiểu. Tuyệt đối không lưu CCCD, ảnh chân
              dung, tọa độ, bệnh lý, thu nhập, BHYT hay tài khoản ngân hàng.
            </p>
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/citizens/export?${new URLSearchParams({
                  ...(q ? { q } : {}),
                  ...(villageFilter ? { villageId: villageFilter } : {}),
                  ...(statusFilter ? { status: statusFilter } : {}),
                  ...(groupFilter ? { groupId: groupFilter } : {}),
                }).toString()}`}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Xuất Excel đang lọc</span>
              </a>
              <a
                href="/api/citizens/import"
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Tải mẫu Excel</span>
              </a>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Upload className="h-3.5 w-3.5" />
                <span>Import Excel</span>
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={handleExcelImport}
                />
              </label>
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 rounded-lg bg-blue-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-900"
              >
                <Plus className="h-4 w-4" />
                <span>Thêm đối tượng</span>
              </button>
            </div>
          )}
        </div>

        {canEdit && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverImport(true);
            }}
            onDragLeave={() => setDragOverImport(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverImport(false);
              handleDroppedOrSelectedFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex flex-col items-center justify-between gap-2 rounded-xl border-2 border-dashed px-4 py-3 text-xs transition sm:flex-row ${
              dragOverImport
                ? "border-blue-600 bg-blue-50 text-blue-900"
                : "border-slate-300 bg-slate-50/70 text-slate-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 shrink-0 text-blue-700" />
              <span>
                <strong>Kéo thả tệp Excel (.xlsx)</strong> từ Phòng VH-XH (4 sheet) hoặc Mẫu chuẩn vào đây để tự động lọc tiêu đề ngang, chuẩn hóa 10 thôn Xã Bình An &amp; gán điểm theo Bảng điểm Lãnh đạo.
              </span>
            </div>
            <label className="shrink-0 cursor-pointer rounded-lg border border-blue-700 bg-white px-3 py-1.5 font-semibold text-blue-800 hover:bg-blue-50">
              Chọn tệp...
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleExcelImport}
              />
            </label>
          </div>
        )}

        {importMsg && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            {importMsg}
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tên, mã công dân..."
              className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-xs"
            />
          </div>

          {user?.role !== "VILLAGE_HEAD" && (
            <select
              value={villageFilter}
              onChange={(e) => setVillageFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
            >
              <option value="">Tất cả các thôn</option>
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} — {v.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
          >
            <option value="">Tất cả nhóm đối tượng</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(CITIZEN_STATUS_LABELS).map(([k, lbl]) => (
              <option key={k} value={k}>
                {lbl}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-3 font-semibold">Mã ĐD</th>
                <th className="px-3 py-3 font-semibold">Họ tên / Năm sinh</th>
                <th className="px-3 py-3 font-semibold">Thôn</th>
                <th className="px-3 py-3 font-semibold">Nhóm đối tượng</th>
                <th className="px-3 py-3 font-semibold">Trạng thái</th>
                {user?.role !== "VILLAGE_HEAD" && (
                  <th className="px-3 py-3 font-semibold">Điểm ĐG</th>
                )}
                <th className="px-3 py-3 font-semibold">Minh chứng</th>
                <th className="px-3 py-3 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {citizens.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Chưa có hồ sơ nào phù hợp điều kiện lọc.
                  </td>
                </tr>
              ) : (
                citizens.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono font-semibold text-blue-900">
                      {c.citizenCode}
                      {c.recordType === "HOUSEHOLD_DISASTER" && (
                        <div className="text-[10px] font-sans text-orange-700">
                          Hộ thiệt hại
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">
                        {c.fullName} ({c.birthYear})
                      </div>
                      {c.guardianNote && (
                        <div className="text-[11px] text-slate-500">
                          Ghi chú: {c.guardianNote}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {c.villageName}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.groups.map((g) => (
                          <span
                            key={g.id}
                            className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-800"
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          c.status === "PENDING_REVIEW"
                            ? "bg-amber-100 text-amber-800"
                            : c.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : c.status === "TEMPORARY"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {CITIZEN_STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                    {user?.role !== "VILLAGE_HEAD" && (
                      <td className="px-3 py-2.5 font-bold text-slate-900">
                        {c.estimatedScore ?? 0}
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Paperclip className="h-3.5 w-3.5" />
                        {c.evidenceCount}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openDetailDrawer(c.id)}
                          className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Eye className="inline h-3 w-3 mr-1" />
                          Chi tiết
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => openEditModal(c)}
                            className="rounded bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
                          >
                            Sửa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingId ? "Cập nhật hồ sơ đối tượng" : "Thêm mới đối tượng"}
              </h2>
              <button onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSaveCitizen} className="space-y-4 text-xs">
              {!editingId && (
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Loại đối tượng quản lý
                  </label>
                  <select
                    value={recordType}
                    onChange={(e) =>
                      setRecordType(
                        e.target.value as "INDIVIDUAL" | "HOUSEHOLD_DISASTER"
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="INDIVIDUAL">Cá nhân độc lập</option>
                    <option value="HOUSEHOLD_DISASTER">
                      Hộ gia đình thiệt hại (thiên tai, dịch bệnh, hỏa hoạn)
                    </option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block font-semibold text-slate-700">
                    Họ và tên (*)
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Năm sinh (*)
                  </label>
                  <input
                    type="number"
                    required
                    min={1900}
                    max={new Date().getFullYear()}
                    value={birthYear}
                    onChange={(e) => setBirthYear(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Giới tính
                  </label>
                  <select
                    value={gender}
                    onChange={(e) =>
                      setGender(e.target.value as "NAM" | "NU" | "KHAC")
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="NAM">Nam</option>
                    <option value="NU">Nữ</option>
                    <option value="KHAC">Khác / Đại diện hộ</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Thôn (*)
                  </label>
                  <select
                    disabled={Boolean(editingId) || user?.role === "VILLAGE_HEAD"}
                    value={villageId}
                    onChange={(e) => setVillageId(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  >
                    {villages.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} — {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Địa chỉ / Xóm
                </label>
                <input
                  type="text"
                  value={addressDetail}
                  onChange={(e) => setAddressDetail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Nhóm đối tượng thuộc diện (*)
                </label>
                <div className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2.5 sm:grid-cols-2">
                  {groups.map((g) => (
                    <label
                      key={g.id}
                      className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.includes(g.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedGroupIds([...selectedGroupIds, g.id]);
                          } else {
                            setSelectedGroupIds(
                              selectedGroupIds.filter((id) => id !== g.id)
                            );
                          }
                        }}
                      />
                      <span>
                        {g.name}{" "}
                        <span className="text-slate-400">({g.baseScore}đ)</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Tóm tắt hoàn cảnh khó khăn (hiện trên danh sách ký nhận)
                </label>
                <input
                  type="text"
                  value={hardshipSummary}
                  onChange={(e) => setHardshipSummary(e.target.value)}
                  placeholder="vd: Hộ nghèo, bệnh hiểm nghèo, neo đơn"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              {duplicateAlert && (
                <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-amber-900">
                  <div className="mb-1 flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 text-amber-700" />
                    <span>Cảnh báo trùng thông tin!</span>
                  </div>
                  <p>{duplicateAlert}</p>
                </div>
              )}

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Ghi chú (Tên Cha/Mẹ hoặc Người giám hộ — bắt buộc nếu trùng tên)
                </label>
                <input
                  type="text"
                  required={Boolean(duplicateAlert)}
                  value={guardianNote}
                  onChange={(e) => setGuardianNote(e.target.value)}
                  placeholder="vd: Con ông Nguyễn Văn B / Người giám hộ: Trần Thị C"
                  className={`w-full rounded-lg border px-3 py-2 ${
                    duplicateAlert
                      ? "border-amber-500 bg-amber-50/40"
                      : "border-slate-300"
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Trạng thái hồ sơ
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    {Object.entries(CITIZEN_STATUS_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>

                {allowBonus && (
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Điểm cộng thực tế địa phương (0–50)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={localBonusScore}
                      onChange={(e) => setLocalBonusScore(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                )}
              </div>

              {allowBonus && localBonusScore > 0 && (
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Lý do cộng điểm thực tế
                  </label>
                  <input
                    type="text"
                    value={localBonusReason}
                    onChange={(e) => setLocalBonusReason(e.target.value)}
                    placeholder="vd: Không còn khả năng lao động, nuôi 2 trẻ nhỏ"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              )}

              {editingId && (
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Lý do cập nhật / biến động (lưu Nhật ký)
                  </label>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="vd: Rà soát định kỳ 6 tháng / Đã khắc phục thiên tai"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              )}

              {formError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-red-700">
                  {formError}
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
                  disabled={saving}
                  className="rounded-lg bg-blue-800 px-5 py-2 font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu hồ sơ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="font-mono text-xs font-bold text-blue-800">
                  {detail.citizen.citizenCode}
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {detail.citizen.fullName} ({detail.citizen.birthYear})
                </h2>
              </div>
              <button onClick={() => setDetail(null)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-5 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 space-y-1">
                <div>
                  <b>Thôn:</b> {detail.citizen.villageName} ({detail.citizen.addressDetail})
                </div>
                <div>
                  <b>Hoàn cảnh:</b> {detail.citizen.hardshipSummary}
                </div>
                {detail.citizen.guardianNote && (
                  <div>
                    <b>Ghi chú giám hộ:</b> {detail.citizen.guardianNote}
                  </div>
                )}
                <div>
                  <b>Trạng thái:</b>{" "}
                  {CITIZEN_STATUS_LABELS[detail.citizen.status] ??
                    detail.citizen.status}
                </div>
              </div>

              {/* Evidence Upload via Google Drive */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">
                    Hồ sơ minh chứng (lưu trên Google Drive)
                  </h3>
                  {canEdit && (
                    <label
                      className={`cursor-pointer rounded-lg px-2.5 py-1 font-semibold ${
                        driveConnected
                          ? "bg-blue-800 text-white hover:bg-blue-900"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      <Upload className="mr-1 inline h-3 w-3" />
                      {uploadingEv ? "Đang tải..." : "Tải lên minh chứng"}
                      <input
                        type="file"
                        className="hidden"
                        disabled={!driveConnected || uploadingEv}
                        onChange={(e) =>
                          handleUploadEvidence(detail.citizen.id, e)
                        }
                      />
                    </label>
                  )}
                </div>
                {!driveConnected && (
                  <p className="mb-2 text-[11px] text-amber-700">
                    Chưa kết nối Google Drive — cần Lãnh đạo kết nối Drive trong
                    mục Quản trị để tải minh chứng.
                  </p>
                )}
                {evMsg && (
                  <div className="mb-2 rounded bg-blue-50 p-2 text-blue-800">
                    {evMsg}
                  </div>
                )}
                {detail.evidences.length === 0 ? (
                  <p className="text-slate-500">Chưa có tệp minh chứng nào.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.evidences.map((ev) => (
                      <a
                        key={ev.id}
                        href={`/api/evidence/${ev.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                      >
                        <span className="flex items-center gap-2 font-medium text-blue-800">
                          <FileText className="h-3.5 w-3.5" />
                          {ev.fileName}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {Math.round(ev.fileSize / 1024)} KB
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Support History */}
              {user?.role !== "VILLAGE_HEAD" && (
                <div>
                  <h3 className="mb-2 font-bold text-slate-800">
                    Lịch sử đã nhận hỗ trợ ({detail.histories.length})
                  </h3>
                  {detail.histories.length === 0 ? (
                    <p className="text-slate-500">Chưa ghi nhận lượt hỗ trợ nào.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.histories.map((h) => (
                        <div
                          key={h.id}
                          className="rounded-lg border border-slate-200 p-2"
                        >
                          <div className="font-semibold text-slate-800">
                            {h.programCode} — {h.programTitle}
                          </div>
                          <div className="text-slate-500">
                            {h.donorName} • {h.valueVnd.toLocaleString("vi-VN")}đ •{" "}
                            {new Date(h.receivedAt).toLocaleDateString("vi-VN")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Change Log */}
              <div>
                <h3 className="mb-2 font-bold text-slate-800">
                  Lịch sử biến động hồ sơ
                </h3>
                <div className="space-y-1.5">
                  {detail.changes.map((ch) => (
                    <div
                      key={ch.id}
                      className="rounded-lg bg-slate-50 px-3 py-2 text-[11px]"
                    >
                      <div className="font-medium text-slate-800">{ch.summary}</div>
                      <div className="text-slate-400">
                        {new Date(ch.createdAt).toLocaleString("vi-VN")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Import Excel */}
      {importPreview && importFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl text-xs">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Xem trước dữ liệu Import &amp; Tự động gán điểm
                </h2>
                <p className="text-slate-500">
                  Tệp: <strong>{importFile.name}</strong> • Định dạng:{" "}
                  <span className="font-semibold text-blue-800">
                    {importPreview.format === "VHXH_WELFARE"
                      ? "Danh sách Phòng VH-XH (nhiều sheet, tự lọc tiêu đề ngang)"
                      : "Mẫu chuẩn 10 cột"}
                  </span>
                </p>
              </div>
              <button
                onClick={() => {
                  setImportPreview(null);
                  setImportFile(null);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-slate-500">Tổng dòng đọc</div>
                <div className="text-lg font-bold text-slate-900">
                  {importPreview.totalRowsRead}
                </div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <div className="text-emerald-700">Sẽ nhập mới</div>
                <div className="text-lg font-bold text-emerald-800">
                  {importPreview.willInsertCount}
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <div className="text-blue-700">Gộp thêm nhóm</div>
                <div className="text-lg font-bold text-blue-800">
                  {importPreview.willMergeGroupCount}
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <div className="text-amber-700">Chờ rà soát</div>
                <div className="text-lg font-bold text-amber-800">
                  {importPreview.reviewFlaggedCount}
                </div>
              </div>
              <div className="rounded-lg bg-red-50 p-3">
                <div className="text-red-700">Bỏ qua</div>
                <div className="text-lg font-bold text-red-800">
                  {importPreview.skippedTotal}
                </div>
              </div>
            </div>

            <div className="mb-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={skipReducedPaused}
                  disabled={importLoading}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setSkipReducedPaused(val);
                    runImportRequest(importFile, "preview", { skipReducedPaused: val });
                  }}
                />
                <span>
                  Bỏ qua dòng đã giảm / tạm dừng chi (bỏ chọn = vẫn nhập ở trạng thái &quot;Đã giảm / Tạm dừng&quot;)
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={attachGroupOnDuplicate}
                  disabled={importLoading}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setAttachGroupOnDuplicate(val);
                    runImportRequest(importFile, "preview", {
                      attachGroupOnDuplicate: val,
                    });
                  }}
                />
                <span>
                  Tự bổ sung nhóm đối tượng nếu trùng Họ tên + Năm sinh + Thôn trong hệ thống
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allowIncompleteDob}
                  disabled={importLoading}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setAllowIncompleteDob(val);
                    runImportRequest(importFile, "preview", { allowIncompleteDob: val });
                  }}
                />
                <span>
                  Vẫn nhập các dòng thiếu/lỗi năm sinh với trạng thái &quot;Chờ rà soát lại&quot;
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="font-semibold text-slate-700">
                  Nếu dòng thiếu tên thôn:
                </span>
                <select
                  value={fallbackVillageId}
                  disabled={importLoading}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFallbackVillageId(val);
                    runImportRequest(importFile, "preview", { fallbackVillageId: val });
                  }}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1"
                >
                  <option value={0}>Bỏ qua các dòng thiếu tên thôn</option>
                  {villages
                    .filter((v) => v.name && !v.name.includes("(dự phòng)"))
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        Gán tạm vào: {v.name} ({v.code})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-2 font-bold text-slate-900">
                  Nhóm đối tượng &amp; Điểm tự động gán (theo Bảng điểm Lãnh đạo)
                </h3>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {importPreview.byGroup.map((g, idx) => (
                    <div
                      key={`${g.groupCode}-${idx}`}
                      className="flex items-center justify-between border-b border-slate-100 py-1"
                    >
                      <span className="truncate pr-2" title={g.rawSection}>
                        {g.groupName}
                      </span>
                      <span className="shrink-0 font-semibold text-slate-800">
                        {g.count} người •{" "}
                        <span className="text-blue-700">{g.baseScore} điểm</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-2 font-bold text-slate-900">
                  Phân bố sau chuẩn hóa theo Thôn
                </h3>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {importPreview.byVillage.map((v) => (
                    <div
                      key={v.villageName}
                      className="flex items-center justify-between border-b border-slate-100 py-1"
                    >
                      <span>{v.villageName}</span>
                      <span className="font-bold text-slate-800">{v.count} người</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {importPreview.sampleWarnings.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="mb-1 font-bold text-amber-900">
                  Mẫu các dòng bỏ qua / lưu ý ({importPreview.skippedTotal} dòng):
                </div>
                <div className="max-h-28 space-y-0.5 overflow-y-auto text-[11px] text-amber-800">
                  {importPreview.sampleWarnings.map((w, i) => (
                    <div key={i}>
                      [{w.sheet} dòng {w.row}] {w.name}: {w.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setImportPreview(null);
                  setImportFile(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={importLoading}
                onClick={() => runImportRequest(importFile, "commit")}
                className="rounded-lg bg-blue-800 px-5 py-2 font-semibold text-white hover:bg-blue-900 disabled:opacity-50"
              >
                {importLoading
                  ? "Đang nhập dữ liệu..."
                  : `Xác nhận nhập (${importPreview.willInsertCount} mới, ${importPreview.willMergeGroupCount} gộp)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
