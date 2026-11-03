// End-to-end desktop verification. Dialogs return temporary fixture paths only.
const fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  tar = require("tar");
const { project, ask, answer, say } = require("./fixture.cjs");
(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "entry-grader-ui-"));
  const submissions = path.join(dir, "제출"),
    cases = path.join(dir, "테스트"),
    archive = path.join(dir, "archive");
  await Promise.all([submissions, cases, archive].map((p) => fs.mkdir(p)));
  for (const [id, blocks] of [
    ["29901", [ask(), say(answer())]],
    ["29902", [ask(), say("틀린 답")]],
  ]) {
    const p = project(blocks),
      picture = p.objects[0].sprite.pictures[0];
    await fs.writeFile(
      path.join(archive, "dot.png"),
      Buffer.from(picture.fileurl.split(",")[1], "base64"),
    );
    picture.fileurl =
      id === "29902"
        ? "./bower_components/entry-js/images/media/entrybot1.svg"
        : "dot.png";
    await fs.writeFile(path.join(archive, "project.json"), JSON.stringify(p));
    await tar.c(
      {
        cwd: archive,
        gzip: true,
        file: path.join(submissions, id + "_검증학생_문제1.ent"),
      },
      ["project.json", "dot.png"],
    );
  }
  for (const [id, value] of [
    ["1", "42"],
    ["2", "7"],
  ]) {
    await fs.writeFile(path.join(cases, "input" + id + ".txt"), value + "\n");
    await fs.writeFile(path.join(cases, "output" + id + ".txt"), value + "\n");
  }
  const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
  const executablePath = process.env.GRADER_APP || require("electron");
  const args = process.env.GRADER_APP ? [] : [path.resolve(__dirname, "..")];
  const application = await _electron.launch({
    executablePath,
    args,
    timeout: 30000,
  });
  try {
    await application.evaluate(
      ({ dialog }, paths) => {
        let i = 0;
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [paths[i++]],
        });
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: paths[2],
        });
      },
      [submissions, cases, path.join(dir, "결과.xlsx")],
    );
    const page = await application.firstWindow();
    await page.waitForSelector("#start");
    await page.click("#submissions");
    await page.click("#tests");
    await page.click("#start");
    await page.waitForFunction(
      () => document.getElementById("status").textContent === "채점 완료",
      null,
      { timeout: 120000 },
    );
    assert.equal(await page.locator("#rows tr").count(), 4);
    assert.equal(await page.locator(".badge.PASS").count(), 2);
    assert.equal(await page.locator(".badge.FAIL").count(), 2);
    await page.click("#export");
    await page.waitForFunction(
      () =>
        document.getElementById("current").textContent.startsWith("저장 완료:"),
      null,
      { timeout: 10000 },
    );
    const wb = new (require("exceljs").Workbook)();
    await wb.xlsx.readFile(path.join(dir, "결과.xlsx"));
    assert.equal(wb.getWorksheet("테스트별 상세").rowCount, 5);
    assert.equal(wb.getWorksheet("학생별 결과").rowCount, 3);
    await page.screenshot({ path: path.join(dir, "앱화면.png") });
    console.log("UI + XLSX VERIFIED", dir);
  } finally {
    await application.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
