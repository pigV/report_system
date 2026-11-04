# deploy/pack.ps1
# 在【本机】（Windows 开发机）执行：校验 + 构建 + 打包，产出可上传测试服务器的 tar 包。
# 测试服务器上不要运行本脚本；服务器端请使用 deploy/install.sh。
[CmdletBinding()]
param(
    [switch]$IncludeData,
    [switch]$SkipTests,
    [string]$OutDir
)

$ErrorActionPreference = 'Stop'

# 锁文件是 lockfileVersion 9.0（由 pnpm 12 生成），本机全局 pnpm 版本不匹配时
# 自动在 deploy/.tools 下装一份固定版本，不改动全局环境。
$PnpmVersion = '12'
$ToolsDir = Join-Path $PSScriptRoot '.tools'

$root = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $PSScriptRoot 'out' }

function Write-Step([string]$Message) {
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Checked([string]$Label, [scriptblock]$Action) {
    Write-Step $Label
    & $Action
    if ($LASTEXITCODE -ne 0) { throw "$Label 失败（退出码 $LASTEXITCODE）" }
}

function Resolve-Pnpm {
    $global = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($global) {
        $version = (& $global.Source --version 2>$null | Select-Object -First 1)
        if ($version -and $version.Split('.')[0] -eq $PnpmVersion) {
            Write-Step "使用本机 pnpm $version"
            return $global.Source
        }
        Write-Host "本机 pnpm $version 与锁文件（pnpm $PnpmVersion）不匹配，改用本地 pnpm" -ForegroundColor Yellow
    }
    $local = Join-Path $ToolsDir 'pnpm.cmd'
    if (-not (Test-Path $local)) {
        if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
            throw "需要 npm 才能安装本地 pnpm@$PnpmVersion"
        }
        Write-Step "安装本地 pnpm@$PnpmVersion 到 $ToolsDir（不改动全局环境）"
        & npm install -g "pnpm@$PnpmVersion" --prefix $ToolsDir --no-fund --no-audit | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "本地 pnpm@$PnpmVersion 安装失败" }
    }
    return $local
}

Push-Location $root
try {
    $pnpm = Resolve-Pnpm

    Invoke-Checked '安装依赖' { & $pnpm install --frozen-lockfile }
    Invoke-Checked '构建前端' { & $pnpm 'build' }

    $index = Join-Path $root 'dist/client/index.html'
    if (-not (Test-Path $index)) { throw "构建产物缺失: $index" }

    if (-not $SkipTests) {
        Invoke-Checked '运行测试' { & $pnpm 'test' }
        Invoke-Checked '校验 Sites 产物' { & $pnpm 'test:sites' }
    }

    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $archive = Join-Path $OutDir "prototype-$stamp.tar.gz"

    Write-Step "打包 $archive"
    $packArgs = @('deploy/pack-archive.mjs', $archive)
    if ($IncludeData) { $packArgs += '--include-data' }
    Invoke-Checked '打包（Node 读明文，绕过透明加密客户端）' { node @packArgs }

    $listing = (tar -tzf $archive) | ForEach-Object { $_ -replace '^\./', '' }
    if ($LASTEXITCODE -ne 0) { throw '无法读取生成的压缩包' }
    foreach ($required in @(
        '.pack-manifest',
        'dist/client/index.html',
        'package.json',
        'pnpm-lock.yaml',
        'vite.config.mjs',
        'server/api.mjs',
        'deploy/install.sh'
    )) {
        if (-not ($listing -contains $required)) { throw "压缩包缺少 $required" }
    }

    $sizeMb = [math]::Round((Get-Item $archive).Length / 1MB, 1)
    $hash = (Get-FileHash -Algorithm SHA256 -Path $archive).Hash

    Write-Host ''
    Write-Host '打包完成' -ForegroundColor Green
    Write-Host "  包文件: $archive"
    Write-Host "  大小:   $sizeMb MB"
    Write-Host "  SHA256: $hash"
    Write-Host ''
    Write-Host '下一步（本机执行）：把包和 install.sh 传到测试服务器'
    Write-Host "  scp deploy/install.sh `"$archive`" user@test-server:/tmp/"
    Write-Host '然后在测试服务器上执行'
    Write-Host "  sudo bash /tmp/install.sh /tmp/prototype-$stamp.tar.gz"
}
finally {
    Pop-Location
}
