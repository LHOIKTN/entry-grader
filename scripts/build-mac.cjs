const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process");
const root = path.resolve(__dirname, "..");
if (process.platform !== "darwin")
  throw Error("이 빌드 명령은 macOS에서 실행하세요.");
if (!fs.existsSync(path.join(root, "runtime/manifest.json")))
  throw Error("npm run prepare:runtime을 먼저 실행하세요.");
const executable = require("electron");
const electronApp = path.resolve(executable, "../../..");
const dest = path.join(root, "dist", "엔트리 자동채점.app");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.rmSync(dest, { recursive: true, force: true });
cp.execFileSync("/usr/bin/ditto", [electronApp, dest]);
const resources = path.join(dest, "Contents/Resources");
fs.rmSync(path.join(resources, "default_app.asar"), { force: true });
const appRoot = path.join(resources, "app");
fs.mkdirSync(appRoot, { recursive: true });
for (const name of [
  "src",
  "runtime",
  "tests",
  "package.json",
  "README.md",
  "LICENSE",
])
  fs.cpSync(path.join(root, name), path.join(appRoot, name), {
    recursive: true,
  });
// Copy only production dependencies, retaining nested dependency paths.
const npm = process.env.npm_execpath;
const args = ["ls", "--omit=dev", "--parseable", "--all"];
const output = npm
  ? cp.execFileSync(process.execPath, [npm, ...args], {
      cwd: root,
      encoding: "utf8",
    })
  : cp.execFileSync("npm", args, { cwd: root, encoding: "utf8" });
const dirs = output
  .trim()
  .split("\n")
  .filter((p) => p.startsWith(root + path.sep + "node_modules" + path.sep));
for (const dir of dirs) {
  const relative = path.relative(root, dir);
  const target = path.join(appRoot, relative);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(dir, target, { recursive: true });
  }
}
const plist = path.join(dest, "Contents/Info.plist");
for (const [key, value] of Object.entries({
  CFBundleName: "엔트리 자동채점",
  CFBundleDisplayName: "엔트리 자동채점",
  CFBundleIdentifier: "local.entry.grader",
  CFBundleShortVersionString: "0.1.0",
  CFBundleVersion: "1",
})) {
  cp.execFileSync("/usr/libexec/PlistBuddy", [
    "-c",
    `Set :${key} ${value}`,
    plist,
  ]);
}
cp.execFileSync(
  "/usr/bin/codesign",
  ["--force", "--deep", "--sign", "-", dest],
  { stdio: "inherit" },
);
console.log("앱 생성 완료:", dest);
