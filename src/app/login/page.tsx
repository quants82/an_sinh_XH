"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, User } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [communeName, setCommuneName] = useState("Xã Bình An");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.needsOnboarding) {
          router.replace("/onboarding");
          return;
        }
        if (d.user) {
          router.replace("/dashboard");
          return;
        }
        if (d.settings?.communeName) setCommuneName(d.settings.communeName);
      });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Đăng nhập thất bại");
      } else {
        router.replace("/dashboard");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0f294a] via-[#153967] to-[#1e497d] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
            <Shield className="h-6 w-6" />
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Chuyển đổi số cơ sở
          </div>
          <h1 className="mt-1 text-xl font-bold text-slate-900">
            Hệ thống An sinh Xã hội
          </h1>
          <p className="mt-1 text-sm text-slate-500">{communeName}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Tên đăng nhập
            </label>
            <div className="relative">
              <User className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="vd: lanhdao hoặc truongthon01"
                className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-800 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:opacity-60"
          >
            {submitting ? "Đang xác thực..." : "Đăng nhập hệ thống"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          Dữ liệu được phân quyền theo vai trò & địa bàn thôn. Không lưu CCCD hay
          thông tin y tế nhạy cảm.
        </p>
      </div>
    </div>
  );
}
