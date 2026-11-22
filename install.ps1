# 大肥鱼 fatfish · 一行安装（Windows / PowerShell）
#   irm https://raw.githubusercontent.com/qpzmas/siokhfd/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
$repo = "github:qpzmas/siokhfd"

Write-Host ""
Write-Host "  🐟  大肥鱼 fatfish" -ForegroundColor Yellow
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  需要先装 Node.js 16+：https://nodejs.org" -ForegroundColor Red
    return
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "  找不到 npm。也可以直接用：" -ForegroundColor Red
    Write-Host "    npx $repo" -ForegroundColor Cyan
    return
}

Write-Host "  正在安装…" -ForegroundColor DarkGray
npm install -g $repo --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "  安装失败。也可以直接用（不装）：" -ForegroundColor Red
    Write-Host "    npx $repo" -ForegroundColor Cyan
    return
}

Write-Host "  装好了！" -ForegroundColor Green
Write-Host "  在终端里输入 " -NoNewline
Write-Host "fatfish" -ForegroundColor Cyan -NoNewline
Write-Host " 开始"
Write-Host ""
Write-Host "  空格 = 喂食   N = 昼夜   Q = 退出" -ForegroundColor DarkGray
Write-Host ""
