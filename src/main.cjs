const { app, BrowserWindow, ipcMain, dialog, session } = require("electron");
const fs = require("node:fs/promises"),
  path = require("node:path"),
  http = require("node:http");
const { loadEnt, loadCases, normalizeOutput } = require("./ent.cjs");
const root = path.resolve(__dirname, "..");
let main,
  server,
  origin,
  running = false,
  cancel = false,
  worker,
  results = [],
  lastRun = {};
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
async function startServer() {
  server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const target = path.resolve(root, "." + pathname);
      if (
        req.method !== "GET" ||
        !target.startsWith(root + path.sep) ||
        !/^\/(runtime|src)\//.test(pathname)
      )
        throw Error();
      const body = await fs.readFile(target);
      const type =
        {
          ".js": "text/javascript",
          ".css": "text/css",
          ".html": "text/html",
          ".png": "image/png",
          ".svg": "image/svg+xml",
          ".mp3": "audio/mpeg",
          ".woff": "font/woff",
          ".woff2": "font/woff2",
          ".json": "application/json",
        }[path.extname(target)] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
}
async function executeCase(project, test, timeoutMs) {
  const w = new BrowserWindow({
    show: false,
    width: 720,
    height: 560,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      partition: "grader-runtime",
    },
  });
  worker = w;
  w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  w.webContents.on("will-navigate", (e) => e.preventDefault());
  let timer;
  const work = (async () => {
    await w.loadURL(origin + "/src/runner.html");
    const value = await w.webContents.executeJavaScript(
      `window.runCase(${JSON.stringify(project)},${JSON.stringify(test.inputs)},${timeoutMs})`,
    );
    if (value.status === "COMPLETED")
      value.status =
        normalizeOutput(value.actual) === test.expected ? "PASS" : "FAIL";
    return { ...value, expected: test.expected };
  })();
  try {
    return await Promise.race([
      work,
      new Promise((resolve) => {
        timer = setTimeout(
          () =>
            resolve({
              status: "TIMEOUT",
              detail: "실행 환경이 제한 시간 내 응답하지 않았습니다.",
              expected: test.expected,
              actual: null,
            }),
          timeoutMs + 20000,
        );
      }),
    ]);
  } catch (e) {
    return {
      status: cancel ? "CANCELLED" : "ERROR",
      detail: e.message,
      expected: test.expected,
      actual: null,
    };
  } finally {
    clearTimeout(timer);
    if (!w.isDestroyed()) w.destroy();
    if (worker === w) worker = null;
  }
}
async function collectJobs(submissions, tests) {
  const items = await fs.readdir(submissions, { withFileTypes: true });
  let groups = [];
  if (items.some((f) => f.isFile() && f.name.toLowerCase().endsWith(".ent")))
    groups.push({
      name: path.basename(submissions),
      dir: submissions,
      testdir: tests,
    });
  else
    for (const p of ["문제1", "문제2", "문제3"]) {
      const item = items.find(
        (f) => f.isDirectory() && f.name.normalize("NFC") === p,
      );
      if (item)
        groups.push({
          name: p,
          dir: path.join(submissions, item.name),
          testdir: path.join(tests, p),
        });
    }
  if (!groups.length)
    throw Error(
      "ENT 파일이 있는 문제 폴더 또는 문제1~3을 포함한 상위 폴더를 선택해 주세요.",
    );
  const jobs = [];
  for (const group of groups) {
    const cases = await loadCases(group.testdir),
      files = (await fs.readdir(group.dir))
        .filter((f) => f.toLowerCase().endsWith(".ent"))
        .sort((a, b) => a.localeCompare(b, "ko"));
    for (const file of files)
      jobs.push({
        ...group,
        file,
        fullpath: path.join(group.dir, file),
        cases,
      });
  }
  return jobs;
}
function emit(channel, data) {
  if (main && !main.isDestroyed()) main.webContents.send(channel, data);
}
async function grade(options) {
  if (running) throw Error("이미 채점 중입니다.");
  const timeoutMs = Number(options.timeout) * 1000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000)
    throw Error("제한 시간은 1~300초로 설정해 주세요.");
  running = true;
  cancel = false;
  try {
    const jobs = await collectJobs(options.submissions, options.tests);
    results = [];
    const total = jobs.reduce((n, j) => n + j.cases.length, 0);
    let completed = 0;
    lastRun = {
      total,
      cancelled: false,
      engine: JSON.parse(
        await fs.readFile(path.join(root, "runtime/manifest.json"), "utf8"),
      ),
    };
    emit("begin", { total, files: jobs.length });
    for (const job of jobs) {
      if (cancel) break;
      let project, loadError;
      try {
        project = await loadEnt(job.fullpath);
      } catch (e) {
        loadError = e.message;
      }
      for (const test of job.cases) {
        if (cancel) break;
        emit("progress", {
          completed,
          total,
          current: job.file,
          test: test.id,
        });
        const result = loadError
          ? {
              status: "ERROR",
              detail: loadError,
              actual: null,
              expected: test.expected,
            }
          : await executeCase(project, test, timeoutMs);
        if (cancel) break;
        const match = job.file
          .normalize("NFC")
          .match(/^(\d{5})_(.+)_문제[123]\.ent$/);
        const row = {
          problem:
            job.file.normalize("NFC").match(/_(문제[123])\.ent$/)?.[1] ||
            job.name,
          file: job.file,
          studentId: match?.[1] || "",
          name: match?.[2] || "",
          test: test.id,
          ...result,
        };
        results.push(row);
        completed++;
        emit("result", { row, completed, total });
      }
    }
    lastRun.cancelled = cancel;
    return { cancelled: cancel, count: results.length, total };
  } finally {
    running = false;
  }
}
function csvCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
async function exportResults() {
  if (!results.length) throw Error("저장할 결과가 없습니다.");
  const { filePath, canceled } = await dialog.showSaveDialog(main, {
    title: "채점 결과 저장",
    defaultPath: "엔트리_채점결과.xlsx",
    filters: [
      { name: "Excel", extensions: ["xlsx"] },
      { name: "CSV", extensions: ["csv"] },
    ],
  });
  if (canceled) return null;
  if (path.extname(filePath).toLowerCase() !== ".csv") {
    await require("./report.cjs").writeReport(filePath, results, lastRun);
    return filePath;
  }
  const fields = [
    "problem",
    "studentId",
    "name",
    "file",
    "test",
    "status",
    "expected",
    "actual",
    "detail",
    "inputsUsed",
    "inputCount",
    "elapsedMs",
  ];
  const headers = [
    "문제",
    "학번",
    "이름",
    "파일",
    "테스트",
    "판정",
    "기대 출력",
    "실제 마지막 말풍선",
    "설명",
    "사용 입력 수",
    "전체 입력 수",
    "실행 시간(ms)",
  ];
  const lines = [
    headers.map(csvCell).join(","),
    ...results.map((r) =>
      fields
        .map((k) => csvCell(k === "status" ? labels[r[k]] : r[k]))
        .join(","),
    ),
  ];
  await fs.writeFile(filePath, "\uFEFF" + lines.join("\r\n"), "utf8");
  return filePath;
}
app
  .whenReady()
  .then(async () => {
    await startServer();
    const engineSession = session.fromPartition("grader-runtime");
    engineSession.setPermissionRequestHandler((wc, permission, cb) =>
      cb(false),
    );
    engineSession.webRequest.onBeforeRequest((details, cb) =>
      cb({
        cancel: !(
          details.url.startsWith(origin + "/") ||
          details.url.startsWith("data:") ||
          details.url.startsWith("blob:")
        ),
      }),
    );
    if (process.argv.includes("--self-test")) {
      try {
        await require("../tests/engine.cjs").run({
          executeCase,
          loadEnt,
          root,
        });
        app.exit(0);
      } catch (e) {
        console.error(e);
        app.exit(1);
      }
      return;
    }
    main = new BrowserWindow({
      width: 1140,
      height: 820,
      minWidth: 860,
      minHeight: 650,
      title: "엔트리 자동채점",
      backgroundColor: "#f4f6fa",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    main.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    main.webContents.on("will-navigate", (e) => e.preventDefault());
    ipcMain.handle("choose-folder", async () => {
      const r = await dialog.showOpenDialog(main, {
        properties: ["openDirectory"],
      });
      return r.canceled ? null : r.filePaths[0];
    });
    ipcMain.handle("grade", (_, options) => grade(options));
    ipcMain.handle("cancel", () => {
      cancel = true;
      if (worker && !worker.isDestroyed()) worker.destroy();
    });
    ipcMain.handle("export", exportResults);
    ipcMain.handle("runtime-info", async () =>
      JSON.parse(
        await fs.readFile(path.join(root, "runtime/manifest.json"), "utf8"),
      ),
    );
    await main.loadFile(path.join(__dirname, "index.html"));
    main.on("closed", () => {
      cancel = true;
      if (worker && !worker.isDestroyed()) worker.destroy();
      app.quit();
    });
  })
  .catch((e) => {
    console.error(e);
    dialog.showErrorBox("실행 오류", e.message);
    app.quit();
  });
app.on("window-all-closed", () => {
  if (!process.argv.includes("--self-test")) app.quit();
});
app.on("before-quit", () => {
  cancel = true;
  if (server) server.close();
});
