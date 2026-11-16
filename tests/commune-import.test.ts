import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  parseCommuneWorkbook,
  parseFlexibleBirthYear,
  resolveBinhAnVillageName,
  resolveWelfareGroupCode,
} from "../src/lib/commune-import";
import {
  buildScoringRulesWorkbook,
  parseScoringRulesWorkbook,
} from "../src/lib/excel";
import { getRouteGuide, ROUTE_GUIDES } from "../src/lib/route-guides";

describe("Bình An village alias & typo normalization", () => {
  it("maps merged hamlets and spelling variants to 10 canonical villages", () => {
    assert.equal(resolveBinhAnVillageName("Kiên Thạnh"), "Vĩnh Lộc");
    assert.equal(resolveBinhAnVillageName("Vình Lộc"), "Vĩnh Lộc");
    assert.equal(resolveBinhAnVillageName("Vân Tường"), "Trường Định");
    assert.equal(resolveBinhAnVillageName("Trường Định 1"), "Trường Định");
    assert.equal(resolveBinhAnVillageName("Trưừng Định 2"), "Trường Định");
    assert.equal(resolveBinhAnVillageName("An Dõng"), "Kiên Ngãi");
    assert.equal(resolveBinhAnVillageName("Nhơn Thuận"), "An Vinh");
    assert.equal(resolveBinhAnVillageName("Mỹ an"), "Mỹ An");
    assert.equal(resolveBinhAnVillageName("Phú lạc"), "Phú Lạc");
  });
});

describe("NĐ 176 / NĐ 20 / NĐ 335 group header matching", () => {
  it("resolves section banners even with real-world typos", () => {
    assert.equal(
      resolveWelfareGroupCode(
        "Người từ  đủ 70 tuổi đến đưới 75 tuổi thuộc hộ nghèo, hộ cận nghèo, không hưởng lương hưu hoặc trợ cấp bảo hiểm xã hội hằng tháng"
      ),
      "HT_70_75_HN"
    );
    assert.equal(
      resolveWelfareGroupCode(
        "Người từ đủ 75 tuổi trở lên, không có lương hưu, trợ cấp bảo hiểm xã hội hàng tháng, trợ cấp xã hội hàng tháng"
      ),
      "HT_75_TRO_LEN"
    );
    assert.equal(
      resolveWelfareGroupCode("Người cao tuổi, khuyết tật đặc biêt nặng"),
      "NCT_KT_DBN"
    );
    assert.equal(
      resolveWelfareGroupCode(
        "Hỗ trợ chi phí chăm sóc hàng tháng cho hộ gia đình đang nuôi dưỡng người khuyết tật đặc biệt nặng"
      ),
      "CHAM_SOC_KT_DBN"
    );
    assert.equal(
      resolveWelfareGroupCode(
        "Hỗ trợ chi phí chăm sóc hàng tháng cho người nhận nuôi dưỡng trẻ mồ côi từ 4 đến dưới 16 tuổi"
      ),
      "CHAM_SOC_MO_COI"
    );
  });
});

describe("Flexible birth year parsing", () => {
  it("handles Date objects, DD/MM/YYYY, YYYY, 5-digit typo and flags bad dates", () => {
    assert.deepEqual(parseFlexibleBirthYear(new Date("1954-09-07T00:00:00Z"), 2026), {
      birthYear: 1954,
      rawText: "1954-09-07",
      valid: true,
      warning: undefined,
    });
    assert.equal(parseFlexibleBirthYear("15/03/1951", 2026).birthYear, 1951);
    assert.equal(parseFlexibleBirthYear(1948, 2026).birthYear, 1948);

    const typo5 = parseFlexibleBirthYear("08/06/20078", 2026);
    assert.equal(typo5.birthYear, 2007);
    assert.equal(typo5.valid, true);

    const badShort = parseFlexibleBirthYear("01/01/193", 2026);
    assert.equal(badShort.valid, false);

    const empty = parseFlexibleBirthYear("", 2026);
    assert.equal(empty.valid, false);
  });
});

