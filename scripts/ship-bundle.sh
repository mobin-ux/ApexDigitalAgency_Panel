#!/usr/bin/env bash
# ============================================================================
#  Apex Digi — ship a pre-built bundle to production
# ============================================================================
#  Usage, from the repo root:
#
#      pnpm demo:build            # if you have not built yet
#      bash scripts/ship-bundle.sh
#
#  It asks for the server password ONCE (or nothing at all if the deploy key
#  is installed — see scripts/authorize-deploy-key.md) and does the rest.
#
#  Why this replaces building on the server
#  ---------------------------------------
#  The Nuxt bundler peaks around 4.5GB. The VPS has 3.9GB of RAM in total, so
#  a build there only completed by thrashing swap for ~10 minutes, and the old
#  safe-deploy.sh had to STOP the app for all of it to free the memory. That is
#  ten minutes of downtime on a live payment system per release, and twice a
#  build died part-way and left .output half-written, serving 500s.
#
#  Here the build happens on a machine that can do it, and the server only
#  receives files. Downtime is a swap plus a restart — a few seconds.
#
#  Everything after the upload runs in ONE ssh session, so password auth
#  prompts once rather than once per step. (Windows OpenSSH has no
#  ControlMaster multiplexing, so this is done by structure, not by config.)
#
#  Safety properties:
#    - the live site keeps serving during the entire upload
#    - a failed or interrupted upload leaves production completely untouched
#    - the bundle is checked for a LINUX Prisma engine before AND after upload;
#      without it every database-backed route would 500 in production
#    - a failed health check restores the previous build automatically
#    - .env.production is never read or written, so the Stripe secrets on the
#      server survive a deploy untouched
# ============================================================================
set -uo pipefail

HOST="${APEX_HOST:-root@146.19.130.11}"
KEY="${APEX_KEY:-$HOME/.ssh/apex_deploy}"
APP_DIR="/opt/apex"
LOCAL_OUT=".demo/.output"
HEALTH="/auth/login-1"

say()  { printf '\n[ship] %s\n' "$*"; }
die()  { printf '\n[ship] ERROR: %s\n' "$*" >&2; exit 1; }

# Use the deploy key when it exists; otherwise ssh falls back to a password
# prompt, which is why BatchMode is deliberately NOT set here.
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
[ -f "$KEY" ] && SSH_OPTS+=(-i "$KEY")

# --- 1. local sanity ---------------------------------------------------------
say "Checking the local bundle…"
[ -f "$LOCAL_OUT/server/index.mjs" ] || die "No bundle at $LOCAL_OUT — run: pnpm demo:build"

# Built on a dev machine, runs on Linux. Without a Linux query engine every
# Prisma call 500s in production, and nothing fails at build time to warn you,
# so this is a hard gate rather than a warning.
ENGINES=$(find "$LOCAL_OUT" -name 'libquery_engine-debian*.so.node' 2>/dev/null)
[ -n "$ENGINES" ] || die "The bundle has no Linux Prisma engine.
     prisma/schema.prisma needs:
       binaryTargets = [\"native\", \"debian-openssl-3.0.x\", \"debian-openssl-1.1.x\"]
     then: pnpm exec prisma generate && pnpm demo:build"

say "Linux Prisma engine present:"
printf '        %s\n' $(basename -a $ENGINES)

SIZE=$(du -sh "$LOCAL_OUT" 2>/dev/null | cut -f1)
say "Bundle is $SIZE on disk (~168MB compressed on the wire). Uploading…"
say "If you are asked for a password, that is the server asking — it is typed"
say "straight into ssh and is not stored anywhere by this script."

STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE="$APP_DIR/.output.staging-$STAMP"

# --- 2..5. one connection: upload → verify → swap → health-check → rollback --
#
# The tarball arrives on the remote command's stdin; `tar -x` consumes exactly
# the archive and the rest of the script runs afterwards on the same session.
# The build machine's own engine (Windows DLL / macOS dylib) is excluded — it
# can never load on the server and is ~20MB of dead weight.
tar -czf - -C "$LOCAL_OUT" \
    --exclude='query_engine-windows.dll.node' \
    --exclude='libquery_engine-darwin*.dylib.node' \
    . \
| ssh "${SSH_OPTS[@]}" "$HOST" "
set -u
APP_DIR='$APP_DIR'
STAGE='$STAGE'
OUT=\"\$APP_DIR/.demo/.output\"
PREV=\"\$APP_DIR/.output.previous\"

echo
echo '[server] receiving bundle…'
rm -rf \"\$STAGE\"; mkdir -p \"\$STAGE\"
if ! tar -xzf - -C \"\$STAGE\"; then
  echo '[server] UPLOAD FAILED — removing staging, live site untouched.'
  rm -rf \"\$STAGE\"
  exit 21
fi

# Verify what actually landed, not what we think we sent.
if [ ! -f \"\$STAGE/server/index.mjs\" ]; then
  echo '[server] INCOMPLETE: no server/index.mjs — live site untouched.'
  rm -rf \"\$STAGE\"; exit 22
fi
if ! find \"\$STAGE\" -name 'libquery_engine-debian*.so.node' | grep -q .; then
  echo '[server] INCOMPLETE: no Linux Prisma engine — live site untouched.'
  rm -rf \"\$STAGE\"; exit 23
fi
echo \"[server] bundle verified (\$(du -sh \"\$STAGE\" | cut -f1))\"

echo '[server] swapping in the new build…'
systemctl stop apex 2>/dev/null
rm -rf \"\$PREV\"
[ -d \"\$OUT\" ] && mv \"\$OUT\" \"\$PREV\"
mkdir -p \"\$(dirname \"\$OUT\")\"
mv \"\$STAGE\" \"\$OUT\"
systemctl start apex
sleep 7

code=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3000$HEALTH)
echo \"[server] health check: HTTP \$code\"

if [ \"\$code\" != '200' ] && [ \"\$code\" != '302' ]; then
  echo '[server] UNHEALTHY — rolling back to the previous build…'
  systemctl stop apex 2>/dev/null
  rm -rf \"\$OUT\"
  [ -d \"\$PREV\" ] && mv \"\$PREV\" \"\$OUT\"
  systemctl start apex
  sleep 7
  back=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3000$HEALTH)
  echo \"[server] rolled back. Site now answers HTTP \$back\"
  exit 24
fi

echo
echo '[server] --- post-deploy state ---'
echo \"[server] service: \$(systemctl is-active apex)\"
# Confirms the Stripe keys survived. Prints key TYPE and LENGTH only, never a value.
[ -f \"\$APP_DIR/stripe-setup.sh\" ] && bash \"\$APP_DIR/stripe-setup.sh\" --check 2>/dev/null | sed 's/^/[server] /'
echo \"[server] previous build kept at \$PREV\"
"

rc=$?
case "$rc" in
  0)  say "DEPLOYED. The new build is live and answering." ;;
  21|22|23) die "Upload/verification failed. Production was NOT touched — it is still serving the previous build." ;;
  24) die "The new build started but was unhealthy, so the previous build was restored automatically." ;;
  255) die "Could not connect to $HOST (ssh error). Nothing was deployed." ;;
  *)  die "Deploy failed with status $rc. Check the [server] lines above." ;;
esac
