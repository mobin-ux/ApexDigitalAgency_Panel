#!/usr/bin/env bash
# ============================================================================
#  Apex Digi — safe production build
# ============================================================================
#  Usage on the server:   sudo bash /opt/apex/safe-deploy.sh
#
#  Why this exists: the production VPS has 3.9GB of RAM and the Nuxt bundler
#  needs roughly 6GB, so it only completes by spilling into swap. A build that
#  dies part-way overwrites .output and leaves the site serving 500s with no
#  way back. That happened once; this script makes it impossible.
#
#  The sequence:
#    1. keep the currently-working .output as a backup
#    2. stop the app (frees ~400MB of RAM the build needs, and the app cannot
#       serve a half-written bundle anyway)
#    3. build
#    4. success → start the app and verify it answers; failure OR a failed
#       health check → restore the backup and start the old version again
#
#  Worst case is a few minutes of downtime on the PREVIOUS working build,
#  never an indefinite outage.
# ============================================================================
set -u

APP_DIR="/opt/apex"
OUT="$APP_DIR/.demo/.output"
BAK="$APP_DIR/.output.previous"
HEAP="${HEAP_MB:-6144}"

cd "$APP_DIR" || exit 1

say() { printf '\n[deploy] %s\n' "$*"; }

# --- 1. back up the working build -------------------------------------------
if [ -d "$OUT" ] && [ -f "$OUT/server/index.mjs" ]; then
  say "Backing up the current working build…"
  rm -rf "$BAK"
  cp -a "$OUT" "$BAK"
  say "Backup saved to $BAK"
else
  say "WARNING: no usable current build to back up — continuing without a rollback point."
fi

# --- 2. free memory ----------------------------------------------------------
say "Stopping the app to free memory for the build…"
systemctl stop apex 2>/dev/null
sleep 2

# --- 3. build ----------------------------------------------------------------
say "Building (heap ${HEAP}MB). This takes about 10 minutes…"
rm -f build.done build.fail
if NODE_OPTIONS="--max-old-space-size=${HEAP}" pnpm demo:build > build.log 2>&1; then
  BUILD_OK=1
else
  BUILD_OK=0
fi

restore() {
  say "RESTORING the previous working build…"
  if [ -d "$BAK" ] && [ -f "$BAK/server/index.mjs" ]; then
    rm -rf "$OUT"
    cp -a "$BAK" "$OUT"
    systemctl start apex
    sleep 6
    code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/auth/login-1)
    say "Rolled back. Site responded HTTP $code"
  else
    say "No backup available to restore. The site needs a successful build."
  fi
}

if [ "$BUILD_OK" != "1" ]; then
  say "BUILD FAILED — the site was not touched beyond this rollback."
  tail -5 build.log
  restore
  exit 1
fi

# --- 4. start and health-check ----------------------------------------------
say "Build succeeded. Starting the app…"
systemctl start apex
sleep 8

code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/auth/login-1)
if [ "$code" = "200" ] || [ "$code" = "302" ]; then
  say "Healthy — site responded HTTP $code"
  say "Stripe configuration after deploy:"
  bash "$APP_DIR/stripe-setup.sh" --check 2>/dev/null | sed 's/^/    /'
  say "Done. Previous build kept at $BAK in case you need it."
  exit 0
fi

say "The new build started but answered HTTP $code — treating that as a failure."
restore
exit 1
