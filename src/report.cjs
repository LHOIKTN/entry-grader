const ExcelJS = require("exceljs");
const labels = {
  PASS: "통과",
  FAIL: "오답",
  ERROR: "실행 오류",
  TIMEOUT: "시간 초과",
  INPUT_EXHAUSTED: "입력 부족",
  UNUSED_INPUT: "입력 남음",
  NO_OUTPUT: "출력 없음",
  CANCELLED: "중단",
};
function tableSheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns;
  rows.forEach((r) => ws.addRow(r));
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: columns.length },
  };
  ws.getRow(1).height = 27;
  ws.getRow(1).font = {
    name: "Arial",
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF274694" },
  };
  ws.eachRow((row, n) => {
    if (n > 1) {
      row.alignment = { vertical: "top", wrapText: true };
      row.font = { name: "Arial", size: 11 };
      if (n % 2 === 0)
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF2F5FA" },
        };
    }
  });
  return ws;
}
async function writeReport(file, results, metadata = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Entry Grader";
  wb.created = new Date();
  const grouped = new Map();
  for (const r of results) {
    const key = r.problem + "\0" + r.file;
    let s = grouped.get(key);
    if (!s) {
      s = {
        problem: r.problem,
        studentId: r.studentId,
        name: r.name,
        file: r.file,
        total: 0,
        pass: 0,
        fail: 0,
        other: 0,
      };
      grouped.set(key, s);
    }
    s.total++;
    s[r.status === "PASS" ? "pass" : r.status === "FAIL" ? "fail" : "other"]++;
  }
  tableSheet(
    wb,
    "학생별 결과",
    [
      { header: "문제", key: "problem", width: 12 },
      { header: "학번", key: "studentId", width: 12 },
      { header: "이름", key: "name", width: 16 },
      { header: "실행 테스트 수", key: "total", width: 18 },
      { header: "통과", key: "pass", width: 12 },
      { header: "오답", key: "fail", width: 12 },
      { header: "오류·기타", key: "other", width: 15 },
      { header: "파일", key: "file", width: 42 },
    ],
    [...grouped.values()],
  );
  tableSheet(
    wb,
    "테스트별 상세",
    [
      { header: "문제", key: "problem", width: 12 },
      { header: "학번", key: "studentId", width: 12 },
      { header: "이름", key: "name", width: 16 },
      { header: "테스트", key: "test", width: 10 },
      { header: "판정", key: "verdict", width: 16 },
      { header: "기대 출력", key: "expected", width: 34 },
      { header: "실제 마지막 말풍선", key: "actual", width: 34 },
      { header: "설명", key: "detail", width: 48 },
      { header: "사용 입력 수", key: "inputsUsed", width: 16 },
      { header: "전체 입력 수", key: "inputCount", width: 16 },
      { header: "실행 시간(ms)", key: "elapsedMs", width: 18 },
      { header: "파일", key: "file", width: 42 },
    ],
    results.map((r) => ({ ...r, verdict: labels[r.status] || r.status })),
  );
  tableSheet(
    wb,
    "실행 정보",
    [
      { header: "항목", key: "key", width: 25 },
      { header: "내용", key: "value", width: 100 },
    ],
    [
      {
        key: "출력 비교",
        value:
          "정답 문자열이 마지막 말하기 말풍선에 포함되면 통과. 앞뒤 공백·줄바꿈 무시. 질문 제외.",
      },
      {
        key: "채점 상태",
        value: metadata.cancelled ? "중단됨 — 완료된 테스트만 포함" : "완료",
      },
      {
        key: "완료 / 예정 테스트",
        value: `${results.length} / ${metadata.total ?? results.length}`,
      },
      { key: "엔진", value: JSON.stringify(metadata.engine || {}) },
      {
        key: "점수",
        value: "배점 미설정. 점수 대신 테스트 통과 수를 기록합니다.",
      },
    ],
  );
  await wb.xlsx.writeFile(file);
}
module.exports = { writeReport };
