import { NextResponse } from "next/server";
import { db, ensureDbReady } from "@/db";
import {
  citizenGroups,
  citizens,
  supportGroups,
  systemSettings,
  villages,
} from "@/db/schema";
import { asc, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { buildFilteredCitizensWorkbook } from "@/lib/excel";

export async function GET(req: Request) {
  await ensureDbReady();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("q")?.trim().toLowerCase() || "";
  const villageFilter = url.searchParams.get("villageId");
  const statusFilter = url.searchParams.get("status");
  const groupFilter = url.searchParams.get("groupId");

  const [settingsRows, citizenRows, villageRows, groupRows, cgRows] = await Promise.all([
    db.select().from(systemSettings).limit(1),
    db.select().from(citizens).orderBy(desc(citizens.id)),
    db.select().from(villages).orderBy(asc(villages.sortOrder)),
    db.select().from(supportGroups).orderBy(asc(supportGroups.sortOrder)),
    db.select().from(citizenGroups),
  ]);

  const vMap = new Map(villageRows.map((v) => [v.id, v]));
  const gMap = new Map(groupRows.map((g) => [g.id, g]));
  const groupsByCitizen = new Map<number, Array<typeof supportGroups.$inferSelect>>();

  for (const cg of cgRows) {
    const g = gMap.get(cg.groupId);
    if (!g) continue;
    const arr = groupsByCitizen.get(cg.citizenId) ?? [];
    arr.push(g);
    groupsByCitizen.set(cg.citizenId, arr);
  }

  const isVillageScoped = user.role === "VILLAGE_HEAD";
  const filtered = citizenRows.filter((c) => {
    if (isVillageScoped && user.villageId && c.villageId !== user.villageId) return false;
    if (villageFilter && c.villageId !== Number(villageFilter)) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    const cGroups = groupsByCitizen.get(c.id) ?? [];
    if (groupFilter && !cGroups.some((g) => g.id === Number(groupFilter))) return false;
    if (search) {
      const hay = `${c.citizenCode} ${c.fullName} ${c.normalizedName} ${c.hardshipSummary}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const byVillageMap = new Map<number, { villageName: string; active: number; ended: number; total: number }>();
  const byGroupMap = new Map<number, { groupName: string; baseScore: number; total: number }>();

  const rows = filtered.map((c) => {
    const v = vMap.get(c.villageId);
    const cGroups = groupsByCitizen.get(c.id) ?? [];
    const baseScore = cGroups.reduce((s, g) => s + g.baseScore, 0);
    const isEnded = c.status === "ENDED" || c.status === "MOVED_OUT" || c.status === "DECEASED";

    const vStat = byVillageMap.get(c.villageId) ?? {
      villageName: v?.name ?? "Khác",
      active: 0,
      ended: 0,
      total: 0,
    };
    if (isEnded) vStat.ended++;
    else vStat.active++;
    vStat.total++;
    byVillageMap.set(c.villageId, vStat);

    for (const g of cGroups) {
      const gStat = byGroupMap.get(g.id) ?? {
        groupName: g.name,
        baseScore: g.baseScore,
        total: 0,
      };
      gStat.total++;
      byGroupMap.set(g.id, gStat);
    }

    return {
      citizenCode: c.citizenCode,
      fullName: c.fullName,
      birthYear: c.birthYear,
      villageName: v?.name ?? "",
      groupsText: cGroups.map((g) => g.name).join(", "),
      baseScore,
      localBonusScore: isVillageScoped ? 0 : c.localBonusScore,
      estimatedScore: isVillageScoped ? baseScore : baseScore + c.localBonusScore,
      status: c.status,
      hardshipSummary: c.hardshipSummary,
    };
  });

  const filterParts = [
    villageFilter ? `Thôn: ${vMap.get(Number(villageFilter))?.name ?? villageFilter}` : "",
    groupFilter ? `Nhóm: ${gMap.get(Number(groupFilter))?.name ?? groupFilter}` : "",
    statusFilter ? `Trạng thái: ${statusFilter}` : "",
    search ? `Từ khóa: "${search}"` : "",
  ].filter(Boolean);

  const buf = await buildFilteredCitizensWorkbook({
    communeName: settingsRows[0]?.communeName || "Xã Bình An",
    filterDescription: filterParts.length > 0 ? filterParts.join(" | ") : "Toàn bộ danh sách",
    rows,
    byVillage: [...byVillageMap.values()].sort((a, b) =>
      a.villageName.localeCompare(b.villageName, "vi")
    ),
    byGroup: [...byGroupMap.values()].sort((a, b) => b.total - a.total),
  });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ThongKe_DoiTuong_AnSinh.xlsx"`,
    },
  });
}
