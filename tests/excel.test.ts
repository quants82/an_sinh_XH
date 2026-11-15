import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  buildInternalProgramWorkbook,
  buildSignoffWorkbook,
} from "../src/lib/excel";

describe("Excel exports", () => {
  it("generates strictly 6 columns for signoff workbook", async () => {
    const buf = await buildSignoffWorkbook({
      communeName: "Xã Bình An",
      programCode: "HT-2026-TET-01",
      programTitle: "Quà Tết 2026",
      donorName: "Hội CTĐ",
      rows: [
        {
          stt: 1,
          fullName: "Nguyễn Văn A",
          birthYear: 1955,
          villageName: "Thôn 1",
          hardshipSummary: "Hộ nghèo, bệnh hiểm nghèo",
        },
      ],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const header = ws.getRow(4);
    assert.equal(header.cellCount, 6);
    assert.equal(header.getCell(1).value, "STT");
    assert.equal(header.getCell(2).value, "Họ và tên");
    assert.equal(header.getCell(3).value, "Năm sinh");
    assert.equal(header.getCell(4).value, "Thôn");
    assert.equal(header.getCell(5).value, "Hoàn cảnh khó khăn");
    assert.equal(header.getCell(6).value, "Ký nhận");
  });

  it("generates full internal workbook", async () => {
    const buf = await buildInternalProgramWorkbook({
      communeName: "Xã Bình An",
      programCode: "HT-2026-TET-01",
      programTitle: "Quà Tết 2026",
      donorName: "Hội CTĐ",
      unitValue: 500000,
      rows: [
        {
          stt: 1,
          citizenCode: "BA-T01-000001",
          fullName: "Nguyễn Văn A",
          birthYear: 1955,
          villageName: "Thôn 1",
          groupsText: "Hộ nghèo",
          hardshipSummary: "Hộ nghèo",
          allocationType: "PRIMARY",
          baseScore: 10,
          bonusScore: 3,
          penaltyScore: 0,
          totalScore: 13,
          receivedCountThisYear: 0,
          warningMessage: "",
          leaderExceptionApproved: false,
          exceptionReason: "",
        },
      ],
    });
    assert.ok(buf.byteLength > 1000);
  });
});
