import { decryptSecret } from "./crypto";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

export function isDriveOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

export function resolveRedirectUri(origin?: string): string {
  if (process.env.GOOGLE_REDIRECT_URI?.trim()) {
    return process.env.GOOGLE_REDIRECT_URI.trim();
  }
  const base =
    origin || process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/drive/callback`;
}

export function buildDriveAuthUrl(state: string, origin?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("Thiếu cấu hình GOOGLE_CLIENT_ID");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: resolveRedirectUri(origin),
    response_type: "code",
    scope:
      "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  origin?: string
): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Thiếu cấu hình GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: resolveRedirectUri(origin),
    grant_type: "authorization_code",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        "Không lấy được token Google Drive (hãy đảm bảo bạn đã cấp quyền đầy đủ)."
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

export async function refreshDriveAccessToken(
  encryptedRefreshToken: string
): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Thiếu cấu hình GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
  }

  const refreshToken = decryptSecret(encryptedRefreshToken);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || "Không làm mới được token Google Drive"
    );
  }
  return data.access_token;
}

export async function getDriveUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "unknown@google";
  const data = (await res.json()) as { email?: string };
  return data.email || "unknown@google";
}

async function findOrCreateFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<string> {
  const parentClause = parentId
    ? ` and '${parentId}' in parents`
    : " and 'root' in parents";
  const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentClause}`;

  const searchRes = await fetch(
    `${DRIVE_FILES_URL}?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (searchRes.ok) {
    const searchData = (await searchRes.json()) as {
      files?: Array<{ id: string; name: string }>;
    };
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
  }

  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];

  const createRes = await fetch(`${DRIVE_FILES_URL}?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Không tạo được thư mục Drive ${name}: ${errText}`);
  }
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

export async function ensureStandardFolderTree(
  accessToken: string,
  communeCode: string
): Promise<{
  rootId: string;
  evidenceId: string;
  programsId: string;
  reportsId: string;
  backupId: string;
}> {
  const rootName = `AN_SINH_XA_${communeCode.toUpperCase() || "BA"}`;
  const rootId = await findOrCreateFolder(accessToken, rootName);
  const [evidenceId, programsId, reportsId, backupId] = await Promise.all([
    findOrCreateFolder(accessToken, "01_HoSo_MinhChung", rootId),
    findOrCreateFolder(accessToken, "02_DotHoTro_DaKhoa", rootId),
    findOrCreateFolder(accessToken, "03_BaoCao_ThongKe", rootId),
    findOrCreateFolder(accessToken, "04_SaoLuu_HeThong", rootId),
  ]);
  return { rootId, evidenceId, programsId, reportsId, backupId };
}

export async function uploadBufferToDrive(params: {
  accessToken: string;
  folderId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ id: string; name: string }> {
  const boundary = `----AnSinhBoundary${Date.now().toString(16)}`;
  const metadataPart = JSON.stringify({
    name: params.fileName,
    parents: [params.folderId],
  });

  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`,
    "utf8"
  );
  const tail = Buffer.from(`\r\n--${boundary}--`, "utf8");
  const body = Buffer.concat([head, params.buffer, tail]);

  const res = await fetch(`${DRIVE_UPLOAD_URL}&fields=id,name`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upload Google Drive thất bại: ${errText}`);
  }
  return (await res.json()) as { id: string; name: string };
}

export async function fetchFileFromDrive(
  accessToken: string,
  driveFileId: string
): Promise<Response> {
  const res = await fetch(`${DRIVE_FILES_URL}/${driveFileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("Không tải được tệp từ Google Drive");
  }
  return res;
}

export async function getActiveDriveContext(): Promise<{
  accessToken: string;
  settings: typeof systemSettings.$inferSelect;
} | null> {
  const rows = await db.select().from(systemSettings).limit(1);
  const s = rows[0];
  if (!s || !s.driveConnected || !s.driveEncryptedRefreshToken) {
    return null;
  }
  const accessToken = await refreshDriveAccessToken(
    s.driveEncryptedRefreshToken
  );
  // Ensure folder ids exist
  if (!s.driveRootFolderId || !s.driveEvidenceFolderId || !s.driveBackupFolderId) {
    const folders = await ensureStandardFolderTree(accessToken, s.communeCode);
    await db
      .update(systemSettings)
      .set({
        driveRootFolderId: folders.rootId,
        driveEvidenceFolderId: folders.evidenceId,
        driveProgramsFolderId: folders.programsId,
        driveReportsFolderId: folders.reportsId,
        driveBackupFolderId: folders.backupId,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.id, s.id));
    s.driveRootFolderId = folders.rootId;
    s.driveEvidenceFolderId = folders.evidenceId;
    s.driveProgramsFolderId = folders.programsId;
    s.driveReportsFolderId = folders.reportsId;
    s.driveBackupFolderId = folders.backupId;
  }
  return { accessToken, settings: s };
}
