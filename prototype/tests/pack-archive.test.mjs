import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const cli = path.join(root, "deploy", "pack-archive.mjs");

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

function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "pack-archive-"));
  mkdirSync(path.join(dir, "dist", "client", "assets"), { recursive: true });
  mkdirSync(path.join(dir, "node_modules", "junk"), { recursive: true });
  mkdirSync(path.join(dir, "data"), { recursive: true });
  mkdirSync(path.join(dir, "deploy", ".tools"), { recursive: true });
  writeFileSync(path.join(dir, "deploy", ".tools", "pnpm.cmd"), "@echo off");
  writeFileSync(path.join(dir, "dist", "client", "index.html"), '<!doctype html><div id="root"></div>');
  writeFileSync(path.join(dir, "dist", "client", "assets", "app.js"), "console.log('ok');");
  writeFileSync(path.join(dir, "package.json"), '{"name":"fixture"}');
  writeFileSync(path.join(dir, "node_modules", "junk", "index.js"), "module.exports = 1;");
  writeFileSync(path.join(dir, "data", "reports.sqlite"), "sqlite-bytes");
  const longDir = path.join(dir, "src", "a".repeat(60), "b".repeat(60));
  mkdirSync(longDir, { recursive: true });
  writeFileSync(path.join(longDir, "long-name-file.txt"), "long path content");
  return dir;
}

function runCli(dir, out, extra = []) {
  return spawnSync(process.execPath, [cli, out, "--root", dir, ...extra], { encoding: "utf8" });
}

function tarList(out) {
  const result = spawnSync(
    bashPath,
    ["-c", `cd '${path.dirname(out)}' && tar -tzf '${path.basename(out)}'`],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split("\n").filter(Boolean).map((line) => line.replace(/^\.\//, ""));
}

function tarRead(out, entry) {
  const result = spawnSync(
    bashPath,
    ["-c", `cd '${path.dirname(out)}' && tar -xzOf '${path.basename(out)}' '${entry}'`],
    { encoding: "buffer" },
  );
  assert.equal(result.status, 0, String(result.stderr));
  return result.stdout;
}

test("writes a gzip container with plaintext members", { skip: noBash }, () => {
  const dir = fixture();
  const out = path.join(dir, "out", "pkg.tar.gz");
  try {
    mkdirSync(path.dirname(out), { recursive: true });
    const result = runCli(dir, out);
    assert.equal(result.status, 0, result.stderr);

    const head = readFileSync(out).subarray(0, 2);
    assert.deepEqual([...head], [0x1f, 0x8b], "archive should be gzip");

    const entries = tarList(out);
    assert.ok(entries.includes("dist/client/index.html"));
    assert.ok(entries.includes("package.json"));
    assert.equal(tarRead(out, "dist/client/index.html").toString(), '<!doctype html><div id="root"></div>');
    assert.equal(tarRead(out, "dist/client/assets/app.js").toString(), "console.log('ok');");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("excludes node_modules, data and its own output by default", { skip: noBash }, () => {
  const dir = fixture();
  const out = path.join(dir, "deploy", "out", "pkg.tar.gz");
  try {
    mkdirSync(path.dirname(out), { recursive: true });
    assert.equal(runCli(dir, out).status, 0);

    const entries = tarList(out);
    assert.ok(!entries.some((entry) => entry.startsWith("node_modules/")));
    assert.ok(!entries.some((entry) => entry.startsWith("data/")));
    assert.ok(!entries.some((entry) => entry.startsWith("deploy/out/")));
    assert.ok(!entries.some((entry) => entry.startsWith("deploy/.tools/")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--include-data keeps sqlite data files", { skip: noBash }, () => {
  const dir = fixture();
  const out = path.join(dir, "out", "pkg.tar.gz");
  try {
    mkdirSync(path.dirname(out), { recursive: true });
    assert.equal(runCli(dir, out, ["--include-data"]).status, 0);
    assert.ok(tarList(out).includes("data/reports.sqlite"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stores long paths losslessly", { skip: noBash }, () => {
  const dir = fixture();
  const out = path.join(dir, "out", "pkg.tar.gz");
  try {
    mkdirSync(path.dirname(out), { recursive: true });
    assert.equal(runCli(dir, out).status, 0);
    const longEntry = tarList(out).find((entry) => entry.endsWith("long-name-file.txt"));
    assert.ok(longEntry, "long path should be archived");
    assert.ok(longEntry.length > 100, "fixture path should exceed 100 chars");
    assert.equal(tarRead(out, longEntry).toString(), "long path content");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writes a sha256 manifest covering every packed file", { skip: noBash }, () => {
  const dir = fixture();
  const out = path.join(dir, "out", "pkg.tar.gz");
  try {
    mkdirSync(path.dirname(out), { recursive: true });
    assert.equal(runCli(dir, out).status, 0);

    assert.ok(tarList(out).includes(".pack-manifest"), "manifest should be packed");
    const manifest = tarRead(out, ".pack-manifest").toString().trim().split("\n");
    const hashes = new Map();
    for (const line of manifest) {
      const match = line.match(/^([0-9a-f]{64}) {2}(.+)$/);
      assert.ok(match, `bad manifest line: ${line}`);
      hashes.set(match[2], match[1]);
    }

    for (const rel of ["dist/client/index.html", "package.json", "dist/client/assets/app.js"]) {
      assert.ok(hashes.has(rel), `manifest should list ${rel}`);
      const expected = createHash("sha256").update(tarRead(out, rel)).digest("hex");
      assert.equal(hashes.get(rel), expected, rel);
    }
    assert.ok(!hashes.has(".pack-manifest"), "manifest must not list itself");
    assert.ok(!hashes.has("data/reports.sqlite"), "excluded files must not be listed");
    assert.ok(![...hashes.keys()].some((entry) => entry.startsWith("node_modules/")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
