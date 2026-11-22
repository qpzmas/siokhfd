# 大肥鱼 fatfish · 一行安装（Windows / PowerShell）
#   irm https://raw.githubusercontent.com/qpzmas/siokhfd/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
$repo = "qpzmas/siokhfd"

Write-Host ""
Write-Host "  大肥鱼 fatfish" -ForegroundColor Yellow
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  需要先装 Node.js 16+：https://nodejs.org" -ForegroundColor Red
    return
}

$dir = if ($env:FATFISH_HOME) { $env:FATFISH_HOME } else { Join-Path $env:LOCALAPPDATA "fatfish" }
$file = Join-Path $dir "fatfish.mjs"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$urls = @(
    "https://raw.githubusercontent.com/$repo/main/fatfish.mjs",
    "https://cdn.jsdelivr.net/gh/$repo@main/fatfish.mjs",
    "https://api.github.com/repos/$repo/contents/fatfish.mjs"
)

$ok = $false
Write-Host "  正在下载…" -ForegroundColor DarkGray
foreach ($u in $urls) {
    try {
        $hdr = @{ "User-Agent" = "fatfish"; "Accept" = "application/vnd.github.raw" }
        Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile $file -Headers $hdr -TimeoutSec 30
        if ((Get-Item $file).Length -gt 1000) { $ok = $true; break }
    } catch { }
}

if (-not $ok -and (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "  换 npm 再试一次…" -ForegroundColor DarkGray
    npm install -g "github:$repo" --silent
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "  装好了！输入 " -NoNewline -ForegroundColor Green
        Write-Host "fatfish" -ForegroundColor Cyan -NoNewline
        Write-Host " 开始" -ForegroundColor Green
        return
    }
}

if (-not $ok) {
    Write-Host "  下载失败。也可以直接用：npx github:$repo" -ForegroundColor Red
    return
}

# 一个 fatfish.cmd 垫片，让 "fatfish" 能直接在终端里敲
$nl = [Environment]::NewLine
$shim = Join-Path $dir "fatfish.cmd"
$text = "@echo off" + $nl + 'node "' + $file + '" %*' + $nl
Set-Content -Path $shim -Encoding ASCII -Value $text

if (-not $env:FATFISH_NO_PATH) {
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if (-not $userPath) { $userPath = "" }
    if ($userPath -notlike "*$dir*") {
        $newPath = ($userPath.TrimEnd(";") + ";" + $dir).TrimStart(";")
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-Host "  已把 $dir 加进用户 PATH（重开终端生效）" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "  装好了！" -ForegroundColor Green
Write-Host "  新开一个终端，输入 " -NoNewline
Write-Host "fatfish" -ForegroundColor Cyan -NoNewline
Write-Host " 开始"
Write-Host "  现在也可以直接跑： node " -NoNewline -ForegroundColor DarkGray
Write-Host $file -ForegroundColor DarkGray
Write-Host ""
Write-Host "  空格 = 喂食   N = 昼夜   Q = 退出" -ForegroundColor DarkGray
Write-Host ""
