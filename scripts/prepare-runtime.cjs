// Copies the actual EntryJS distribution; no student data or source changes.
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
if (!process.argv[2]) {
  const archive = path.join(root, "vendor/entry-runtime.tar.gz");
  const expected = fs.readFileSync(archive + ".sha256", "utf8").trim();
  const actual = crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
  if (actual !== expected) throw Error("실행 엔진 묶음의 체크섬이 다릅니다.");
  require("tar").x({ file: archive, cwd: root, sync: true, strict: true });
  console.log("저장소에 포함된 검증된 실행 엔진을 준비했습니다.");
  return;
}
const entry = path.resolve(process.argv[2] || "../entry/entryjs");
const offline = path.resolve(process.argv[3] || "../entry/entry-offline");
const out = path.join(root, "runtime");
fs.mkdirSync(out, { recursive: true });
function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}
for (const p of [
  "dist/entry.js",
  "dist/entry.css",
  "extern/lang/ko.js",
  "extern/util/static.js",
  "extern/util/CanvasInput.js",
  "extern/util/ndgmr.Collision.js",
  "extern/util/handle.js",
  "extern/util/bignumber.min.js",
  "extern/util/filbert.js",
  "images",
])
  copy(path.join(entry, p), path.join(out, "entry", p));
copy(
  path.join(offline, "src/renderer/resources/vendor"),
  path.join(out, "vendor"),
);
copy(
  path.join(offline, "node_modules/@entrylabs/legacy-video/dist/index.js"),
  path.join(out, "vendor/legacy-video.js"),
);
copy(
  path.join(offline, "node_modules/entry-tool/dist/entry-tool.js"),
  path.join(out, "vendor/entry-tool.js"),
);
copy(
  path.join(entry, "node_modules/lodash/lodash.min.js"),
  path.join(out, "vendor/lodash.min.js"),
);
for (const p of ["LICENSE", "NOTICE"])
  if (fs.existsSync(path.join(entry, p)))
    copy(path.join(entry, p), path.join(out, "licenses/EntryJS-" + p));
for (const name of [
  "entry-tool",
  "@entrylabs/legacy-video",
  "lodash",
  "jquery",
  "react",
  "react-dom",
]) {
  const dir = path.join(offline, "node_modules", name);
  if (fs.existsSync(dir))
    for (const file of fs
      .readdirSync(dir)
      .filter((f) => /^(LICENSE|COPYING|NOTICE)/i.test(f)))
      copy(
        path.join(dir, file),
        path.join(out, "licenses", name.replaceAll("/", "-") + "-" + file),
      );
}
let commit = "unknown";
try {
  commit = cp
    .execFileSync("git", ["-C", entry, "rev-parse", "HEAD"], {
      encoding: "utf8",
    })
    .trim();
} catch {}
const manifest = {
  version: JSON.parse(fs.readFileSync(path.join(entry, "package.json")))
    .version,
  commit,
  sha256: crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(out, "entry/dist/entry.js")))
    .digest("hex"),
};
fs.writeFileSync(
  path.join(out, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
console.log("Prepared actual EntryJS runtime", manifest);
