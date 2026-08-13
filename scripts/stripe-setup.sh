#!/usr/bin/env bash
# ============================================================================
#  Apex Digi — Stripe configuration helper
# ============================================================================
#  Run on the server:   sudo bash /opt/apex/stripe-setup.sh
#
#  It asks for your Stripe keys and writes them to /opt/apex/.env.production,
#  then restarts the app. The secret values are typed by YOU, directly into
#  this terminal — they are never displayed, never logged, and never leave
#  this machine.
#
#  Re-runnable any time (e.g. after rotating a key): it replaces the existing
#  values rather than duplicating them.
#
#  Check current status WITHOUT revealing anything:
#      sudo bash /opt/apex/stripe-setup.sh --check
# ============================================================================
set -u

ENV_FILE="/opt/apex/.env.production"

# --- Write (or replace) one KEY=value line in the env file ------------------
set_env() {
  local key="$1" value="$2"
  touch "$ENV_FILE"
  # Drop any existing definition, then append the new one.
  grep -v "^${key}=" "$ENV_FILE" > "${ENV_FILE}.tmp" 2>/dev/null || true
  mv "${ENV_FILE}.tmp" "$ENV_FILE"
  printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
}

# --- Report configuration state, showing only safe fingerprints -------------
status() {
  echo "Stripe configuration in $ENV_FILE:"
  for key in NUXT_PAYMENTS_STRIPE_SECRET_KEY NUXT_PAYMENTS_STRIPE_WEBHOOK_SECRET NUXT_PUBLIC_PAYMENTS_STRIPE_PUBLISHABLE_KEY; do
    line=$(grep "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1)
    value="${line#*=}"
    if [ -z "$line" ] || [ -z "$value" ]; then
      printf '  %-46s NOT SET\n' "$key"
    else
      # Show only the key TYPE and length — never the secret itself.
      prefix=$(printf '%s' "$value" | cut -c1-8)
      printf '  %-46s set (%s…, %s chars)\n' "$key" "$prefix" "${#value}"
    fi
  done
  echo
  echo "Service: $(systemctl is-active apex 2>/dev/null || echo unknown)"
}

if [ "${1:-}" = "--check" ]; then
  status
  exit 0
fi

echo "==========================================================="
echo " Apex Digi — connect Stripe"
echo "==========================================================="
echo
echo "You'll paste three values from your Stripe Dashboard."
echo "The two secret ones stay hidden as you type/paste — that's normal."
echo "Press Enter without typing to KEEP the current value."
echo

# --- 1. Publishable key (public by design, shown as you type) ---------------
echo "1/3  Publishable key  — Stripe → Developers → API keys"
echo "     Starts with pk_live_ (or pk_test_)"
read -r -p "     Paste it here: " PK
echo

# --- 2. Secret key (hidden) -------------------------------------------------
echo "2/3  Secret key  — same page, click 'Reveal'"
echo "     Starts with sk_live_ (or sk_test_).  [input hidden]"
read -r -s -p "     Paste it here: " SK
echo
echo

# --- 3. Webhook signing secret (hidden) -------------------------------------
echo "3/3  Webhook signing secret"
echo "     Stripe → Developers → Webhooks → your endpoint"
echo "     (the one for https://panel.apexdigi.co.uk/api/webhooks/stripe"
echo "      with payload style 'Snapshot') → 'Signing secret'"
echo "     Starts with whsec_.  [input hidden]"
read -r -s -p "     Paste it here: " WH
echo
echo

# --- Validate before writing anything ---------------------------------------
fail=0
if [ -n "$PK" ] && ! printf '%s' "$PK" | grep -qE '^pk_(live|test)_'; then
  echo "  ✗ That publishable key doesn't start with pk_live_ / pk_test_."; fail=1
fi
if [ -n "$SK" ] && ! printf '%s' "$SK" | grep -qE '^(sk|rk)_(live|test)_'; then
  echo "  ✗ That secret key doesn't start with sk_live_ / sk_test_."; fail=1
fi
if [ -n "$WH" ] && ! printf '%s' "$WH" | grep -qE '^whsec_'; then
  echo "  ✗ That signing secret doesn't start with whsec_."; fail=1
fi
if [ "$fail" = "1" ]; then
  echo
  echo "Nothing was changed. Re-run the command and try again."
  exit 1
fi

# --- Write ------------------------------------------------------------------
[ -n "$PK" ] && set_env NUXT_PUBLIC_PAYMENTS_STRIPE_PUBLISHABLE_KEY "$PK"
[ -n "$SK" ] && set_env NUXT_PAYMENTS_STRIPE_SECRET_KEY "$SK"
[ -n "$WH" ] && set_env NUXT_PAYMENTS_STRIPE_WEBHOOK_SECRET "$WH"

chmod 600 "$ENV_FILE"
chown root:root "$ENV_FILE" 2>/dev/null || true

# Clear the values from this shell's memory as soon as they're written.
unset PK SK WH

echo "Saved. Restarting the app…"
systemctl restart apex
sleep 4
echo
status
echo
echo "==========================================================="
echo " Done. Next step: sign in to the panel as an administrator,"
echo " go to  Admin → Settings  and turn ON  'payments.live-mode'."
echo " Until that is on, Apex refuses to move real money — this is"
echo " a deliberate safety catch."
echo "==========================================================="
