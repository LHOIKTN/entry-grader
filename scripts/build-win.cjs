// Portable Windows application: keep the entire output directory together.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
if (process.platform !== 'win32') throw Error('Windows에서 npm run build:win을 실행하세요.');
if (!fs.existsSync(path.join(root, 'runtime/manifest.json'))) throw Error('npm run prepare:runtime을 먼저 실행하세요.');
const source = path.dirname(require('electron'));
const dest = path.join(root, 'dist', 'entry-grader-win-' + process.arch);
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(source, dest, { recursive: true });
fs.renameSync(path.join(dest, 'electron.exe'), path.join(dest, 'EntryGrader.exe'));
fs.rmSync(path.join(dest, 'resources/default_app.asar'), { force: true });
const appRoot = path.join(dest, 'resources/app');
fs.mkdirSync(appRoot, { recursive: true });
for (const name of ['src', 'runtime', 'tests', 'package.json', 'README.md', 'LICENSE']) fs.cpSync(path.join(root, name), path.join(appRoot, name), { recursive: true });
// npm supplies its JS entry point when running an npm script; avoid Windows .cmd spawning.
if (!process.env.npm_execpath) throw Error('npm run build:win 명령으로 실행하세요.');
const output = cp.execFileSync(process.execPath, [process.env.npm_execpath, 'ls', '--omit=dev', '--parseable', '--all'], { cwd: root, encoding: 'utf8' });
for (const dir of output.trim().split(/\r?\n/).filter(p => p.startsWith(root + path.sep + 'node_modules' + path.sep))) {
  const target = path.join(appRoot, path.relative(root, dir));
  if (!fs.existsSync(target)) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.cpSync(dir, target, { recursive: true }); }
}
console.log('Windows 앱 생성 완료:', path.join(dest, 'EntryGrader.exe'));
console.log('다른 PC로 옮길 때는 이 폴더 전체를 복사하세요.');
