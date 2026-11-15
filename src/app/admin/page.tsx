"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AppShell, type CurrentUserClient } from "@/components/AppShell";
import {
  Users,
  HardDrive,
  ArrowRightLeft,
  Settings,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Upload,
  Plus,
} from "lucide-react";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";

interface UserRow {
  id: number;
  username: string;
  fullName: string;
  unitName: string;
  role: UserRole;
  villageId: number | null;
  villageName: string | null;
  isActive: boolean;
}

interface Village {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

interface SupportGroup {
  id: number;
  code: string;
  name: string;
  baseScore: number;
  isPhase2Optional: boolean;
  defaultDurationMonths: number | null;
  isActive: boolean;
}

interface SettingsPayload {
  communeName: string;
  communeCode: string;
  requireDriveToSave: boolean;
  driveConnected: boolean;
  driveEmail: string | null;
  driveOAuthConfigured: boolean;
  duplicateCheckMonths: number;
  smallSupportMax: number;
  mediumSupportMax: number;
  smallSupportPenalty: number;
  largeSupportPenalty: number;
  yearlyWarningThreshold: number;
  lastBackupAt: string | null;
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUserClient | null>(null);
  const [tab, setTab] = useState<"users" | "drive" | "transfer" | "rules">("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [groups, setGroups] = useState<SupportGroup[]>([]);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Add user form
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newUnitName, setNewUnitName] = useState("Phòng VHXH");
  const [newRole, setNewRole] = useState<UserRole>("STAFF");
  const [newVillageId, setNewVillageId] = useState<number>(1);
  const [newPassword, setNewPassword] = useState("123456");

  // Transfer ownership form
  const [targetOwnerId, setTargetOwnerId] = useState<number>(0);
  const [confirmPw, setConfirmPw] = useState("");
  const [demoteRole, setDemoteRole] = useState<"LEADER" | "DEPT_HEAD" | "AUDITOR">("LEADER");
  const [disconnectDrive, setDisconnectDrive] = useState(false);
  const [transferReason, setTransferReason] = useState("");
  const [newGroupCode, setNewGroupCode] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupScore, setNewGroupScore] = useState(5);
  const [showReserveVillages, setShowReserveVillages] = useState(false);

