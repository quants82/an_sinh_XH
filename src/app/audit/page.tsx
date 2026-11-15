"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

interface AuditLogItem {
  id: number;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
}

interface CitizenChangeItem {
  id: number;
  citizenCode: string;
  citizenName: string;
  changeType: string;
  summary: string;
  createdAt: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [changes, setChanges] = useState<CitizenChangeItem[]>([]);
  const [tab, setTab] = useState<"audit" | "changes">("audit");

  useEffect(() => {
    fetch("/api/audit")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setLogs(d.logs || []);
        setChanges(d.changes || []);
      });
  }, []);

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Nhật ký Hệ thống &amp; Lịch sử Biến động
          </h1>
          <p className="text-xs text-slate-500">
            Ghi vết minh bạch: ai sửa, sửa trường nào, giá trị trước/sau và thời
            điểm thực hiện
          </p>
        </div>

        <div className="flex gap-2 text-xs font-semibold">
          <button
            onClick={() => setTab("audit")}
            className={`rounded-lg px-3 py-2 ${
              tab === "audit"
                ? "bg-blue-800 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            Nhật ký hệ thống ({logs.length})
          </button>
          <button
            onClick={() => setTab("changes")}
            className={`rounded-lg px-3 py-2 ${
              tab === "changes"
                ? "bg-blue-800 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            Biến động hồ sơ công dân ({changes.length})
          </button>
        </div>

        {tab === "audit" ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2.5">Thời gian</th>
                  <th className="px-3 py-2.5">Người thực hiện</th>
                  <th className="px-3 py-2.5">Hành động</th>
                  <th className="px-3 py-2.5">Đối tượng</th>
                  <th className="px-3 py-2.5">Trước → Sau / Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                      {new Date(l.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-900">
                      {l.actorName}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-blue-800">
                      {l.action}
                    </td>
                    <td className="px-3 py-2">
                      {l.entity} #{l.entityId}
                      {l.fieldName ? ` (${l.fieldName})` : ""}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {l.oldValue || l.newValue ? (
                        <div>
                          {l.oldValue ? (
                            <span className="text-red-700 line-through mr-1">
                              {l.oldValue}
                            </span>
                          ) : null}
                          {l.newValue ? (
                            <span className="font-medium text-emerald-800">
                              → {l.newValue}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {l.reason && (
                        <div className="text-[11px] italic text-slate-500">
                          Lý do: {l.reason}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2.5">Thời gian</th>
                  <th className="px-3 py-2.5">Mã công dân</th>
                  <th className="px-3 py-2.5">Họ tên</th>
                  <th className="px-3 py-2.5">Nội dung biến động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {changes.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                      {new Date(c.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold text-blue-900">
                      {c.citizenCode}
                    </td>
                    <td className="px-3 py-2 font-semibold">{c.citizenName}</td>
                    <td className="px-3 py-2 text-slate-700">{c.summary}</td>
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
