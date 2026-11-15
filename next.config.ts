import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "exceljs", "bcryptjs"],
};

export default nextConfig;
