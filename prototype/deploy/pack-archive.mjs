#!/usr/bin/env node
// deploy/pack-archive.mjs
// 打包助手：用 Node 读取文件内容并生成 tar.gz。
//
// 为什么不用 tar 命令：部分企业装了透明加密客户端（如亿赛通 Esafenet），
// 只有被信任的进程（node、PowerShell 等）读取时才返回明文，tar/cp 这类工具
// 读到的是密文，打出来的包在服务器上就是乱码。Node 读到的是明文，
// 写出的 .tar.gz 也是明文，所以由 Node 自己完成打包。
//
// 用法：node deploy/pack-archive.mjs <输出.tar.gz> [--root 目录] [--include-data]
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const here = path.dirname(fileURLToPath(import.meta.url));
const BLOCK = 512;

function parseArgs(argv) {
  const args = { out: "", root: path.resolve(here, ".."), includeData: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--root") {
      args.root = path.resolve(argv[++i] ?? "");
    } else if (value === "--include-data") {
      args.includeData = true;
    } else if (value.startsWith("-")) {
      throw new Error(`未知参数: ${value}`);
    } else if (!args.out) {
      args.out = path.resolve(value);
    } else {
      throw new Error("只能指定一个输出路径");
    }
  }
  if (!args.out) throw new Error("缺少输出路径");
  return args;
}

function shouldSkip(rel, includeData) {
  const top = rel.split("/")[0];
  if (top === "node_modules" || top === ".git") return true;
  if (rel === "deploy/out" || rel.startsWith("deploy/out/")) return true;
  if (rel === "deploy/.tools" || rel.startsWith("deploy/.tools/")) return true;
  if (rel === "tests/.tmp" || rel.startsWith("tests/.tmp/")) return true;
  if (!includeData && (rel === "data" || rel.startsWith("data/"))) return true;
  return false;
}

function collect(root, includeData) {
  const files = [];
  const walk = (dirAbs, relBase) => {
    for (const entry of readdirSync(dirAbs, { withFileTypes: true })) {
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (shouldSkip(rel, includeData)) continue;
      const abs = path.join(dirAbs, entry.name);
      if (entry.isDirectory()) walk(abs, rel);
      else if (entry.isFile()) files.push({ rel, abs });
      else process.stderr.write(`[跳过] 非普通文件: ${rel}\n`);
    }
  };
  walk(root, "");
  return files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

function octal(buffer, offset, length, value) {
  const text = Math.floor(value).toString(8).padStart(length - 1, "0");
  buffer.write(text, offset, length - 1, "ascii");
  buffer.write("\0", offset + length - 1, 1, "ascii");
}

function splitName(name) {
  if (Buffer.byteLength(name) <= 100) return { name, prefix: "" };
  for (let i = name.length - 1; i > 0; i -= 1) {
    if (name[i] !== "/") continue;
    const prefix = name.slice(0, i);
    const rest = name.slice(i + 1);
    if (Buffer.byteLength(rest) <= 100 && Buffer.byteLength(prefix) <= 155) {
      return { name: rest, prefix };
    }
  }
  throw new Error(`路径过长，无法写入 tar: ${name}`);
}

function header({ name, size, mtime }) {
  const { name: shortName, prefix } = splitName(name);
  const block = Buffer.alloc(BLOCK, 0);
  block.write(shortName, 0, 100, "utf8");
  octal(block, 100, 8, 0o644);
  octal(block, 108, 8, 0);
  octal(block, 116, 8, 0);
  octal(block, 124, 12, size);
  octal(block, 136, 12, mtime);
  block.write("        ", 148, 8, "ascii");
  block.write("0", 156, 1, "ascii");
  block.write("ustar\0", 257, 6, "ascii");
  block.write("00", 263, 2, "ascii");
  block.write("root", 265, 32, "ascii");
  block.write("root", 297, 32, "ascii");
  octal(block, 329, 8, 0);
  octal(block, 337, 8, 0);
  if (prefix) block.write(prefix, 345, 155, "utf8");

  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  return block;
}

function buildTar(entries) {
  const parts = [];
  for (const { name, data, mtime } of entries) {
    parts.push(header({ name, size: data.length, mtime }));
    parts.push(data);
    const pad = (BLOCK - (data.length % BLOCK)) % BLOCK;
    if (pad) parts.push(Buffer.alloc(pad, 0));
  }
  parts.push(Buffer.alloc(BLOCK * 2, 0));
  return Buffer.concat(parts);
}

function main() {
  const { out, root, includeData } = parseArgs(process.argv.slice(2));
  const files = collect(root, includeData);
  if (!files.length) throw new Error(`没有可打包的文件: ${root}`);

  const entries = files.map(({ rel, abs }) => {
    const data = readFileSync(abs);
    return {
      name: rel,
      data,
      mtime: statSync(abs).mtimeMs / 1000,
      hash: createHash("sha256").update(data).digest("hex"),
    };
  });

  // 校验清单：安装时用 sha256sum -c 全量比对，及时发现密文或损坏
  const manifest =
    entries.map(({ hash, name }) => `${hash}  ${name}`).join("\n") + "\n";
  const tar = buildTar([
    { name: ".pack-manifest", data: Buffer.from(manifest, "utf8"), mtime: Date.now() / 1000 },
    ...entries,
  ]);
  const gz = gzipSync(tar, { level: 9 });
  writeFileSync(out, gz);

  const head = readFileSync(out).subarray(0, 2);
  if (head[0] !== 0x1f || head[1] !== 0x8b) {
    throw new Error("写入的包不是 gzip 明文，可能被透明加密客户端拦截了");
  }

  const mb = (gz.length / 1024 / 1024).toFixed(1);
  process.stdout.write(`已生成 ${out}（${files.length} 个文件，${mb} MB）\n`);
}

main();
