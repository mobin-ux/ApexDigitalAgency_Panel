<script setup lang="ts">
/**
 * Wallet & Credit — Apex Design redesign.
 * Four tabs (Overview / Transactions / Installments / Banking) plus a Top-up
 * modal and an Apply-for-credit modal, on the dark navy (.apex-dark) surface
 * with electric-violet accents and Yellix display headings.
 *
 * Real data throughout:
 *  - Cash balance, cards, ad credits, credit line → /api/finance/dashboard
 *  - Transaction feed (top-ups/payments/…)        → /api/finance/transactions
 *  - Installment plans + upcoming payments        → /api/orders (real
 *    `installmentPlan` rows; charged via /api/finance/installments/:id/pay)
 *  - Saved payment instruments                    → /api/finance/payment-methods
 *  - Top-ups and new instruments                  → <WalletTopUp> → hosted
 *    provider flow (PCI SAQ-A, ADR-015)
 *  - Bank details, VAT rate, finance terms        → /api/config
 *
 * Remaining TODO(api): downloadable receipts (no endpoint yet — the button is
 * absent rather than lying), VAT invoices (no Invoice model — see `receipts`),
 * and the billing address / VAT number fields.
 */
import { computed, ref } from 'vue'

definePageMeta({
  title: 'Wallet & credit',
  layout: 'sidenav',
  middleware: 'auth',
})

const { user } = useUser()
const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()

// ---- fetches --------------------------------------------------------------
const { data: finance, refresh: refreshFinance } = await useFetch('/api/finance/dashboard', { lazy: true })
const { data: txData, refresh: refreshTx } = await useFetch('/api/finance/transactions', { lazy: true })
const { data: ordersData, refresh: refreshOrders } = await useFetch('/api/orders', { lazy: true })

// ---- types + helpers ------------------------------------------------------
type IconKind = 'web' | 'mkt' | 'uiux' | 'brand'
type TxKind = 'topup' | 'installment' | 'refund' | 'credit' | 'out'

const SVC_META: Record<IconKind, { icon: string, bg: string, text: string }> = {
  web: { icon: 'lucide:code-2', bg: 'bg-primary-500/14', text: 'text-primary-400' },
  mkt: { icon: 'lucide:megaphone', bg: 'bg-[#EC6453]/14', text: 'text-[#EC6453]' },
  uiux: { icon: 'lucide:pen-tool', bg: 'bg-primary-500/14', text: 'text-primary-400' },
  brand: { icon: 'lucide:target', bg: 'bg-[#D9A521]/14', text: 'text-[#F2C14E]' },
}

const TX_META: Record<TxKind, { icon: string, bg: string, text: string }> = {
  topup: { icon: 'lucide:arrow-up', bg: 'bg-[#22B07D]/14', text: 'text-[#22B07D]' },
  refund: { icon: 'lucide:undo-2', bg: 'bg-[#22B07D]/14', text: 'text-[#22B07D]' },
  credit: { icon: 'lucide:zap', bg: 'bg-primary-500/14', text: 'text-primary-400' },
  installment: { icon: 'lucide:arrow-down', bg: 'bg-[#6EA8FE]/14', text: 'text-[#6EA8FE]' },
  out: { icon: 'lucide:arrow-down', bg: 'bg-[#6EA8FE]/14', text: 'text-[#6EA8FE]' },
}

function iconKind(category: string): IconKind {
  const c = (category || '').toLowerCase()
  if (c.includes('seo') || c.includes('market') || c.includes('ads'))
    return 'mkt'
  if (c.includes('ui') || c.includes('ux') || (c.includes('design') && !c.includes('brand')))
    return 'uiux'
  if (c.includes('brand'))
    return 'brand'
  return 'web'
}

function txKind(type: string, amount: number): TxKind {
  const t = (type || '').toUpperCase()
  if (t === 'DEPOSIT' || (amount > 0 && t !== 'REFUND'))
    return 'topup'
  if (t === 'REFUND')
    return 'refund'
  if (t === 'AD_CREDIT' || t === 'CREDIT')
    return 'credit'
  if (t === 'PAYMENT' || t === 'INSTALLMENT')
    return 'installment'
  return 'out'
}

function shortId(id: string) {
  return String(id).replace(/-/g, '').slice(0, 8).toUpperCase()
}

