#!/usr/bin/env bash
# ============================================================================
#  Apex Digi — install deploy/Caddyfile on the server (ADR-023)
# ============================================================================
#  Usage, from the repo root:
#
#      bash scripts/ship-caddy.sh            # install and reload
#      bash scripts/ship-caddy.sh --check    # validate on the server, change nothing
#
#  What it does, in one ssh session:
#    1. uploads deploy/Caddyfile and scripts/cloudflare-ips.sh;
#    2. generates /etc/caddy/cloudflare-ips.caddy (the Cloudflare ranges the
#       Caddyfile imports) and validates the pair in a scratch directory, so a
#       bad file never reaches /etc/caddy;
#    3. backs up the live Caddyfile beside itself with a timestamp, installs
#       the new one, reloads Caddy (a reload keeps every connection and every
#       certificate), and checks both apps answer through it;
#    4. installs a weekly systemd timer that refreshes the Cloudflare ranges.
#
#  Run this BEFORE proxying any DNS record through Cloudflare
#  (`node scripts/cloudflare-apply.mjs --apply`): once records are proxied the
#  apps see Cloudflare's addresses unless this Caddyfile is in place.
# ============================================================================
set -uo pipefail

HOST="${APEX_HOST:-root@146.19.130.11}"
KEY="${APEX_KEY:-$HOME/.ssh/apex_deploy}"
MODE="${1:-}"

say() { printf '\n[ship-caddy] %s\n' "$*"; }
die() { printf '\n[ship-caddy] ERROR: %s\n' "$*" >&2; exit 1; }

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
[ -f "$KEY" ] && SSH_OPTS+=(-i "$KEY")

[ -f deploy/Caddyfile ] || die "Run this from the repo root."
[ -f scripts/cloudflare-ips.sh ] || die "scripts/cloudflare-ips.sh is missing."
case "$MODE" in ''|--check) ;; *) die "Unknown option: $MODE" ;; esac

STAMP="$(date +%Y%m%d-%H%M%S)"
say "Uploading the Caddyfile and the Cloudflare range script…"

tar -czf - deploy/Caddyfile scripts/cloudflare-ips.sh \
| ssh "${SSH_OPTS[@]}" "$HOST" "
set -u
MODE='$MODE'
STAMP='$STAMP'
WORK=/tmp/apex-caddy-\$STAMP
mkdir -p \"\$WORK\" && tar -xzf - -C \"\$WORK\" || { echo '[server] upload failed'; exit 21; }
# Files come from a Windows checkout; Caddy and bash both want LF.
sed -i 's/\r\$//' \"\$WORK/deploy/Caddyfile\" \"\$WORK/scripts/cloudflare-ips.sh\"

echo '[server] fetching the Cloudflare ranges…'
CF_IPS_FILE=\"\$WORK/cloudflare-ips.caddy\" bash \"\$WORK/scripts/cloudflare-ips.sh\" --no-reload || exit 22

# Validate against the scratch copy of the ranges file, not the live one.
sed \"s#/etc/caddy/cloudflare-ips.caddy#\$WORK/cloudflare-ips.caddy#\" \"\$WORK/deploy/Caddyfile\" > \"\$WORK/Caddyfile.test\"
if ! caddy validate --config \"\$WORK/Caddyfile.test\" --adapter caddyfile > \"\$WORK/validate.log\" 2>&1; then
  echo '[server] the new Caddyfile does not validate:'; tail -5 \"\$WORK/validate.log\"; exit 23
fi
echo '[server] new Caddyfile validates'

if [ \"\$MODE\" = '--check' ]; then
  echo '[server] --check: nothing installed. Differences from the live file:'
  diff -u /etc/caddy/Caddyfile \"\$WORK/deploy/Caddyfile\" || true
  rm -rf \"\$WORK\"
  exit 0
fi

install -m 0644 \"\$WORK/cloudflare-ips.caddy\" /etc/caddy/cloudflare-ips.caddy
install -m 0755 \"\$WORK/scripts/cloudflare-ips.sh\" /usr/local/bin/apex-cloudflare-ips
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.\$STAMP
install -m 0644 \"\$WORK/deploy/Caddyfile\" /etc/caddy/Caddyfile
echo \"[server] installed; previous file kept at /etc/caddy/Caddyfile.bak.\$STAMP\"

if ! systemctl reload caddy; then
  echo '[server] reload failed — restoring the previous Caddyfile'
  cp /etc/caddy/Caddyfile.bak.\$STAMP /etc/caddy/Caddyfile
  systemctl reload caddy
  exit 24
fi
sleep 2
for h in 146-19-130-11.sslip.io site.146-19-130-11.sslip.io; do
  code=\$(curl -s -o /dev/null -m 20 -w '%{http_code}' \"https://\$h/\")
  echo \"[server] https://\$h/ -> \$code\"
  case \"\$code\" in 200|30[0-9]) ;; *) echo '[server] a preview host stopped answering — restoring the previous Caddyfile'; cp /etc/caddy/Caddyfile.bak.\$STAMP /etc/caddy/Caddyfile; systemctl reload caddy; exit 25 ;; esac
done

cat > /etc/systemd/system/apex-cloudflare-ips.service <<'UNIT'
[Unit]
Description=Refresh the Cloudflare address ranges Caddy trusts
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/apex-cloudflare-ips
UNIT
cat > /etc/systemd/system/apex-cloudflare-ips.timer <<'UNIT'
[Unit]
Description=Weekly refresh of the Cloudflare address ranges Caddy trusts

[Timer]
OnCalendar=Mon 04:30
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now apex-cloudflare-ips.timer > /dev/null 2>&1
echo \"[server] weekly range refresh: \$(systemctl is-active apex-cloudflare-ips.timer)\"
rm -rf \"\$WORK\"
echo '[server] done'
"
rc=$?
case $rc in
  0) if [ "$MODE" = "--check" ]; then say "Validated on the server; nothing was changed."; else say "Caddy is serving the new configuration."; fi ;;
  21) die "Upload failed." ;;
  22) die "Could not fetch Cloudflare's address lists on the server." ;;
  23) die "The new Caddyfile does not validate; nothing was changed." ;;
  24) die "Caddy refused the reload; the previous Caddyfile was restored." ;;
  25) die "A preview host stopped answering; the previous Caddyfile was restored." ;;
  *) die "ssh exited with $rc." ;;
esac
