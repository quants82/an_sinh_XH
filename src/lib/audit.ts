import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export interface AuditEntryInput {
  actorId: number | null;
  actorName: string;
  action: string;
  entity: string;
  entityId: string | number;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
}

export async function writeAuditLog(entry: AuditEntryInput): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: entry.actorId,
    actorName: entry.actorName,
    action: entry.action,
    entity: entry.entity,
    entityId: String(entry.entityId),
    fieldName: entry.fieldName ?? null,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    reason: entry.reason ?? null,
  });
}

export async function diffAndAuditFields(params: {
  actorId: number | null;
  actorName: string;
  entity: string;
  entityId: string | number;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  fields: string[];
  reason?: string | null;
}): Promise<string[]> {
  const changed: string[] = [];
  for (const field of params.fields) {
    const oldStr =
      params.before[field] === null || params.before[field] === undefined
        ? ""
        : String(params.before[field]);
    const newStr =
      params.after[field] === null || params.after[field] === undefined
        ? ""
        : String(params.after[field]);
    if (oldStr !== newStr) {
      changed.push(field);
      await writeAuditLog({
        actorId: params.actorId,
        actorName: params.actorName,
        action: "UPDATE",
        entity: params.entity,
        entityId: params.entityId,
        fieldName: field,
        oldValue: oldStr,
        newValue: newStr,
        reason: params.reason ?? null,
      });
    }
  }
  return changed;
}
