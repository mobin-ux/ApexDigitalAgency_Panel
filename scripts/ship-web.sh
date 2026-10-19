#!/usr/bin/env bash
# ============================================================================
#  Apex Digi — ship the public website (web/) to production
# ============================================================================
#  Usage, from the repo root:
#
#      bash scripts/ship-web.sh
#
#  Unlike the panel (scripts/ship-bundle.sh), the site is BUILT ON THE SERVER:
#  it is small (a ~30s build on the VPS) and it carries a native module,
#  sharp, which @nuxt/image bundles for the build machine's platform. A bundle
#  built on Windows would ship a Windows sharp binary to Linux.
#
#  What it does, in one ssh session:
#    1. uploads web/ source (no node_modules, no build output) to a fresh dir;
#    2. installs from the lockfile and builds there, while the live site keeps
#       serving the previous build;
#    3. swaps the build in, restarts apex-web, health-checks, and restores the
#       previous build automatically if the new one does not answer 200.
#
#  Server layout (set up 2026-10-20):
#    /opt/apex-web/.output         the live build (node .output/server/index.mjs)
#    /opt/apex-web/.env            runtime env; NEVER touched by this script
#    /etc/systemd/system/apex-web.service   runs as user apex on 127.0.0.1:3100
#    /etc/caddy/Caddyfile          apexdigi.co.uk (+ www redirect) → :3100
# ============================================================================
set -uo pipefail

HOST="${APEX_HOST:-root@146.19.130.11}"
KEY="${APEX_KEY:-$HOME/.ssh/apex_deploy}"
SITE_URL="${SITE_URL:-https://apexdigi.co.uk}"
PANEL_URL="${PANEL_URL:-https://panel.apexdigi.co.uk}"

say() { printf '\n[ship-web] %s\n' "$*"; }
die() { printf '\n[ship-web] ERROR: %s\n' "$*" >&2; exit 1; }

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
[ -f "$KEY" ] && SSH_OPTS+=(-i "$KEY")

[ -f web/nuxt.config.ts ] || die "Run this from the repo root."
STAMP="$(date +%Y%m%d-%H%M%S)"
say "Uploading web/ source and building on the server…"

# The .npmrc points at a mirror that suits the build machine, not the server,
# so it stays behind; the server installs from the public registry.
tar -czf - -C web \
    --exclude=node_modules --exclude=.nuxt --exclude=.output --exclude=.data \
    --exclude=.env --exclude=.npmrc \
    . \
| ssh "${SSH_OPTS[@]}" "$HOST" "
set -u
BASE=/opt/apex-web
SRC=\$BASE/src-$STAMP
echo '[server] receiving source…'
mkdir -p \"\$SRC\" && tar -xzf - -C \"\$SRC\" || { rm -rf \"\$SRC\"; exit 21; }

cd \"\$SRC\"
export CI=1 NODE_OPTIONS=--max-old-space-size=2560
export NUXT_PUBLIC_SITE_URL='$SITE_URL' NUXT_PUBLIC_PANEL_URL='$PANEL_URL' NUXT_SITE_ENV=production
if ! nice -n 10 pnpm install --frozen-lockfile --registry=https://registry.npmjs.org/ > \$BASE/build.log 2>&1 \
   || ! nice -n 10 pnpm build >> \$BASE/build.log 2>&1; then
  echo '[server] BUILD FAILED — live site untouched. Last lines:'
  tail -20 \$BASE/build.log
  rm -rf \"\$SRC\"; exit 22
fi
echo '[server] build ok'

systemctl stop apex-web
rm -rf \$BASE/.output.previous
[ -d \$BASE/.output ] && mv \$BASE/.output \$BASE/.output.previous
cp -a \"\$SRC/.output\" \$BASE/.output
mkdir -p \$BASE/.data
chown -R apex:apex \$BASE/.output \$BASE/.data
systemctl start apex-web
sleep 5

code=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3100/)
echo \"[server] health check: HTTP \$code\"
if [ \"\$code\" != '200' ]; then
  echo '[server] UNHEALTHY — restoring the previous build…'
  systemctl stop apex-web
  rm -rf \$BASE/.output
  [ -d \$BASE/.output.previous ] && mv \$BASE/.output.previous \$BASE/.output
  systemctl start apex-web
  exit 24
fi

# Keep the newest source tree only (the previous build stays in .output.previous).
find \$BASE -maxdepth 1 -name 'src-*' ! -path \"\$SRC\" -exec rm -rf {} +
echo \"[server] service: \$(systemctl is-active apex-web)\"
"

rc=$?
case "$rc" in
  0)  say "DEPLOYED. $SITE_URL is serving the new build." ;;
  21|22) die "Upload or build failed. Production was NOT touched." ;;
  24) die "The new build was unhealthy; the previous build was restored." ;;
  255) die "Could not connect to $HOST. Nothing was deployed." ;;
  *)  die "Deploy failed with status $rc." ;;
esac
