const assert = require("node:assert/strict");
const { b, text, answer, say, ask, project } = require("./fixture.cjs");
async function run({ executeCase, loadEnt }) {
  const cases = [
    ["입력 후 중간 답안도 통과", project([ask(),say("정답은 120"),say("끝")]), ["5"], "120", "PASS", 5000],
    ["입력 전 답안 제외", project([say("120"),ask(),say("끝")]), ["5"], "120", "FAIL", 5000],
    ["마지막 입력 전 답안 제외", project([ask(),say("120"),ask(),say("끝")]), ["1","2"], "120", "FAIL", 5000],
    ["말풍선끼리 이어 붙여 일치시키지 않음", project([say("12"),say("0")]), [], "120", "FAIL", 5000],
    ["입력 후 출력 없음", project([say("안내"),ask()]), ["5"], "안내", "NO_OUTPUT", 5000],
    ["추가 문구를 포함한 정답", project([say("정답은 120입니다")]), [], "120", "PASS", 5000],
    [
      "묻고 기다리기 / 질문 제외 / 마지막 말풍선",
      project([say("안내"), ask(), say("중간"), ask(), say(answer())]),
      ["10", "20"],
      "20",
      "PASS",
      5000,
    ],
    [
      "테스트 실행마다 초기화",
      project([ask(), say(answer())]),
      ["0"],
      "0",
      "PASS",
      5000,
    ],
    [
      "출력 불일치",
      project([ask(), say(answer())]),
      ["10"],
      "11",
      "FAIL",
      5000,
    ],
    [
      "입력 부족",
      project([ask(), ask(), say(answer())]),
      ["10"],
      "",
      "INPUT_EXHAUSTED",
      5000,
    ],
    ["입력 남음", project([say("완료")]), ["10"], "완료", "UNUSED_INPUT", 5000],
    ["말풍선 없음", project([]), [], "", "NO_OUTPUT", 5000],
    [
      "무한 반복",
      project([b("repeat_inf", [null], [[say("계속")]])]),
      [],
      "계속",
      "TIMEOUT",
      500,
    ],
    [
      "엔트리 실행 오류",
      project([b("ask_and_wait", [text(""), null])]),
      [],
      "",
      "ERROR",
      5000,
    ],
    [
      "시간 지정 말하기",
      project([b("dialog_time", [text("마지막"), text("0.1"), "speak", null])]),
      [],
      "마지막",
      "PASS",
      5000,
    ],
  ];
  for (const [name, p, inputs, expected, status, timeout] of cases) {
    const r = await executeCase(p, { inputs, expected }, timeout);
    console.log(name, JSON.stringify(r));
    assert.equal(r.status, status, name);
  }
  if (process.env.ENTRY_SMOKE_FILE) {
    const p = await loadEnt(process.env.ENTRY_SMOKE_FILE);
    const r = await executeCase(
      p,
      { inputs: ["3", "80", "90", "100"], expected: "열심히 해야겠다" },
      15000,
    );
    console.log("실제 제출 파일", JSON.stringify(r));
    assert.equal(r.status, "PASS");
    assert.equal(r.inputsUsed, 4);
  }
  if (process.env.ENTRY_FUNCTION_SMOKE_FILE) {
    const p = await loadEnt(process.env.ENTRY_FUNCTION_SMOKE_FILE);
    const r = await executeCase(
      p,
      { inputs: ["5"], expected: "정답은 120" },
      15000,
    );
    console.log("실제 재귀 함수", JSON.stringify(r));
    assert.equal(r.status, "PASS");
  }
  console.log("ENGINE TESTS PASSED");
}
module.exports = { run };
