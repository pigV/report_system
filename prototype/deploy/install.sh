#!/usr/bin/env bash
# deploy/install.sh
# 在【测试服务器】（Linux）执行：安装 Node 运行时与 pnpm、解压部署、启动服务并自检。
# 本机（Windows 开发机）不要运行本脚本；本机请用 deploy/pack.ps1 打包。
# 服务器不需要预装 Node 或 pnpm：脚本会把 Node 24 装进 <应用目录>/runtime，不改动系统环境。
set -euo pipefail

APP_NAME="report-prototype"
DEFAULT_PORT=4173
PNPM_MAJOR="12"
MIN_NODE_VERSION="22.5.0"
NODE_DIST_MAJOR="24"
SERVICE_USER="report"

PACKAGE=""
TARGET=""
PORT="$DEFAULT_PORT"
HOST="127.0.0.1"
WITH_NGINX=0
NO_START=0
NO_SYSTEMD=0
STOP=0
SYSTEMD=0

NODE=""
NODE_BIN=""
PNPM=""

log()  { printf '\033[36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33m[警告] %s\033[0m\n' "$*" >&2; }
fail() { printf '\033[31m[错误] %s\033[0m\n' "$*" >&2; exit 1; }

usage() {
    cat <<'EOF'
用法: sudo bash install.sh <prototype-*.tar.gz> [选项]

在【测试服务器】上执行本脚本；本机打包请用 deploy/pack.ps1。

选项:
  --target DIR     安装目录（默认 root 为 /opt/report-prototype，普通用户为 ~/report-prototype）
  --port N         服务端口（默认 4173）
  --host IP        监听地址（默认 127.0.0.1；不用 nginx 时用 0.0.0.0）
  --nginx          写入 nginx 反向代理配置（默认不写；文件已存在则跳过）
  --no-start       只安装，不启动服务
  --no-systemd     不安装 systemd 服务，改为后台进程启动（普通用户默认如此）
  --stop           停止已安装的服务，不重新部署
  --help, -h       显示本帮助
EOF
}

version_ge() {
    local have need
    have=${1#v}
    need=${2#v}
    [ "$(printf '%s\n%s\n' "$have" "$need" | sort -V | head -n1)" = "$need" ]
}

node_arch() {
    case "$1" in
        x86_64|amd64|x64) printf 'x64\n' ;;
        aarch64|arm64)    printf 'arm64\n' ;;
        armv7l|armhf)     printf 'armv7l\n' ;;
        *) return 1 ;;
    esac
}

fetch_to() {
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$1" -o "$2"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO "$2" "$1"
    else
        fail "需要 curl 或 wget 才能下载 Node 运行时"
    fi
}

fetch_text() {
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$1"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "$1"
    else
        fail "需要 curl 或 wget 才能下载 Node 运行时"
    fi
}

node_supports_sqlite() {
    "$1" --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; const db = new DatabaseSync(':memory:'); db.close();" >/dev/null 2>&1
}

setup_node() {
    if command -v node >/dev/null 2>&1; then
        local system_node system_version usable=1
        system_node=$(command -v node)
        system_version=$("$system_node" --version 2>/dev/null || echo 0)
        if ! version_ge "$system_version" "$MIN_NODE_VERSION" || ! node_supports_sqlite "$system_node"; then
            usable=0
            warn "系统 Node $system_version 不满足要求（需 >= $MIN_NODE_VERSION 且支持 node:sqlite），改用应用自带运行时"
        elif [ "$SYSTEMD" = 1 ] && printf '%s' "$system_node" | grep -qE '^/(root|home|Users)/'; then
            usable=0
            warn "系统 Node 位于用户目录（$system_node），systemd 服务用户无法使用，改用应用自带运行时"
        fi
        if [ "$usable" = 1 ]; then
            NODE="$system_node"
            NODE_BIN=$(dirname "$system_node")
            log "使用系统 Node $system_version（$NODE_BIN）"
            return 0
        fi
    fi
    install_bundled_node
}

