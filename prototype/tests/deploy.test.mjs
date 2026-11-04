import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function findBash() {
  if (process.platform !== "win32") return "bash";
  for (const candidate of [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const bashPath = findBash();
const noBash = bashPath ? false : "bash is not available on this machine";

function runBash(args, options = {}) {
  return spawnSync(bashPath, args, { cwd: root, encoding: "utf8", ...options });
}

function sourceAndRun(script) {
  return runBash(["-c", `source deploy/install.sh\n${script}`]);
}

test("pack.ps1 is a local-machine packaging script", () => {
  const file = path.join(root, "deploy", "pack.ps1");
  assert.ok(existsSync(file), "deploy/pack.ps1 should exist");
  const content = readFileSync(file, "utf8");
  assert.match(content, /本机/);
  assert.match(content, /install --frozen-lockfile/);
  assert.match(content, /PnpmVersion\s*=\s*'12'/);
  assert.match(content, /\$pnpm 'build'/);
  assert.match(content, /\$pnpm 'test'/);
  assert.match(content, /\$pnpm 'test:sites'/);
  assert.match(content, /pack-archive\.mjs/);
  assert.match(content, /tar/);
});

test("start.sh parses and documents its modes", { skip: noBash }, () => {
  const syntax = runBash(["-n", "deploy/start.sh"]);
  assert.equal(syntax.status, 0, syntax.stderr);
  const help = runBash(["deploy/start.sh", "--help"]);
  assert.equal(help.status, 0, help.stderr);
  const output = help.stdout + help.stderr;
  assert.match(output, /启动|升级/);
  assert.match(output, /APP_DIR/);
  assert.match(output, /INSTALLER/);
});

test("install.sh parses as bash", { skip: noBash }, () => {
  const result = runBash(["-n", "deploy/install.sh"]);
  assert.equal(result.status, 0, result.stderr);
});

test("install.sh identifies itself as the test-server script", () => {
  const file = path.join(root, "deploy", "install.sh");
  assert.ok(existsSync(file), "deploy/install.sh should exist");
  assert.match(readFileSync(file, "utf8"), /测试服务器/);
});

test("install.sh --help lists the supported options", { skip: noBash }, () => {
  const result = runBash(["deploy/install.sh", "--help"]);
  assert.equal(result.status, 0, result.stderr);
  const output = result.stdout + result.stderr;
  for (const token of ["--target", "--port", "--host", "--nginx", "--no-start", "--no-systemd", "--help"]) {
    assert.ok(output.includes(token), `help should mention ${token}`);
  }
});

test("install.sh refuses to run without a package argument", { skip: noBash }, () => {
  const result = runBash(["deploy/install.sh"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /用法|usage/i);
});

test("version_ge compares dotted numeric versions", { skip: noBash }, () => {
  const cases = [
    ["24.1.0", "22.13.0", true],
    ["22.13.0", "22.13.0", true],
    ["22.12.9", "22.13.0", false],
    ["18.19.0", "22.13.0", false],
    ["24.10.1", "24.9.9", true],
  ];
  for (const [have, need, expected] of cases) {
    const result = sourceAndRun(
      `version_ge "${have}" "${need}" && echo yes || echo no`,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), expected ? "yes" : "no", `${have} >= ${need}`);
  }
});

test("node_arch maps uname output to Node build names", { skip: noBash }, () => {
  const cases = [
    ["x86_64", "x64"],
    ["amd64", "x64"],
    ["aarch64", "arm64"],
    ["arm64", "arm64"],
    ["armv7l", "armv7l"],
  ];
  for (const [machine, expected] of cases) {
    const result = sourceAndRun(`node_arch "${machine}"`);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), expected, machine);
  }
});

test("check_payload accepts plaintext and rejects ciphertext payloads", { skip: noBash }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), "payload-"));
  const posix = dir.replace(/\\/g, "/");
  const index = `${posix}/dist/client/index.html`;
  try {
    mkdirSync(path.join(dir, "dist", "client"), { recursive: true });
    // 用 shell 写文件：在装了透明加密的机器上，node/PowerShell 写入的 .html 会被加密，
    // 只有非受控进程写入的字节才是明文（服务器上收到的就是这些字节）。
    const write = runBash([
      "-c",
      `mkdir -p '${posix}/dist/client' && printf '<!doctype html><div id="root"></div>' > '${index}'`,
    ]);
    assert.equal(write.status, 0, write.stderr);

    const good = sourceAndRun(`check_payload "${posix}"`);
    assert.equal(good.status, 0, good.stderr);

    runBash(["-c", `printf '\\340\\250\\221\\347\\330\\362' > '${index}'`]);
    const bad = sourceAndRun(`check_payload "${posix}"`);
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr + bad.stdout, /内容异常/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verify_http reports the last failure reason", { skip: noBash }, () => {
  const nodeBin = path.dirname(process.execPath).replace(/\\/g, "/");
  const nodePath = process.execPath.replace(/\\/g, "/");
  const result = sourceAndRun(
    `NODE="${nodePath}" NODE_BIN="${nodeBin}" PORT=45999 VERIFY_ATTEMPTS=1 SYSTEMD=0 TARGET=/tmp/report-verify verify_http`,
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /最后一次结果/);
});

test("check_payload verifies the bundled sha256 manifest", { skip: noBash }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), "payload-"));
  const posix = dir.replace(/\\/g, "/");
  try {
    const prepare = runBash([
      "-c",
      `mkdir -p '${posix}/dist/client/assets'` +
        ` && printf '<!doctype html><div id="root"></div>' > '${posix}/dist/client/index.html'` +
        ` && printf 'console.log(1);' > '${posix}/dist/client/assets/app.js'` +
        ` && cd '${posix}' && sha256sum dist/client/index.html dist/client/assets/app.js > .pack-manifest`,
    ]);
    assert.equal(prepare.status, 0, prepare.stderr);

    const good = sourceAndRun(`check_payload "${posix}"`);
    assert.equal(good.status, 0, good.stderr);

    runBash(["-c", `printf 'tampered' >> '${posix}/dist/client/assets/app.js'`]);
    const bad = sourceAndRun(`check_payload "${posix}"`);
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr + bad.stdout, /校验失败/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
