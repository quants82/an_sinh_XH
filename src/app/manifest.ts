import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hệ thống An sinh Xã hội số — Xã Bình An",
    short_name: "An sinh XH",
    description:
      "Nền tảng quản lý đối tượng yếu thế, chấm điểm ưu tiên và điều phối hỗ trợ thiện nguyện minh bạch cấp cơ sở",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0f294a",
    theme_color: "#0f294a",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
