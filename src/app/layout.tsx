import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hệ thống Quản lý An sinh Xã hội số cấp Xã",
  description:
    "Nền tảng quản lý đối tượng yếu thế, chấm điểm ưu tiên và điều phối hỗ trợ thiện nguyện minh bạch cấp cơ sở",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
