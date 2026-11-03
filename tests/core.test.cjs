const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path");
const { parseInput, normalizeOutput, loadCases } = require("../src/ent.cjs");
test("입력 한 줄씩, BOM/Windows 줄바꿈, 마지막 개행 처리", () => {
  assert.deepEqual(parseInput("\uFEFF3\r\n80\r\n90\r\n100\r\n"), [
    "3",
    "80",
    "90",
    "100",
  ]);
  assert.deepEqual(parseInput("0\n"), ["0"]);
  assert.deepEqual(parseInput(""), []);
  assert.deepEqual(parseInput("hello world\n"), ["hello world"]);
});
test("출력은 앞뒤 공백만 무시하고 문구와 내부 공백 보존", () => {
  assert.equal(normalizeOutput(" 정답은 120\r\n"), "정답은 120");
  assert.notEqual(normalizeOutput("정답은 120"), "120");
  assert.notEqual(normalizeOutput("a  b"), "a b");
});
test("테스트 짝 누락과 빈 입력 줄을 명확히 거부", async () => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "entry-tests-"));
  try {
    await fs.writeFile(path.join(d, "input1.txt"), "1\n");
    await assert.rejects(loadCases(d), /output1/);
    await fs.writeFile(path.join(d, "output1.txt"), "1\n");
    assert.equal((await loadCases(d))[0].expected, "1");
    await fs.writeFile(path.join(d, "input1.txt"), "1\n\n2");
    await assert.rejects(loadCases(d), /빈 줄/);
  } finally {
    await fs.rm(d, { recursive: true, force: true });
  }
});
test("Excel 상세·학생별 합계와 문자열 출력 보존", async () => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "entry-report-"));
  try {
    const file = path.join(d, "result.xlsx");
    await require("../src/report.cjs").writeReport(file, [
      {
        problem: "문제1",
        studentId: "20401",
        name: "테스트",
        file: "demo.ent",
        test: "1",
        status: "PASS",
        actual: "=1+1",
        expected: "=1+1",
      },
      {
        problem: "문제1",
        studentId: "20401",
        name: "테스트",
        file: "demo.ent",
        test: "2",
        status: "FAIL",
        actual: "0",
        expected: "1",
      },
    ]);
    const wb = new (require("exceljs").Workbook)();
    await wb.xlsx.readFile(file);
    assert.equal(wb.getWorksheet("학생별 결과").getCell("D2").value, 2);
    assert.equal(wb.getWorksheet("학생별 결과").getCell("E2").value, 1);
    assert.equal(wb.getWorksheet("테스트별 상세").getCell("G2").value, "=1+1");
    assert.equal(wb.worksheets.length, 3);
  } finally {
    await fs.rm(d, { recursive: true, force: true });
  }
});