install_bundled_node() {
    local runtime="$TARGET/runtime"
    mkdir -p "$runtime"
    if [ -x "$runtime/node/bin/node" ]; then
        NODE="$runtime/node/bin/node"
        NODE_BIN="$runtime/node/bin"
        log "复用已下载的 Node $("$NODE" --version)（$NODE_BIN）"
        return 0
    fi
    [ -f /etc/alpine-release ] && fail "官方 Node 构建不支持 Alpine(musl)，请改用 apk add nodejs 或 glibc 系统"

    local machine arch base file sha tmp
    machine=$(uname -m)
    arch=$(node_arch "$machine") || fail "不支持的 CPU 架构: $machine"
    base="https://nodejs.org/dist/latest-v${NODE_DIST_MAJOR}.x"

    log "下载 Node ${NODE_DIST_MAJOR}（linux-${arch}）到 $runtime"
    file=$(fetch_text "$base/SHASUMS256.txt" | grep -E " node-v[0-9.]+-linux-${arch}\.tar\.gz$" | awk '{print $2}' | head -n1)
    [ -n "$file" ] || fail "无法从 $base 找到 linux-${arch} 的 Node 包"
    sha=$(fetch_text "$base/SHASUMS256.txt" | grep -F " $file" | awk '{print $1}' | head -n1)

    tmp=$(mktemp)
    fetch_to "$base/$file" "$tmp"
    if command -v sha256sum >/dev/null 2>&1; then
        printf '%s  %s\n' "$sha" "$tmp" | sha256sum -c - >/dev/null
    elif command -v shasum >/dev/null 2>&1; then
        printf '%s  %s\n' "$sha" "$tmp" | shasum -a 256 -c - >/dev/null
    else
        warn "没有 sha256sum/shasum，跳过校验和验证"
    fi

    tar -xzf "$tmp" -C "$runtime"
    rm -f "$tmp"
    mv "$runtime/${file%.tar.gz}" "$runtime/node"
    NODE="$runtime/node/bin/node"
    NODE_BIN="$runtime/node/bin"
    log "Node 安装完成: $("$NODE" --version)"
}

setup_pnpm() {
    if command -v pnpm >/dev/null 2>&1; then
        local v
        v=$(pnpm --version 2>/dev/null || echo 0)
        if [ "${v%%.*}" = "$PNPM_MAJOR" ]; then
            PNPM=$(command -v pnpm)
            log "使用系统 pnpm $v（$PNPM）"
            return 0
        fi
        warn "系统 pnpm $v 与锁文件（pnpm $PNPM_MAJOR）不匹配，安装局部 pnpm"
    fi
    local npm_bin prefix
    npm_bin=$(command -v npm 2>/dev/null || true)
    if [ -z "$npm_bin" ]; then npm_bin="$NODE_BIN/npm"; fi
    prefix="$TARGET/runtime"
    log "安装 pnpm@$PNPM_MAJOR 到 $prefix（不改动系统环境）"
    if ! PATH="$NODE_BIN:$PATH" "$npm_bin" install -g "pnpm@$PNPM_MAJOR" --prefix "$prefix" --no-fund --no-audit >/dev/null 2>&1; then
        fail "pnpm 安装失败，请检查服务器能否访问 npm registry"
    fi
    PNPM=""
    local candidate
    for candidate in "$prefix/bin/pnpm" "$prefix/pnpm"; do
        if [ -f "$candidate" ]; then PNPM="$candidate"; break; fi
    done
    [ -n "$PNPM" ] || fail "pnpm 安装后未找到可执行文件（$prefix/bin/pnpm）"
    log "pnpm 安装完成: $("$PNPM" --version)"
}

verify_manifest() {
    local dir="$1" manifest="$dir/.pack-manifest" total
    [ -f "$manifest" ] || { warn "包内没有校验清单（.pack-manifest），跳过全量校验"; return 0; }
    total=$(wc -l < "$manifest" | tr -d ' ')
    log "校验安装包完整性（$total 个文件）"
    if command -v sha256sum >/dev/null 2>&1; then
        ( cd "$dir" && sha256sum -c --quiet .pack-manifest >/dev/null 2>&1 ) \
            || fail "安装包文件校验失败：有文件内容不一致（可能是透明加密后的密文或传输损坏），请在本机用 deploy/pack.ps1 重新打包"
    elif command -v shasum >/dev/null 2>&1; then
        ( cd "$dir" && shasum -a 256 -c --quiet .pack-manifest >/dev/null 2>&1 ) \
            || fail "安装包文件校验失败：有文件内容不一致（可能是透明加密后的密文或传输损坏），请在本机用 deploy/pack.ps1 重新打包"
    else
        warn "没有 sha256sum/shasum，跳过全量校验"
    fi
}

check_payload() {
    local dir="$1"
    [ -f "$dir/dist/client/index.html" ] || fail "安装包缺少 dist/client/index.html，请先用 deploy/pack.ps1 打包"
    if ! head -c 9 "$dir/dist/client/index.html" | grep -q '<!doctype'; then
        fail "dist/client/index.html 内容异常（可能是被透明加密后上传的密文），请在本机用 deploy/pack.ps1 重新打包"
    fi
    verify_manifest "$dir"
}

