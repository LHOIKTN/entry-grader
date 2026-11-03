/* Real EntryJS runs unchanged. Adapters observe dialogs and submit the stage input. */
window.runCase = async function (project, inputs, timeoutMs) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let error = null,
    used = 0,
    last = null,
    outputs = [],
    questions = [],
    idle = 0;
  const fail = (e) => {
    error = String(e?.message || e || "실행 오류");
  };
  window.addEventListener("error", (e) => fail(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => fail(e.reason));
  Entry.init(document.getElementById("stage"), {
    type: "minimize",
    libDir: "/runtime",
    entryDir: "/entry",
    expansionDisable: true,
    aiUtilizeDisable: true,
    useWebGL: false,
  });
  const Dialog = Entry.Dialog;
  Entry.Dialog = new Proxy(Dialog, {
    construct(Target, args) {
      const dialog = Reflect.construct(Target, args);
      const [, message, mode] = args;
      if (mode === "speak" || mode === "yell") {
        last = String(message);
        outputs.push(last);
      } else if (mode === "ask") questions.push(String(message));
      return dialog;
    },
  });
  const stopWithError = Entry.Utils.stopProjectWithToast;
  Entry.Utils.stopProjectWithToast = function (scope, message, e) {
    fail(e || message);
    return stopWithError.apply(this, arguments);
  };
  Entry.loadProject(project);
  const loadStart = Date.now();
  while (!Entry.Loader.loaded) {
    if (error) throw Error(error);
    if (Date.now() - loadStart > 15000)
      throw Error("프로젝트 자산 불러오기 시간 초과");
    await sleep(25);
  }
  Entry.engine.toggleRun();
  const start = Date.now();
  function result(status, detail = "") {
    return {
      status,
      detail,
      actual: last,
      inputsUsed: used,
      inputCount: inputs.length,
      outputs,
      questions,
      elapsedMs: Date.now() - start,
    };
  }
  while (true) {
    if (error) return result("ERROR", error);
    if (Date.now() - start > timeoutMs)
      return result("TIMEOUT", "실행 제한 시간을 초과했습니다.");
    const field = Entry.stage.inputField,
      model = Entry.container.inputValue;
    if (field && !field._isHidden && model.script && !model.complete) {
      if (used >= inputs.length)
        return result(
          "INPUT_EXHAUSTED",
          "프로그램이 입력 파일보다 더 많은 답을 요구합니다.",
        );
      const value = inputs[used++];
      if (value === "")
        return result(
          "ERROR",
          "빈 줄 입력은 현재 엔트리 입력창에서 지원하지 않습니다.",
        );
      field.value(value);
      Entry.dispatchEvent("canvasInputComplete");
      idle = 0;
    }
    let active = 0;
    Entry.container.mapObjectOnScene((obj) => {
      active += (obj.script?.executors || []).filter((e) => !e.isEnd()).length;
    });
    if (!active || !Entry.engine.isState("run")) idle++;
    else idle = 0;
    if (idle >= 3) {
      if (used < inputs.length)
        return result(
          "UNUSED_INPUT",
          "프로그램 종료 후 사용하지 않은 입력이 남았습니다.",
        );
      if (last === null)
        return result("NO_OUTPUT", "말하기 말풍선이 출력되지 않았습니다.");
      return result("COMPLETED");
    }
    await sleep(20);
  }
};
