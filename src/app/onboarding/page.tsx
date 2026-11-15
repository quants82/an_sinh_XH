"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  HardDrive,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [communeName, setCommuneName] = useState("Xã Bình An");
  const [communeCode, setCommuneCode] = useState("BA");
  const [leaderFullName, setLeaderFullName] = useState("");
  const [leaderUnitName, setLeaderUnitName] = useState("UBND Xã");
  const [username, setUsername] = useState("lanhdao");
  const [password, setPassword] = useState("");
  const [villagesText, setVillagesText] = useState(
    Array.from({ length: 17 }, (_, i) => `Thôn ${i + 1}`).join("\n")
  );
  const [driveOAuthConfigured, setDriveOAuthConfigured] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => {
        if (!d.needsOnboarding) {
          if (d.user?.role === "OWNER" && !d.settings?.driveConnected) {
            setStep(2);
          } else {
            router.replace(d.user ? "/dashboard" : "/login");
            return;
          }
        }
        if (d.settings) {
          setDriveOAuthConfigured(Boolean(d.settings.driveOAuthConfigured));
          setDriveConnected(Boolean(d.settings.driveConnected));
          setDriveEmail(d.settings.driveEmail || null);
        }
      });
  }, [router]);

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const villageNames = villagesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communeName,
          communeCode,
          leaderFullName,
          leaderUnitName,
          username,
          password,
          villageNames,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Khởi tạo thất bại");
      } else {
        setStep(2);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f294a] to-[#1e497d] px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-2xl md:p-8">
        <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Khởi tạo Hệ thống An sinh Xã hội số
            </h1>
            <p className="text-xs text-slate-500">
              Thiết lập tài khoản Lãnh đạo chủ quản & kết nối Google Drive lần đầu
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-6 flex items-center gap-3 text-xs font-semibold">
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${
              step === 1
                ? "bg-blue-800 text-white"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {step > 1 ? <CheckCircle2 className="h-4 w-4" /> : <span>1</span>}
            <span>Thông tin Xã & Chủ quản</span>
          </div>
          <div className="h-px flex-1 bg-slate-200" />
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${
              step === 2
                ? "bg-blue-800 text-white"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            <span>2</span>
            <span>Kết nối Google Drive</span>
          </div>
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1Submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Tên đơn vị (Xã / Phường)
                </label>
                <input
                  type="text"
                  required
                  value={communeName}
                  onChange={(e) => setCommuneName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Mã viết tắt (sinh mã CD)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={communeCode}
                  onChange={(e) => setCommuneCode(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Họ tên Lãnh đạo Chủ quản (OWNER)
                </label>
                <input
                  type="text"
                  required
                  placeholder="vd: Nguyễn Văn A"
                  value={leaderFullName}
                  onChange={(e) => setLeaderFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Đơn vị công tác
                </label>
                <input
                  type="text"
                  required
                  value={leaderUnitName}
                  onChange={(e) => setLeaderUnitName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Tên đăng nhập quản trị
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Mật khẩu (tối thiểu 6 ký tự)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Danh sách 17 thôn (mỗi dòng 1 tên thôn, hệ thống tự gán mã cố định T01..T17)
              </label>
              <textarea
                rows={5}
                value={villagesText}
                onChange={(e) => setVillagesText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs leading-relaxed"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-800 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
            >
              <span>{submitting ? "Đang khởi tạo..." : "Lưu & Sang bước kết nối Google Drive"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <HardDrive className="mt-0.5 h-6 w-6 shrink-0 text-blue-800" />
                <div>
                  <h2 className="font-bold text-blue-950">
                    Kết nối Google Drive của Lãnh đạo / Cơ quan
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-blue-900">
                    Hệ thống sẽ tự động tạo thư mục chuẩn{" "}
                    <code className="rounded bg-white px-1 py-0.5 font-semibold">
                      AN_SINH_XA_{communeCode}
                    </code>{" "}
                    gồm 4 thư mục con (Hồ sơ minh chứng, Đợt hỗ trợ đã khóa, Báo
                    cáo, Sao lưu) trên Google Drive của bạn.
                  </p>
                </div>
              </div>
            </div>

            {driveConnected ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span>Đã kết nối Google Drive: {driveEmail}</span>
                </div>
              </div>
            ) : !driveOAuthConfigured ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
                <div className="mb-1 flex items-center gap-1.5 font-bold">
                  <AlertCircle className="h-4 w-4 text-amber-700" />
                  <span>Chưa cấu hình Google OAuth trên máy chủ</span>
                </div>
                <p>
                  Biến môi trường <code>GOOGLE_CLIENT_ID</code> và{" "}
                  <code>GOOGLE_CLIENT_SECRET</code> chưa được thiết lập. Bạn vẫn có
                  thể vào hệ thống ngay để chạy thử dữ liệu giả định và thêm nhân
                  viên; sau khi cấu hình biến môi trường trên Vercel, vào{" "}
                  <b>Quản trị &amp; Google Drive</b> để bấm kết nối bất cứ lúc nào.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              {driveOAuthConfigured && !driveConnected && (
                <a
                  href="/api/drive/auth?returnTo=/dashboard"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-800 py-2.5 text-sm font-semibold text-white hover:bg-blue-900"
                >
                  <HardDrive className="h-4 w-4" />
                  <span>Kết nối Google Drive ngay</span>
                </a>
              )}
              <button
                onClick={() => router.replace("/dashboard")}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <span>Vào Bảng điều khiển</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