extract_package() {
    log "解压安装包到 $TARGET（data/ 目录保持不变）"
    mkdir -p "$TARGET"
    tar -xzf "$PACKAGE" -C "$TARGET"
    check_payload "$TARGET"
    mkdir -p "$TARGET/data"
}

install_deps() {
    log "安装依赖（pnpm install --frozen-lockfile）"
    ( cd "$TARGET" && PATH="$NODE_BIN:$PATH" "$PNPM" install --frozen-lockfile )
}

prepare_service_user() {
    if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
        log "创建服务用户 $SERVICE_USER"
        useradd -r -m -d "$TARGET" -s /usr/sbin/nologin "$SERVICE_USER" 2>/dev/null || warn "创建用户 $SERVICE_USER 失败，继续"
    fi
    chown -R "$SERVICE_USER:$SERVICE_USER" "$TARGET" 2>/dev/null || true
}

install_service() {
    local unit="/etc/systemd/system/${APP_NAME}.service"
    if [ -f "$unit" ]; then
        log "systemd 服务已存在，保持原文件不变：$unit"
    else
        log "写入 systemd 服务：$unit"
        cat > "$unit" <<EOF
[Unit]
Description=影像文书原型 (vite preview + 本地 API)
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${TARGET}
ExecStart=${NODE} ${TARGET}/node_modules/vite/bin/vite.js preview --host ${HOST} --port ${PORT} --strictPort
Restart=on-failure
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    fi
    systemctl daemon-reload
    if [ "$NO_START" = 1 ]; then
        log "已跳过启动（--no-start）"
        return 0
    fi
    systemctl enable "$APP_NAME" >/dev/null 2>&1 || warn "开机自启设置失败"
    systemctl restart "$APP_NAME"
}

start_background() {
    if [ "$NO_START" = 1 ]; then
        log "已跳过启动（--no-start）"
        return 0
    fi
    mkdir -p "$TARGET/logs"
    log "后台启动服务（端口 $PORT）"
    ( cd "$TARGET" && PATH="$NODE_BIN:$PATH" nohup "$NODE" node_modules/vite/bin/vite.js preview --host "$HOST" --port "$PORT" --strictPort >>"$TARGET/logs/app.log" 2>&1 & echo $! > "$TARGET/report-prototype.pid" )
}

install_nginx() {
    if ! command -v nginx >/dev/null 2>&1; then
        warn "未检测到 nginx，跳过反向代理配置"
        return 0
    fi
    local conf="/etc/nginx/conf.d/${APP_NAME}.conf"
    if [ -f "$conf" ]; then
        log "nginx 配置已存在，跳过：$conf"
        return 0
    fi
    log "写入 nginx 反向代理：$conf"
    cat > "$conf" <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_set_header Host \$http_host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    if nginx -t 2>/dev/null; then
        systemctl reload nginx 2>/dev/null || warn "nginx 重载失败，请手动执行 systemctl reload nginx"
        log "nginx 已重载"
    else
        warn "nginx 配置校验失败，请检查 $conf"
    fi
}

stop_app() {
    local pidfile="$TARGET/report-prototype.pid"
    if [ -f "$pidfile" ]; then
        kill "$(cat "$pidfile")" 2>/dev/null || true
        rm -f "$pidfile"
        log "已停止后台进程"
    fi
    if [ -f "/etc/systemd/system/${APP_NAME}.service" ] && command -v systemctl >/dev/null 2>&1; then
        systemctl stop "$APP_NAME" 2>/dev/null || true
        log "已停止 systemd 服务 $APP_NAME"
    fi
}

