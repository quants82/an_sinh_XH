import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, citizenChanges, citizens } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  if (user.role === "VILLAGE_HEAD") {
    return NextResponse.json(
      { error: "Không có quyền xem nhật ký hệ thống toàn xã" },
      { status: 403 }
    );
  }

  const [logs, changes, citizenRows] = await Promise.all([
    db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(200),
    db.select().from(citizenChanges).orderBy(desc(citizenChanges.id)).limit(200),
    db
      .select({
        id: citizens.id,
        citizenCode: citizens.citizenCode,
        fullName: citizens.fullName,
      })
      .from(citizens),
  ]);

  const cMap = new Map(citizenRows.map((c) => [c.id, c]));

  return NextResponse.json({
    logs,
    changes: changes.map((ch) => ({
      ...ch,
      citizenCode: cMap.get(ch.citizenId)?.citizenCode ?? "",
      citizenName: cMap.get(ch.citizenId)?.fullName ?? "",
    })),
  });
}
