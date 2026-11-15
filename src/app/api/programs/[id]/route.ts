import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  citizenGroups,
  citizens,
  supportAllocations,
  supportGroups,
  supportHistory,
  supportPrograms,
  villages,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  canApprovePrograms,
  canEditCitizens,
  canLockPrograms,
  getCurrentUser,
} from "@/lib/auth";
import { runAllocationForProgram } from "@/lib/program-allocator";
import { writeAuditLog } from "@/lib/audit";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role === "VILLAGE_HEAD") {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

  const { id } = await context.params;
  const programId = Number(id);
  const [program] = await db
    .select()
    .from(supportPrograms)
    .where(eq(supportPrograms.id, programId))
    .limit(1);
  if (!program) {
    return NextResponse.json({ error: "Không tìm thấy chương trình" }, { status: 404 });
  }

  const [allocRows, citizenRows, villageRows, groupRows, cgRows] =
    await Promise.all([
      db
        .select()
        .from(supportAllocations)
        .where(eq(supportAllocations.programId, programId))
        .orderBy(desc(supportAllocations.totalScore)),
      db.select().from(citizens),
      db.select().from(villages),
      db.select().from(supportGroups),
      db.select().from(citizenGroups),
    ]);

  const cMap = new Map(citizenRows.map((c) => [c.id, c]));
  const vMap = new Map(villageRows.map((v) => [v.id, v]));
  const gMap = new Map(groupRows.map((g) => [g.id, g]));

  const groupsByCitizen = new Map<number, string[]>();
  for (const cg of cgRows) {
    const g = gMap.get(cg.groupId);
    if (!g) continue;
    const arr = groupsByCitizen.get(cg.citizenId) ?? [];
    arr.push(g.name);
    groupsByCitizen.set(cg.citizenId, arr);
  }

  const allocations = allocRows.map((a) => {
    const c = cMap.get(a.citizenId);
    const v = c ? vMap.get(c.villageId) : undefined;
    return {
      ...a,
      citizenCode: c?.citizenCode || "",
      fullName: c?.fullName || "",
      birthYear: c?.birthYear || 0,
      villageName: v?.name || "",
      hardshipSummary: c?.hardshipSummary || "",
      groupsText: (groupsByCitizen.get(a.citizenId) ?? []).join(", "),
    };
  });

  return NextResponse.json({ program, allocations });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !canEditCitizens(user.role) || user.role === "VILLAGE_HEAD") {
    return NextResponse.json({ error: "Không có quyền thao tác" }, { status: 403 });
  }

  const { id } = await context.params;
  const programId = Number(id);
  const [program] = await db
    .select()
    .from(supportPrograms)
    .where(eq(supportPrograms.id, programId))
    .limit(1);
  if (!program) {
    return NextResponse.json({ error: "Không tìm thấy chương trình" }, { status: 404 });
  }

  const body = (await req.json()) as {
    action:
      | "REFRESH_ALLOCATIONS"
      | "SUBMIT_FOR_LOCK"
      | "LOCK"
      | "APPROVE"
      | "REOPEN"
      | "APPROVE_EXCEPTION"
      | "PROMOTE_RESERVE"
      | "TOGGLE_ROW_DELIVERY"
      | "MARK_DELIVERED";
    reason?: string;
    allocationId?: number;
    isDelivered?: boolean;
    deliveredAt?: string;
    supportKind?: string;
    giftDetails?: string;
    valueVnd?: number;
    note?: string;
  };

  if (body.action === "REFRESH_ALLOCATIONS") {
    if (program.status === "LOCKED" || program.status === "APPROVED") {
      return NextResponse.json(
        { error: "Kỳ đã khóa/phê duyệt, không thể lọc lại khi chưa mở lại kỳ." },
        { status: 400 }
      );
    }
    await runAllocationForProgram(programId);
    await writeAuditLog({
      actorId: user.id,
      actorName: user.fullName,
      action: "REFRESH_ALLOCATIONS",
      entity: "support_programs",
      entityId: programId,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "SUBMIT_FOR_LOCK") {
    await db
      .update(supportPrograms)
      .set({ status: "PENDING_APPROVAL", updatedAt: new Date() })
      .where(eq(supportPrograms.id, programId));
    await writeAuditLog({
      actorId: user.id,
      actorName: user.fullName,
      action: "SUBMIT_FOR_LOCK",
      entity: "support_programs",
      entityId: programId,
      oldValue: program.status,
      newValue: "PENDING_APPROVAL",
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "LOCK") {
    if (!canLockPrograms(user.role)) {
      return NextResponse.json(
        { error: "Chỉ Lãnh đạo cấp phòng trở lên mới được khóa danh sách" },
        { status: 403 }
      );
    }
    await db
      .update(supportPrograms)
      .set({
        status: "LOCKED",
        lockedById: user.id,
        lockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(supportPrograms.id, programId));
    await writeAuditLog({
      actorId: user.id,
      actorName: user.fullName,
      action: "LOCK_PROGRAM",
      entity: "support_programs",
      entityId: programId,
      oldValue: program.status,
      newValue: "LOCKED",
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "APPROVE") {
    if (!canApprovePrograms(user.role)) {
      return NextResponse.json(
        { error: "Chỉ Lãnh đạo UBND / MTTQ mới được phê duyệt đợt hỗ trợ" },
        { status: 403 }
      );
    }
    await db
      .update(supportPrograms)
      .set({
        status: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(supportPrograms.id, programId));
    await writeAuditLog({
      actorId: user.id,
      actorName: user.fullName,
      action: "APPROVE_PROGRAM",
      entity: "support_programs",
      entityId: programId,
      oldValue: program.status,
      newValue: "APPROVED",
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "REOPEN") {
    if (!canApprovePrograms(user.role)) {
      return NextResponse.json(
        { error: "Chỉ Lãnh đạo mới được mở lại kỳ đã khóa" },
        { status: 403 }
      );
    }
    if (!body.reason?.trim()) {
      return NextResponse.json(
        { error: "Bắt buộc nhập lý do khi mở lại kỳ đã khóa" },
        { status: 400 }
      );
    }
    await db
      .update(supportPrograms)
      .set({ status: "REOPENED", updatedAt: new Date() })
      .where(eq(supportPrograms.id, programId));
    await writeAuditLog({
      actorId: user.id,
      actorName: user.fullName,
      action: "REOPEN_PROGRAM",
      entity: "support_programs",
      entityId: programId,
      oldValue: program.status,
      newValue: "REOPENED",
      reason: body.reason.trim(),
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "APPROVE_EXCEPTION" || body.action === "PROMOTE_RESERVE") {
    if (!canApprovePrograms(user.role) && !canLockPrograms(user.role)) {
      return NextResponse.json(
        { error: "Chỉ Cấp phòng/Lãnh đạo mới được duyệt ngoại lệ" },
        { status: 403 }
      );
    }
    if (!body.allocationId || !body.reason?.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập lý do duyệt ngoại lệ" },
        { status: 400 }
      );
    }
    await db
      .update(supportAllocations)
      .set({
        allocationType: "PRIMARY",
        leaderExceptionApproved: true,
        exceptionReason: body.reason.trim(),
      })
      .where(eq(supportAllocations.id, body.allocationId));
    await writeAuditLog({
      actorId: user.id,
      actorName: user.fullName,
      action: body.action,
      entity: "support_allocations",
      entityId: body.allocationId,
      reason: body.reason.trim(),
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "TOGGLE_ROW_DELIVERY") {
    if (program.status !== "APPROVED" && program.status !== "LOCKED") {
      return NextResponse.json(
        { error: "Cần khóa hoặc phê duyệt danh sách trước khi tick ghi nhận phát quà." },
        { status: 400 }
      );
    }
    if (!body.allocationId) {
      return NextResponse.json({ error: "Thiếu allocationId" }, { status: 400 });
    }

    const [alloc] = await db
      .select()
      .from(supportAllocations)
      .where(eq(supportAllocations.id, body.allocationId))
      .limit(1);
    if (!alloc || alloc.programId !== programId) {
      return NextResponse.json({ error: "Không tìm thấy dòng phân bổ" }, { status: 404 });
    }

    const mark = body.isDelivered ?? true;
    const { and } = await import("drizzle-orm");
    const { classifySupportTier } = await import("@/lib/scoring");
    const { systemSettings } = await import("@/db/schema");
    const [s] = await db.select().from(systemSettings).limit(1);

    if (mark) {
      const receivedAt = body.deliveredAt ? new Date(body.deliveredAt) : new Date();
      const supportKind = body.supportKind || program.supportKind;
      const giftDetails = body.giftDetails?.trim() || program.title;
      const valueVnd =
        typeof body.valueVnd === "number" && body.valueVnd >= 0
          ? body.valueVnd
          : program.unitValue;
      const note = body.note?.trim() || null;
      const tier = classifySupportTier(
        valueVnd,
        s?.smallSupportMax ?? 500000,
        s?.mediumSupportMax ?? 2000000
      );

      await db
        .update(supportAllocations)
        .set({
          isDelivered: true,
          deliveredAt: receivedAt,
          deliveredSupportKind: supportKind,
          deliveredGiftDetails: giftDetails,
          deliveredValueVnd: valueVnd,
          deliveryNote: note,
        })
        .where(eq(supportAllocations.id, alloc.id));

      const existingHist = await db
        .select()
        .from(supportHistory)
        .where(
          and(
            eq(supportHistory.programId, program.id),
            eq(supportHistory.citizenId, alloc.citizenId)
          )
        )
        .limit(1);

      if (existingHist[0]) {
        await db
          .update(supportHistory)
          .set({
            supportKind,
            giftDetails,
            valueVnd,
            tier,
            note,
            receivedAt,
            recordedById: user.id,
          })
          .where(eq(supportHistory.id, existingHist[0].id));
      } else {
        await db.insert(supportHistory).values({
          citizenId: alloc.citizenId,
          programId: program.id,
          programCode: program.programCode,
          programTitle: program.title,
          occasionKey: program.occasionKey,
          donorName: program.donorName,
          supportKind,
          giftDetails,
          valueVnd,
          tier,
          note,
          receivedAt,
          recordedById: user.id,
        });
      }

      await writeAuditLog({
        actorId: user.id,
        actorName: user.fullName,
        action: "RECORD_ROW_DELIVERY",
        entity: "support_allocations",
        entityId: alloc.id,
        newValue: `${supportKind}: ${giftDetails} (${valueVnd.toLocaleString("vi-VN")}đ) ngày ${receivedAt.toISOString().slice(0, 10)}`,
        reason: note,
      });
    } else {
      await db
        .update(supportAllocations)
        .set({
          isDelivered: false,
          deliveredAt: null,
          deliveredSupportKind: null,
          deliveredGiftDetails: null,
          deliveredValueVnd: null,
          deliveryNote: null,
        })
        .where(eq(supportAllocations.id, alloc.id));

      await db
        .delete(supportHistory)
        .where(
          and(
            eq(supportHistory.programId, program.id),
            eq(supportHistory.citizenId, alloc.citizenId)
          )
        );

      await writeAuditLog({
        actorId: user.id,
        actorName: user.fullName,
        action: "UNMARK_ROW_DELIVERY",
        entity: "support_allocations",
        entityId: alloc.id,
        reason: body.reason || "Hủy tick ghi nhận cấp phát",
      });
    }

    return NextResponse.json({ ok: true });
  }

  if (body.action === "MARK_DELIVERED") {
    if (program.status !== "APPROVED" && program.status !== "LOCKED") {
      return NextResponse.json(
        { error: "Cần khóa/phê duyệt danh sách trước khi chốt đã trao quà" },
        { status: 400 }
      );
    }

    const allocs = await db
      .select()
      .from(supportAllocations)
      .where(eq(supportAllocations.programId, programId));

    const primaries = allocs.filter(
      (a) =>
        (a.allocationType === "PRIMARY" || a.leaderExceptionApproved) &&
        !a.isDelivered
    );

    const now = body.deliveredAt ? new Date(body.deliveredAt) : new Date();
    const supportKind = body.supportKind || program.supportKind;
    const giftDetails = body.giftDetails?.trim() || program.title;
    const valueVnd =
      typeof body.valueVnd === "number" && body.valueVnd >= 0
        ? body.valueVnd
        : program.unitValue;

    for (const a of primaries) {
      await db
        .update(supportAllocations)
        .set({
          isDelivered: true,
          deliveredAt: now,
          deliveredSupportKind: supportKind,
          deliveredGiftDetails: giftDetails,
          deliveredValueVnd: valueVnd,
          deliveryNote: body.note?.trim() || null,
        })
        .where(eq(supportAllocations.id, a.id));

      await db.insert(supportHistory).values({
        citizenId: a.citizenId,
        programId: program.id,
        programCode: program.programCode,
        programTitle: program.title,
        occasionKey: program.occasionKey,
        donorName: program.donorName,
        supportKind,
        giftDetails,
        valueVnd,
        tier: program.tier,
        note: body.note?.trim() || null,
        receivedAt: now,
        recordedById: user.id,
      });
    }

    await writeAuditLog({
      actorId: user.id,
      actorName: user.fullName,
      action: "MARK_DELIVERED",
      entity: "support_programs",
      entityId: programId,
      newValue: `Đã ghi nhận lịch sử nhận hỗ trợ cho ${primaries.length} người`,
    });

    return NextResponse.json({ ok: true, count: primaries.length });
  }

  return NextResponse.json({ error: "Thao tác không hỗ trợ" }, { status: 400 });
}
