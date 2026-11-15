import { NextResponse } from "next/server";
import { db, ensureDbReady } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import {
  ensureStandardFolderTree,
  exchangeCodeForTokens,
  getDriveUserEmail,
} from "@/lib/drive";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: Request) {
  await ensureDbReady();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  let returnTo = "/admin";
  if (stateParam) {
    try {
      const parsed = JSON.parse(decryptSecret(stateParam)) as {
        userId: number;
        returnTo?: string;
      };
      if (parsed.returnTo) returnTo = parsed.returnTo;
    } catch {
      return NextResponse.redirect(new URL("/admin?drive=error_state", url.origin));
    }
  }

  if (errorParam || !code) {
    return NextResponse.redirect(
      new URL(
        `${returnTo}?drive=${errorParam ? "error" : "cancelled"}&msg=${encodeURIComponent(
          errorParam || "Bạn đã hủy cấp quyền Google Drive"
        )}`,
        url.origin
      )
    );
  }

  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") {
    return NextResponse.redirect(
      new URL("/login?error=forbidden", url.origin)
    );
  }

  try {
    const { accessToken, refreshToken } = await exchangeCodeForTokens(
      code,
      url.origin
    );
    const driveEmail = await getDriveUserEmail(accessToken);

    const settingsRows = await db.select().from(systemSettings).limit(1);
    const s = settingsRows[0];
    const communeCode = s?.communeCode || "BA";
    const folders = await ensureStandardFolderTree(accessToken, communeCode);

    const encryptedToken = encryptSecret(refreshToken);

    if (s) {
      await db
        .update(systemSettings)
        .set({
          driveConnected: true,
          driveEmail,
          driveEncryptedRefreshToken: encryptedToken,
          driveRootFolderId: folders.rootId,
          driveEvidenceFolderId: folders.evidenceId,
          driveProgramsFolderId: folders.programsId,
          driveReportsFolderId: folders.reportsId,
          driveBackupFolderId: folders.backupId,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.id, s.id));
    }

    await writeAuditLog({
      actorId: user.id,
      actorName: user.fullName,
      action: "CONNECT_DRIVE",
      entity: "system_settings",
      entityId: "1",
      newValue: driveEmail,
    });

    return NextResponse.redirect(
      new URL(`${returnTo}?drive=connected`, url.origin)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "connect_failed";
    return NextResponse.redirect(
      new URL(
        `${returnTo}?drive=error&msg=${encodeURIComponent(msg)}`,
        url.origin
      )
    );
  }
}
