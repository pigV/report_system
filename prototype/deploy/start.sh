#!/usr/bin/env bash
# deploy/start.sh
# 在【测试服务器】执行：
#   sudo ./start.sh                      启动/重启已部署的服务
#   sudo ./start.sh <prototype-*.tar.gz> 先升级到该安装包，再启动
# 可通过环境变量覆盖默认路径：APP_DIR / INSTALLER / BIND_HOST / PORT / SERVICE
set -euo pipefail

APP_DIR="${APP_DIR:-/data/report_system/app}"
INSTALLER="${INSTALLER:-/data/report_system/install.sh}"
BIND_HOST="${BIND_HOST:-0.0.0.0}"
PORT="${PORT:-4173}"
SERVICE="${SERVICE:-report-prototype}"

log()  { printf '\033[36m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[31m[错误] %s\033[0m\n' "$*" >&2; exit 1; }

usage() {
    cat <<'EOF'
用法: sudo ./start.sh [安装包]

  （无参数）             启动已部署的服务，并等待接口就绪
  <prototype-*.tar.gz>  先升级到该安装包（保留 data/），再启动

环境变量:
  APP_DIR     应用目录（默认 /data/report_system/app）
  INSTALLER   安装脚本（默认 /data/report_system/install.sh）
  BIND_HOST   监听地址（默认 0.0.0.0）
  PORT        端口（默认 4173）
  SERVICE     systemd 服务名（默认 report-prototype）
EOF
}

wait_ready() {
    local url="http://127.0.0.1:${PORT}/api/hospitals" i
    for i in $(seq 1 30); do
        if curl -fsS -o /dev/null "$url" 2>/dev/null; then return 0; fi
        sleep 1
    done
    return 1
}

show_status() {
    systemctl --no-pager --lines=0 status "$SERVICE" 2>/dev/null | sed -n '1,5p' || true
}

main() {
    case "${1:-}" in
        --help|-h) usage; exit 0 ;;
    esac
    [ "$(id -u)" -eq 0 ] || fail "请用 sudo 运行"

    local package="${1:-}"

    if [ -n "$package" ]; then
        [ -f "$package" ] || fail "找不到安装包: $package"
        [ -f "$INSTALLER" ] || fail "找不到安装脚本: $INSTALLER"
        log "升级到 $(basename "$package")"
        rm -rf "$APP_DIR/dist"
        bash "$INSTALLER" "$package" --host "$BIND_HOST" --port "$PORT" --target "$APP_DIR"
    else
        log "启动服务 $SERVICE"
        if ! systemctl start "$SERVICE" 2>/dev/null; then
            fail "服务 $SERVICE 未安装，请先执行: sudo bash $INSTALLER <安装包> --host $BIND_HOST --target $APP_DIR"
        fi
    fi

    log "等待服务就绪 http://127.0.0.1:${PORT}"
    if ! wait_ready; then
        show_status
        journalctl -u "$SERVICE" -n 20 --no-pager 2>/dev/null || true
        fail "服务未就绪，请查看上面的日志"
    fi

    show_status
    local ip
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    [ -n "$ip" ] || ip="<服务器IP>"
    log "已就绪：http://${ip}:${PORT}/"
}

main "$@"
