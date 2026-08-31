<script setup lang="ts">
import type { ReplyPriority } from '~~/shared/support-eta'
import { DEFAULT_REPLY_TARGETS, onlinePillText, REPLY_PRIORITIES, replyTargetKey } from '~~/shared/support-eta'

/**
 * Admin — Platform settings (V2 Phase 9, `Admin - Team & Platform.dc.html` §5).
 *
 * The four panels the design draws hold the values a *client* can see, and
 * every one of them is read by a feature today:
 *
 * - Support promise (badge 27) — one number per priority, with a live
 *   preview of the exact sentence the client's Support page renders. Phase
 *   6 §6 found a hardcoded "15 min" in three components beside a
 *   config-driven pill; `shared/support-eta.ts` is now the single source
 *   both this preview and `/api/config` read, so they cannot disagree.
 * - Credit rules — the credit ceiling `ensureCredit()` applies, the
 *   24-month gate the New Order wizard and `/api/orders` check, and the
 *   first-instalment offset every new plan is built from.
 * - Sign-in & security (badge 29) — stated as real numbers read out of
 *   `utils/ratelimit.ts` and the reset endpoint, not the design's
 *   placeholders, and read-only because they are code, not settings.
 * - Company & documents — what actually prints on a financing agreement.
 *
 * Everything else the platform stores keeps its own section below, so
 * rebuilding this screen does not quietly remove admin control of the
 * payment rails or the maintenance banner.
 *
 * Owner-only: `platform.settings` is the one permission only Owner holds,
 * and `/api/admin/settings` enforces the same.
 */
