import { NextResponse } from "next/server";
import { db, ensureDbReady } from "@/db";
import { systemSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { isDriveOAuthConfigured } from "@/lib/drive";

export async function GET() {
  await ensureDbReady();
  const [owners, settingsRows, currentUser] = await Promise.all([
    db.select({ id: users.id }).from(users).where(eq(users.role, "OWNER")).limit(1),
    db.select().from(systemSettings).limit(1),
    getCurrentUser(),
  ]);

  const s = settingsRows[0];
  return NextResponse.json({
    needsOnboarding: owners.length === 0,
    user: currentUser,
    settings: s
      ? {
          communeName: s.communeName,
          communeCode: s.communeCode,
          requireDriveToSave: s.requireDriveToSave,
          driveConnected: s.driveConnected,
          driveEmail: s.driveEmail,
          lastBackupAt: s.lastBackupAt,
          driveOAuthConfigured: isDriveOAuthConfigured(),
        }
      : null,
  });
}
