"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Gift,
  ClipboardList,
  ShieldCheck,
  History,
  LogOut,
  Menu,
  X,
  HardDrive,
  AlertTriangle,
  KeyRound,
  BarChart3,
} from "lucide-react";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";

export interface CurrentUserClient {
  id: number;
  username: string;
  fullName: string;
  unitName: string;
  role: UserRole;
  villageId: number | null;
  mustChangePassword: boolean;
}

export interface SystemSettingsSummary {
  communeName: string;
  communeCode: string;
  driveConnected: boolean;
  driveEmail: string | null;
  lastBackupAt: string | null;
  driveOAuthConfigured: boolean;
}

export function AppShell({
  children,
  onReady,
}: {
  children: React.ReactNode;
  onReady?: (ctx: {
    user: CurrentUserClient;
    settings: SystemSettingsSummary;
  }) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUserClient | null>(null);
  const [settings, setSettings] = useState<SystemSettingsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Forced password change modal state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.needsOnboarding) {
          router.replace("/onboarding");
          return;
        }
        if (!data.user) {
          router.replace("/login");
          return;
        }
        setUser(data.user);
        setSettings(data.settings);
        setLoading(false);
        onReady?.({ user: data.user, settings: data.settings });
      })
      .catch(() => {
        if (active) router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [router, onReady]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error || "Đổi mật khẩu thất bại");
      } else {
        setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
        setCurrentPassword("");
        setNewPassword("");
      }
    } finally {
      setPwSaving(false);
    }
  }

  if (loading || !user || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-800 border-t-transparent" />
          <p className="text-sm text-slate-600">Đang tải hệ thống...</p>
        </div>
      </div>
    );
  }

  const isVillageHead = user.role === "VILLAGE_HEAD";
  const navItems = [
    { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard, show: true },
    { href: "/citizens", label: "Đối tượng an sinh", icon: Users, show: true },
    {
      href: "/programs",
      label: "Đợt hỗ trợ & Lọc DS",
      icon: Gift,
      show: !isVillageHead,
    },
    {
      href: "/reports",
      label: "Báo cáo & Đề xuất",
      icon: BarChart3,
      show: !isVillageHead,
    },
    { href: "/tasks", label: "Giao nhiệm vụ", icon: ClipboardList, show: true },
    {
      href: "/audit",
      label: "Nhật ký & Biến động",
      icon: History,
      show: !isVillageHead,
    },
    {
      href: "/admin",
      label: "Quản trị & Google Drive",
      icon: ShieldCheck,
      show: user.role === "OWNER" || user.role === "LEADER" || user.role === "DEPT_HEAD",
    },
  ].filter((i) => i.show);

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar Desktop */}
      <aside className="no-print hidden w-64 flex-col bg-[#0f294a] text-white md:flex">
        <div className="border-b border-blue-900/60 px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-300">
            Chuyển đổi số cơ sở
          </div>
          <div className="mt-1 text-base font-bold leading-snug">
            An sinh Xã hội
          </div>
          <div className="text-xs text-blue-200">
            {settings.communeName} ({settings.communeCode})
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-blue-700 text-white shadow-sm"
                    : "text-blue-100 hover:bg-blue-900/50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-blue-900/60 p-4">
          <div className="mb-3 rounded-lg bg-blue-950/60 p-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-blue-200">
              <HardDrive className="h-3.5 w-3.5" />
              <span>Google Drive:</span>
              {settings.driveConnected ? (
                <span className="text-emerald-400">Đã kết nối</span>
              ) : (
                <span className="text-amber-300">Chưa kết nối</span>
              )}
            </div>
            {settings.driveEmail && (
              <div className="mt-1 truncate text-[11px] text-blue-300">
                {settings.driveEmail}
              </div>
            )}
          </div>

          <div className="mb-3 text-xs">
            <div className="font-semibold text-white">{user.fullName}</div>
            <div className="text-blue-300">{ROLE_LABELS[user.role]}</div>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-700/70 px-3 py-2 text-xs font-medium text-blue-100 hover:bg-blue-900"
          >
            <LogOut className="h-3.5 w-3.5" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex w-72 flex-col bg-[#0f294a] text-white">
            <div className="flex items-center justify-between border-b border-blue-900 px-4 py-4">
              <div>
                <div className="font-bold">An sinh Xã hội</div>
                <div className="text-xs text-blue-200">{settings.communeName}</div>
              </div>
              <button onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      active ? "bg-blue-700 text-white" : "text-blue-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-blue-900 p-4">
              <div className="mb-2 text-xs">
                <div className="font-semibold">{user.fullName}</div>
                <div className="text-blue-300">{ROLE_LABELS[user.role]}</div>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-700 px-3 py-2 text-xs"
              >
                <LogOut className="h-3.5 w-3.5" /> Đăng xuất
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        <header className="no-print flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-slate-700 hover:bg-slate-100 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {settings.communeName} — Quản lý An sinh Xã hội
              </div>
              <div className="text-xs text-slate-500">
                {user.unitName} • {user.fullName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!settings.driveConnected && user.role === "OWNER" && (
              <Link
                href="/admin?tab=drive"
                className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Chưa kết nối Google Drive</span>
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      {/* Forced Change Password Modal */}
      {user.mustChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-2 text-blue-900">
              <KeyRound className="h-5 w-5" />
              <h2 className="text-lg font-bold">
                Đổi mật khẩu lần đầu đăng nhập
              </h2>
            </div>
            <p className="mb-4 text-sm text-slate-600">
              Để đảm bảo an toàn dữ liệu an sinh xã hội, vui lòng đổi mật khẩu tạm
              thời do quản trị viên cấp.
            </p>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Mật khẩu hiện tại (tạm thời)
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Mật khẩu mới (tối thiểu 6 ký tự)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              {pwError && (
                <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">
                  {pwError}
                </div>
              )}
              <button
                type="submit"
                disabled={pwSaving}
                className="w-full rounded-lg bg-blue-800 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
              >
                {pwSaving ? "Đang lưu..." : "Xác nhận đổi mật khẩu"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
