import { NextResponse } from "next/server";
import { canApprovePrograms, getCurrentUser } from "@/lib/auth";
import { seedDemoDataset } from "@/lib/demo-seed";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !canApprovePrograms(user.role)) {
    return NextResponse.json(
      { error: "Chỉ Lãnh đạo mới được nạp dữ liệu mẫu" },
      { status: 403 }
    );
  }

  const result = await seedDemoDataset(user.id, user.fullName);
  return NextResponse.json({ ok: true, ...result });
}
