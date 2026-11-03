const fs = require("node:fs/promises"),
  path = require("node:path"),
  tar = require("tar");
async function loadEnt(file) {
  const buffers = new Map();
  let total = 0,
    count = 0;
  await tar.t({
    file,
    strict: true,
    onReadEntry(entry) {
      if (
        ++count > 10000 ||
        entry.size > 64 * 1024 * 1024 ||
        (total += entry.size) > 128 * 1024 * 1024
      )
        throw Error("프로젝트 크기 제한 초과");
      if (entry.type !== "File") {
        entry.resume();
        return;
      }
      const chunks = [];
      entry.on("data", (chunk) => chunks.push(chunk));
      entry.on("end", () =>
        buffers.set(entry.path.replace(/^\.\//, ""), Buffer.concat(chunks)),
      );
    },
  });
  const key = [...buffers.keys()].find((k) => /(^|\/)project\.json$/.test(k));
  if (!key) throw Error("project.json이 없는 ENT 파일입니다.");
  const project = JSON.parse(buffers.get(key).toString("utf8"));
  if (!Array.isArray(project.objects))
    throw Error("올바른 엔트리 프로젝트가 아닙니다.");
  const mime = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
  };
  for (const obj of project.objects) {
    for (const media of [
      ...(obj.sprite?.pictures || []),
      ...(obj.sprite?.sounds || []),
    ]) {
      let data =
        buffers.get(media.fileurl) ||
        buffers.get(
          path.posix.join(path.posix.dirname(key), media.fileurl || ""),
        );
      // ENT files may refer to official built-in media instead of embedding it.
      const builtIn = (media.fileurl || "").match(
        /(?:^|\/)entry-js\/images\/(media\/[a-zA-Z0-9_.-]+)$/,
      );
      if (!data && builtIn)
        data = await fs.readFile(
          path.join(__dirname, "../runtime/entry/images", builtIn[1]),
        );
      if (!data)
        throw Error(
          "프로젝트에 포함되지 않은 이미지/소리가 있습니다: " +
            (media.name || media.filename),
        );
      media.fileurl = `data:${mime[path.extname(media.fileurl).toLowerCase()] || "application/octet-stream"};base64,${data.toString("base64")}`;
    }
  }
  // External hardware/AI projects need an explicit environment; never guess their result.
  if (
    [
      "hardwareLiteBlocks",
      "externalModules",
      "externalModulesLite",
      "aiUtilizeBlocks",
    ].some((k) => project[k]?.length)
  )
    throw Error(
      "하드웨어/외부 모듈 프로젝트는 이 채점기에서 지원하지 않습니다.",
    );
  return project;
}
function parseInput(text) {
  text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (text.endsWith("\n")) text = text.slice(0, -1);
  return text === "" ? [] : text.split("\n");
}
function normalizeOutput(text) {
  return String(text)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}
async function loadCases(dir) {
  const names = await fs.readdir(dir),
    ids = names
      .filter((n) => /^input\d+\.txt$/.test(n))
      .map((n) => n.match(/\d+/)[0])
      .sort((a, b) => Number(a) - Number(b));
  if (!ids.length)
    throw Error("테스트 폴더에 input1.txt / output1.txt 파일을 넣어주세요.");
  for (const name of names.filter((n) => /^output\d+\.txt$/.test(n)))
    if (!names.includes(name.replace("output", "input")))
      throw Error(name + "와 짝인 입력 파일이 없습니다.");
  return Promise.all(
    ids.map(async (id) => {
      if (!names.includes("output" + id + ".txt"))
        throw Error("output" + id + ".txt 파일이 없습니다.");
      const inputs = parseInput(
        await fs.readFile(path.join(dir, "input" + id + ".txt"), "utf8"),
      );
      if (inputs.some((v) => v === ""))
        throw Error(
          "input" +
            id +
            ".txt에 빈 줄이 있습니다. 한 줄에 답변 하나씩 적어주세요.",
        );
      return {
        id,
        inputs,
        expected: normalizeOutput(
          await fs.readFile(path.join(dir, "output" + id + ".txt"), "utf8"),
        ),
      };
    }),
  );
}
module.exports = { loadEnt, parseInput, normalizeOutput, loadCases };
