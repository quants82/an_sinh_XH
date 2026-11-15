import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildDriveAuthUrl, isDriveOAuthConfigured } from "@/lib/drive";
import { encryptSecret } from "@/lib/crypto";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") {
    return NextResponse.json(
      { error: "Chỉ Chủ quản hệ thống (Lãnh đạo) mới được kết nối Google Drive." },
      { status: 403 }
    );
  }
  if (!isDriveOAuthConfigured()) {
    return NextResponse.json(
      { error: "Chưa cấu hình GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET trong biến môi trường." },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") || "/admin";
  const statePayload = JSON.stringify({
    userId: user.id,
    returnTo,
    ts: Date.now(),
  });
  const state = encryptSecret(statePayload);
  const authUrl = buildDriveAuthUrl(state, url.origin);
  return NextResponse.redirect(authUrl);
}
