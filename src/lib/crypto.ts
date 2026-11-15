import crypto from "crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "./constants";

const FALLBACK_DEV_SECRET = "local-dev-an-sinh-xh-secret-32-chars!!";

function getAppSecret(): string {
  return process.env.APP_SECRET && process.env.APP_SECRET.length >= 16
    ? process.env.APP_SECRET
    : FALLBACK_DEV_SECRET;
}

function getEncryptionKey(): Buffer {
  return crypto.createHash("sha256").update(getAppSecret()).digest();
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(cipherPayload: string): string {
  const [ivHex, tagHex, dataHex] = cipherPayload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Dữ liệu mã hóa không hợp lệ");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface SessionPayload {
  userId: number;
  username: string;
  role: UserRole;
  villageId: number | null;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const secretKey = new TextEncoder().encode(getAppSecret());
  return new SignJWT({
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
    villageId: payload.villageId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(getAppSecret());
    const { payload } = await jwtVerify(token, secretKey);
    if (
      typeof payload.userId !== "number" ||
      typeof payload.username !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      username: payload.username,
      role: payload.role as UserRole,
      villageId:
        typeof payload.villageId === "number" ? payload.villageId : null,
    };
  } catch {
    return null;
  }
}