function fmtDate(v: string | Date | null | undefined, fallback = 'TBD') {
  if (!v)
    return fallback
  return new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function addMonths(base: Date, n: number) {
  const d = new Date(base)
  d.setMonth(d.getMonth() + n)
  return d
}

/** Signed money string using the design's + / − (U+2212) prefixes. */
function signed(n: number) {
  const prefix = n < 0 ? '−' : n > 0 ? '+' : ''
  return prefix + formatCurrency(Math.abs(n))
}

// ---- core real data -------------------------------------------------------
const balance = computed(() => (finance.value as any)?.balanceOverview?.cash ?? 0)
const cards = computed(() => ((finance.value as any)?.cards ?? []) as any[])
const rawTx = computed(() => ((txData.value as any)?.transactions ?? []) as any[])

// ---- tabs -----------------------------------------------------------------
const TAB_DEFS = [
  ['overview', 'Overview'],
  ['transactions', 'Transactions'],
  ['installments', 'Installments'],
  ['banking', 'Banking'],
] as const
const tab = ref<'overview' | 'transactions' | 'installments' | 'banking'>('overview')

function goTab(next: typeof tab.value) {
  tab.value = next
  if (import.meta.client)
    window.scrollTo({ top: 0 })
}

// ---- transactions ---------------------------------------------------------
interface UiTx { id: string, title: string, sub: string, date: string, amount: number, kind: TxKind }

/**
 * Human labels for the ledger's `type` enum. Lower-casing the raw value turned
 * `AD_CREDIT` into "Ad_credit" on screen; anything unmapped falls back to a
 * neutral word rather than leaking the enum.
 */
const TX_LABEL: Record<string, string> = {
  DEPOSIT: 'Top-up',
  PAYMENT: 'Payment',
  INSTALLMENT: 'Installment',
  REFUND: 'Refund',
  WITHDRAWAL: 'Withdrawal',
  AD_CREDIT: 'Ad credit',
  CREDIT: 'Credit',
  CREDIT_REPAY: 'Credit repayment',
}

const allTx = computed<UiTx[]>(() =>
  rawTx.value.map((t) => {
    const kind = txKind(t.type, t.amount)
    return {
      id: t.id,
      title: t.description || (t.amount > 0 ? 'Wallet top-up' : 'Payment'),
      sub: TX_LABEL[String(t.type ?? '').toUpperCase()] ?? 'Transaction',
      date: fmtDate(t.date),
      amount: t.amount,
      kind,
    }
  }),
)

const TX_FILTERS = [
  ['all', 'All'],
  ['topup', 'Top-ups'],
  ['installment', 'Installments'],
  ['refund', 'Refunds'],
  ['credit', 'Credit'],
] as const
const txFilter = ref<'all' | TxKind>('all')
const txQ = ref('')

const txRows = computed(() => {
  const needle = txQ.value.trim().toLowerCase()
  return allTx.value.filter((t) => {
    if (txFilter.value !== 'all' && t.kind !== txFilter.value)
      return false
    if (needle && !(t.title.toLowerCase().includes(needle) || t.sub.toLowerCase().includes(needle) || t.date.toLowerCase().includes(needle)))
      return false
    return true
  })
})
const recentTx = computed(() => allTx.value.slice(0, 4))
const txEmptyMsg = computed(() =>
  txQ.value.trim()
    ? `Nothing matches “${txQ.value}”. Try a different search or filter.`
    : 'Your top-ups, payments and refunds will appear here.',
)

// ---- installment plans (DERIVED from projects — consistent with My Orders) -
interface Row { n: number, label: string, date: string, amount: number, state: 'paid' | 'next' | 'scheduled', dueSoon: boolean }
interface Plan {
  id: string
  shortId: string
  name: string
  service: string
  icon: IconKind
  status: 'active' | 'completed'
  total: number
  paid: number
  amount: number
  dueSoon: boolean
  nextLabel: string | null
  rows: Row[]
}

// Real Installment rows (linked to projects) — created by the New Order
// wizard, charged via /api/finance/installments/:id/pay. `Plan.id` is the
// installment-plan id, which is what the Pay button posts to.
const plans = computed<Plan[]>(() => {
  const rows = (ordersData.value as any)?.data ?? []
  return rows
    .filter((o: any) => o.installmentPlan)
    .map((o: any): Plan => {
      const p = o.installmentPlan
      const total = p.monthsTotal
      const completed = p.status === 'settled' || p.monthsPaid >= total
      const paid = Math.min(total, p.monthsPaid)
      const amount = Math.max(1, Math.round(p.monthlyAmount || p.amountDue || 0))
      const nextDue = new Date(p.nextDue)
      const dueInDays = completed ? null : Math.ceil((nextDue.getTime() - Date.now()) / 86_400_000)
      const dueSoon = !completed && dueInDays != null && dueInDays >= 0 && dueInDays <= 5

      // Schedule dates anchored on the real next due date: installment i
      // (0-based) falls (i − paid) months from nextDue.
      const planRows: Row[] = []
      for (let i = 0; i < total; i++) {
        const isPaid = i < paid
        const isNext = !completed && i === paid
        planRows.push({
          n: i + 1,
          label: `Installment ${i + 1} of ${total}`,
          date: fmtDate(addMonths(nextDue, i - paid)),
          amount,
          state: isPaid ? 'paid' : isNext ? 'next' : 'scheduled',
          dueSoon: isNext && dueSoon,
        })
      }
      const nextRow = planRows.find(r => r.state === 'next')
      return {
        id: p.id,
        shortId: shortId(o.id),
        name: o.name,
        service: o.category || 'General',
        icon: iconKind(o.category),
        status: completed ? 'completed' : 'active',
        total,
        paid,
        amount,
        dueSoon,
        nextLabel: completed ? null : dueSoon ? `Due in ${dueInDays} day${dueInDays === 1 ? '' : 's'}` : nextRow ? nextRow.date : null,
        rows: planRows,
      }
    })
})

const expanded = ref<Record<string, boolean>>({})
function togglePlan(id: string) {
  expanded.value = { ...expanded.value, [id]: !expanded.value[id] }
}
// open the first plan by default once data lands
watchEffect(() => {
  if (plans.value.length && Object.keys(expanded.value).length === 0)
    expanded.value = { [plans.value[0]!.id]: true }
})

// ---- overview: upcoming payments -----------------------------------------
const upcoming = computed(() =>
  plans.value
    .filter(p => p.status === 'active')
    .map((p) => {
      const next = p.rows.find(r => r.state === 'next')
      return {
        id: p.id,
        name: p.name,
        sub: `Installment ${p.paid + 1} of ${p.total}`,
        amount: p.amount,
        date: p.nextLabel || (next ? next.date : 'Next cycle'),
        dueSoon: p.dueSoon,
        icon: p.icon,
      }
    })
    .sort((a, b) => Number(b.dueSoon) - Number(a.dueSoon)),
)

// ---- credit line (real CreditLine record from /api/finance/dashboard) -----
const creditLine = computed<any>(() => (finance.value as any)?.credit ?? null)
/**
 * Whether there is a facility to describe at all.
 *
 * Without this the card rendered a fully-formed credit product for accounts
 * that have none: "£0 available to spend", a 0% bar, "spend up to £0 on any
 * project", and a disabled "Start a project" button with nothing saying why.
 * A disabled primary action with no reason is a dead end, and "£0" reads as a
 * bug rather than a state.
 */
const hasCredit = computed(() => !!creditLine.value && (creditLine.value.limit ?? 0) > 0)
const credit = computed(() => {
  const line = creditLine.value
  const limit = line?.limit ?? 0
  const used = line?.used ?? 0
  return {
    limit,
    used,
    available: Math.max(0, limit - used),
    pct: limit > 0 ? Math.round((used / limit) * 100) : 0,
    frozen: line?.status === 'FROZEN',
    repayAmount: line?.nextRepayAmount ?? null,
    repayDate: line?.nextRepayDate
      ? new Date(line.nextRepayDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : null,
  }
})

/**
 * Payment receipts — the ledger rows themselves, not invented invoices.
 *
 * This list used to mint an invoice number from the row's position in a
 * reverse-chronological array, counting down from a hardcoded 14. An invoice
 * number has to be unique, sequential and permanent; that one shifted for every
 * record as soon as another payment landed, repeated across customers, and ran
 * into INV-2026-000 after fourteen payments. A customer quoting it to accounts
 * would be quoting something that no longer existed.
 *
 * These records are payment receipts, so they are labelled and identified as
 * such. TODO(api): when a real `Invoice` model issues server-side numbers,
 * restore an Invoices section reading from it — never client-side numbering.
 */
const receipts = computed(() =>
  allTx.value
    .filter(t => t.kind === 'installment' || (t.kind === 'out' && t.amount < 0))
    .slice(0, 5)
    .map(t => ({
      id: t.id,
      title: t.title,
      sub: t.date,
      amount: Math.abs(t.amount),
    })),
)

// ---- banking: bank transfer (agency receiving account from /api/config) ---
const { data: appConfig } = await useFetch('/api/config', { lazy: true })
const BANK_ROWS = computed<{ key: string, label: string, value: string }[]>(() =>
  (appConfig.value as any)?.bank ?? [],
)

/**
 * The credit card describes the terms the checkout actually offers, read from
 * the same admin Setting the New Order wizard gates on. Hardcoding "or spread
 * it over 24 months" would promise a term the wizard withholds whenever
 * `finance.enable-24mo-plans` is off — a pricing promise, not a copy nit.
 */
const enable24mo = computed(() => (appConfig.value as any)?.finance?.enable24moPlans !== false)
const copied = ref<string | null>(null)
let copyTimer: ReturnType<typeof setTimeout> | undefined
function copyBank(key: string) {
  const row = BANK_ROWS.value.find(b => b.key === key)
  if (row && import.meta.client && navigator.clipboard)
    navigator.clipboard.writeText(row.value).catch(() => {})
  copied.value = key
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copied.value = null), 1600)
}