describe("VH-XH multi-sheet workbook parsing & Leader scoring Excel round-trip", () => {
  it("cuts headers/footers, parses horizontal group banners and un-numbered rows", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Bình Hòa");
    ws.addRow(["UBND XÃ BÌNH AN", "", "", "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"]);
    ws.addRow(["PHÒNG VH-XH"]);
    ws.addRow(["STT", "Số sổ", "Họ và tên", "Ngày, tháng, năm sinh", "Nơi thường trú mới", "Hệ số"]);
    ws.addRow(["Tổng cộng", "", "", "", "", ""]);
    ws.addRow([
      "Người từ đủ 75 tuổi trở lên, không hưởng lương hưu hoặc trợ cấp bảo hiểm xã hội hằng tháng",
      "Người từ đủ 75 tuổi trở lên, không hưởng lương hưu hoặc trợ cấp bảo hiểm xã hội hằng tháng",
      "Người từ đủ 75 tuổi trở lên, không hưởng lương hưu hoặc trợ cấp bảo hiểm xã hội hằng tháng",
      "",
      "",
      "",
    ]);
    ws.addRow(["", "", "Nguyễn Văn Thử", "1945", "Kiên Thạnh", "1.0", "", "TM"]);
    ws.addRow(["2", "555", "Trần Thị Giảm", "12/04/1948", "Vân Tường", "1.0", "", "G.T8"]);
    ws.addRow([
      " ",
      "Hỗ trợ chi phí chăm sóc hàng tháng cho người nhận nuôi dưỡng trẻ mồ côi từ 4 đến dưới 16 tuổi",
      "Hỗ trợ chi phí chăm sóc hàng tháng cho người nhận nuôi dưỡng trẻ mồ côi từ 4 đến dưới 16 tuổi",
      "Hỗ trợ chi phí chăm sóc hàng tháng cho người nhận nuôi dưỡng trẻ mồ côi từ 4 đến dưới 16 tuổi",
      "Hỗ trợ chi phí chăm sóc hàng tháng cho người nhận nuôi dưỡng trẻ mồ côi từ 4 đến dưới 16 tuổi",
      "1.0",
    ]);
    ws.addRow(["1", "999", "Lê Văn Nuôi", "1972", "An Dõng", "1.5"]);
    ws.addRow(["Tổng số đối tượng tháng 10:", "", "", 3]);
    ws.addRow(["BÊN NHẬN CHI TRẢ"]);
    ws.addRow(["", "", "Huỳnh Văn Dũng"]);

    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const parsed = await parseCommuneWorkbook(buf);

    assert.equal(parsed.format, "VHXH_WELFARE");
    assert.equal(parsed.totalRowsRead, 3);
    assert.equal(parsed.reducedOrPausedCount, 1);

    assert.equal(parsed.rows[0].fullName, "Nguyễn Văn Thử");
    assert.equal(parsed.rows[0].resolvedVillageName, "Vĩnh Lộc");
    assert.deepEqual(parsed.rows[0].matchedGroupCodes, ["HT_75_TRO_LEN"]);

    assert.equal(parsed.rows[1].isReducedOrPaused, true);
    assert.equal(parsed.rows[1].resolvedVillageName, "Trường Định");

    assert.equal(parsed.rows[2].fullName, "Lê Văn Nuôi");
    assert.equal(parsed.rows[2].resolvedVillageName, "Kiên Ngãi");
    assert.deepEqual(parsed.rows[2].matchedGroupCodes, ["CHAM_SOC_MO_COI"]);
  });

  it("round-trips standalone Leader scoring workbook", async () => {
    const buf = await buildScoringRulesWorkbook([
      {
        code: "HT_75_TRO_LEN",
        name: "Hưu trí XH (>= 75 tuổi)",
        baseScore: 7,
        isActive: true,
        defaultDurationMonths: null,
      },
      {
        code: "THIEN_TAI",
        name: "Hộ thiên tai",
        baseScore: 9,
        isActive: false,
        defaultDurationMonths: 6,
      },
    ]);
    const rows = await parseScoringRulesWorkbook(buf);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], {
      code: "HT_75_TRO_LEN",
      name: "Hưu trí XH (>= 75 tuổi)",
      baseScore: 7,
      isActive: true,
      defaultDurationMonths: null,
    });
    assert.deepEqual(rows[1], {
      code: "THIEN_TAI",
      name: "Hộ thiên tai",
      baseScore: 9,
      isActive: false,
      defaultDurationMonths: 6,
    });
  });

  it("provides step-by-step user guides for all 7 sidebar menus", () => {
    const expectedRoutes = [
      "/dashboard",
      "/citizens",
      "/programs",
      "/reports",
      "/tasks",
      "/audit",
      "/admin",
    ];
    assert.equal(ROUTE_GUIDES.length, 7);
    for (const r of expectedRoutes) {
      const g = getRouteGuide(r);
      assert.equal(g.href, r);
      assert.ok(g.steps.length >= 2);
      assert.ok(g.tip.length > 0);
    }
  });
});