definePageMeta({
  title: 'Platform settings',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()
const { can } = useStaffAccess()
const allowed = computed(() => can('platform.settings'))

// ------------------------------------------------------------- catalogue

interface SettingDef {
  key: string
  label: string
  hint?: string
  type: 'text' | 'number' | 'boolean' | 'select'
  options?: { value: string, label: string }[]
  default: string | number | boolean
  group: string
}

/**
 * The settings the four design panels own. Split out from the general
 * catalogue below because each of these has a dedicated control in the
 * design rather than a generic label-and-input row.
 */
const PANEL_DEFAULTS: SettingDef[] = [
  ...REPLY_PRIORITIES.map(p => ({
    key: replyTargetKey(p),
    label: p,
    type: 'number' as const,
    default: DEFAULT_REPLY_TARGETS[p],
    group: 'support',
  })),
  { key: 'credit.max-limit', label: 'Credit ceiling', type: 'number', default: 20_000, group: 'credit' },
  { key: 'finance.enable-24mo-plans', label: '24-month financing', type: 'boolean', default: true, group: 'finance' },
  { key: 'finance.first-installment-days', label: 'First instalment after', type: 'number', default: 30, group: 'finance' },
  { key: 'general.site-name', label: 'Trading name', type: 'text', default: 'Apex Digital Agency', group: 'general' },
  { key: 'general.support-email', label: 'Support email', type: 'text', default: 'support@apexdigi.co.uk', group: 'general' },
  { key: 'business.vat-rate', label: 'VAT rate', type: 'number', default: 20, group: 'business' },
]

/**
 * Everything else the platform stores. Kept from the previous version of
 * this page so no existing control is lost, restyled onto the Phase 9
 * card. The `hint` on each row says whether a feature reads it — an
 * honesty note the previous page already carried, and still true.
 */
interface SettingGroup { group: string, title: string, accent: string, items: SettingDef[] }

const otherGroups: SettingGroup[] = [
  {
    group: 'general',
    title: 'General',
    accent: 'bg-primary-500',
    items: [
      { key: 'general.maintenance-mode', label: 'Maintenance mode', hint: 'Live: shows a maintenance banner on every customer page.', type: 'boolean', default: false, group: 'general' },
      { key: 'general.default-locale', label: 'Default language', type: 'select', options: [{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }, { value: 'es', label: 'Español' }, { value: 'de', label: 'Deutsch' }, { value: 'ar', label: 'العربية' }, { value: 'ja', label: '日本語' }], default: 'en', group: 'general' },
    ],
  },
  {
    group: 'business',
    title: 'Company record',
    accent: 'bg-[#6EA8FE]',
    items: [
      { key: 'business.company-name', label: 'Registered company name', hint: 'Stored. Nothing prints it yet — the agreement uses the trading name above.', type: 'text', default: 'Apex Digital Agency Ltd', group: 'business' },
      { key: 'business.company-address', label: 'Registered address', hint: 'Stored. Needed once invoices exist (REQUIREMENTS §6).', type: 'text', default: 'London, United Kingdom', group: 'business' },
      { key: 'business.vat-number', label: 'VAT number', hint: 'Stored. Needed once invoices exist.', type: 'text', default: '', group: 'business' },
    ],
  },
  {
    group: 'finance',
    title: 'Withdrawals',
    accent: 'bg-[#22B07D]',
    items: [
      { key: 'finance.withdrawal-min', label: 'Minimum withdrawal (£)', hint: 'Live: served to the customer wallet through /api/config.', type: 'number', default: 25, group: 'finance' },
      { key: 'finance.withdrawal-max', label: 'Maximum withdrawal (£)', hint: 'Live: served to the customer wallet through /api/config.', type: 'number', default: 10_000, group: 'finance' },
    ],
  },
  {
    group: 'payments',
    title: 'Payment rails',
    accent: 'bg-[#6EA8FE]',
    items: [
      { key: 'payments.live-mode', label: 'Live mode', hint: 'Live: OFF forces sandbox. Even with live API keys installed, real money only moves when this is on.', type: 'boolean', default: false, group: 'payments' },
      { key: 'payments.provider.charge', label: 'Card & wallet payments', hint: 'Live: routes one-off charges. Falls back to the mock rail without credentials.', type: 'select', options: [{ value: 'stripe', label: 'Stripe' }, { value: 'paypal', label: 'PayPal' }, { value: 'mock', label: 'Mock (no real money)' }], default: 'stripe', group: 'payments' },
      { key: 'payments.provider.recurring', label: 'Instalment collection', hint: 'Live: routes scheduled collection. Bacs via GoCardless caps fees at £4.', type: 'select', options: [{ value: 'gocardless', label: 'GoCardless (Bacs Direct Debit)' }, { value: 'stripe', label: 'Stripe' }, { value: 'mock', label: 'Mock (no real money)' }], default: 'gocardless', group: 'payments' },
      { key: 'payments.provider.mandate', label: 'Direct debit mandates', hint: 'Live: which provider hosts the mandate authorisation flow.', type: 'select', options: [{ value: 'gocardless', label: 'GoCardless' }, { value: 'stripe', label: 'Stripe' }, { value: 'mock', label: 'Mock' }], default: 'gocardless', group: 'payments' },
      { key: 'payments.provider.payout', label: 'Withdrawals & payouts', hint: 'Live: routes money leaving the platform to customers.', type: 'select', options: [{ value: 'stripe', label: 'Stripe' }, { value: 'gocardless', label: 'GoCardless' }, { value: 'mock', label: 'Mock' }], default: 'stripe', group: 'payments' },
    ],
  },
  {
    group: 'support',
    title: 'Support handling',
    accent: 'bg-[#F2C14E]',
    items: [
      { key: 'support.default-priority', label: 'Default ticket priority', hint: 'Live: applied when a new request doesn\'t specify one.', type: 'select', options: [{ value: 'LOW', label: 'Low' }, { value: 'NORMAL', label: 'Normal' }, { value: 'HIGH', label: 'High' }], default: 'NORMAL', group: 'support' },
      { key: 'support.auto-close-days', label: 'Auto-close resolved after (days)', hint: '0 disables auto-closing.', type: 'number', default: 7, group: 'support' },
      { key: 'support.satisfaction-survey', label: 'Satisfaction survey', hint: 'Stored. Asks customers to rate resolved tickets once the survey ships.', type: 'boolean', default: false, group: 'support' },
    ],
  },
  {
    group: 'integrations',
    title: 'Integrations',
    accent: 'bg-[#EC6453]',
    items: [
      { key: 'integrations.webhook-url', label: 'Outbound webhook URL', hint: 'Stored. Fires once an event bus exists.', type: 'text', default: '', group: 'integrations' },
      { key: 'integrations.slack-webhook', label: 'Slack webhook', hint: 'Stored. For new-ticket and new-order alerts.', type: 'text', default: '', group: 'integrations' },
      { key: 'integrations.analytics-id', label: 'Analytics measurement ID', hint: 'Stored.', type: 'text', default: '', group: 'integrations' },
    ],
  },
]

const allDefs: SettingDef[] = [...PANEL_DEFAULTS, ...otherGroups.flatMap(g => g.items)]

type SettingValue = string | number | boolean

const values = reactive<Record<string, SettingValue>>({})
/** The last loaded state, so Discard restores rather than guessing. */
const loaded = reactive<Record<string, SettingValue>>({})

for (const def of allDefs) {
  values[def.key] = def.default
  loaded[def.key] = def.default
}

const { data, refresh } = await useFetch('/api/admin/settings', { immediate: allowed.value })

watch(data, (payload) => {
  for (const def of allDefs) {
    loaded[def.key] = def.default
    values[def.key] = def.default
  }
  for (const row of payload?.settings ?? []) {
    if (row.key in values) {
      loaded[row.key] = row.value as SettingValue
      values[row.key] = row.value as SettingValue
    }
  }
}, { immediate: true })

/** Only what actually differs is dirty, so Save can't be armed by a focus. */
const dirtyKeys = computed(() => allDefs.filter(d => values[d.key] !== loaded[d.key]).map(d => d.key))
const isDirty = computed(() => dirtyKeys.value.length > 0)

const lastSaved = computed(() => {
  const rows = data.value?.settings ?? []
  if (!rows.length) {
    return null
  }
  return rows.reduce((a, b) => (new Date(a.updatedAt) > new Date(b.updatedAt) ? a : b))
})

const footerText = computed(() => {
  if (isDirty.value) {
    const n = dirtyKeys.value.length
    return `${n} unsaved ${n === 1 ? 'change' : 'changes'}. Clients see the new values as soon as you save.`
  }
  if (lastSaved.value) {
    const when = new Date(lastSaved.value.updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')
    return `Everything saved. Last change: ${when}${lastSaved.value.updatedBy ? ` by ${lastSaved.value.updatedBy}` : ''}.`
  }
  return 'Everything saved.'
})

const saving = ref(false)

function discard() {
  for (const def of allDefs) {
    values[def.key] = loaded[def.key]!
  }
}

async function saveAll() {
  if (saving.value || !isDirty.value) {
    return
  }
  saving.value = true
  try {
    // Post everything, not just the dirty keys: the endpoint upserts and
    // audits only what actually changed, and sending the whole set keeps a
    // never-saved key from staying absent from the table forever.
    const settings = allDefs.map(def => ({
      key: def.key,
      value: def.type === 'number' ? Number(values[def.key]) || 0 : values[def.key]!,
      group: def.group,
    }))
    const result = await $fetch('/api/admin/settings', { method: 'PUT', body: { settings } })
    await refresh()
    toaster.add({
      title: 'Settings saved',
      description: result.updated > 0 ? `${result.updated} value(s) changed and audited.` : 'No values changed.',
      icon: 'lucide:check',
      progress: true,
    })
  }
  catch (error: any) {
    toaster.add({ title: 'Save failed', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    saving.value = false
  }
}

// -------------------------------------------------------- support promise

const PRIORITY_LABELS: Record<ReplyPriority, { label: string, hint: string }> = {
  urgent: { label: 'Urgent requests', hint: 'Client picks Urgent priority' },
  high: { label: 'High priority', hint: 'Client picks High' },
  normal: { label: 'Normal priority', hint: 'The default, and the one shown in the online pill' },
  low: { label: 'Low priority', hint: 'Client picks Low' },
}

/** The exact sentence `support.vue` renders, from the same function. */
const clientPreview = computed(() => onlinePillText(Number(values[replyTargetKey('normal')]) || 0))

function setEta(priority: ReplyPriority, raw: string) {
  const digits = raw.replace(/\D/g, '')
  values[replyTargetKey(priority)] = digits === '' ? 0 : Number(digits)
}

// ------------------------------------------------------- sign-in security

/**
 * Read-only, and stated as the numbers the code actually uses — the
 * design's own figures ("5 attempts per 15 minutes") do not match
 * `RateLimits.login`, which is 5 per *minute* with a 15-minute block, and
 * printing the mockup's numbers on a page operators consult when someone
 * cannot sign in would be worse than printing none. These are constants in
 * `utils/ratelimit.ts`, not settings, so there is nothing to edit here and
 * no input is offered.
 */
const securityRows = [
  { label: 'Failed sign-ins before lockout', hint: 'Counted per IP address and per identifier, over a rolling minute', value: '5 attempts', chip: false },
  { label: 'Lockout length', hint: 'The response tells the person how long is left', value: '15 minutes', chip: false },
  { label: 'Password reset link validity', hint: 'Single use — the token is burned when the password is set', value: '60 minutes', chip: false },
  { label: 'Session length', hint: 'Stateless JWT; changing a password does not end other sessions', value: '7 days', chip: false },
  { label: 'Two-factor authentication', hint: 'Authenticator app for staff and clients', value: 'Not built', chip: true },
]

const CARD = 'rounded-2xl border border-muted-200 bg-white p-5 dark:border-white/10 dark:bg-muted-800'
const CARD_TITLE = 'font-heading text-[16.5px] font-bold tracking-[-0.01em] text-muted-900 dark:text-white'
const CARD_SUB = 'mt-[7px] mb-4 text-[13px] leading-[1.55] text-muted-500'
const ROW = 'flex items-center gap-3.5 py-3.5'
const NUM_INPUT = 'font-heading h-11 rounded-xl border border-muted-200 bg-muted-50 px-3 text-right text-[15px] font-bold tabular-nums text-muted-900 outline-none focus:border-primary-400 dark:border-white/10 dark:bg-white/5 dark:text-white'
const TEXT_INPUT = 'w-full rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-2.5 text-sm text-muted-900 outline-none placeholder:text-muted-400 focus:border-primary-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500'
const GHOST_BTN = 'apex-focus inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-muted-200 bg-muted-100 px-[18px] text-[14.5px] font-semibold text-muted-800 transition-colors hover:bg-muted-200 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-6 pb-10 font-sans">
    <AdminAccessWall
      v-if="!allowed"
      permission="platform.settings"
      title="Platform settings are owner-only"
      body="These values change what every client sees — the reply promise, the credit ceiling and the financing terms — so only an owner can edit them."
    />

    <template v-else>
      <AdminPageHeader
        dense
        title="Platform settings"
        subtitle="Values the client-facing portal reads. Every one in the four panels below is used somewhere a client can see."
      />

      <div class="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-2">
        <!-- ============ SUPPORT PROMISE (badge 27) ============ -->
        <section :class="CARD" aria-label="Support promise">
          <div :class="CARD_TITLE">
            Support promise
          </div>
          <p :class="CARD_SUB">
            Shown on the client's Support page, in the new-request footer and in the Still-stuck card. One value, three places.
          </p>

          <div class="flex flex-col gap-3.5">
            <div v-for="p in REPLY_PRIORITIES" :key="p" class="flex items-center gap-3.5">
              <span class="min-w-0 flex-1">
                <label :for="`eta-${p}`" class="text-muted-900 block text-[13.5px] font-semibold dark:text-white">{{ PRIORITY_LABELS[p].label }}</label>
                <span class="text-muted-500 mt-[3px] block text-xs">{{ PRIORITY_LABELS[p].hint }}</span>
              </span>
              <span class="flex shrink-0 items-center gap-2.5">
                <input
                  :id="`eta-${p}`"
                  :value="values[replyTargetKey(p)]"
                  inputmode="numeric"
                  class="w-[78px]"
                  :class="NUM_INPUT"
                  @input="setEta(p, ($event.target as HTMLInputElement).value)"
                >
                <span class="text-muted-500 w-[38px] text-[13px]">mins</span>
              </span>
            </div>
          </div>

          <!--
            The live preview, built by the same function `/api/config` uses
            to serve the string. The operator reads the sentence the client
            will read, not a description of it.
          -->
          <div class="border-muted-200 bg-muted-50 mt-[18px] flex items-start gap-2.5 rounded-xl border p-3.5 dark:border-white/10 dark:bg-white/5">
            <Icon name="lucide:eye" class="text-primary-500 dark:text-primary-400 mt-px size-[17px] shrink-0" />
            <span class="text-muted-600 dark:text-muted-300 flex-1 text-[13px] leading-[1.6]">
              Clients currently see:
              <strong class="text-muted-900 font-semibold dark:text-white">&ldquo;{{ clientPreview }}&rdquo;</strong>
            </span>
          </div>
        </section>

        <!-- ============ CREDIT RULES ============ -->
        <section :class="CARD" aria-label="Credit rules">
          <div :class="CARD_TITLE">
            Credit rules
          </div>
          <p :class="CARD_SUB">
            The financing terms every new project is offered. Individual limits are still derived per client from what they already owe.
          </p>

          <div class="flex flex-col gap-3.5">
            <div class="flex items-center gap-3.5">
              <span class="min-w-0 flex-1">
                <label for="credit-limit" class="text-muted-900 block text-[13.5px] font-semibold dark:text-white">Credit ceiling per client</label>
                <span class="text-muted-500 mt-[3px] block text-xs">Live: the limit <code class="font-mono">ensureCredit()</code> applies to every credit line.</span>
              </span>
              <span class="flex shrink-0 items-center gap-1.5">
                <span class="font-heading text-muted-500 text-[15px] font-bold">£</span>
                <input
                  id="credit-limit"
                  v-model.number="values['credit.max-limit']"
                  inputmode="numeric"
                  class="w-[104px]"
                  :class="NUM_INPUT"
                >
              </span>
            </div>

            <div class="flex items-center gap-3.5">
              <span class="min-w-0 flex-1">
                <label for="first-inst" class="text-muted-900 block text-[13.5px] font-semibold dark:text-white">First instalment after</label>
                <span class="text-muted-500 mt-[3px] block text-xs">Live: sets the first due date on every new financing plan.</span>
              </span>
              <span class="flex shrink-0 items-center gap-2.5">
                <input
                  id="first-inst"
                  v-model.number="values['finance.first-installment-days']"
                  inputmode="numeric"
                  class="w-[78px]"
                  :class="NUM_INPUT"
                >
                <span class="text-muted-500 w-[38px] text-[13px]">days</span>
              </span>
            </div>

            <!--
              Deliberate deviation. The mockup offers 3 / 6 / 12 / 24 / 36
              months as a free selection, but ADR-011 fixes the pricing for
              exactly two terms — 12 months at 0% and 24 months amortised at
              1%/month — and nothing can price the other three. Offering
              them would let an owner switch on a term the wizard cannot
              quote, which is the "control with nothing behind it" this
              project keeps removing. 12 months is the base product and
              always available; 24 is the one real toggle, and it is the
              same setting `/api/orders` checks before accepting the term.
            -->
            <div class="border-muted-200 border-t pt-3.5 dark:border-white/10">
              <span class="text-muted-900 block text-[13.5px] font-semibold dark:text-white">Instalment terms offered</span>
              <span class="text-muted-500 mb-2.5 mt-[3px] block text-xs leading-[1.45]">
                Only terms with locked pricing can be offered (ADR-011). A service can offer a subset of these, never more.
              </span>
              <div class="flex flex-wrap items-center gap-2">
                <span class="bg-primary-500 inline-flex min-h-[42px] items-center rounded-full px-4 text-[13.5px] font-bold text-white">
                  12 months · 0%
                </span>
                <button
                  type="button"
                  :aria-pressed="Boolean(values['finance.enable-24mo-plans'])"
                  class="apex-focus inline-flex min-h-[42px] cursor-pointer items-center rounded-full border px-4 text-[13.5px] transition-colors"
                  :class="values['finance.enable-24mo-plans']
                    ? 'border-primary-500 bg-primary-500 font-bold text-white'
                    : 'border-muted-200 bg-muted-50 font-semibold text-muted-700 hover:bg-muted-100 dark:border-white/10 dark:bg-white/5 dark:text-muted-300 dark:hover:bg-white/10'"
                  @click="values['finance.enable-24mo-plans'] = !values['finance.enable-24mo-plans']"
                >
                  24 months · 1%/mo
                </button>
              </div>
              <p class="text-muted-500 mt-2.5 text-xs leading-[1.45]">
                12 months is the base product and cannot be switched off — every plan falls back to it.
              </p>
            </div>

            <!--
              The mockup's "Hold deliverables until fully paid" switch is
              not rendered. There is no deliverables feature in this
              codebase — no `DeliverableRelease` model and no handover
              screen — so the toggle would store a boolean nothing reads,
              which is exactly the `twoFactor` field Phase 7 deleted from
              Settings. It arrives with the Overview & Work file.
            -->
            <div class="border-muted-200 flex items-center gap-3.5 border-t pt-3.5 dark:border-white/10">
              <span class="min-w-0 flex-1">
                <span class="text-muted-900 block text-[13.5px] font-semibold dark:text-white">Hold deliverables until fully paid</span>
                <span class="text-muted-500 mt-[3px] block text-xs leading-[1.45]">
                  There is no deliverable handover in the panel yet, so there is nothing for this rule to govern. It arrives with project deliverables.
                </span>
              </span>
              <span class="bg-muted-200 text-muted-600 dark:text-muted-400 shrink-0 rounded-full px-2.5 py-[5px] text-[10.5px] font-extrabold uppercase tracking-[0.04em] dark:bg-white/5">
                Not built
              </span>
            </div>
          </div>
        </section>

        <!-- ============ SIGN-IN & SECURITY (badge 29) ============ -->
        <section :class="CARD" aria-label="Sign-in and security">
          <div :class="CARD_TITLE">
            Sign-in &amp; security
          </div>
          <p :class="CARD_SUB">
            Applies to client and staff sign-in. These are constants in the auth code rather than settings, so they are stated here and changed in a deploy.
          </p>
          <div class="flex flex-col">
            <div
              v-for="(row, index) in securityRows"
              :key="row.label"
              :class="[ROW, index < securityRows.length - 1 ? 'border-muted-200 border-b dark:border-white/5' : '']"
            >
              <span class="min-w-0 flex-1">
                <span class="text-muted-900 block text-[13.5px] font-semibold dark:text-white">{{ row.label }}</span>
                <span class="text-muted-500 mt-[3px] block text-xs leading-[1.45]">{{ row.hint }}</span>
              </span>
              <span
                v-if="row.chip"
                class="bg-muted-200 text-muted-600 dark:text-muted-400 shrink-0 rounded-full px-2.5 py-[5px] text-[10.5px] font-extrabold uppercase tracking-[0.04em] dark:bg-white/5"
              >{{ row.value }}</span>
              <span
                v-else
                class="font-heading text-muted-900 shrink-0 text-[15px] font-bold tabular-nums dark:text-white"
              >{{ row.value }}</span>
            </div>
          </div>
        </section>

        <!-- ============ COMPANY & DOCUMENTS ============ -->
        <section :class="CARD" aria-label="Company and documents">
          <div :class="CARD_TITLE">
            Company &amp; documents
          </div>
          <p :class="CARD_SUB">
            What prints on the financing agreement a client signs, and where they are told to write to.
          </p>
          <div class="flex flex-col gap-3.5">
            <div>
              <label for="site-name" class="text-muted-900 mb-1.5 block text-[13.5px] font-semibold dark:text-white">Trading name</label>
              <input id="site-name" v-model="values['general.site-name']" :class="TEXT_INPUT">
              <p class="text-muted-500 mt-1.5 text-xs leading-[1.45]">
                Live: printed as the agency on every financing agreement.
              </p>
            </div>
            <div>
              <label for="support-email" class="text-muted-900 mb-1.5 block text-[13.5px] font-semibold dark:text-white">Support email</label>
              <input id="support-email" v-model="values['general.support-email']" type="email" :class="TEXT_INPUT">
              <p class="text-muted-500 mt-1.5 text-xs leading-[1.45]">
                Live: shown to clients on the Support page and on error states.
              </p>
            </div>
            <div>
              <label for="vat-rate" class="text-muted-900 mb-1.5 block text-[13.5px] font-semibold dark:text-white">VAT rate (%)</label>
              <input id="vat-rate" v-model.number="values['business.vat-rate']" inputmode="numeric" class="w-[104px]" :class="NUM_INPUT">
              <p class="text-muted-500 mt-1.5 text-xs leading-[1.45]">
                Live: used in the agreement's totals.
              </p>
            </div>
            <p class="border-muted-200 text-muted-500 border-t pt-3.5 text-xs leading-[1.5] dark:border-white/10">
              The registered company name, address and VAT number live in <strong class="text-muted-700 dark:text-muted-300">Company record</strong> below. Nothing prints them yet — there is no invoice document in the platform (REQUIREMENTS §6).
            </p>
          </div>
        </section>
      </div>

      <!-- ================== EVERYTHING ELSE THE PLATFORM STORES ================== -->
      <section class="mt-2" aria-label="Other platform configuration">
        <div class="mb-3 flex flex-wrap items-center gap-[11px]">
          <ApexSectionLabel>Other configuration</ApexSectionLabel>
          <span class="grow" />
          <span class="text-muted-500 text-[12.5px]">Not drawn in the design, kept so no existing control is lost</span>
        </div>

        <div class="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-2">
          <section v-for="group in otherGroups" :key="group.group" :class="CARD" :aria-label="group.title">
            <h2 class="text-muted-500 mb-4 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.06em]">
              <span aria-hidden="true" class="h-[15px] w-[3px] rounded-full" :class="group.accent" />{{ group.title }}
            </h2>

            <div class="flex flex-col gap-4">
              <div v-for="item in group.items" :key="item.key">
                <!-- boolean -> switch row -->
                <div
                  v-if="item.type === 'boolean'"
                  class="border-muted-200 bg-muted-50 flex items-center justify-between gap-4 rounded-xl border px-3.5 py-3 dark:border-white/10 dark:bg-white/5"
                >
                  <div class="min-w-0">
                    <div class="text-muted-900 text-[13.5px] font-semibold dark:text-white">
                      {{ item.label }}
                    </div>
                    <div v-if="item.hint" class="text-muted-500 mt-0.5 text-xs leading-[1.45]">
                      {{ item.hint }}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="Boolean(values[item.key])"
                    :aria-label="item.label"
                    class="apex-focus relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition"
                    :class="values[item.key] ? 'bg-[#22B07D]' : 'bg-muted-300 dark:bg-white/10'"
                    @click="values[item.key] = !values[item.key]"
                  >
                    <span class="absolute top-0.5 size-5 rounded-full bg-white shadow transition-all" :class="values[item.key] ? 'left-[22px]' : 'left-0.5'" />
                  </button>
                </div>

                <template v-else>
                  <!--
                    A real `<label for>` only where there is an element with
                    that id to point at. `BaseSelect` does not forward `id`
                    to its trigger, so a label pointing at `setting-<key>`
                    would be a dangling reference — worse than no label,
                    which is the same finding as Phase 1 Mobile's dangling
                    `aria-describedby` on the sheets. The select is named by
                    its own `aria-label` instead.
                  -->
                  <label
                    v-if="item.type !== 'select'"
                    :for="`setting-${item.key}`"
                    class="text-muted-900 mb-2 block text-[12.5px] font-semibold dark:text-white"
                  >
                    {{ item.label }}
                  </label>
                  <span v-else class="text-muted-900 mb-2 block text-[12.5px] font-semibold dark:text-white" aria-hidden="true">
                    {{ item.label }}
                  </span>
                  <!--
                    `BaseSelect` rather than a native `<select>`: on a dark
                    surface the OS popup renders white-on-black and CSS
                    cannot reach it (Phase 3 §2).
                  -->
                  <!--
                    Bound explicitly rather than with `v-model`: an indexed
                    read off the values record is `SettingValue | undefined`,
                    which the select's model type rejects. Every select value
                    here is a string, so it is narrowed on the way in and out.
                  -->
                  <BaseSelect
                    v-if="item.type === 'select'"
                    :model-value="String(values[item.key] ?? '')"
                    rounded="lg"
                    :aria-label="item.label"
                    class="dark:bg-muted-700! h-11! w-full! rounded-xl! dark:border-white/10! dark:text-white!"
                    :classes="{ text: 'text-[13.5px]' }"
                    @update:model-value="values[item.key] = String($event ?? '')"
                  >
                    <BaseSelectItem v-for="opt in item.options" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </BaseSelectItem>
                  </BaseSelect>
                  <input
                    v-else
                    :id="`setting-${item.key}`"
                    v-model="values[item.key]"
                    :type="item.type === 'number' ? 'number' : 'text'"
                    :class="TEXT_INPUT"
                  >
                  <p v-if="item.hint" class="text-muted-500 mt-1.5 text-xs leading-[1.45]">
                    {{ item.hint }}
                  </p>
                </template>
              </div>
            </div>
          </section>

          <!-- Currency is locked by decision (ADR-005); shown so its absence isn't read as an oversight. -->
          <section :class="CARD" aria-label="Currency">
            <h2 class="text-muted-500 mb-4 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.06em]">
              <span aria-hidden="true" class="bg-primary-200 h-[15px] w-[3px] rounded-full" />Currency
            </h2>
            <div class="border-muted-200 bg-muted-50 flex items-center gap-4 rounded-xl border px-4 py-3.5 dark:border-white/10 dark:bg-white/5">
              <span class="bg-primary-500/14 font-heading text-primary-600 dark:text-primary-400 flex size-10 items-center justify-center rounded-xl text-lg font-extrabold">£</span>
              <div>
                <div class="text-muted-900 text-[13.5px] font-semibold dark:text-white">
                  GBP — British Pound
                </div>
                <div class="text-muted-500 mt-0.5 text-xs">
                  Fixed platform-wide (ADR-005). All amounts format through useCurrency().
                </div>
              </div>
              <Icon name="lucide:lock" class="text-muted-400 ms-auto size-4 shrink-0" />
            </div>
          </section>
        </div>
      </section>

      <!-- ==================== ONE DIRTY-STATE FOOTER ==================== -->
      <div class="border-muted-200 dark:bg-muted-800 sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-[18px] shadow-[0_-8px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
        <span class="text-muted-600 dark:text-muted-300 min-w-0 flex-1 text-[13px] leading-[1.5]">{{ footerText }}</span>
        <button v-if="isDirty" type="button" :class="GHOST_BTN" @click="discard">
          Discard
        </button>
        <BaseButton rounded="lg" size="lg" variant="primary" :disabled="!isDirty || saving" :loading="saving" @click="saveAll">
          Save settings
        </BaseButton>
      </div>
    </template>
  </div>
</template>
