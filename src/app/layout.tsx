import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hệ thống Quản lý An sinh Xã hội số cấp Xã",
  applicationName: "An sinh XH",
  description:
    "Nền tảng quản lý đối tượng yếu thế, chấm điểm ưu tiên và điều phối hỗ trợ thiện nguyện minh bạch cấp cơ sở",
  appleWebApp: {
    capable: true,
    title: "An sinh XH",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f294a",
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
