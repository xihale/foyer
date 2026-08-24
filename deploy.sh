#!/usr/bin/env bash
# foyer 部署（用户级 systemd，全程无需 root）
# 用法: ./deploy.sh user@host
# 数据: ~/.local/state/foyer/data/foyer.db
set -euo pipefail

TARGET="${1:?用法: ./deploy.sh user@host}"

echo "== 构建前端 =="
(cd frontend && bun install && bun run build)

echo "== 编译 Go 静态二进制 =="
# CGO_ENABLED=0 纯静态交叉编译；upx 只压磁盘，启动解压一次，RSS 实测无差
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -trimpath -ldflags='-s -w' -o /tmp/foyer-go-release .
command -v upx >/dev/null && upx --lzma -q /tmp/foyer-go-release || echo "(无 upx，跳过压缩)"

echo "== 上传 =="
ssh "$TARGET" "mkdir -p ~/.local/bin ~/.local/state/foyer/data/icons ~/.config/systemd/user"
# 上一版二进制留作回滚：cp 回去后 restart 即可
ssh "$TARGET" '[ -f ~/.local/bin/foyer ] && cp ~/.local/bin/foyer ~/.local/bin/foyer.prev.bak || true'
scp -q /tmp/foyer-go-release "$TARGET:/tmp/foyer.new.$$"
rm -f /tmp/foyer-go-release
ssh "$TARGET" "mv /tmp/foyer.new.$$ ~/.local/bin/foyer && chmod +x ~/.local/bin/foyer"

# icons 增量同步（运行时磁盘资源，不打进二进制；不 --delete，避免误删服务器上新传的）
rsync -r data/icons/ "$TARGET:.local/state/foyer/data/icons/"
# db 仅首启播种：已有则跳过，防止用本地旧库覆盖线上的新数据
ssh "$TARGET" '[ -f ~/.local/state/foyer/data/foyer.db ] || cat > ~/.local/state/foyer/data/foyer.db' < data/foyer.db

echo "== 用户级 systemd 单元 =="
ssh "$TARGET" "cat > ~/.config/systemd/user/foyer.service" < foyer-user.service
# enable-linger 让服务在 SSH 断开后仍存活（对自己用户无需 root）
ssh "$TARGET" "loginctl enable-linger \$USER 2>/dev/null || true"
ssh "$TARGET" "systemctl --user daemon-reload && systemctl --user enable --now foyer && systemctl --user restart foyer"

echo "== 完成 =="
echo "状态: ssh $TARGET 'systemctl --user status foyer'"
echo "日志: ssh $TARGET 'journalctl --user -u foyer -n 20'   # 首启管理员密码在这里"
echo "回滚上一版: ssh $TARGET 'cp ~/.local/bin/foyer.prev.bak ~/.local/bin/foyer && systemctl --user restart foyer'"
