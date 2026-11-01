#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  report_runtime_root="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
  export PATH="$report_runtime_root/node/bin:$report_runtime_root/bin/fallback:$PATH"
fi
if ! command -v node >/dev/null 2>&1 || ! command -v pnpm >/dev/null 2>&1; then
  echo "需要 Node.js 24+ 和 pnpm，请先安装后再运行。" >&2
  exit 1
fi
exec pnpm run dev --host 127.0.0.1 --port 4173 --strictPort