  const loadAll = useCallback(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.users) {
          setUsers(d.users);
          const candidate = d.users.find(
            (u: UserRow) => u.role !== "OWNER" && u.isActive
          );
          if (candidate && !targetOwnerId) setTargetOwnerId(candidate.id);
        }
      });
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setSettings(d.settings);
        setVillages(d.villages || []);
        setGroups(d.supportGroups || []);
        if (d.villages?.[0]) setNewVillageId(d.villages[0].id);
      });
  }, [targetOwnerId]);

  useEffect(() => {
    loadAll();
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const driveStatus = sp.get("drive");
      const driveMsg = sp.get("msg");
      if (driveStatus) {
        setTab("drive");
        if (driveStatus === "connected") {
          setMsg("Đã kết nối Google Drive thành công và tạo xong thư mục lưu trữ.");
        } else if (driveStatus === "cancelled") {
          setErr(driveMsg || "Bạn đã hủy xác thực Google Drive.");
        } else if (driveStatus === "error_state") {
          setErr("Phiên xác thực Drive không hợp lệ (hãy thử bấm kết nối lại).");
        } else if (driveStatus === "error") {
          setErr(`Lỗi kết nối Google Drive: ${driveMsg || "Không xác định"}`);
        }
      }
    }
  }, [loadAll]);

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newUsername,
        fullName: newFullName,
        unitName: newUnitName,
        role: newRole,
        villageId: newRole === "VILLAGE_HEAD" ? Number(newVillageId) : null,
        password: newPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Thêm nhân viên thất bại");
    } else {
      setMsg(`Đã tạo tài khoản '${data.user.username}' thành công.`);
      setNewUsername("");
      setNewFullName("");
      loadAll();
    }
  }

  async function toggleUserActive(u: UserRow) {
    await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    loadAll();
  }

  async function resetUserPassword(u: UserRow) {
    const pw = window.prompt(
      `Nhập mật khẩu tạm mới cho ${u.fullName} (tối thiểu 6 ký tự):`,
      "123456"
    );
    if (!pw || pw.length < 6) return;
    await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword: pw }),
    });
    setMsg(`Đã đặt lại mật khẩu tạm cho ${u.fullName}.`);
  }

  async function handleTransferOwnership(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    const res = await fetch("/api/admin/transfer-ownership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUserId: Number(targetOwnerId),
        currentPassword: confirmPw,
        demoteRole,
        disconnectDrive,
        reason: transferReason,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Chuyển quyền thất bại");
    } else {
      setMsg(
        `Đã chuyển quyền Chủ quản hệ thống sang '${data.newOwner}'. Vai trò hiện tại của bạn: ${data.yourNewRole}.`
      );
      window.location.reload();
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setMsg("");
    setErr("");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settings,
        villageUpdates: villages,
        groupUpdates: groups.map((g) => ({
          id: g.id,
          name: g.name,
          baseScore: g.baseScore,
          isActive: g.isActive,
          defaultDurationMonths: g.defaultDurationMonths,
        })),
      }),
    });
    if (res.ok) {
      setMsg(
        "Đã lưu Bảng điểm quy định & Danh mục thôn. Điểm mới tự động áp dụng cho toàn bộ đối tượng thuộc nhóm tương ứng."
      );
      loadAll();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Không lưu được cấu hình");
    }
  }

  async function handleImportScoringExcel(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg("");
    setErr("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/settings/scoring-excel", {
      method: "POST",
      body: fd,
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(d.error || "Import Bảng điểm thất bại");
    } else {
      setMsg(
        `Đã nhập riêng Bảng điểm Lãnh đạo: cập nhật ${d.updatedCount} nhóm, thêm mới ${d.createdCount} nhóm. Điểm đã tự động áp dụng cho toàn bộ đối tượng!`
      );
      loadAll();
    }
    e.target.value = "";
  }

  async function handleAddNewGroup() {
    if (!newGroupCode.trim() || !newGroupName.trim()) {
      setErr("Vui lòng nhập đủ Mã nhóm và Tên nhóm mới.");
      return;
    }
    setMsg("");
    setErr("");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newGroup: {
          code: newGroupCode,
          name: newGroupName,
          baseScore: Number(newGroupScore) || 5,
        },
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(d.error || "Không thêm được nhóm mới");
    } else {
      setNewGroupCode("");
      setNewGroupName("");
      setNewGroupScore(5);
      setMsg("Đã thêm nhóm đối tượng mới vào Bảng điểm.");
      loadAll();
    }
  }

  async function handleDisconnectDrive() {
    if (!window.confirm("Bạn chắc chắn muốn ngắt kết nối Google Drive hiện tại?")) {
      return;
    }
    const res = await fetch("/api/drive/disconnect", { method: "POST" });
    if (res.ok) {
      setMsg("Đã ngắt kết nối Google Drive.");
      loadAll();
    }
  }

  const isOwner = currentUser?.role === "OWNER";

  return (
    <AppShell onReady={({ user: u }) => setCurrentUser(u)}>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Quản trị Hệ thống, Nhân sự &amp; Google Drive
          </h1>
          <p className="text-xs text-slate-500">
            Thêm nhân viên, phân quyền theo vai trò/thôn, kết nối Google Drive và
            chuyển quyền quản lý
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-xs font-semibold">
          <button
            onClick={() => setTab("users")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${
              tab === "users"
                ? "bg-blue-800 text-white"
                : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Nhân sự &amp; Phân quyền
          </button>
          <button
            onClick={() => setTab("drive")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${
              tab === "drive"
                ? "bg-blue-800 text-white"
                : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            <HardDrive className="h-3.5 w-3.5" /> Kết nối Google Drive &amp; Sao lưu
          </button>
          {isOwner && (
            <button
              onClick={() => setTab("transfer")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${
                tab === "transfer"
                  ? "bg-blue-800 text-white"
                  : "bg-white text-slate-700 border border-slate-200"
              }`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Chuyển quyền Quản lý
            </button>
          )}
          <button
            onClick={() => setTab("rules")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${
              tab === "rules"
                ? "bg-blue-800 text-white"
                : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            <Settings className="h-3.5 w-3.5" /> Thôn &amp; Quy tắc Chấm điểm
          </button>
        </div>

        {msg && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-900">
            {msg}
          </div>
        )}
        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
            {err}
          </div>
        )}

        {/* TAB 1: USERS */}
        {tab === "users" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                <UserPlus className="h-4 w-4 text-blue-800" />
                <span>Thêm nhân viên mới</span>
              </div>
              <form onSubmit={handleAddUser} className="space-y-3 text-xs">
                <div>
                  <label className="mb-1 block font-semibold">Tên đăng nhập (*)</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="vd: truongthon01 hoặc canbovhxh"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">Họ và tên (*)</label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">Đơn vị / Đoàn thể</label>
                  <input
                    type="text"
                    required
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    placeholder="Phòng VHXH / Hội Phụ nữ / Thôn 1"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">Vai trò (*)</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    {isOwner && (
                      <option value="LEADER">Lãnh đạo UBND / MTTQ</option>
                    )}
                    <option value="DEPT_HEAD">Lãnh đạo cấp phòng (VHXH)</option>
                    <option value="STAFF">Cán bộ chuyên môn / Hội đoàn</option>
                    <option value="VILLAGE_HEAD">Trưởng thôn (chỉ xem thôn mình)</option>
                    <option value="AUDITOR">Giám sát / Kiểm tra (chỉ đọc)</option>
                  </select>
                </div>
                {newRole === "VILLAGE_HEAD" && (
                  <div>
                    <label className="mb-1 block font-semibold">
                      Phạm vi thôn quản lý (*)
                    </label>
                    <select
                      value={newVillageId}
                      onChange={(e) => setNewVillageId(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      {villages.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.code} — {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-1 block font-semibold">
                    Mật khẩu tạm (bắt buộc đổi khi đăng nhập)
                  </label>
                  <input
                    type="text"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-800 py-2 font-semibold text-white hover:bg-blue-900"
                >
                  Tạo tài khoản nhân viên
                </button>
              </form>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-8">
              <h2 className="mb-3 text-sm font-bold text-slate-900">
                Danh sách tài khoản ({users.length})
              </h2>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2.5 py-2">Tài khoản</th>
                    <th className="px-2.5 py-2">Họ tên &amp; Đơn vị</th>
                    <th className="px-2.5 py-2">Vai trò</th>
                    <th className="px-2.5 py-2">Phạm vi</th>
                    <th className="px-2.5 py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className={!u.isActive ? "opacity-50" : ""}>
                      <td className="px-2.5 py-2.5 font-mono font-semibold">
                        {u.username}
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="font-semibold text-slate-900">
                          {u.fullName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {u.unitName}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            u.role === "OWNER"
                              ? "bg-blue-100 text-blue-900"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td className="px-2.5 py-2.5">
                        {u.villageName || "Toàn xã"}
                      </td>
                      <td className="px-2.5 py-2.5 text-right">
                        {u.role !== "OWNER" && (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => resetUserPassword(u)}
                              className="rounded border border-slate-300 px-2 py-1 text-[11px]"
                            >
                              Đặt lại MK
                            </button>
                            <button
                              onClick={() => toggleUserActive(u)}
                              className={`rounded px-2 py-1 text-[11px] font-semibold ${
                                u.isActive
                                  ? "bg-red-50 text-red-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {u.isActive ? "Khóa" : "Mở khóa"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: GOOGLE DRIVE */}
        {tab === "drive" && settings && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5 text-xs">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Trạng thái kết nối Google Drive
                </h2>
                <p className="mt-1 text-slate-500">
                  Kho lưu trữ hồ sơ minh chứng, danh sách đợt hỗ trợ đã khóa và
                  bản sao lưu Excel định kỳ
                </p>
              </div>
              {settings.driveConnected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  Đang kết nối: {settings.driveEmail}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 font-bold text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  Chưa kết nối Google Drive
                </span>
              )}
            </div>

            {!settings.driveOAuthConfigured && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 leading-relaxed text-amber-900">
                <b>Hướng dẫn kích hoạt nút Kết nối Google Drive:</b> Thêm 2 biến
                môi trường <code>GOOGLE_CLIENT_ID</code> và{" "}
                <code>GOOGLE_CLIENT_SECRET</code> (tạo miễn phí trên Google Cloud
                Console với Redirect URI là{" "}
                <code>&lt;domain-vercel&gt;/api/drive/callback</code>) vào mục{" "}
                <i>Environment Variables</i> trên Vercel.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {isOwner && settings.driveOAuthConfigured && (
                <a
                  href="/api/drive/auth?returnTo=/admin"
                  className="flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2.5 font-semibold text-white hover:bg-blue-900"
                >
                  <HardDrive className="h-4 w-4" />
                  <span>
                    {settings.driveConnected
                      ? "Kết nối lại / Đổi tài khoản Drive"
                      : "Kết nối Google Drive ngay"}
                  </span>
                </a>
              )}
              {isOwner && settings.driveConnected && (
                <button
                  onClick={handleDisconnectDrive}
                  className="rounded-lg border border-red-300 px-4 py-2.5 font-semibold text-red-700 hover:bg-red-50"
                >
                  Ngắt kết nối Drive
                </button>
              )}
              <button
                onClick={async () => {
                  const res = await fetch("/api/drive/backup", { method: "POST" });
                  if (res.ok && res.headers.get("content-type")?.includes("json")) {
                    const d = await res.json();
                    setMsg(`Đã sao lưu lên Drive: ${d.fileName}`);
                    loadAll();
                  } else {
                    window.location.href = "/api/drive/backup?download=1";
                  }
                }}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Sao lưu toàn bộ CSDL ngay</span>
              </button>
            </div>

            {settings.lastBackupAt && (
              <div className="text-slate-500">
                Lần sao lưu lên Drive gần nhất:{" "}
                <b>{new Date(settings.lastBackupAt).toLocaleString("vi-VN")}</b>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TRANSFER OWNERSHIP */}
        {tab === "transfer" && isOwner && (
          <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xs text-xs">
            <h2 className="mb-2 text-base font-bold text-slate-900">
              Chuyển quyền Quản lý tối cao (OWNER)
            </h2>
            <p className="mb-4 text-slate-600">
              Dùng khi Lãnh đạo luân chuyển công tác hoặc bàn giao phụ trách hệ
              thống cho nhân sự khác. Toàn bộ lịch sử bàn giao được ghi nhận vĩnh
              viễn vào Nhật ký hệ thống.
            </p>
            <form onSubmit={handleTransferOwnership} className="space-y-4">
              <div>
                <label className="mb-1 block font-semibold">
                  Chọn nhân sự tiếp nhận quyền Chủ quản (*)
                </label>
                <select
                  required
                  value={targetOwnerId}
                  onChange={(e) => setTargetOwnerId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  {users
                    .filter((u) => u.role !== "OWNER" && u.isActive)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.username}) — {u.unitName}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold">
                  Vai trò của bạn sau khi bàn giao
                </label>
                <select
                  value={demoteRole}
                  onChange={(e) =>
                    setDemoteRole(
                      e.target.value as "LEADER" | "DEPT_HEAD" | "AUDITOR"
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="LEADER">Lãnh đạo UBND / MTTQ</option>
                  <option value="DEPT_HEAD">Lãnh đạo cấp phòng</option>
                  <option value="AUDITOR">Giám sát (chỉ đọc)</option>
                </select>
              </div>

              <label className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-amber-900">
                <input
                  type="checkbox"
                  checked={disconnectDrive}
                  onChange={(e) => setDisconnectDrive(e.target.checked)}
                />
                <span>
                  Ngắt kết nối Google Drive hiện tại để người quản lý mới kết nối
                  tài khoản Drive của họ (bỏ chọn nếu đang dùng Drive chung của UBND)
                </span>
              </label>

              <div>
                <label className="mb-1 block font-semibold">Lý do bàn giao</label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="vd: Bàn giao công tác theo Quyết định..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold">
                  Nhập lại mật khẩu hiện tại của bạn để xác nhận (*)
                </label>
                <input
                  type="password"
                  required
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-red-700 py-2.5 font-semibold text-white hover:bg-red-800"
              >
                Xác nhận chuyển quyền quản lý
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: RULES & VILLAGES */}
        {tab === "rules" && settings && (
          <form
            onSubmit={handleSaveSettings}
            className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs text-xs"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block font-semibold">Tên Xã / Phường</label>
                <input
                  type="text"
                  value={settings.communeName}
                  onChange={(e) =>
                    setSettings({ ...settings, communeName: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold">
                  Mốc tháng tính đã nhận hỗ trợ
                </label>
                <input
                  type="number"
                  value={settings.duplicateCheckMonths}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      duplicateCheckMonths: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold">
                  Ngưỡng cảnh báo nhận/năm
                </label>
                <input
                  type="number"
                  value={settings.yearlyWarningThreshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      yearlyWarningThreshold: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div>
              <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Bảng điểm quy định theo Nhóm đối tượng (Lãnh đạo ban hành)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Có thể chỉnh trực tiếp bên dưới hoặc nhập riêng từ tệp Excel Bảng điểm. Hệ thống tự động gán &amp; cập nhật điểm cho toàn bộ đối tượng thuộc nhóm.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/api/settings/scoring-excel"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Tải Excel Bảng điểm</span>
                  </a>
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-700 bg-blue-50 px-3 py-1.5 font-semibold text-blue-900 hover:bg-blue-100">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Nhập riêng Bảng điểm (.xlsx)</span>
                    <input
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={handleImportScoringExcel}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {groups.map((g, idx) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={g.isActive}
                        onChange={(e) => {
                          const next = [...groups];
                          next[idx] = { ...g, isActive: e.target.checked };
                          setGroups(next);
                        }}
                      />
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                        {g.code}
                      </span>
                      <input
                        type="text"
                        value={g.name}
                        onChange={(e) => {
                          const next = [...groups];
                          next[idx] = { ...g, name: e.target.value };
                          setGroups(next);
                        }}
                        className="min-w-0 flex-1 rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-blue-400 focus:outline-none"
                      />
                    </div>
                    <input
                      type="number"
                      className="w-16 shrink-0 rounded border border-slate-300 px-2 py-1 text-center font-bold"
                      value={g.baseScore}
                      onChange={(e) => {
                        const next = [...groups];
                        next[idx] = { ...g, baseScore: Number(e.target.value) };
                        setGroups(next);
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Thêm nhóm mới */}
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2.5">
                <input
                  type="text"
                  placeholder="Mã nhóm (vd: HO_DAC_BIET)"
                  value={newGroupCode}
                  onChange={(e) => setNewGroupCode(e.target.value)}
                  className="w-44 rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                />
                <input
                  type="text"
                  placeholder="Tên nhóm đối tượng mới..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="min-w-52 flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <input
                  type="number"
                  placeholder="Điểm"
                  value={newGroupScore}
                  onChange={(e) => setNewGroupScore(Number(e.target.value))}
                  className="w-20 rounded border border-slate-300 bg-white px-2 py-1.5 text-center font-bold"
                />
                <button
                  type="button"
                  onClick={handleAddNewGroup}
                  className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 font-semibold text-white hover:bg-slate-900"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm nhóm
                </button>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Danh mục Thôn (Mã cố định không đổi khi sáp nhập/đổi tên)
                </h3>
                {villages.some((v) => !v.isActive) && (
                  <button
                    type="button"
                    onClick={() => setShowReserveVillages(!showReserveVillages)}
                    className="font-semibold text-blue-700 hover:underline"
                  >
                    {showReserveVillages
                      ? "Ẩn mã thôn dự phòng"
                      : `Hiện ${villages.filter((v) => !v.isActive).length} mã thôn dự phòng`}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {villages.map((v, idx) => {
                  if (!v.isActive && !showReserveVillages) return null;
                  return (
                    <div
                      key={v.id}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                        v.isActive
                          ? "border-slate-200 bg-white"
                          : "border-dashed border-slate-200 bg-slate-50 opacity-75"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={v.isActive}
                        title="Bật/tắt thôn hoạt động"
                        onChange={(e) => {
                          const next = [...villages];
                          next[idx] = { ...v, isActive: e.target.checked };
                          setVillages(next);
                        }}
                      />
                      <span className="font-mono font-bold text-blue-800">
                        {v.code}
                      </span>
                      <input
                        type="text"
                        value={v.name}
                        onChange={(e) => {
                          const next = [...villages];
                          next[idx] = { ...v, name: e.target.value };
                          setVillages(next);
                        }}
                        className="flex-1 rounded border border-slate-200 px-2 py-1"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-blue-800 px-5 py-2.5 font-semibold text-white hover:bg-blue-900"
            >
              Lưu cấu hình hệ thống
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
