"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AppShell, type CurrentUserClient } from "@/components/AppShell";
import { Plus, CheckCircle2, Clock, RotateCcw, X } from "lucide-react";
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from "@/lib/constants";

interface TaskItem {
  id: number;
  title: string;
  description: string;
  taskType: string;
  villageId: number | null;
  villageName: string | null;
  assignedToId: number;
  assignedToName: string;
  assignedToUnit: string;
  assignedByName: string;
  dueDate: string | null;
  priority: string;
  status: string;
  completionNote: string | null;
  createdAt: string;
}

interface StaffOption {
  id: number;
  fullName: string;
  unitName: string;
  role: string;
  villageName: string | null;
  isActive: boolean;
}

interface VillageOption {
  id: number;
  code: string;
  name: string;
}

export default function TasksPage() {
  const [user, setUser] = useState<CurrentUserClient | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [villages, setVillages] = useState<VillageOption[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("REVIEW_6_MONTHS");
  const [assignedToId, setAssignedToId] = useState<number>(0);
  const [villageId, setVillageId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [saving, setSaving] = useState(false);
  const [noteInput, setNoteInput] = useState<Record<number, string>>({});

  const loadTasks = useCallback(() => {
    fetch("/api/tasks")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.tasks) setTasks(d.tasks);
      });
  }, []);

  useEffect(() => {
    loadTasks();
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.users) {
          const active = d.users.filter((u: StaffOption) => u.isActive);
          setStaff(active);
          if (active[0]) setAssignedToId(active[0].id);
        }
      });
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.villages) setVillages(d.villages);
      });
  }, [loadTasks]);

  const canAssign =
    user?.role === "OWNER" ||
    user?.role === "LEADER" ||
    user?.role === "DEPT_HEAD";

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          taskType,
          assignedToId: Number(assignedToId),
          villageId: villageId ? Number(villageId) : null,
          dueDate: dueDate || null,
          priority,
        }),
      });
      if (res.ok) {
        setModalOpen(false);
        setTitle("");
        setDescription("");
        loadTasks();
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateTaskStatus(taskId: number, status: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        completionNote: noteInput[taskId],
      }),
    });
    loadTasks();
  }

  return (
    <AppShell onReady={({ user: u }) => setUser(u)}>
      <div className="space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Giao nhiệm vụ &amp; Theo dõi thực hiện
            </h1>
            <p className="text-xs text-slate-500">
              Phân công rà soát định kỳ, xác minh thiệt hại cho cán bộ chuyên môn,
              hội đoàn và 17 trưởng thôn
            </p>
          </div>
          {canAssign && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-900"
            >
              <Plus className="h-4 w-4" />
              <span>Giao nhiệm vụ mới</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              Chưa có nhiệm vụ nào được giao.
            </div>
          ) : (
            tasks.map((t) => {
              const isMine = t.assignedToId === user?.id;
              return (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            t.status === "DONE"
                              ? "bg-emerald-100 text-emerald-800"
                              : t.status === "SUBMITTED"
                              ? "bg-blue-100 text-blue-800"
                              : t.status === "RETURNED"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {TASK_STATUS_LABELS[t.status] ?? t.status}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                          {TASK_TYPE_LABELS[t.taskType] ?? t.taskType}
                        </span>
                        {t.villageName && (
                          <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-800">
                            {t.villageName}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-sm font-bold text-slate-900">
                        {t.title}
                      </h3>
                      {t.description && (
                        <p className="mt-1 text-xs text-slate-600">
                          {t.description}
                        </p>
                      )}
                      <div className="mt-2 text-[11px] text-slate-500">
                        Người thực hiện: <b>{t.assignedToName}</b> ({t.assignedToUnit}) •
                        Giao bởi: {t.assignedByName}
                        {t.dueDate &&
                          ` • Hạn: ${new Date(t.dueDate).toLocaleDateString("vi-VN")}`}
                      </div>
                      {t.completionNote && (
                        <div className="mt-2 rounded bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
                          <b>Báo cáo tiến độ:</b> {t.completionNote}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:w-64">
                      {(isMine || canAssign) && t.status !== "DONE" && (
                        <input
                          type="text"
                          placeholder="Ghi chú báo cáo / phản hồi..."
                          value={noteInput[t.id] ?? ""}
                          onChange={(e) =>
                            setNoteInput({ ...noteInput, [t.id]: e.target.value })
                          }
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                        />
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {isMine &&
                          (t.status === "NEW" || t.status === "RETURNED") && (
                            <button
                              onClick={() => updateTaskStatus(t.id, "IN_PROGRESS")}
                              className="flex items-center gap-1 rounded bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900"
                            >
                              <Clock className="h-3 w-3" /> Nhận làm
                            </button>
                          )}
                        {isMine && t.status !== "DONE" && t.status !== "SUBMITTED" && (
                          <button
                            onClick={() => updateTaskStatus(t.id, "SUBMITTED")}
                            className="flex items-center gap-1 rounded bg-blue-800 px-2.5 py-1 text-xs font-semibold text-white"
                          >
                            Nộp báo cáo
                          </button>
                        )}
                        {canAssign && t.status !== "DONE" && (
                          <>
                            <button
                              onClick={() => updateTaskStatus(t.id, "DONE")}
                              className="flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white"
                            >
                              <CheckCircle2 className="h-3 w-3" /> Duyệt xong
                            </button>
                            <button
                              onClick={() => updateTaskStatus(t.id, "RETURNED")}
                              className="flex items-center gap-1 rounded bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900"
                            >
                              <RotateCcw className="h-3 w-3" /> Trả lại
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create Task Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Giao nhiệm vụ mới
              </h2>
              <button onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Tiêu đề nhiệm vụ (*)
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="vd: Rà soát biến động hộ nghèo quý IV tại Thôn 1"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Loại nhiệm vụ
                  </label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    {Object.entries(TASK_TYPE_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Người nhận nhiệm vụ (*)
                  </label>
                  <select
                    value={assignedToId}
                    onChange={(e) => setAssignedToId(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} — {s.unitName}
                        {s.villageName ? ` (${s.villageName})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Địa bàn thôn
                  </label>
                  <select
                    value={villageId}
                    onChange={(e) => setVillageId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="">Toàn xã / Chung</option>
                    {villages.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} — {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Mức độ ưu tiên
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="LOW">Thấp</option>
                    <option value="MEDIUM">Bình thường</option>
                    <option value="HIGH">Cao</option>
                    <option value="URGENT">Khẩn cấp</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Hạn hoàn thành
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Nội dung hướng dẫn chi tiết
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

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
                  className="rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white hover:bg-blue-900"
                >
                  {saving ? "Đang giao..." : "Giao nhiệm vụ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
