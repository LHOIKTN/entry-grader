const $ = (id) => document.getElementById(id),
  options = {};
let counts = { pass: 0, other: 0 };
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
for (const key of ["submissions", "tests"])
  $(key).onclick = async () => {
    const p = await grader.chooseFolder();
    if (p) {
      options[key] = p;
      $(key + "Path").textContent = p;
    }
  };
function busy(value) {
  for (const id of ["start", "submissions", "tests", "timeout"])
    $(id).disabled = value;
  $("cancel").disabled = !value;
  $("export").disabled = value || !(counts.pass + counts.other);
}
$("start").onclick = async () => {
  if (!options.submissions || !options.tests) {
    $("status").textContent = "제출 폴더와 테스트 폴더를 모두 선택해 주세요.";
    return;
  }
  busy(true);
  $("status").textContent = "파일 확인 중…";
  try {
    const r = await grader.grade({ ...options, timeout: $("timeout").value });
    $("status").textContent = r.cancelled
      ? "채점 중단 · 완료된 결과는 저장할 수 있습니다."
      : "채점 완료";
  } catch (e) {
    $("status").textContent = "채점 시작 실패";
    $("current").textContent = e.message;
  } finally {
    busy(false);
  }
};
$("cancel").onclick = async () => {
  await grader.cancel();
  $("status").textContent = "중단 중…";
};
$("export").onclick = async () => {
  try {
    const p = await grader.export();
    if (p) $("current").textContent = "저장 완료: " + p;
  } catch (e) {
    $("current").textContent = e.message;
  }
};
grader.on("begin", ({ total, files }) => {
  counts = { pass: 0, other: 0 };
  $("rows").replaceChildren();
  $("summary").textContent = "";
  $("progress").max = total;
  $("progress").value = 0;
  $("status").textContent = files + "개 파일 채점 중";
  $("counter").textContent = "0 / " + total;
});
grader.on("progress", (p) => {
  $("current").textContent = p.current + " · 테스트 " + p.test;
});
grader.on("result", ({ row, completed, total }) => {
  counts[row.status === "PASS" ? "pass" : "other"]++;
  $("progress").value = completed;
  $("counter").textContent = completed + " / " + total;
  $("summary").textContent = `통과 ${counts.pass} · 그 외 ${counts.other}`;
  const tr = document.createElement("tr");
  for (const value of [
    row.studentId + " " + row.name + " · " + row.problem,
    row.test,
    labels[row.status],
    row.expected,
    row.actual ?? "—",
  ]) {
    const td = document.createElement("td");
    td.textContent = value;
    tr.append(td);
  }
  const badge = document.createElement("span");
  badge.className = "badge " + row.status;
  badge.textContent = labels[row.status];
  tr.children[2].replaceChildren(badge);
  if (row.detail) {
    const note = document.createElement("small");
    note.textContent = row.detail;
    tr.children[2].append(note);
  }
  tr.children[0].title = row.file;
  $("rows").append(tr);
});
grader
  .runtimeInfo()
  .then((r) => {
    $("engine").textContent =
      `실제 EntryJS ${r.version} · ${r.commit.slice(0, 8)} · 오프라인 실행`;
  })
  .catch(() => {
    $("engine").textContent =
      "실행 엔진이 없습니다. README의 준비 절차를 확인해 주세요.";
  });
