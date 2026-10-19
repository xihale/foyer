# foyer @ gx — webhook 部署

push → GitHub webhook（HMAC-SHA256）→ `https://home.xeed.ink/hooks/foyer-deploy`
→ Caddy → unix `/run/webhook.sock` → 共享接收器（adnanh/webhook）
→ sudo 白名单 → `/usr/local/lib/webhook-deploy`（runner）→ 本脚本。
共享接收器的全景与坑见 zig-playground `scripts/server/README.md`。

## 服务器侧布局（用户 `foyer-ci`，uid 1507，锁密码）

| 路径 | 作用 |
|---|---|
| `~/foyer` | 持久克隆（`https://github.com/xihale/foyer`，公开仓库） |
| `~/.local/bin/foyer` | 部署产物；`.prev` 留一次回滚 |
| `~/.local/state/foyer/data/` | `foyer.db` + `icons/`，部署永不触碰 |
| `~/.local/share/go/` | deploy.sh 引导的 go 工具链（gx 无系统 go） |
| `~/.webhook-secret` | GitHub webhook secret（0600） |
| `~/.ntfy-notify` | 部署通知（topic `webhook-deploy`，与各站共用） |
| `~/deploy.log` | runner 追加的部署日志 |

`~/.config/systemd/user/foyer.service` 由 deploy.sh 每次覆盖安装（linger 已开）。

## 白名单（服务器 root 维护）

- `/etc/webhook/hooks.json`：`foyer-deploy` 条目，钉 `refs/heads/main`。
- `/etc/sudoers.d/webhook-deploy`：`webhook ALL=(foyer-ci) NOPASSWD: /usr/local/lib/webhook-deploy /home/foyer-ci/foyer/scripts/server/deploy.sh refs/heads/main foyer *`。
- Caddy `home.xeed.ink`：`@deployhook` 匹配 `/hooks/foyer-deploy` 的 POST 走
  `unix//run/webhook.sock`，其余回落 `127.0.0.1:3002`。

## 手动操作

```sh
ssh gx
sudo -u foyer-ci bash ~/foyer/scripts/server/deploy.sh   # 手动部署
tail -f ~foyer-ci/deploy.log                             # 部署日志
sudo -u foyer-ci systemctl --user status foyer           # 需 XDG_RUNTIME_DIR=/run/user/1507
sudo journalctl -u webhook -n 50                         # 接收器侧
```

冒烟（改完 hooks.json / sudoers / Caddy 后各来一遍）：
错签名 500；ping、无签名、错分支 200 且不部署；未知 hook 404；
push main → deploy.log 出现 `deploy success` 且 ntfy 收到通知。

## 回滚

```sh
sudo -u foyer-ci bash -c 'XDG_RUNTIME_DIR=/run/user/1507 \
  cp ~/.local/bin/foyer.prev ~/.local/bin/foyer && \
  systemctl --user restart foyer'
```