// ---- billing details (name/email real; address/VAT placeholder) -----------
const billing = computed(() => ({
  name: [user.value?.firstName, user.value?.lastName].filter(Boolean).join(' ') || 'Your account',
  email: user.value?.email || '—',
}))

// ---- auto-pay (persisted on User.autoPayInstallments) ---------------------
const autoPay = ref(true)
watch(finance, (f: any) => {
  if (f && typeof f.autoPayInstallments === 'boolean')
    autoPay.value = f.autoPayInstallments
}, { immediate: true })

async function toggleAutoPay() {
  const next = !autoPay.value
  autoPay.value = next
  try {
    await $fetch('/api/settings/preferences', { method: 'PATCH', body: { autoPayInstallments: next } })
    toaster.add({
      title: next ? 'Auto-pay on' : 'Auto-pay off',
      description: next ? 'Due installments will be paid from your wallet automatically.' : 'You’ll pay each installment manually.',
      icon: 'lucide:check',
      progress: true,
    })
  }
  catch {
    autoPay.value = !next
    toaster.add({ title: 'Could not save', description: 'Auto-pay preference was not updated. Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
}

// ---- payment methods ------------------------------------------------------
// Real saved instruments from /api/finance/payment-methods. Card details are
// never collected here: the provider hosts that (PCI SAQ-A, ADR-015), so this
// page only ever shows brand/last4 and sends the customer to a hosted flow.
interface UiPaymentMethod {
  id: string
  kind: 'card' | 'bacs_debit' | 'paypal' | 'open_banking'
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  mandateStatus: string | null
  isDefault: boolean
  usable: boolean
  expired: boolean
  label: string
}

const { data: methodsData, refresh: refreshMethods } = await useFetch<{ methods: UiPaymentMethod[] }>(
  '/api/finance/payment-methods',
  { default: () => ({ methods: [] }) },
)
const methods = computed(() => methodsData.value?.methods ?? [])
/** Only usable instruments can fund a top-up or an instalment collection. */
const usableMethods = computed(() => methods.value.filter(m => m.usable))

const methodBusyId = ref<string | null>(null)

// ---- payment flow (top-up + add-method) → <WalletTopUp> -------------------
// One component drives both the "Top up wallet" and "Add a payment method"
// journeys (card + UK Direct Debit, full validation and all states). On any
// success we re-pull the balance, transaction feed and saved methods.
const payOpen = ref(false)
const payMode = ref<'topup' | 'add-method'>('topup')
async function onPaySuccess() {
  await Promise.all([refreshFinance(), refreshTx(), refreshMethods()])
}

function openAddMethod() {
  payMode.value = 'add-method'
  payOpen.value = true
}

async function makeDefault(method: UiPaymentMethod) {
  if (methodBusyId.value)
    return
  methodBusyId.value = method.id
  try {
    await $fetch(`/api/finance/payment-methods/${method.id}`, {
      method: 'PATCH',
      body: { action: 'set_default' },
    })
    await refreshMethods()
    toaster.add({ title: 'Default updated', description: `${method.label} is now your default.`, icon: 'lucide:check-circle-2' })
  }
  catch (error: any) {
    toaster.add({ title: 'Couldn’t update', description: error?.data?.message ?? 'Please try again.', icon: 'lucide:alert-triangle' })
  }
  finally {
    methodBusyId.value = null
  }
}

// Removal is destructive and can break an auto-collected plan, so it goes
// through a confirmation modal — never a native confirm() (project rule #3).
const removeTarget = ref<UiPaymentMethod | null>(null)

async function confirmRemove() {
  const method = removeTarget.value
  if (!method || methodBusyId.value)
    return
  methodBusyId.value = method.id
  try {
    await $fetch(`/api/finance/payment-methods/${method.id}`, { method: 'DELETE' })
    removeTarget.value = null
    await refreshMethods()
    toaster.add({ title: 'Payment method removed', description: `${method.label} was removed.`, icon: 'lucide:check-circle-2' })
  }
  catch (error: any) {
    // The server refuses to strand an active auto-pay plan — surface that
    // reason verbatim rather than a generic failure.
    toaster.add({
      title: 'Couldn’t remove it',
      description: error?.data?.message ?? 'Please try again.',
      icon: 'lucide:alert-triangle',
    })
  }
  finally {
    methodBusyId.value = null
  }
}

/** Brand badge text for the card chip. */
function brandBadge(m: UiPaymentMethod) {
  if (m.kind === 'bacs_debit')
    return 'BACS'
  const b = (m.brand || '').toLowerCase()
  if (b.includes('visa'))
    return 'VISA'
  if (b.includes('master'))
    return 'MC'
  if (b.includes('amex') || b.includes('express'))
    return 'AMEX'
  return 'CARD'
}

// ---- top-up ---------------------------------------------------------------
function openTopup() {
  payMode.value = 'topup'
  payOpen.value = true
}

// ---- installment "Pay now" — real charge from the wallet ------------------
const payingPlan = ref<string | null>(null)
async function payInstallment(plan: Plan) {
  if (payingPlan.value)
    return
  payingPlan.value = plan.id
  try {
    const res: any = await $fetch(`/api/finance/installments/${plan.id}/pay`, { method: 'POST' })
    toaster.add({
      title: res.settled ? 'Plan fully paid 🎉' : 'Installment paid',
      description: res.settled
        ? `That was the final installment for ${plan.name} — the plan is settled.`
        : `${formatCurrency(res.charged)} for ${plan.name} was paid from your wallet.`,
      icon: 'lucide:check',
      progress: true,
    })
    await Promise.all([refreshFinance(), refreshTx(), refreshOrders()])
  }
  catch (e: any) {
    toaster.add({ title: 'Payment failed', description: e?.data?.message || 'Please try again in a moment.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    payingPlan.value = null
  }
}
</script>

<template>
  <div class="apex-wallet mx-auto flex max-w-[1180px] flex-col pb-14 font-sans text-muted-400">
    <!-- ============ TITLE ============ -->
    <ApexPageHeader
      title="Wallet &amp;"
      accent="credit"
      subtitle="Your balance, installments and payment details — all in one place."
      class="mb-8"
    >
      <template #actions>
        <BaseButton rounded="full" variant="primary" class="h-12! w-full px-6 shadow-[0_10px_24px_rgba(125,83,242,0.32)] sm:h-11! sm:w-auto" @click="openTopup">
          <Icon name="lucide:plus" class="size-4" />
          <span>Top up wallet</span>
        </BaseButton>
      </template>
    </ApexPageHeader>

    <!-- ============ TABS ============ -->
    <!-- `aria-pressed` buttons rather than tabs: there is no tabpanel to point
         at, and this matches the choice made on My Orders (Phase 4). -->
    <div role="group" aria-label="Wallet sections" class="mb-6 inline-flex max-w-full gap-1 self-start overflow-x-auto rounded-full border border-white/8 bg-muted-800 p-1">
      <button
        v-for="[key, label] in TAB_DEFS" :key="key"
        type="button" :aria-pressed="tab === key"
        class="apex-focus shrink-0 rounded-full px-[18px] py-[11px] text-[13.5px] transition-all sm:py-[9px]"
        :class="tab === key ? 'bg-primary-500 font-bold text-white' : 'font-semibold text-muted-400 hover:text-white'"
        @click="goTab(key)"
      >
        {{ label }}
      </button>
    </div>

    <!-- ============================================================ OVERVIEW -->
    <div v-if="tab === 'overview'" class="apex-rise flex flex-col gap-5">
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <!-- CASH WALLET -->
        <section
          class="relative flex flex-col overflow-hidden rounded-2xl border border-white/8 p-5 sm:p-[26px]"
          style="background: linear-gradient(160deg, #16252A, #0F1D21);"
        >
          <div class="pointer-events-none absolute -right-16 -top-24 size-[230px] rounded-full" style="background: radial-gradient(circle, rgba(34,176,125,.16), transparent 70%);" />
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <span class="inline-flex size-[34px] items-center justify-center rounded-xl bg-[#22B07D]/15 text-[#22B07D]">
                <Icon name="lucide:wallet" class="size-[17px]" />
              </span>
              <span class="font-heading text-[15px] font-bold text-white">Cash wallet</span>
            </div>
            <span class="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-500">GBP</span>
          </div>
          <div class="mt-[22px]">
            <div class="text-[12.5px] text-muted-500">
              Available balance
            </div>
            <div class="mt-1.5 font-heading text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] tabular-nums text-white sm:text-[42px]">
              {{ formatCurrency(balance) }}
            </div>
          </div>
          <div class="mt-[22px] flex gap-2.5">
            <BaseButton rounded="lg" variant="primary" class="flex-1 shadow-[0_8px_20px_rgba(125,83,242,0.28)]" @click="openTopup">
              <Icon name="lucide:plus" class="size-[15px]" />
              <span>Top up</span>
            </BaseButton>
            <BaseButton rounded="lg" class="flex-1 border border-white/8 bg-muted-700 !text-white" @click="goTab('transactions')">
              History
            </BaseButton>
          </div>
          <div class="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-[15px] py-[13px]">
            <div>
              <div class="text-[13.5px] font-semibold text-white">
                Auto-pay installments
              </div>
              <div class="mt-0.5 text-xs text-muted-500">
                {{ autoPay ? 'Installments are paid from your wallet first' : 'Pay each installment manually' }}
              </div>
            </div>
            <button
              role="switch" :aria-checked="autoPay" aria-label="Toggle auto-pay installments"
              class="apex-tap relative h-[25px] w-11 shrink-0 rounded-full transition-colors"
              :class="autoPay ? 'bg-primary-500' : 'bg-white/12'"
              @click="toggleAutoPay"
            >
              <span class="absolute top-[3px] size-[19px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.3)] transition-all" :class="autoPay ? 'left-[22px]' : 'left-[3px]'" />
            </button>
          </div>
        </section>

        <!-- APEX CREDIT -->
        <section
          v-if="hasCredit"
          class="relative flex flex-col overflow-hidden rounded-2xl border border-primary-500/26 p-5 sm:p-6"
          style="background: linear-gradient(160deg, #1B2231, #141A26);"
        >
          <div class="pointer-events-none absolute -right-16 -top-24 size-[260px] rounded-full" style="background: radial-gradient(circle, rgba(125,83,242,.24), transparent 70%);" />
          <div class="relative flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <span class="inline-flex size-[34px] items-center justify-center rounded-xl bg-primary-500/18 text-primary-400">
                <Icon name="lucide:zap" class="size-[17px]" />
              </span>
              <span class="font-heading text-[15px] font-bold text-white">Apex credit</span>
            </div>
            <span
              class="inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.05em]"
              :class="credit.frozen ? 'bg-[#EC6453]/16 text-[#EC6453]' : 'bg-[#22B07D]/14 text-[#22B07D]'"
            >
              {{ credit.frozen ? 'On hold' : 'Active' }}
            </span>
          </div>

          <div class="relative mt-[22px]">
            <div class="text-[12.5px] text-muted-500">
              Available to spend
            </div>
            <div class="mt-1.5 font-heading text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] tabular-nums text-white sm:text-[42px]">
              {{ formatCurrency(credit.available) }}
            </div>
            <div class="mt-4">
              <div class="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div class="h-full rounded-full" :style="{ width: `${credit.pct}%`, background: 'linear-gradient(90deg, var(--color-primary-400), var(--color-primary-500))' }" />
              </div>
              <div class="mt-2 flex justify-between text-[12.5px] text-muted-500">
                <span>{{ formatCurrency(credit.used) }} in use</span>
                <span>{{ formatCurrency(credit.limit) }} limit</span>
              </div>
            </div>
          </div>

          <!-- how it works: instant facility, no application -->
          <div class="relative mt-[18px] rounded-xl border border-primary-500/20 bg-primary-500/[0.08] px-[15px] py-[13px]">
            <div class="text-[11.5px] font-bold uppercase tracking-[0.04em] text-primary-200">
              No application needed
            </div>
            <div class="mt-[3px] text-[13px] text-muted-300">
              Spend up to {{ formatCurrency(credit.limit) }} on any project. Choose
              <strong class="font-semibold text-white">0% over 12 months</strong><template v-if="enable24mo">
                or spread it over <strong class="font-semibold text-white">24 months</strong>
              </template>
              at checkout — a repayment plan is set up automatically.
            </div>
          </div>

          <div v-if="credit.frozen" class="relative mt-3.5 flex items-center gap-2.5 rounded-xl border border-[#EC6453]/24 bg-[#EC6453]/[0.08] px-[15px] py-[13px]">
            <Icon name="lucide:pause-circle" class="size-[17px] shrink-0 text-[#EC6453]" />
            <div class="text-[13px] text-muted-400">
              Your credit is on hold. Contact support to restore access.
            </div>
          </div>

          <!--
            Fully drawn down. "Start a project" is disabled below, and a disabled
            primary button with no reason is a dead end — say why, and what
            clears it.
          -->
          <div v-else-if="credit.available <= 0" class="relative mt-3.5 flex items-center gap-2.5 rounded-xl border border-[#D9A521]/24 bg-[#D9A521]/[0.08] px-[15px] py-[13px]">
            <Icon name="lucide:info" class="size-[17px] shrink-0 text-[#F2C14E]" />
            <div class="text-[13px] text-muted-400">
              Your {{ formatCurrency(credit.limit) }} limit is fully committed. Paying an installment
              frees up credit for a new project.
            </div>
          </div>

          <div class="relative mt-3.5 flex gap-2.5">
            <BaseButton to="/dashboards/services" rounded="lg" variant="primary" class="flex-1 shadow-[0_8px_20px_rgba(125,83,242,0.28)]" :disabled="credit.frozen || credit.available <= 0">
              Start a project
            </BaseButton>
            <BaseButton rounded="lg" class="flex-1 border border-white/8 bg-muted-700 !text-white" @click="goTab('installments')">
              View plans
            </BaseButton>
          </div>
        </section>

        <!--
          No facility on the account: describe the product and offer the one
          action that can change that, instead of a £0 card with a disabled
          button and no explanation.
        -->
        <section v-else class="flex flex-col rounded-2xl border border-white/8 bg-muted-800 p-5 sm:p-6">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <span class="inline-flex size-[34px] items-center justify-center rounded-xl bg-white/5 text-muted-400">
                <Icon name="lucide:zap" class="size-[17px]" />
              </span>
              <span class="font-heading text-[15px] font-bold text-white">Apex credit</span>
            </div>
            <span class="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-muted-500">
              Not enabled
            </span>
          </div>

          <div class="flex flex-1 flex-col justify-center py-[26px]">
            <div class="font-heading text-[19px] font-bold tracking-[-0.01em] text-white">
              Spread project costs over time
            </div>
            <p class="mt-2 max-w-[380px] text-[13.5px] leading-[1.55] text-muted-400">
              Apex credit lets you start work now and repay monthly at 0%. It isn't set up on
              your account yet — your account manager can enable it.
            </p>
          </div>

          <BaseButton to="/dashboards/support" rounded="lg" class="border border-white/8 bg-muted-700 !text-white">
            <Icon name="lucide:message-square" class="size-4" />
            <span>Ask about Apex credit</span>
          </BaseButton>
        </section>
      </div>

      <!-- second row -->
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <!-- upcoming payments -->
        <section class="flex flex-col rounded-2xl border border-white/8 bg-muted-800 p-6">
          <div class="mb-4 flex items-center gap-2.5">
            <Icon name="lucide:calendar" class="size-[18px] text-primary-400" />
            <h3 class="font-heading text-base font-bold text-white">
              Upcoming payments
            </h3>
          </div>
          <div v-if="upcoming.length" class="flex flex-col gap-2.5">
            <div
              v-for="u in upcoming" :key="u.id"
              class="flex items-center gap-3 rounded-xl border bg-muted-700 px-3.5 py-3"
              :class="u.dueSoon ? 'border-[#D9A521]/28' : 'border-white/8'"
            >
              <span class="inline-flex size-[38px] shrink-0 items-center justify-center rounded-xl" :class="[SVC_META[u.icon].bg, SVC_META[u.icon].text]">
                <Icon :name="SVC_META[u.icon].icon" class="size-[17px]" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-[13.5px] font-semibold text-white">
                  {{ u.name }}
                </div>
                <div class="mt-0.5 text-xs text-muted-500">
                  {{ u.sub }}
                </div>
              </div>
              <div class="text-right">
                <div class="font-heading text-[15px] font-bold tabular-nums text-white">
                  {{ formatCurrency(u.amount) }}
                </div>
                <div class="mt-0.5 text-[11.5px] font-semibold" :class="u.dueSoon ? 'text-[#F2C14E]' : 'text-muted-500'">
                  {{ u.date }}
                </div>
              </div>
            </div>
          </div>
          <div v-else class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/8 p-[26px] text-center text-[13.5px] text-muted-500">
            No payments scheduled — start a project to see installments here.
          </div>
          <button
            class="mt-3.5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-transparent p-2.5 text-[13px] font-bold text-primary-400 transition-all hover:bg-muted-700"
            @click="goTab('installments')"
          >
            View all installments
            <Icon name="lucide:chevron-right" class="size-3.5" />
          </button>
        </section>

        <!-- recent activity -->
        <section class="flex flex-col rounded-2xl border border-white/8 bg-muted-800 p-6">
          <div class="mb-4 flex items-center gap-2.5">
            <Icon name="lucide:activity" class="size-[18px] text-primary-400" />
            <h3 class="font-heading text-base font-bold text-white">
              Recent activity
            </h3>
          </div>
          <div v-if="recentTx.length" class="flex flex-col">
            <div
              v-for="(t, i) in recentTx" :key="t.id"
              class="flex items-center gap-3 py-2.5"
              :class="i < recentTx.length - 1 ? 'border-b border-white/8' : ''"
            >
              <span class="inline-flex size-[38px] shrink-0 items-center justify-center rounded-xl" :class="[TX_META[t.kind].bg, TX_META[t.kind].text]">
                <Icon :name="TX_META[t.kind].icon" class="size-4" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-[13.5px] font-semibold text-white">
                  {{ t.title }}
                </div>
                <div class="mt-0.5 text-xs text-muted-500">
                  {{ t.sub }}
                </div>
              </div>
              <span class="font-heading text-[15px] font-bold tabular-nums" :class="t.amount > 0 ? 'text-[#22B07D]' : 'text-white'">
                {{ signed(t.amount) }}
              </span>
            </div>
          </div>
          <div v-else class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/8 p-[26px] text-center text-[13.5px] text-muted-500">
            No activity yet — your top-ups and payments will appear here.
          </div>
          <button
            class="mt-3.5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-transparent p-2.5 text-[13px] font-bold text-primary-400 transition-all hover:bg-muted-700"
            @click="goTab('transactions')"
          >
            View all transactions
            <Icon name="lucide:chevron-right" class="size-3.5" />
          </button>
        </section>
      </div>
    </div>

    <!-- ============================================================ TRANSACTIONS -->
    <div v-else-if="tab === 'transactions'" class="apex-rise">
      <div class="mb-[18px] flex flex-wrap items-center gap-3.5">
        <div class="flex max-w-full flex-nowrap gap-1 overflow-x-auto rounded-full border border-white/8 bg-muted-800 p-1">
          <button
            v-for="[key, label] in TX_FILTERS" :key="key"
            class="shrink-0 rounded-full px-[15px] py-2 text-[13px] transition-all"
            :class="txFilter === key ? 'bg-primary-500 font-bold text-white' : 'font-semibold text-muted-400 hover:text-white'"
            @click="txFilter = key as any"
          >
            {{ label }}
          </button>
        </div>
        <div class="flex-1" />
        <label class="flex w-full items-center gap-2.5 rounded-xl border border-white/8 bg-muted-800 px-3.5 py-2.5 focus-within:border-primary-400 sm:w-[250px]">
          <Icon name="lucide:search" class="size-4 shrink-0 text-muted-500" />
          <input v-model="txQ" placeholder="Search transactions" class="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-white outline-none placeholder:text-muted-500">
        </label>
      </div>

      <section v-if="txRows.length" class="rounded-2xl border border-white/8 bg-muted-800 px-6 py-2">
        <div
          v-for="(t, i) in txRows" :key="t.id"
          class="flex items-center gap-4 py-[15px]"
          :class="i < txRows.length - 1 ? 'border-b border-white/5' : ''"
        >
          <span class="inline-flex size-[38px] shrink-0 items-center justify-center rounded-xl" :class="[TX_META[t.kind].bg, TX_META[t.kind].text]">
            <Icon :name="TX_META[t.kind].icon" class="size-4" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-white">
              {{ t.title }}
            </div>
            <div class="mt-[3px] text-xs text-muted-500">
              {{ t.sub }}
            </div>
          </div>
          <div class="shrink-0 text-right">
            <div class="font-heading text-[15px] font-bold tabular-nums" :class="t.amount > 0 ? 'text-[#22B07D]' : 'text-white'">
              {{ signed(t.amount) }}
            </div>
            <div class="mt-[3px] text-[11.5px] text-muted-500">
              {{ t.date }}
            </div>
          </div>
        </div>
      </section>
      <div v-else class="rounded-2xl border border-white/8 bg-muted-800 px-[30px] py-14 text-center">
        <span class="mb-4 inline-flex size-[60px] items-center justify-center rounded-full bg-muted-700 text-muted-500">
          <Icon name="lucide:activity" class="size-[26px]" />
        </span>
        <h3 class="font-heading text-[19px] font-bold text-white">
          No transactions
        </h3>
        <p class="mt-2 text-sm text-muted-400">
          {{ txEmptyMsg }}
        </p>
      </div>
    </div>

    <!-- ============================================================ INSTALLMENTS -->
    <div v-else-if="tab === 'installments'" class="apex-rise">
      <div v-if="plans.length" class="flex flex-col gap-3.5">
        <section v-for="pl in plans" :key="pl.id" class="overflow-hidden rounded-2xl border border-white/8 bg-muted-800">
          <!-- A real <button> gets keyboard handling, focus and role for free,
               and can announce its expanded state; the div needed three extra
               handlers to fake half of that. -->
          <button
            type="button" :aria-expanded="!!expanded[pl.id]"
            class="apex-focus flex w-full cursor-pointer items-center gap-4 px-6 py-[19px] text-left transition-colors hover:bg-muted-700"
            @click="togglePlan(pl.id)"
          >
            <span class="inline-flex size-11 shrink-0 items-center justify-center rounded-xl" :class="[SVC_META[pl.icon].bg, SVC_META[pl.icon].text]">
              <Icon :name="SVC_META[pl.icon].icon" class="size-5" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2.5">
                <span class="font-heading text-[16.5px] font-bold text-white">{{ pl.name }}</span>
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.05em]"
                  :class="pl.status === 'completed' ? 'bg-[#22B07D]/14 text-[#22B07D]' : pl.dueSoon ? 'bg-[#D9A521]/16 text-[#F2C14E]' : 'bg-[#22B07D]/14 text-[#22B07D]'"
                >
                  {{ pl.status === 'completed' ? 'Paid in full' : pl.dueSoon ? 'Due soon' : 'Up to date' }}
                </span>
              </div>
              <div class="mt-[3px] truncate text-[12.5px] text-muted-500">
                {{ pl.service }} · #{{ pl.shortId }}<template v-if="pl.status !== 'completed'">
                  · Next: {{ formatCurrency(pl.amount) }} · {{ pl.nextLabel }}
                </template>
              </div>
            </div>
            <div class="hidden w-[200px] shrink-0 flex-col gap-[7px] sm:flex">
              <!--
                Segments only while they stay readable. At 24 installments each
                one is ~5px wide with a 3px gap inside a 200px column, which
                reads as noise; a single bar carries the same fact, and the
                count below states it exactly.
              -->
              <div v-if="pl.total <= 12" class="flex gap-[3px]">
                <div
                  v-for="(r, i) in pl.rows" :key="i"
                  class="h-[7px] flex-1 rounded-[3px]"
                  :class="i < pl.paid ? (pl.status === 'completed' ? 'bg-[#22B07D]' : 'bg-primary-500') : 'bg-white/8'"
                />
              </div>
              <div v-else class="h-[7px] overflow-hidden rounded-full bg-white/8">
                <div
                  class="h-full rounded-full"
                  :class="pl.status === 'completed' ? 'bg-[#22B07D]' : 'bg-primary-500'"
                  :style="{ width: `${Math.round((pl.paid / pl.total) * 100)}%` }"
                />
              </div>
              <div class="text-right text-[11.5px] text-muted-500">
                {{ pl.paid }} of {{ pl.total }} paid
              </div>
            </div>
            <Icon name="lucide:chevron-down" aria-hidden="true" class="size-[18px] shrink-0 text-muted-500 transition-transform" :class="expanded[pl.id] ? 'rotate-180' : ''" />
          </button>

          <div v-if="expanded[pl.id]" class="apex-fade border-t border-white/8 px-6 pb-[18px] pt-2.5">
            <div
              v-for="r in pl.rows" :key="r.n"
              class="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-white/[0.04] py-[11px] sm:flex-nowrap"
            >
              <span
                class="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full font-heading text-[11.5px] font-bold"
                :class="r.state === 'paid' ? 'bg-[#22B07D]/16 text-[#22B07D]' : r.state === 'next' ? 'bg-primary-500/18 text-primary-200' : 'bg-muted-700 text-muted-500'"
              >{{ r.n }}</span>
              <div class="min-w-0 flex-1 text-[13.5px] font-semibold" :class="r.state === 'scheduled' ? 'text-muted-500' : 'text-white'">
                {{ r.label }}
              </div>
              <span
                class="inline-flex w-[86px] shrink-0 items-center justify-center rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.05em]"
                :class="r.state === 'paid' ? 'bg-[#22B07D]/14 text-[#22B07D]' : r.state === 'next' ? (r.dueSoon ? 'bg-[#D9A521]/16 text-[#F2C14E]' : 'bg-primary-500/16 text-primary-200') : 'bg-muted-700 text-muted-500'"
              >
                {{ r.state === 'paid' ? 'Paid' : r.state === 'next' ? (r.dueSoon ? 'Due soon' : 'Next') : 'Scheduled' }}
              </span>
              <div class="flex w-full flex-wrap items-center gap-x-3.5 gap-y-2 ps-[38px] sm:w-auto sm:flex-nowrap sm:gap-y-0 sm:ps-0">
                <span class="shrink-0 basis-[110px] text-[12.5px] text-muted-500">{{ r.date }}</span>
                <span class="shrink-0 basis-[70px] text-right font-heading text-sm font-bold tabular-nums text-white">{{ formatCurrency(r.amount) }}</span>
                <button
                  v-if="r.state === 'next'"
                  class="ms-auto shrink-0 rounded-full bg-primary-500 px-[15px] py-[7px] text-xs font-bold text-white transition-colors hover:bg-primary-600 sm:ms-0"
                  @click="payInstallment(pl)"
                >
                  Pay now
                </button>
                <span v-else class="hidden shrink-0 sm:inline-block sm:w-[79px]" />
              </div>
            </div>
          </div>
        </section>
      </div>
      <div v-else class="rounded-2xl border border-white/8 bg-muted-800 px-[30px] py-14 text-center">
        <span class="mb-4 inline-flex size-[60px] items-center justify-center rounded-full bg-muted-700 text-muted-500">
          <Icon name="lucide:calendar" class="size-[26px]" />
        </span>
        <h3 class="font-heading text-[19px] font-bold text-white">
          No installment plans
        </h3>
        <p class="mb-5 mt-2 text-sm text-muted-400">
          Installment schedules appear here once you start a project.
        </p>
        <BaseButton rounded="full" variant="primary" to="/dashboards/services">
          Start a project
        </BaseButton>
      </div>
    </div>

    <!-- ============================================================ BANKING -->
    <div v-else-if="tab === 'banking'" class="apex-rise grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <!-- left: methods + invoices -->
      <div class="flex min-w-0 flex-col gap-5">
        <section class="rounded-2xl border border-white/8 bg-muted-800 p-6">
          <div class="mb-4 flex items-center gap-2.5">
            <Icon name="lucide:credit-card" class="size-[18px] text-primary-400" />
            <h3 class="font-heading text-base font-bold text-white">
              Payment methods
            </h3>
          </div>
          <div v-if="methods.length" class="flex flex-col gap-2.5" role="list">
            <div
              v-for="m in methods" :key="m.id"
              role="listitem"
              class="flex items-center gap-3.5 rounded-xl border bg-muted-700 px-4 py-3.5"
              :class="m.isDefault ? 'border-primary-500/26' : 'border-white/8'"
            >
              <span class="inline-flex h-8 w-[46px] shrink-0 items-center justify-center rounded-lg border border-white/15 text-[9px] font-extrabold tracking-[0.04em] text-white" style="background: linear-gradient(140deg, #1B2B31, #0D181C);">
                {{ brandBadge(m) }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold text-white">
                  {{ m.label }}
                </div>
                <div class="mt-0.5 text-xs" :class="m.expired ? 'text-[#EC6453]' : 'text-muted-500'">
                  <template v-if="m.kind === 'bacs_debit'">
                    <span v-if="m.mandateStatus === 'active'">Direct Debit · active</span>
                    <span v-else-if="m.mandateStatus === 'failed'" class="text-[#EC6453]">Authorisation failed</span>
                    <span v-else class="text-[#F2C14E]">Awaiting your bank authorisation</span>
                  </template>
                  <template v-else-if="m.expMonth && m.expYear">
                    {{ m.expired ? 'Expired' : 'Expires' }} {{ String(m.expMonth).padStart(2, '0') }}/{{ String(m.expYear).slice(-2) }}
                  </template>
                  <template v-else>
                    Card
                  </template>
                </div>
              </div>
              <span v-if="m.isDefault" class="rounded-full bg-primary-500/14 px-[11px] py-[5px] text-[11px] font-extrabold uppercase tracking-[0.05em] text-primary-200">Default</span>
              <button
                v-else-if="m.usable"
                :disabled="methodBusyId === m.id"
                class="px-2 py-[5px] text-xs font-semibold text-muted-500 transition-colors hover:text-white disabled:opacity-50"
                @click="makeDefault(m)"
              >
                Make default
              </button>
              <button
                :aria-label="`Remove ${m.label}`"
                :disabled="methodBusyId === m.id"
                class="inline-flex size-8 items-center justify-center rounded-xl border border-white/8 text-muted-500 transition-colors hover:border-[#EC6453]/40 hover:text-[#EC6453] disabled:opacity-50"
                @click="removeTarget = m"
              >
                <Icon name="lucide:trash-2" class="size-[15px]" />
              </button>
            </div>
          </div>
          <div v-else class="mb-0.5 rounded-xl border border-dashed border-white/8 p-[22px] text-center text-[13.5px] text-muted-500">
            No payment methods yet. Add one to pay instalments automatically.
          </div>
          <button
            class="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-white/15 p-3 text-[13.5px] font-semibold text-muted-400 transition-all hover:border-primary-400 hover:bg-primary-500/5 hover:text-white"
            @click="openAddMethod"
          >
            <Icon name="lucide:plus" class="size-[15px]" />
            Add payment method
          </button>
        </section>

        <!--
          Receipts, not invoices: these rows are the ledger's own payment
          records. The download button is gone rather than firing a toast
          claiming an account manager was notified — a missing control is
          honest, one that lies is not. TODO(api): restore downloads when
          GET /api/finance/receipts/:id exists, as a real <a download>.
        -->
        <section class="rounded-2xl border border-white/8 bg-muted-800 p-6">
          <div class="mb-3.5 flex items-center gap-2.5">
            <Icon name="lucide:receipt" class="size-[18px] text-primary-400" />
            <h3 class="font-heading text-base font-bold text-white">
              Receipts
            </h3>
            <span class="rounded-full bg-muted-700 px-2.5 py-0.5 text-xs text-muted-500">{{ receipts.length }}</span>
          </div>
          <div v-if="receipts.length">
            <div
              v-for="receipt in receipts" :key="receipt.id"
              class="flex items-center gap-3.5 border-b border-white/[0.04] py-3 last:border-b-0"
            >
              <div class="min-w-0 flex-1">
                <div class="truncate text-[13.5px] font-semibold text-white">
                  {{ receipt.title }}
                </div>
                <div class="mt-0.5 truncate text-xs text-muted-500">
                  {{ receipt.sub }}
                </div>
              </div>
              <span class="font-heading text-sm font-bold tabular-nums text-white">{{ formatCurrency(receipt.amount) }}</span>
              <span class="inline-flex shrink-0 items-center rounded-full bg-[#22B07D]/14 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-[#22B07D]">Paid</span>
            </div>
            <p class="mt-3.5 text-xs leading-[1.55] text-muted-500">
              A payment receipt is issued for every installment. VAT invoices are sent by email
              from our accounts team.
            </p>
          </div>
          <div v-else class="rounded-xl border border-dashed border-white/8 p-[22px] text-center text-[13.5px] text-muted-500">
            A receipt appears here for every installment payment.
          </div>
        </section>
      </div>

      <!-- right: bank transfer + billing -->
      <div class="flex flex-col gap-5">
        <section class="rounded-2xl border border-white/8 p-6" style="background: linear-gradient(160deg, #16252A, #101D21);">
          <div class="mb-1.5 flex items-center gap-2.5">
            <Icon name="lucide:landmark" class="size-[18px] text-primary-400" />
            <h3 class="font-heading text-base font-bold text-white">
              Bank transfer
            </h3>
          </div>
          <p class="mb-3.5 text-[12.5px] leading-[1.5] text-muted-500">
            <!-- No project ID is shown on this tab, so say where to find one. -->
            Pay any installment directly by transfer. Use your project ID as the reference — you'll
            find it on the project page in <NuxtLink to="/dashboards/orders" class="font-semibold text-primary-400 hover:text-primary-200">
              My orders
            </NuxtLink>.
          </p>
          <div
            v-for="b in BANK_ROWS" :key="b.key"
            class="flex items-center gap-2.5 border-b border-white/[0.05] py-2.5"
          >
            <div class="min-w-0 flex-1">
              <div class="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-500">
                {{ b.label }}
              </div>
              <div class="mt-[3px] text-[13.5px] font-semibold tabular-nums text-white">
                {{ b.value }}
              </div>
            </div>
            <button
              class="rounded-lg border border-white/8 bg-muted-700 px-3 py-1.5 text-[11.5px] font-semibold transition-colors hover:border-white/15 hover:text-white"
              :class="copied === b.key ? 'text-[#22B07D]' : 'text-muted-400'"
              @click="copyBank(b.key)"
            >
              {{ copied === b.key ? 'Copied' : 'Copy' }}
            </button>
          </div>
        </section>

        <section class="rounded-2xl border border-white/8 bg-muted-800 p-6">
          <div class="mb-3.5 flex items-center justify-between gap-2.5">
            <div class="flex items-center gap-2.5">
              <Icon name="lucide:user" class="size-[18px] text-primary-400" />
              <h3 class="font-heading text-base font-bold text-white">
                Billing details
              </h3>
            </div>
            <!-- Name and email come from the account record, so Edit goes where
                 they are actually editable rather than firing a toast. -->
            <NuxtLink to="/dashboards/settings" class="apex-focus rounded-md text-[12.5px] font-bold text-primary-400 transition-colors hover:text-primary-200">
              Edit
            </NuxtLink>
          </div>
          <div class="flex flex-col gap-2.5 text-[13.5px] leading-[1.5] text-muted-400">
            <div>
              <div class="mb-[3px] text-[11px] font-bold uppercase tracking-[0.05em] text-muted-500">
                Billed to
              </div>
              <span class="font-semibold text-white">{{ billing.name }}</span>
            </div>
            <div>
              <div class="mb-[3px] text-[11px] font-bold uppercase tracking-[0.05em] text-muted-500">
                Email
              </div>
              {{ billing.email }}
            </div>
            <!-- TODO(api): billing address + VAT number are not stored yet. -->
            <div>
              <div class="mb-[3px] text-[11px] font-bold uppercase tracking-[0.05em] text-muted-500">
                Address
              </div>
              Add your billing address in Settings.
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- ==================================== TOP-UP / ADD PAYMENT METHOD FLOW -->
    <WalletTopUp
      :open="payOpen"
      :mode="payMode"
      @close="payOpen = false"
      @success="onPaySuccess"
    />

    <!-- ================================================= REMOVE METHOD CONFIRM -->
    <div v-if="removeTarget" class="apex-fade fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(5,10,12,0.66)] p-6 backdrop-blur-[4px]" @click="removeTarget = null">
      <div
        role="dialog" aria-label="Remove payment method"
        class="apex-pop w-[420px] max-w-full rounded-2xl border border-white/15 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.5)] sm:p-7"
        style="background: #132125;"
        @click.stop
      >
        <div class="mb-3.5 flex items-center gap-3">
          <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#EC6453]/25 bg-[#EC6453]/10">
            <Icon name="lucide:trash-2" class="size-[18px] text-[#EC6453]" />
          </span>
          <h3 class="font-heading text-[19px] font-extrabold tracking-[-0.01em] text-white">
            Remove this method?
          </h3>
        </div>
        <p class="mb-5 text-[13.5px] leading-relaxed text-muted-500">
          <strong class="text-white">{{ removeTarget.label }}</strong> will be removed from your account.
          <template v-if="removeTarget.kind === 'bacs_debit'">
            Your Direct Debit mandate will also be cancelled with your bank.
          </template>
        </p>
        <div class="flex flex-col gap-2.5 sm:flex-row">
          <BaseButton rounded="lg" variant="muted" class="w-full sm:flex-1" @click="removeTarget = null">
            Keep it
          </BaseButton>
          <BaseButton
            rounded="lg" variant="primary"
            class="w-full sm:flex-1"
            :disabled="Boolean(methodBusyId)"
            @click="confirmRemove"
          >
            {{ methodBusyId ? 'Removing…' : 'Remove' }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.apex-rise {
  animation: apexRise 0.3s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.apex-fade {
  animation: apexFade 0.25s both;
}
.apex-pop {
  animation: apexPop 0.25s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
@keyframes apexRise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes apexFade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes apexPop {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .apex-rise,
  .apex-fade,
  .apex-pop {
    animation: none;
  }
}
</style>
