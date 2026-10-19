#!/usr/bin/env bash
# Server-side deploy job for home.xeed.ink — dispatched by the shared webhook
# receiver on gx (adnanh/webhook → sudo whitelist → /usr/local/lib/webhook-deploy;
# see scripts/server/README.md), or manually: ssh gx, then
# `sudo -u foyer-ci bash ~/foyer/scripts/server/deploy.sh`.
#
#   1. shallow-fetch the pushed branch into the persistent clone
#   2. bun install + qwik build → frontend/dist (go:embed eats it)
#   3. go build (toolchain bootstrapped into ~/.local/share/go) → ~/.local/bin/foyer
#   4. systemctl --user restart foyer; Caddy proxies home.xeed.ink → 127.0.0.1:3002
#
# Data (db + fetched icons) lives outside the repo at ~/.local/state/foyer and
# is never touched here.
set -Eeuo pipefail
umask 022
REF="${1:-refs/heads/main}"
BRANCH="${REF#refs/heads/}"
REPO=/home/foyer-ci/foyer # on the gx VPS (1.14.133.242)
BIN=$HOME/.local/bin/foyer
GO_VERSION=1.26.5 # >= go.mod's go directive; bump both together
GO_ROOT=$HOME/.local/share/go
LOCK=$HOME/.deploy.lock
RERUN=$HOME/.deploy-rerun
say() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { say "FATAL: $*"; exit 1; }
cd "$REPO"
# One deploy at a time; a push that lands mid-deploy queues exactly one rerun
# (latest commit wins — the queued rerun fetches the newest sha anyway).
exec 9>"$LOCK"
if ! flock -n 9; then
  touch "$RERUN"
  say "deploy already running — queued one rerun"
  exit 0
fi
say "=== deploy start (${BRANCH}, sha=${ZP_PUSH_SHA:-unknown}) ==="
# Snapshot the running script BEFORE the fetch: bash keeps executing the old
# inode across the checkout, but $0 is just a path and resolves to the new
# file afterwards — path-to-path comparison can never detect the change.
SELF_SNAP=$(mktemp)
cat "$0" > "$SELF_SNAP"
git fetch --depth=1 origin "$BRANCH"
git checkout -q -B "$BRANCH" FETCH_HEAD
# node_modules and the Go caches survive on purpose. We were spawned from the
# pre-fetch checkout; if deploy.sh itself changed, re-exec so the new
# revision's logic publishes this push. After the re-exec the snapshot equals
# the file, so this fires at most once.
if ! cmp -s "$SELF_SNAP" "$REPO/scripts/server/deploy.sh"; then
  rm -f "$SELF_SNAP"
  say "deploy.sh changed in ${BRANCH} — re-execing from new checkout"
  exec /bin/bash "$REPO/scripts/server/deploy.sh" "$@"
fi
rm -f "$SELF_SNAP"
# --- Go toolchain (gx has no system go; keep it user-owned like zvm does) ---
if [ ! -x "$GO_ROOT/go/bin/go" ]; then
  say "bootstrapping go $GO_VERSION into $GO_ROOT"
  mkdir -p "$GO_ROOT"
  # go.dev is flaky-to-blocked from gx; the China mirrors are the reliable path.
  for host in https://go.dev/dl https://golang.google.cn/dl \
    https://mirrors.aliyun.com/golang; do
    if curl -fsSL --retry 2 -o "$GO_ROOT/go.tgz" \
      "$host/go$GO_VERSION.linux-amd64.tar.gz"; then
      rm -rf "$GO_ROOT/go"
      tar -xz -C "$GO_ROOT" -f "$GO_ROOT/go.tgz"
      rm -f "$GO_ROOT/go.tgz"
      break
    fi
  done
  [ -x "$GO_ROOT/go/bin/go" ] || die "could not fetch go $GO_VERSION toolchain"
fi
GO="$GO_ROOT/go/bin/go"
export GOTOOLCHAIN=local # a bumped go.mod must fail loudly, not download
# gx egress: proxy.golang.org and go.dev are blocked from this VPS (SYN
# blackhole, v4 and v6 alike); goproxy.cn answers in ~50ms. Override by
# exporting GOPROXY before calling this script if that ever changes.
export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"
# --- user bus: webhook spawns us without a login session --------------------
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
# --- build ------------------------------------------------------------------
(cd frontend && bun install --frozen-lockfile && bun run build)
printf '{"sha":"%s","branch":"%s","deployedAt":"%s"}\n' \
  "$(git rev-parse HEAD)" "$BRANCH" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > frontend/dist/deploy-meta.json
say "building with $("$GO" version)"
"$GO" build -trimpath -ldflags='-s -w' -o "$BIN.new" .
# --- install + restart (previous binary kept for one-shot rollback) ---------
[ -f "$BIN" ] && cp "$BIN" "$BIN.prev"
mv "$BIN.new" "$BIN"
mkdir -p "$HOME/.config/systemd/user"
cat "$REPO/scripts/server/foyer.service" > "$HOME/.config/systemd/user/foyer.service"
systemctl --user daemon-reload
systemctl --user enable --now foyer
systemctl --user restart foyer
up=0
for _ in $(seq 1 30); do
  if curl -fsS -m 2 -o /dev/null http://127.0.0.1:3002/; then up=1; break; fi
  sleep 0.5
done
if [ "$up" != 1 ]; then
  if [ -f "$BIN.prev" ]; then
    say "service did not come up — rolling back to previous binary"
    cp "$BIN.prev" "$BIN"
    systemctl --user restart foyer
  fi
  die "foyer not healthy on 127.0.0.1:3002 after restart"
fi
say "published $(git rev-parse --short HEAD) → $BIN (foyer active, :3002 healthy)"
say "=== deploy done ==="
if [ -e "$RERUN" ]; then
  rm -f "$RERUN"
  say "a newer push arrived during this deploy — running again"
  exec /bin/bash "$0" "$REF"
fi
