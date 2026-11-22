#!/usr/bin/env bash
# 大肥鱼 fatfish · 一行安装
#   curl -fsSL https://raw.githubusercontent.com/qpzmas/siokhfd/main/install.sh | bash
set -euo pipefail

REPO="qpzmas/siokhfd"
RAW="https://raw.githubusercontent.com/${REPO}/main"
BIN_DIR="${FATFISH_BIN:-$HOME/.local/bin}"

if ! command -v node >/dev/null 2>&1; then
  printf '\033[33m需要 Node.js 16 或更高版本：https://nodejs.org\033[0m\n' >&2
  exit 1
fi

mkdir -p "$BIN_DIR"
curl -fsSL "$RAW/fatfish.mjs" -o "$BIN_DIR/fatfish.mjs"
chmod +x "$BIN_DIR/fatfish.mjs"

# 不带扩展名的 node 脚本会被当成 CommonJS，所以套一层 shim
cat > "$BIN_DIR/fatfish" <<EOF
#!/usr/bin/env sh
exec node "$BIN_DIR/fatfish.mjs" "\$@"
EOF
chmod +x "$BIN_DIR/fatfish"

printf '\033[32m🐟 装好了\033[0m  %s/fatfish\n' "$BIN_DIR"
case ":$PATH:" in
  *":$BIN_DIR:"*) printf '现在输入 \033[1mfatfish\033[0m 就能看见它。\n' ;;
  *)
    printf '把下面这行加进你的 shell 配置（~/.zshrc / ~/.bashrc）：\n'
    printf '  \033[36mexport PATH="%s:$PATH"\033[0m\n' "$BIN_DIR"
    printf '然后输入 \033[1mfatfish\033[0m 就能看见它。\n'
    ;;
esac
