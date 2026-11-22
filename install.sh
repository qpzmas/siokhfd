#!/usr/bin/env bash
# 大肥鱼 fatfish · 一行安装
#   curl -fsSL https://raw.githubusercontent.com/qpzmas/siokhfd/main/install.sh | bash
set -euo pipefail

REPO="qpzmas/siokhfd"
BIN_DIR="${FATFISH_BIN:-$HOME/.local/bin}"

say()   { printf '%s\n' "$*"; }
say_g() { printf '\033[32m%s\033[0m\n' "$*"; }
say_c() { printf '\033[36m%s\033[0m\n' "$*"; }
die()   { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

say ""
say "  🐟  大肥鱼 fatfish"
say ""

command -v node >/dev/null 2>&1 || die "  需要 Node.js 16+：https://nodejs.org"
command -v curl >/dev/null 2>&1 || die "  需要 curl。"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

# 下载并确认拿到的是 fatfish.mjs，而不是一个错误页
fetch() {
  curl -fsSL --max-time 30 "$@" -o "$tmp" 2>/dev/null || return 1
  [ -s "$tmp" ] || return 1
  head -c 32 "$tmp" | grep -q 'node' || return 1
  return 0
}

try_raw()      { fetch "https://raw.githubusercontent.com/$REPO/main/fatfish.mjs"; }
try_jsdelivr() { fetch "https://cdn.jsdelivr.net/gh/$REPO@main/fatfish.mjs"; }
try_api()      { fetch -H "Accept: application/vnd.github.raw" "https://api.github.com/repos/$REPO/contents/fatfish.mjs"; }

say "  正在下载…"
got=""
case "${FATFISH_SOURCE:-auto}" in
  raw)      try_raw      && got="raw.githubusercontent.com" ;;
  jsdelivr) try_jsdelivr && got="cdn.jsdelivr.net" ;;
  api)      try_api      && got="api.github.com" ;;
  *)
    if try_raw; then got="raw.githubusercontent.com"
    elif try_jsdelivr; then got="cdn.jsdelivr.net"
    elif try_api; then got="api.github.com"
    fi
    ;;
esac
[ -n "$got" ] || die "  下载失败。可以直接用：npx github:$REPO"
say "    ✓ $got"

mkdir -p "$BIN_DIR"
mv "$tmp" "$BIN_DIR/fatfish.mjs"
chmod +x "$BIN_DIR/fatfish.mjs"

# 不带扩展名的 node 脚本会被当成 CommonJS，所以套一层 shim
shim="$BIN_DIR/fatfish"
printf '#!/usr/bin/env sh\nexec node "%s" "$@"\n' "$BIN_DIR/fatfish.mjs" > "$shim"
chmod +x "$shim"

say ""
say_g "  装好了  $shim"
case ":$PATH:" in
  *":$BIN_DIR:"*) say "  输入 fatfish 就能看见它。" ;;
  *)
    say "  把这一行加进 ~/.zshrc 或 ~/.bashrc："
    say_c "  export PATH=\"$BIN_DIR:\$PATH\""
    say "  然后输入 fatfish 就能看见它。"
    ;;
esac
say ""
