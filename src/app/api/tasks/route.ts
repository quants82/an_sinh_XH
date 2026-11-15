import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, users, villages } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";
import { canAssignTasks, getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const CreateTaskSchema = z.object({
  title: z.string().min(3, "Tiêu đề nhiệm vụ tối thiểu 3 ký tự"),
  description: z.string().optional().default(""),
  taskType: z
    .enum([
      "REVIEW_6_MONTHS",
      "VERIFY_DISASTER",
      "UPDATE_EXPIRED_TEMP",
      "PREPARE_PROGRAM",
      "OTHER",
    ])
    .default("OTHER"),
  villageId: z.number().int().nullable().optional(),
  assignedToId: z.number().int().positive(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const canSeeAll =
    user.role === "OWNER" ||
    user.role === "LEADER" ||
    user.role === "DEPT_HEAD" ||
    user.role === "AUDITOR";

  const [taskRows, userRows, villageRows] = await Promise.all([
    canSeeAll
      ? db.select().from(tasks).orderBy(desc(tasks.id))
      : db
          .select()
          .from(tasks)
          .where(
            or(
              eq(tasks.assignedToId, user.id),
              eq(tasks.assignedById, user.id)
            )
          )
          .orderBy(desc(tasks.id)),
    db
      .select({ id: users.id, fullName: users.fullName, unitName: users.unitName })
      .from(users),
    db.select().from(villages),
  ]);

  const uMap = new Map(userRows.map((u) => [u.id, u]));
  const vMap = new Map(villageRows.map((v) => [v.id, v]));

  return NextResponse.json({
    tasks: taskRows.map((t) => ({
      ...t,
      assignedToName: uMap.get(t.assignedToId)?.fullName || "",
      assignedToUnit: uMap.get(t.assignedToId)?.unitName || "",
      assignedByName: uMap.get(t.assignedById)?.fullName || "",
      villageName: t.villageId ? vMap.get(t.villageId)?.name ?? null : null,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAssignTasks(user.role)) {
    return NextResponse.json(
      { error: "Chỉ Lãnh đạo / Cấp phòng được giao nhiệm vụ" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const [created] = await db
    .insert(tasks)
    .values({
      title: data.title.trim(),
      description: data.description.trim(),
      taskType: data.taskType,
      villageId: data.villageId ?? null,
      assignedToId: data.assignedToId,
      assignedById: user.id,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      priority: data.priority,
      status: "NEW",
    })
    .returning();

  await writeAuditLog({
    actorId: user.id,
    actorName: user.fullName,
    action: "ASSIGN_TASK",
    entity: "tasks",
    entityId: created.id,
    newValue: `${created.title} -> user #${created.assignedToId}`,
  });

  return NextResponse.json({ ok: true, task: created });
}
