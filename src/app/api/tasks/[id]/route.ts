import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAssignTasks, getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await context.params;
  const taskId = Number(id);
  const [existing] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Không tìm thấy nhiệm vụ" }, { status: 404 });
  }

  const isAssignee = existing.assignedToId === user.id;
  const isManager = canAssignTasks(user.role);
  if (!isAssignee && !isManager) {
    return NextResponse.json(
      { error: "Không có quyền cập nhật nhiệm vụ này" },
      { status: 403 }
    );
  }

  const body = (await req.json()) as {
    status?: "NEW" | "IN_PROGRESS" | "SUBMITTED" | "DONE" | "RETURNED";
    completionNote?: string;
  };

  // Only managers can mark DONE or RETURNED
  if (
    (body.status === "DONE" || body.status === "RETURNED") &&
    !isManager
  ) {
    return NextResponse.json(
      { error: "Chỉ người giao việc / Lãnh đạo được duyệt hoàn thành hoặc trả lại" },
      { status: 403 }
    );
  }

  await db
    .update(tasks)
    .set({
      status: body.status ?? existing.status,
      completionNote:
        body.completionNote !== undefined
          ? body.completionNote.trim()
          : existing.completionNote,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  await writeAuditLog({
    actorId: user.id,
    actorName: user.fullName,
    action: "UPDATE_TASK",
    entity: "tasks",
    entityId: taskId,
    oldValue: existing.status,
    newValue: body.status ?? existing.status,
    reason: body.completionNote,
  });

  return NextResponse.json({ ok: true });
}
