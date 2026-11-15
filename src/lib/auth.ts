import { cookies } from "next/headers";
import { db, ensureDbReady } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { signSessionToken, verifySessionToken } from "./crypto";
import type { UserRole } from "./constants";

export const SESSION_COOKIE_NAME = "asxh_session";

export interface AuthenticatedUser {
  id: number;
  username: string;
  fullName: string;
  unitName: string;
  role: UserRole;
  villageId: number | null;
  mustChangePassword: boolean;
  isActive: boolean;
}

export async function setSessionCookie(user: AuthenticatedUser): Promise<void> {
  const token = await signSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    villageId: user.villageId,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  await ensureDbReady();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const found = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  const user = found[0];
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    unitName: user.unitName,
    role: user.role as UserRole,
    villageId: user.villageId,
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive,
  };
}

export function canEditCitizens(role: UserRole): boolean {
  return role !== "AUDITOR";
}

export function canLockPrograms(role: UserRole): boolean {
  return role === "OWNER" || role === "LEADER" || role === "DEPT_HEAD";
}

export function canApprovePrograms(role: UserRole): boolean {
  return role === "OWNER" || role === "LEADER";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "OWNER" || role === "LEADER" || role === "DEPT_HEAD";
}

export function canAssignTasks(role: UserRole): boolean {
  return role === "OWNER" || role === "LEADER" || role === "DEPT_HEAD";
}