verify_http() {
    if [ "$NO_START" = 1 ]; then return 0; fi
    local url="http://127.0.0.1:${PORT}" i ok=0 output=""
    log "自检 $url"
    for i in $(seq 1 "${VERIFY_ATTEMPTS:-40}"); do
        if output=$(PATH="$NODE_BIN:$PATH" "$NODE" --input-type=module -e "
            const result = {};
            try {
                const res = await fetch('$url/api/hospitals', { signal: AbortSignal.timeout(5000) });
                result.apiStatus = res.status;
                const body = await res.json().catch(() => null);
                result.hospitals = Array.isArray(body?.hospitals);
            } catch (error) { result.apiError = String(error); }
            try {
                const res = await fetch('$url/', { signal: AbortSignal.timeout(5000) });
                result.pageStatus = res.status;
                const html = await res.text();
                result.hasRoot = html.includes('id=\"root\"');
                result.pageHead = html.slice(0, 32);
            } catch (error) { result.pageError = String(error); }
            console.log(JSON.stringify(result));
            process.exit(result.hospitals && result.hasRoot ? 0 : 1);
        " 2>&1); then
            ok=1
            break
        fi
        sleep 1
    done
    if [ "$ok" != 1 ]; then
        warn "自检失败，最后一次结果：$output"
        warn "日志尾部："
        if [ "$SYSTEMD" = 1 ]; then
            journalctl -u "$APP_NAME" -n 20 --no-pager 2>/dev/null || true
        else
            tail -n 20 "$TARGET/logs/app.log" 2>/dev/null || true
        fi
        fail "服务未通过自检，请查看上面的日志"
    fi
    log "自检通过：/api/hospitals 与首页均正常"
}

summary() {
    local host_name
    host_name=$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo '服务器地址')
    echo
    printf '\033[32m部署完成\033[0m\n'
    if [ "$HOST" = "127.0.0.1" ] || [ "$HOST" = "localhost" ]; then
        echo "  访问地址: 仅本机 http://127.0.0.1:${PORT}/（对外访问需 nginx 或 SSH 隧道，可改用 --host 0.0.0.0）"
    else
        echo "  访问地址: http://${host_name}:${PORT}/   （内网/VPN 内打开）"
    fi
    echo "  安装目录: ${TARGET}"
    echo "  数据目录: ${TARGET}/data（SQLite，升级时保留）"
    if [ "$SYSTEMD" = 1 ]; then
        echo "  服务管理: systemctl status|restart ${APP_NAME}"
        echo "  运行日志: journalctl -u ${APP_NAME} -f"
    else
        echo "  运行日志: tail -f ${TARGET}/logs/app.log"
        echo "  停止服务: bash $0 --stop --target ${TARGET}"
    fi
    echo "  升级方式: 上传新包后执行 sudo bash install.sh <新包> --target ${TARGET}"
}

main() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --help|-h) usage; exit 0 ;;
            --target) TARGET="${2:-}"; shift 2 ;;
            --target=*) TARGET="${1#*=}"; shift ;;
            --port) PORT="${2:-}"; shift 2 ;;
            --port=*) PORT="${1#*=}"; shift ;;
            --host) HOST="${2:-}"; shift 2 ;;
            --host=*) HOST="${1#*=}"; shift ;;
            --nginx) WITH_NGINX=1; shift ;;
            --no-start) NO_START=1; shift ;;
            --no-systemd) NO_SYSTEMD=1; shift ;;
            --stop) STOP=1; shift ;;
            -*) fail "未知参数: $1" ;;
            *)
                [ -z "$PACKAGE" ] || fail "只能指定一个安装包"
                PACKAGE="$1"
                shift
                ;;
        esac
    done

    if [ -z "$TARGET" ]; then
        if [ "$(id -u)" -eq 0 ]; then
            TARGET="/opt/${APP_NAME}"
        else
            TARGET="$HOME/${APP_NAME}"
        fi
    fi
    case "$TARGET" in
        /*) ;;
        *) TARGET="$PWD/$TARGET" ;;
    esac

    if [ "$STOP" = 1 ]; then
        stop_app
        exit 0
    fi

    if [ -z "$PACKAGE" ]; then
        usage >&2
        fail "缺少安装包路径"
    fi
    [ -f "$PACKAGE" ] || fail "找不到安装包: $PACKAGE"
    case "$PORT" in
        ''|*[!0-9]*) fail "端口必须是数字: $PORT" ;;
    esac

    if [ "$NO_SYSTEMD" = 0 ] && [ "$(id -u)" -eq 0 ] && command -v systemctl >/dev/null 2>&1; then
        SYSTEMD=1
    fi

    log "安装目录: $TARGET"
    if [ "$SYSTEMD" = 1 ]; then
        log "运行方式: systemd 系统服务（用户 $SERVICE_USER）"
    else
        log "运行方式: 后台进程（日志 $TARGET/logs/app.log）"
    fi

    mkdir -p "$TARGET"
    setup_node
    setup_pnpm
    extract_package
    install_deps
    if [ "$SYSTEMD" = 1 ]; then
        prepare_service_user
        install_service
    else
        start_background
    fi
    if [ "$WITH_NGINX" = 1 ]; then
        install_nginx
    fi
    verify_http
    summary
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
