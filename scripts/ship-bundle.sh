#!/usr/bin/env bash
# ============================================================================
#  Apex Digi — ship a pre-built bundle to production
# ============================================================================
#  Usage (from the repo root, on a dev machine):
#      bash scripts/ship-bundle.sh
#
#  Why this replaces building on the server
#  ---------------------------------------
#  The Nuxt bundler needs ~6GB of heap. The VPS has 3.9GB of RAM, so a build
#  there only completes by thrashing swap for ~10 minutes — and the old
#  safe-deploy.sh had to STOP the app for the whole of it, because the build
#  needed the app's memory back. That is ~10 minutes of downtime on a live
#  payment system per deploy, and twice it ended in an outage when the build
#  died part-way and left .output half-written.
#
#  Here the build happens on a machine that can actually do it, and the server
#  only receives files. Downtime is the swap plus a restart — a few seconds —
#  and the previous build is kept next to the new one, so a rollback is a
#  directory rename rather than another 10-minute build.
#
#  The sequence:
#    1. sanity-check the local bundle (exists, has the LINUX Prisma engine)
#    2. upload it to a staging directory (live site untouched throughout)
#    3. verify the upload arrived intact
#    4. stop → swap → start   (the only downtime)
#    5. health-check; on failure swap the previous build back automatically
#
#  Requires key-based SSH (see scripts/authorize-deploy-key.md). It never
#  handles a password and never reads or writes .env.production, so the Stripe
#  secrets on the server are untouched by a deploy.
# ============================================================================
set -uo pipefail

HOST="${APEX_HOST:-root@146.19.130.11}"
KEY="${APEX_KEY:-$HOME/.ssh/apex_deploy}"
APP_DIR="/opt/apex"
LOCAL_OUT=".demo/.output"
HEALTH_PATH="/auth/login-1"

SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
say() { printf '\n[ship] %s\n' "$*"; }
die() { printf '\n[ship] ERROR: %s\n' "$*" >&2; exit 1; }

# --- 1. local sanity ---------------------------------------------------------
say "Checking the local bundle…"
[ -f "$LOCAL_OUT/server/index.mjs" ] || die "No bundle at $LOCAL_OUT — run: pnpm demo:build"

# The bundle is built on a dev machine but runs on Linux. Without a Linux query
# engine every Prisma call 500s in production, and that is invisible until the
# site is already live, so it is a hard gate rather than a warning.
if ! find "$LOCAL_OUT" -name 'libquery_engine-debian*.so.node' | grep -q .; then
  die "The bundle has no Linux Prisma engine.
     prisma/schema.prisma needs:
       binaryTargets = [\"native\", \"debian-openssl-3.0.x\", \"debian-openssl-1.1.x\"]
     then re-run prisma generate and rebuild."
fi
say "Linux Prisma engine present: $(find "$LOCAL_OUT" -name 'libquery_engine-debian*.so.node' -printf '%f ' 2>/dev/null)"

# --- 2. upload to staging ----------------------------------------------------
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE="$APP_DIR/.output.staging-$STAMP"

say "Uploading to $STAGE (the live site keeps serving throughout)…"
"${SSH[@]}" "$HOST" "rm -rf '$STAGE' && mkdir -p '$STAGE'" || die "Could not prepare the staging directory."

# tar over ssh: one stream, preserves modes, far quicker than per-file scp.
#
# The build machine's own Prisma engine is excluded — a ~20MB Windows DLL (or a
# macOS dylib) that can never load on the server. Only the debian engines are
# shipped. Roughly 168MB on the wire after compression.
if tar -czf - -C "$LOCAL_OUT" \
      --exclude='query_engine-windows.dll.node' \
      --exclude='libquery_engine-darwin*.dylib.node' \
      . | "${SSH[@]}" "$HOST" "tar -xzf - -C '$STAGE'"; then
  say "Upload finished."
else
  say "Upload failed — cleaning up the staging directory."
  "${SSH[@]}" "$HOST" "rm -rf '$STAGE'"
  die "Upload failed. The live site was NOT touched — it is still serving the previous build."
fi

# --- 3. verify what actually landed -----------------------------------------
say "Verifying the uploaded bundle…"
REMOTE_OK=$("${SSH[@]}" "$HOST" "
  if [ -f '$STAGE/server/index.mjs' ] && find '$STAGE' -name 'libquery_engine-debian*.so.node' | grep -q .; then
    echo OK
  else
    echo BAD
  fi")
if [ "$REMOTE_OK" != "OK" ]; then
  "${SSH[@]}" "$HOST" "rm -rf '$STAGE'"
  die "The uploaded bundle is incomplete — the live site was not touched."
fi

# --- 4. swap + restart (the only downtime) ----------------------------------
say "Swapping in the new build and restarting…"
"${SSH[@]}" "$HOST" "bash -s" <<REMOTE
set -u
APP_DIR='$APP_DIR'
OUT="\$APP_DIR/.demo/.output"
PREV="\$APP_DIR/.output.previous"
STAGE='$STAGE'

systemctl stop apex 2>/dev/null
rm -rf "\$PREV"
[ -d "\$OUT" ] && mv "\$OUT" "\$PREV"
mkdir -p "\$(dirname "\$OUT")"
mv "\$STAGE" "\$OUT"
systemctl start apex
sleep 6

code=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3000$HEALTH_PATH)
echo "HEALTH:\$code"

if [ "\$code" != "200" ] && [ "\$code" != "302" ]; then
  echo "ROLLING_BACK"
  systemctl stop apex 2>/dev/null
  rm -rf "\$OUT"
  [ -d "\$PREV" ] && mv "\$PREV" "\$OUT"
  systemctl start apex
  sleep 6
  back=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3000$HEALTH_PATH)
  echo "ROLLED_BACK_HEALTH:\$back"
fi
REMOTE

# --- 5. report ---------------------------------------------------------------
say "Post-deploy state:"
"${SSH[@]}" "$HOST" "
  systemctl is-active apex | sed 's/^/    service: /'
  curl -s -o /dev/null -w '    local health: HTTP %{http_code}\n' --max-time 20 http://127.0.0.1:3000$HEALTH_PATH
  # Confirms the Stripe keys survived the deploy. Prints key TYPE and LENGTH
  # only — never the value.
  bash '$APP_DIR/stripe-setup.sh' --check 2>/dev/null | sed 's/^/    /'
"

say "Done. Previous build kept at $APP_DIR/.output.previous"
