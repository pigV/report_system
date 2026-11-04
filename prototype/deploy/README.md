# 部署说明

本工程是「静态前端 + Node API + SQLite」，不是纯静态站。服务器上没有 Node 时，
需要先跑一次 `install.sh` 把运行时装进应用目录。

## 分工

| 脚本 | 在哪执行 | 作用 |
|---|---|---|
| `pack.ps1` | 本机（Windows） | 测试 → 构建 → 打包 tar |
| `install.sh` | 测试服务器（Linux） | 装 Node/pnpm → 部署 → 起服务 → 自检 |

## 本机透明加密（DLP）注意

若开发机装了亿赛通等透明加密客户端，`tar`、`cp` 这类工具读到的是**密文**，打出来的包在服务器上会显示为乱码。
因此打包由 `deploy/pack-archive.mjs` 用 Node 完成：Node 读文件时拿到明文，写出的 `.tar.gz` 也是明文。

`install.sh` 解压后会校验 `dist/client/index.html` 开头是 `<!doctype`，并用包内的 `.pack-manifest` 对**全部文件**做 SHA256 比对，发现密文或损坏会直接报错，避免带病部署。

## 步骤

### 1. 本机打包

```powershell
cd D:\my_project\report_system\prototype
.\deploy\pack.ps1
```

产出 `deploy/out/prototype-<时间戳>.tar.gz`，并打印 SHA256。
锁文件为 `lockfileVersion: 9.0`，需要 pnpm 12；本机 pnpm 不是 12 时，脚本会自动在 `deploy/.tools` 安装一份 pnpm 12（不改动全局环境）。

### 2. 上传

```powershell
scp deploy/install.sh deploy/out/prototype-<时间戳>.tar.gz user@test-server:/tmp/
```

### 3. 服务器部署

```sh
sudo bash /tmp/install.sh /tmp/prototype-<时间戳>.tar.gz --nginx
```

脚本会：

1. 检测系统 Node，不满足要求时下载 Node 24 到 `/opt/report-prototype/runtime/node`（用官方 SHA256 校验）
2. 需要时在应用目录内安装 pnpm 12（不改动系统 PATH）
3. 解压安装包（`data/` 目录保留，升级不清数据）
4. `pnpm install --frozen-lockfile`
5. 写入 systemd 服务并启动（服务用户 `report`）
6. 自检 `/api/hospitals` 与首页，失败时打印日志尾部

常用参数：`--target DIR`、`--port N`、`--host IP`、`--nginx`、`--no-start`、`--no-systemd`、`--stop`。

### 4. 日常启动 / 升级（服务器）

把 `deploy/start.sh` 上传到服务器（只需一次）：

```sh
scp deploy/start.sh root@test-server:/data/report_system/start.sh   # 本机执行
```

之后在服务器上：

```sh
sudo /data/report_system/start.sh                                   # 启动/重启，并等待接口就绪
sudo /data/report_system/start.sh /data/report_system/prototype-*.tar.gz   # 先升级，再启动
```

路径不同可以用环境变量覆盖：`APP_DIR`、`INSTALLER`、`BIND_HOST`、`PORT`、`SERVICE`。

### 5. 访问

- 不用 nginx（默认）：部署时加 `--host 0.0.0.0`，VPN 内直接访问 `http://<服务器>:4173/`
- 用 nginx：访问 `http://<服务器>/`（反代到 127.0.0.1:4173）
- 只加 `--host` 不加 `--nginx` 时，服务直接对外监听，nginx 可不装

## 注意

- 服务**没有登录鉴权**，只能放在内网/VPN 内，不要暴露公网。
- nginx 反代必须 `proxy_set_header Host $http_host;`（含端口），否则保存接口会返回 403。
- 升级：重新打包上传后重跑 `install.sh`，`data/` 自动保留。
- 备份：停服后拷贝 `<安装目录>/data/*.sqlite`。
