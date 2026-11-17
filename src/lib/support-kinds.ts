import { eq } from "drizzle-orm";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";

export function parseCustomSupportKinds(rawJson?: string | null): string[] {
  if (!rawJson) return [];
  try {
    const arr = JSON.parse(rawJson);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Lưu thêm hình thức hỗ trợ tùy chỉnh vào system_settings nếu chưa tồn tại (không trùng hoa/thường).
 */
export async function persistCustomSupportKind(rawLabel: string): Promise<{
  savedLabel: string;
  customSupportKinds: string[];
  added: boolean;
}> {
  const clean = rawLabel.replace(/\s+/g, " ").trim();
  const [s] = await db.select().from(systemSettings).limit(1);
  if (!s) {
    return { savedLabel: clean, customSupportKinds: [clean], added: true };
  }

  const existing = parseCustomSupportKinds(s.customSupportKindsJson);
  const builtinLower = new Set(["gift", "cash", "scholarship", "other", "quà / hiện vật", "tiền mặt", "học bổng", "khác"]);
  const matchedExisting = existing.find(
    (k) => k.toLowerCase() === clean.toLowerCase()
  );

  if (matchedExisting) {
    return { savedLabel: matchedExisting, customSupportKinds: existing, added: false };
  }
  if (builtinLower.has(clean.toLowerCase())) {
    return { savedLabel: clean, customSupportKinds: existing, added: false };
  }

  const next = [...existing, clean];
  await db
    .update(systemSettings)
    .set({
      customSupportKindsJson: JSON.stringify(next),
      updatedAt: new Date(),
    })
    .where(eq(systemSettings.id, s.id));

  return { savedLabel: clean, customSupportKinds: next, added: true };
}
