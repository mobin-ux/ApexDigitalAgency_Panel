<script setup lang="ts">
import { creditRef } from '~~/shared/credit'
import { orderRef } from '~~/shared/refs'

/**
 * Wallet & credit — Panel v2 (`Wallet.dc.html`).
 *
 * Three tabs: Overview (balance, credit, what is coming up, payment methods),
 * Transactions (filter + CSV), Payment plans (one card per order with a plan).
 * `?tab=tx|plans` and `?add=1` are the deep links the dashboard uses.
 *
 * Credit (revision of 2026-10-25): the card has the design's states — not set
 * up, under review, approved (or on hold) — and `?credit=apply` opens the
 * application (`WalletCreditApply`), `?credit=status` the application's
 * progress. Both are in the URL so the browser's back button leaves them.
 *
 * Where the mockup and the product differ, the product wins:
 *  - "Auto top-up" is drawn, but no automatic card top-up exists. The switch
 *    here is the real one: paying instalments automatically from the wallet
 *    (`User.autoPayInstallments`), which is what the mockup's sentence about
 *    instalments describes anyway.
 *  - Payments carry no invoice download: there is no invoice document behind
 *    a row (V2 Phase 5), so rows are receipts and the footnote says so.
 *  - Add funds is the real top-up flow (`<WalletTopUp>`, provider-hosted card
 *    entry and bank transfer, ADR-015), not a dialog that adds to a number.
 *  - Adding a card is the provider's hosted form too: card numbers are never
 *    typed into this page (PCI SAQ-A), so the design's card form is not drawn.
 *  - The balance card does not say instalments fall back to a card: they are
 *    taken from the wallet only.
 */
definePageMeta({
  title: 'Wallet & credit',
  layout: 'sidenav',
  middleware: 'auth',
})

interface Tx { id: string, type: string, amount: number, status: string, description: string | null, projectId: string | null, date: string }
interface Method { id: string, kind: string, brand: string | null, last4: string | null, expMonth: number | null, expYear: number | null, isDefault: boolean, usable: boolean, label: string }

const route = useRoute()
const router = useRouter()
const toaster = useNuiToasts()
const { fetchNotifications } = useNotifications()
const { formatCurrency } = useCurrency()
/** Whether customers may apply for credit right now (Website › Panel content). */
const { data: appConfig } = useApexConfig()
const creditApplicationsOpen = computed(() => (appConfig.value as any)?.features?.creditApplications !== false)

const { data: finance, refresh: refreshFinance } = await useFetch<any>('/api/finance/dashboard', { key: 'finance-dashboard' })
const { data: txData, refresh: refreshTx } = await useFetch<{ transactions: Tx[] }>('/api/finance/transactions', { key: 'wallet-tx', query: { limit: 500 } })
const { data: ordersData, refresh: refreshOrders } = await useFetch<{ data: any[] }>('/api/orders', { key: 'orders' })
const { data: methodsData, refresh: refreshMethods } = await useFetch<{ methods: Method[] }>('/api/finance/payment-methods', { key: 'payment-methods', default: () => ({ methods: [] }) })

/* ------------------------------------------------------------------ tabs */
type Tab = 'overview' | 'tx' | 'plans'
const TABS: [Tab, string][] = [['overview', 'Overview'], ['tx', 'Transactions'], ['plans', 'Payment plans']]
const tab = computed<Tab>(() => (['tx', 'plans'].includes(String(route.query.tab)) ? route.query.tab as Tab : 'overview'))
function setTab(t: Tab) {
  router.replace({ query: { ...route.query, tab: t === 'overview' ? undefined : t } })
}

/* ---------------------------------------------------------------- money */
const balance = computed(() => finance.value?.balanceOverview?.walletBalance ?? 0)
const credit = computed(() => finance.value?.credit as { state: 'none' | 'review' | 'approved' | 'frozen', status: string, limit: number, used: number, available: number, application: { requestedLimit: number, status: string, decidedAt: string | null } | null } | undefined)
const creditPct = computed(() => (credit.value?.limit ? Math.min(100, Math.round(credit.value.used / credit.value.limit * 100)) : 0))

/* --------------------------------------------------------------- credit */
const creditView = computed<'apply' | 'status' | null>(() => (route.query.credit === 'apply' || route.query.credit === 'status' ? route.query.credit : null))
const { data: appData, refresh: refreshApp } = await useFetch<{ ceiling: number, application: any }>('/api/credit/application', { key: 'credit-application' })
const application = computed(() => appData.value?.application ?? null)
// Opening the form while an application is already waiting shows its status.
watchEffect(() => {
  if (creditView.value === 'apply' && credit.value && credit.value.state !== 'none') {
    router.replace({ query: { ...route.query, credit: credit.value.state === 'review' ? 'status' : undefined } })
  }
})
function openCredit(view: 'apply' | 'status') {
  router.push({ query: { ...route.query, tab: undefined, credit: view } })
  window.scrollTo({ top: 0 })
}
function exitCredit() {
  const { credit: _c, ...rest } = route.query
  router.push({ query: rest })
  window.scrollTo({ top: 0 })
}
const justApplied = ref(false)
async function onApplied() {
  await Promise.all([refreshFinance(), refreshApp(), fetchNotifications()])
  justApplied.value = true
  router.replace({ query: { ...route.query, credit: 'status' } })
  window.scrollTo({ top: 0 })
}
const withdrawAsk = ref(false)
const withdrawing = ref(false)
async function withdraw() {
  withdrawing.value = true
  try {
    await $fetch('/api/credit/application', { method: 'DELETE' })
    withdrawAsk.value = false
    justApplied.value = false
    await Promise.all([refreshFinance(), refreshApp()])
    exitCredit()
    toaster.add({ title: 'Application withdrawn', description: 'Your ID and statements have been deleted.', icon: 'lucide:check', progress: true })
  }
  catch (e) {
    toaster.add({ title: 'Not withdrawn', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    withdrawing.value = false
  }
}
const CREDIT_TICKS = ['No credit check, nothing on your credit file', 'Never any interest', 'Decision within one working day']
const statusSteps = computed(() => {
  const a = application.value
  if (!a) {
    return []
  }
  const decided = a.status !== 'SUBMITTED'
  const on = a.decidedAt ? ` on ${ukDate(a.decidedAt)}` : ''
  return [
    { t: 'Application submitted', d: stamp(a.submittedAt), done: true, now: false },
    { t: 'Checking your business', d: 'Companies House, your ID and your banking. Usually within one working day.', done: decided, now: !decided },
    {
      t: 'Decision',
      d: a.status === 'APPROVED'
        ? `Approved${on}: a credit line of ${formatCurrency(a.approvedLimit ?? 0)}, ready to use.`
        : a.status === 'DECLINED'
          ? `Not approved${on}. You can still order any service on a monthly plan, one at a time.`
          : 'We update this page and send you a notification. If approved, your credit line is ready to use straight away.',
      done: decided,
      now: false,
    },
  ]
})
const statusFacts = computed(() => {
  const a = application.value
  if (!a) {
    return []
  }
  return [
    { k: 'Requested', v: formatCurrency(a.requestedLimit) },
    { k: 'Business', v: a.businessName },
    { k: 'Banking', v: `${a.statements} statement${a.statements === 1 ? '' : 's'}` },
    { k: 'Status', v: a.status === 'SUBMITTED' ? 'Under review' : a.status === 'APPROVED' ? 'Approved' : 'Not approved' },
  ]
})
function stamp(iso: string) {
  const d = new Date(iso)
  return `${ukDate(iso)}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

/* ----------------------------------------------------------- coming up */
const plans = computed(() => (ordersData.value?.data ?? [])
  .filter(o => o.payMode ? ['fixed-monthly', 'retainer'].includes(o.payMode) || (!o.kickoffPaidAt && o.kickoffAmount > 0) : Boolean(o.installmentPlan))
  .filter(o => o.status !== 'CANCELLED')
  .map(o => ({ o, s: orderSchedule(o) })))

const upcoming = computed(() => {
  const rows: { key: string, date: Date | null, name: string, meta: string, amount: number }[] = []
  for (const { o, s } of plans.value) {
    if (!s.started && o.kickoffAmount > 0) {
      rows.push({ key: `${o.id}-k`, date: null, name: o.name, meta: `${s.kind === 'retainer' ? 'First month' : s.kind === 'full' ? 'Payment in full' : s.kind === 'scope' ? 'Discovery fee' : s.deposit ? 'Deposit' : `Payment 1 of ${s.payments}`} · after your kickoff call`, amount: o.kickoffAmount })
      continue
    }
    const next = s.rows.find(r => r.state === 'Next')
    if (next && s.nextDue) {
      rows.push({ key: o.id, date: s.nextDue, name: o.name, meta: `${next.label} · from wallet`, amount: next.amount })
    }
  }
  return rows.sort((a, b) => (a.date?.getTime() ?? Number.POSITIVE_INFINITY) - (b.date?.getTime() ?? Number.POSITIVE_INFINITY))
})

/* ------------------------------------------------------------ auto-pay */
const autoPay = ref(true)
watch(finance, (f) => {
  if (f && typeof f.autoPayInstallments === 'boolean') {
    autoPay.value = f.autoPayInstallments
  }
}, { immediate: true })
async function toggleAutoPay() {
  const next = !autoPay.value
  autoPay.value = next
  try {
    await $fetch('/api/settings/preferences', { method: 'PATCH', body: { autoPayInstallments: next } })
  }
  catch (e) {
    autoPay.value = !next
    toaster.add({ title: 'Setting not saved', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
}

// Paying the next instalment by hand: the same wallet charge auto-pay makes
// (`/api/finance/installments/:id/pay`), for a customer who has auto-pay off
// or wants to pay early.
const payingPlan = ref<string | null>(null)
async function payNext(o: any) {
  const id = o.installmentPlan?.id
  if (!id || payingPlan.value) {
    return
  }
  payingPlan.value = id
  try {
    const res: any = await $fetch(`/api/finance/installments/${id}/pay`, { method: 'POST' })
    toaster.add({
      title: res.settled ? 'Plan paid off' : 'Payment taken',
      description: `${formatCurrency(res.charged, { maximumFractionDigits: 2 })} for ${o.name} was paid from your wallet.`,
      icon: 'lucide:check',
      progress: true,
    })
    await Promise.all([refreshFinance(), refreshTx(), refreshOrders()])
  }
  catch (e) {
    toaster.add({ title: 'Payment not taken', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    payingPlan.value = null
  }
}

/* ------------------------------------------------------ payment methods */
const methods = computed(() => methodsData.value?.methods ?? [])
function badge(m: Method) {
  if (m.kind === 'bacs_debit') {
    return 'BACS'
  }
  const b = (m.brand ?? '').toLowerCase()
  return b.includes('visa') ? 'VISA' : b.includes('master') ? 'MC' : b.includes('amex') ? 'AMEX' : 'CARD'
}
const BADGE_BG: Record<string, string> = { VISA: 'bg-[#101828]', MC: 'bg-[#EC6453]', AMEX: 'bg-[#6EA8FE]', BACS: 'bg-[#101828]', CARD: 'bg-[#5B6670]' }
function methodTitle(m: Method) {
  if (m.kind === 'bacs_debit') {
    return `Direct Debit${m.last4 ? ` ending ${m.last4}` : ''}`
  }
  const b = badge(m)
  return `${b === 'VISA' ? 'Visa' : b === 'MC' ? 'Mastercard' : b === 'AMEX' ? 'Amex' : 'Card'}${m.last4 ? ` ending ${m.last4}` : ''}`
}
// The design confirms a removal inside the row rather than in a sheet.
const removeTarget = ref<Method | null>(null)
const methodBusy = ref(false)
async function makeDefault(m: Method) {
  methodBusy.value = true
  try {
    await $fetch(`/api/finance/payment-methods/${m.id}`, { method: 'PATCH', body: { action: 'set_default' } })
    await refreshMethods()
  }
  catch (e) {
    toaster.add({ title: 'Default not changed', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    methodBusy.value = false
  }
}
async function confirmRemove() {
  const m = removeTarget.value
  if (!m) {
    return
  }
  methodBusy.value = true
  try {
    await $fetch(`/api/finance/payment-methods/${m.id}`, { method: 'DELETE' })
    removeTarget.value = null
    await refreshMethods()
  }
  catch (e) {
    // The server refuses to strand an active plan; say why, verbatim.
    toaster.add({ title: 'Not removed', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    methodBusy.value = false
  }
}

/* ------------------------------------------------------ add funds flow */
const payOpen = ref(false)
const payMode = ref<'topup' | 'add-method'>('topup')
function openAdd(mode: 'topup' | 'add-method' = 'topup') {
  payMode.value = mode
  payOpen.value = true
}
onMounted(() => {
  if (route.query.add) {
    openAdd('topup')
    const { add: _a, ...rest } = route.query
    router.replace({ query: rest })
  }
})
async function onPaySuccess() {
  await Promise.all([refreshFinance(), refreshTx(), refreshMethods(), refreshOrders()])
}

/* --------------------------------------------------------- transactions */
type TxFilter = 'all' | 'pay' | 'top'
const txf = ref<TxFilter>('all')
const projectNames = computed(() => new Map((ordersData.value?.data ?? []).map(o => [o.id, o.name])))
const transactions = computed(() => (txData.value?.transactions ?? []).map((t) => {
  const top = t.amount > 0
  const [head, ...tail] = (t.description ?? '').split(' — ')
  const project = t.projectId ? projectNames.value.get(t.projectId) : undefined
  return {
    ...t,
    kind: (top ? 'top' : 'pay') as TxFilter,
    title: top ? (t.type === 'REFUND' ? 'Refund' : 'Wallet top-up') : (project ?? tail.join(' — ') ?? head ?? 'Payment'),
    sub: top ? (t.type === 'REFUND' ? (t.description ?? '') : 'Added by you') : (project ? head : (tail.length ? head : (t.description ?? 'Payment'))) || 'Payment',
    method: top ? (t.type === 'REFUND' ? 'Refund' : 'Top-up') : 'Wallet',
    state: t.status === 'COMPLETED' ? 'Completed' : t.status.charAt(0) + t.status.slice(1).toLowerCase(),
  }
}))
const filteredTx = computed(() => transactions.value.filter(t => txf.value === 'all' || t.kind === txf.value))

function exportCsv() {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [['Date', 'Description', 'Detail', 'Method', 'Amount (GBP)', 'Status'].join(',')]
  for (const t of filteredTx.value) {
    lines.push([ukDate(t.date), esc(t.title), esc(t.sub), t.method, t.amount.toFixed(2), t.state].join(','))
  }
  // A BOM so Excel opens the £ and the dashes as UTF-8.
  const blob = new Blob([String.fromCharCode(0xFEFF), lines.join(String.fromCharCode(13, 10))], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `apex-transactions-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const H2 = 'font-heading text-fg-heading m-0 text-[21px] font-bold tracking-[-0.02em]'
const CARD = 'bg-card border-line-subtle shadow-panel rounded-[20px] border'
const PILL = 'apex-ring h-[38px] shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3.5 text-[13.5px] font-semibold'
</script>

<template>
  <div class="@container mx-auto flex max-w-[1260px] flex-col gap-[clamp(22px,2.4vw,30px)] px-[clamp(16px,3vw,40px)] pb-[clamp(28px,4vw,56px)] pt-[clamp(20px,3vw,40px)]">
    <!-- ================================================= credit application -->
    <WalletCreditApply v-if="creditView === 'apply' && credit?.state === 'none'" :ceiling="appData?.ceiling ?? 0" @exit="exitCredit" @submitted="onApplied" />

    <!-- ===================================================== application status -->
    <section v-else-if="creditView === 'status' && application" aria-labelledby="h-status" class="flex w-full max-w-[1000px] flex-col gap-[22px]">
      <button type="button" class="apex-ring text-fg-body hover:text-fg-heading inline-flex min-h-10 cursor-pointer items-center gap-2 self-start rounded-md text-sm font-semibold" @click="exitCredit">
        <Icon name="lucide:arrow-left" class="size-4" />Wallet &amp; credit
      </button>
      <div class="flex flex-col gap-2">
        <h1 id="h-status" class="font-heading text-fg-heading m-0 text-[clamp(26px,1.2vw+18px,34px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
          Credit line application
        </h1>
        <span class="text-fg-muted text-sm">Reference {{ creditRef(application.id) }} · submitted {{ stamp(application.submittedAt) }}</span>
      </div>
      <div v-if="justApplied && application.status === 'SUBMITTED'" role="status" class="apex-pop-in bg-st-success-bg text-st-success-fg flex items-center gap-3 rounded-[14px] px-4 py-3.5 text-sm font-semibold">
        <span aria-hidden="true" class="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#22B07D] text-xs text-white">✓</span>Application sent. We will let you know here and in your notifications as soon as we have a decision.
      </div>
      <div class="grid items-start gap-5 @min-[860px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div :class="CARD" class="p-[clamp(20px,2vw,26px)]">
          <ol aria-label="Progress" class="m-0 flex list-none flex-col p-0">
            <li v-for="(tl, i) in statusSteps" :key="tl.t" class="flex gap-4">
              <span class="flex shrink-0 flex-col items-center">
                <span
                  class="inline-flex size-[30px] items-center justify-center rounded-full border-2 text-[13px] font-bold text-white"
                  :class="tl.done ? 'border-[#22B07D] bg-[#22B07D]' : tl.now ? 'bg-accent border-accent apex-pulse' : 'border-line-rule bg-transparent'"
                >{{ tl.done ? '✓' : '' }}</span>
                <span class="block min-h-6 w-0.5 grow" :class="i === statusSteps.length - 1 ? 'bg-transparent' : tl.done ? 'bg-[#22B07D]' : 'bg-line-soft'" />
              </span>
              <span class="flex min-w-0 grow flex-col gap-1 pb-6 pt-1">
                <span class="text-[15.5px] font-semibold" :class="tl.done || tl.now ? 'text-fg-heading' : 'text-fg-muted'">{{ tl.t }}</span>
                <span class="text-fg-muted text-[13.5px] leading-[1.55]">{{ tl.d }}</span>
              </span>
            </li>
          </ol>
        </div>
        <div class="flex min-w-0 flex-col gap-4">
          <div :class="CARD" class="flex flex-col gap-3 px-5 py-[18px]">
            <span class="text-fg-muted text-xs font-bold uppercase tracking-[.06em]">Your application</span>
            <div v-for="sf in statusFacts" :key="sf.k" class="flex items-baseline justify-between gap-3 text-[13.5px]">
              <span class="text-fg-muted whitespace-nowrap">{{ sf.k }}</span><span class="text-fg-heading min-w-0 text-right font-semibold">{{ sf.v }}</span>
            </div>
          </div>
          <div :class="CARD" class="flex flex-col gap-2.5 px-5 py-[18px]">
            <span class="text-fg-body text-sm leading-[1.55]">Need to change something? Message us and we will update your application.</span>
            <NuxtLink to="/dashboards/support?tab=new" class="apex-ring text-accent-ink self-start rounded-md text-sm font-semibold hover:underline">
              Message support →
            </NuxtLink>
            <template v-if="application.status === 'SUBMITTED'">
              <div v-if="withdrawAsk" class="bg-raised mt-1.5 flex flex-col gap-2.5 rounded-xl px-3.5 py-3">
                <span class="text-fg-body text-[13.5px] leading-normal">Withdraw this application? Your ID and bank statements are deleted straight away.</span>
                <div class="flex justify-end gap-1.5">
                  <button type="button" class="apex-ring text-fg-body min-h-[38px] cursor-pointer rounded-[10px] px-3 text-[13.5px] font-semibold" @click="withdrawAsk = false">
                    Keep it
                  </button>
                  <button type="button" :disabled="withdrawing" class="apex-ring min-h-[38px] cursor-pointer rounded-[10px] bg-[#EC6453] px-3.5 text-[13.5px] font-semibold text-white disabled:opacity-60" @click="withdraw">
                    Withdraw
                  </button>
                </div>
              </div>
              <button v-else type="button" class="apex-ring text-fg-body mt-1 min-h-9 cursor-pointer self-start rounded-md text-[13.5px] font-semibold" @click="withdrawAsk = true">
                Withdraw application
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3.5">
        <div class="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
          <h1 class="font-heading text-fg-heading m-0 text-[clamp(28px,1.3vw+18px,38px)] font-extrabold leading-[1.06] tracking-[-0.03em]">
            Wallet &amp; <span class="text-fg-accent">credit</span>
          </h1>
          <p class="text-fg-body m-0 max-w-[52ch] text-[clamp(15px,.3vw+14px,17px)] leading-relaxed">
            Your balance, payment plans and receipts. Figures include VAT.
          </p>
        </div>
        <ApexButton @click="openAdd('topup')">
          Add funds
        </ApexButton>
      </div>

      <div role="group" aria-label="Wallet sections" class="border-line-subtle flex gap-1 overflow-x-auto border-b [scrollbar-width:none]">
        <button
          v-for="[id, label] in TABS"
          :key="id"
          type="button"
          :aria-pressed="tab === id"
          class="apex-ring h-[46px] shrink-0 cursor-pointer whitespace-nowrap bg-transparent px-3.5 text-[14.5px]"
          :class="tab === id ? 'text-fg-heading font-bold shadow-[inset_0_-2px_0_var(--accent)]' : 'text-fg-muted font-semibold'"
          @click="setTab(id)"
        >
          {{ label }}
        </button>
      </div>

      <!-- ============================================================ overview -->
      <template v-if="tab === 'overview'">
        <section aria-label="Balance and credit" class="flex flex-wrap gap-5">
          <div class="relative flex min-h-[240px] min-w-0 flex-[1.2_1_320px] flex-col gap-1.5 overflow-hidden rounded-3xl bg-[#6C40E8] p-[clamp(22px,2vw,28px)] text-white shadow-violet">
            <div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_110%_at_100%_0%,rgba(155,121,246,.75)_0%,rgba(155,121,246,0)_58%)]" />
            <div class="relative mb-3 flex items-center gap-3">
              <span class="inline-flex size-[38px] items-center justify-center rounded-xl bg-white/[.16]"><Icon name="solar:wallet-2-linear" class="size-5" /></span>
              <span class="text-sm font-semibold">Wallet balance</span>
            </div>
            <span class="font-heading relative text-[clamp(40px,1.8vw+20px,54px)] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{{ formatCurrency(balance) }}</span>
            <span class="relative text-sm">Your kickoff payments and instalments are taken from here.</span>
            <div class="relative mt-auto flex flex-wrap items-center gap-4 pt-[22px]">
              <ApexButton variant="white" size="sm" @click="openAdd('topup')">
                Add funds
              </ApexButton>
              <button type="button" class="apex-ring inline-flex min-h-11 cursor-pointer items-center rounded-md text-sm font-semibold text-white" @click="setTab('tx')">
                Transactions →
              </button>
            </div>
          </div>
          <div v-if="credit" :class="CARD" class="flex min-w-0 flex-[1_1_300px] flex-col gap-4 p-[clamp(20px,2vw,24px)]">
            <div class="flex items-center justify-between gap-3">
              <span class="text-fg-heading text-sm font-semibold">Credit line</span>
              <ApexStatusChip v-if="credit.state === 'none'" tone="neutral" :dot="false">
                Not set up
              </ApexStatusChip>
              <ApexStatusChip v-else :tone="credit.state === 'approved' ? 'success' : 'warning'">
                {{ credit.state === 'review' ? 'Under review' : credit.state === 'frozen' ? 'On hold' : 'Approved' }}
              </ApexStatusChip>
            </div>
            <template v-if="credit.state === 'none'">
              <span class="font-heading text-fg-heading text-[22px] font-bold leading-[1.2] tracking-[-0.02em]">Run more than one project at once</span>
              <p class="text-fg-body m-0 text-sm leading-relaxed">
                A credit line sets how much you can have in open instalment plans at the same time. Applying takes about five minutes.
              </p>
              <div class="flex flex-col gap-2">
                <span v-for="t in CREDIT_TICKS" :key="t" class="text-fg-body flex items-start gap-2.5 text-[13.5px] leading-normal">
                  <span aria-hidden="true" class="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#22B07D] text-[10px] text-white">✓</span>{{ t }}
                </span>
              </div>
              <p v-if="credit.application?.status === 'DECLINED'" class="text-fg-muted m-0 text-[13px] leading-normal">
                Your last application was not approved{{ credit.application.decidedAt ? ` on ${ukDate(credit.application.decidedAt)}` : '' }}. You can apply again.
              </p>
              <div v-if="creditApplicationsOpen" class="mt-auto pt-1.5">
                <ApexButton size="sm" @click="openCredit('apply')">
                  Apply for a credit line
                </ApexButton>
              </div>
              <p v-else class="text-fg-muted mt-auto pt-1.5 text-[13px] leading-normal">
                Credit applications are closed at the moment. You can still order one plan at a time.
              </p>
            </template>
            <template v-else-if="credit.state === 'review'">
              <div class="flex flex-wrap items-baseline gap-2.5">
                <span class="font-heading text-fg-heading text-4xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">{{ formatCurrency(credit.application?.requestedLimit ?? 0) }}</span>
                <span class="text-fg-muted text-[13.5px]">requested</span>
              </div>
              <div aria-hidden="true" class="flex items-center gap-1.5">
                <span class="bg-accent block h-1.5 grow rounded-full" /><span class="bg-accent block h-1.5 grow rounded-full opacity-45" /><span class="bg-track block h-1.5 grow rounded-full" />
              </div>
              <p class="text-fg-body m-0 text-sm leading-relaxed">
                We are checking your business details. We will let you know here and in your notifications, usually within one working day.
              </p>
              <button type="button" class="apex-ring text-accent-ink mt-auto min-h-10 cursor-pointer self-start rounded-md text-sm font-semibold" @click="openCredit('status')">
                View application →
              </button>
            </template>
            <template v-else>
              <div class="flex flex-wrap items-baseline gap-2.5">
                <span class="font-heading text-fg-heading text-4xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">{{ formatCurrency(credit.available) }}</span>
                <span class="text-fg-muted text-[13.5px]">available of {{ formatCurrency(credit.limit) }}</span>
              </div>
              <div role="progressbar" aria-label="Credit committed" :aria-valuenow="creditPct" aria-valuemin="0" aria-valuemax="100" class="bg-track h-2 overflow-hidden rounded-full">
                <div class="bg-accent h-full rounded-full" :style="{ width: `${creditPct}%` }" />
              </div>
              <div class="text-fg-muted flex justify-between gap-3 text-[13px]">
                <span>{{ formatCurrency(credit.used) }} committed to your plans</span><span class="tabular-nums">{{ creditPct }}%</span>
              </div>
              <p class="border-line-soft text-fg-body m-0 mt-auto border-t pt-3.5 text-[13px] leading-[1.55]">
                {{ credit.state === 'frozen' ? 'Your credit line is on hold, so new monthly plans cannot use it. Message support to find out why.' : 'Your credit line is the most you can have in open instalment plans at once. It is not a loan and no interest is charged.' }}
              </p>
            </template>
          </div>
        </section>

        <div class="grid items-start gap-5 @min-[860px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section class="flex min-w-0 flex-col gap-3.5">
            <div class="flex items-baseline justify-between gap-4">
              <h2 :class="H2">
                Coming up
              </h2>
              <button type="button" class="apex-ring text-accent-ink cursor-pointer rounded-md text-sm font-semibold" @click="setTab('plans')">
                All plans →
              </button>
            </div>
            <div :class="CARD" class="overflow-hidden">
              <div v-for="u in upcoming" :key="u.key" class="border-line-soft flex flex-wrap items-center gap-3.5 border-b px-5 py-4 last:border-b-0">
                <span class="bg-raised flex w-[46px] shrink-0 flex-col items-center rounded-xl py-1.5">
                  <template v-if="u.date">
                    <span class="text-fg-muted text-[10.5px] font-bold uppercase tracking-[.06em]">{{ u.date.toLocaleDateString('en-GB', { month: 'short' }) }}</span>
                    <span class="font-heading text-fg-heading text-lg font-extrabold leading-[1.1]">{{ String(u.date.getDate()).padStart(2, '0') }}</span>
                  </template>
                  <template v-else>
                    <span class="text-fg-muted text-[10.5px] font-bold uppercase tracking-[.06em]">Date</span>
                    <span class="font-heading text-fg-heading text-sm font-extrabold leading-[1.4]">TBC</span>
                  </template>
                </span>
                <span class="flex min-w-0 flex-[1_1_160px] flex-col gap-0.5">
                  <span class="text-fg-heading text-[15px] font-semibold">{{ u.name }}</span>
                  <span class="text-fg-muted text-[13px]">{{ u.meta }}</span>
                </span>
                <span class="font-heading text-fg-heading text-[17px] font-bold tabular-nums">{{ formatCurrency(u.amount) }}</span>
              </div>
              <p v-if="!upcoming.length" class="text-fg-body m-0 px-5 py-6 text-sm">
                Nothing is due. Payments appear here as soon as an order has a schedule.
              </p>
            </div>
          </section>

          <section class="flex min-w-0 flex-col gap-3.5">
            <h2 :class="H2">
              Payment methods
            </h2>
            <div :class="CARD" class="flex flex-col p-2">
              <div v-for="(m, i) in methods" :key="m.id" class="flex flex-col" :class="i ? 'border-line-soft border-t' : ''">
                <div class="flex flex-wrap items-center gap-3 p-3">
                  <span class="inline-flex h-8 w-[46px] shrink-0 items-center justify-center rounded-[7px] text-[10.5px] font-extrabold tracking-[.04em] text-white" :class="BADGE_BG[badge(m)]">{{ badge(m) }}</span>
                  <span class="flex min-w-0 flex-[1_1_140px] flex-col gap-0.5">
                    <span class="text-fg-heading truncate text-[14.5px] font-semibold">{{ methodTitle(m) }}</span>
                    <span class="text-fg-muted text-[12.5px]">{{ m.expMonth && m.expYear ? `Expires ${String(m.expMonth).padStart(2, '0')}/${String(m.expYear).slice(-2)}` : m.usable ? 'Ready to use' : 'Waiting for confirmation' }}</span>
                  </span>
                  <ApexStatusChip v-if="m.isDefault" tone="neutral" :dot="false">
                    Default
                  </ApexStatusChip>
                  <div class="flex items-center gap-0.5">
                    <button v-if="!m.isDefault && m.usable" type="button" :disabled="methodBusy" class="apex-ring text-accent-ink hover:bg-accent-tint min-h-9 cursor-pointer rounded-[10px] px-2.5 text-[13px] font-semibold" @click="makeDefault(m)">
                      Make default
                    </button>
                    <button type="button" class="apex-ring text-fg-body hover:bg-hover min-h-9 cursor-pointer rounded-[10px] px-2.5 text-[13px] font-semibold" :aria-label="`Remove ${methodTitle(m)}`" @click="removeTarget = m">
                      Remove
                    </button>
                  </div>
                </div>
                <div v-if="removeTarget?.id === m.id" class="bg-raised mx-3 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-xl px-3.5 py-3">
                  <span class="text-fg-body flex-[1_1_200px] text-[13.5px] leading-normal">Remove {{ methodTitle(m) }}? It will no longer be used for payments.</span>
                  <div class="flex gap-1.5">
                    <button type="button" class="apex-ring text-fg-body min-h-[38px] cursor-pointer rounded-[10px] px-3 text-[13.5px] font-semibold" @click="removeTarget = null">
                      Cancel
                    </button>
                    <button type="button" :disabled="methodBusy" class="apex-ring min-h-[38px] cursor-pointer rounded-[10px] bg-[#EC6453] px-3.5 text-[13.5px] font-semibold text-white disabled:opacity-60" @click="confirmRemove">
                      {{ m.kind === 'bacs_debit' ? 'Remove' : 'Remove card' }}
                    </button>
                  </div>
                </div>
              </div>
              <button type="button" class="apex-ring text-accent-ink hover:bg-hover flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold" :class="methods.length ? 'border-line-soft border-t' : ''" @click="openAdd('add-method')">
                <Icon name="lucide:plus" class="size-[17px]" />Add a card
              </button>
            </div>
            <div :class="CARD" class="flex items-center gap-3.5 px-5 py-[18px]">
              <span class="flex min-w-0 grow flex-col gap-[3px]">
                <span class="text-fg-heading text-[14.5px] font-semibold">Pay instalments automatically</span>
                <span class="text-fg-muted text-[13px] leading-normal">{{ autoPay ? 'Each instalment is taken from your wallet on its due date.' : 'You pay each instalment yourself from the wallet.' }}</span>
              </span>
              <button
                type="button"
                role="switch"
                :aria-checked="autoPay"
                aria-label="Pay instalments automatically"
                class="apex-ring relative h-7 w-[46px] shrink-0 cursor-pointer rounded-full transition-colors"
                :class="autoPay ? 'bg-accent' : 'bg-line-strong'"
                @click="toggleAutoPay"
              >
                <span class="absolute top-[3px] size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(17,31,34,.25)] transition-[left] duration-150" :class="autoPay ? 'left-[21px]' : 'left-[3px]'" />
              </button>
            </div>
          </section>
        </div>
      </template>

      <!-- ======================================================== transactions -->
      <template v-if="tab === 'tx'">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Filter transactions" class="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            <button
              v-for="[id, label] in ([['all', 'All'], ['pay', 'Payments'], ['top', 'Top-ups']] as const)"
              :key="id"
              type="button"
              :aria-pressed="txf === id"
              :class="[PILL, txf === id ? 'bg-fg-heading border-fg-heading text-card' : 'bg-card border-line-subtle text-fg-body']"
              @click="txf = id"
            >
              {{ label }}
            </button>
          </div>
          <button type="button" :disabled="!filteredTx.length" class="apex-ring border-line-subtle bg-card text-fg-heading inline-flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" @click="exportCsv">
            <Icon name="solar:download-minimalistic-linear" class="size-[17px]" />Export CSV
          </button>
        </div>
        <div role="table" aria-label="Transactions" :class="CARD" class="overflow-hidden">
          <div role="row" class="bg-raised border-line-soft text-fg-muted hidden grid-cols-[110px_minmax(0,1fr)_120px_110px_110px] items-center gap-4 border-b px-5 py-3 text-xs font-bold uppercase tracking-[.06em] @min-[760px]:grid">
            <span role="columnheader">Date</span><span role="columnheader">Description</span><span role="columnheader">Method</span><span role="columnheader" class="text-right">Amount</span><span role="columnheader">Status</span>
          </div>
          <div v-for="t in filteredTx" :key="t.id" role="row" class="border-line-soft flex items-center gap-3 border-b px-4 py-3.5 text-sm @min-[760px]:grid @min-[760px]:grid-cols-[110px_minmax(0,1fr)_120px_110px_110px] @min-[760px]:gap-4 @min-[760px]:px-5">
            <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl @min-[760px]:hidden" :class="t.kind === 'top' ? 'bg-st-success-bg text-st-success-fg' : 'bg-raised text-fg-heading'">
              <Icon :name="t.kind === 'top' ? 'lucide:arrow-down-left' : 'lucide:arrow-up-right'" class="size-[18px]" />
            </span>
            <span role="cell" class="text-fg-muted hidden tabular-nums @min-[760px]:block">{{ ukDate(t.date) }}</span>
            <span role="cell" class="flex min-w-0 grow flex-col gap-0.5">
              <span class="text-fg-heading truncate text-[14.5px] font-semibold @min-[760px]:text-sm">{{ t.title }}</span>
              <span class="text-fg-muted truncate text-[12.5px]"><span class="@min-[760px]:hidden">{{ ukDate(t.date) }} · </span>{{ t.sub }}</span>
            </span>
            <span role="cell" class="text-fg-body hidden @min-[760px]:block">{{ t.method }}</span>
            <span role="cell" class="text-right text-[14.5px] font-bold tabular-nums @min-[760px]:text-sm" :class="t.amount > 0 ? 'text-st-success-fg' : 'text-fg-heading'">{{ t.amount > 0 ? '+' : '−' }}{{ formatCurrency(Math.abs(t.amount), { maximumFractionDigits: 2 }) }}</span>
            <span role="cell" class="hidden @min-[760px]:block"><ApexStatusChip :tone="t.status === 'COMPLETED' ? 'success' : 'neutral'">{{ t.state }}</ApexStatusChip></span>
          </div>
          <p v-if="!filteredTx.length" class="text-fg-body m-0 px-5 py-6 text-sm">
            No {{ txf === 'top' ? 'top-ups' : txf === 'pay' ? 'payments' : 'transactions' }} yet.
          </p>
          <span class="text-fg-muted block px-5 py-3.5 text-[12.5px]">Each row is a receipt from your wallet's ledger. VAT invoices are sent by our accounts team; ask in Support if you need one reissued.</span>
        </div>
      </template>

      <!-- ======================================================= payment plans -->
      <template v-if="tab === 'plans'">
        <div v-if="plans.length" class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-5">
          <div v-for="{ o, s } in plans" :key="o.id" class="bg-card border-line-subtle shadow-panel flex min-w-0 flex-col gap-4 rounded-[22px] border p-[22px]">
            <div class="flex items-start justify-between gap-3">
              <span class="flex min-w-0 flex-col gap-[3px]">
                <span class="font-heading text-fg-heading text-lg font-semibold tracking-[-0.02em]">{{ o.name }}</span>
                <span class="text-fg-muted text-[13px]">{{ [o.category, o.planName].filter(Boolean).join(' · ') || orderRef(o.id) }}</span>
              </span>
              <ApexStatusChip :tone="s.started ? 'violet' : 'warning'">
                {{ s.started ? (o.installmentPlan?.status === 'settled' ? 'Paid off' : 'On track') : 'Not started' }}
              </ApexStatusChip>
            </div>
            <span class="font-heading text-fg-heading text-[32px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
              {{ formatCurrency(s.monthly || s.total) }}<span v-if="s.monthly" class="text-fg-muted text-[13px] font-semibold"> /mo</span>
            </span>
            <div aria-hidden="true" class="flex min-h-2.5 flex-wrap gap-[5px]">
              <template v-if="s.payments && s.payments <= 24">
                <span v-for="i in s.payments" :key="i" class="block size-2.5 rounded-full" :class="i <= s.paidCount ? 'bg-accent' : 'bg-dot-unpaid'" />
              </template>
            </div>
            <span class="text-fg-muted text-[13px]">
              {{ s.retainer ? `${s.payments}-month minimum, then rolling monthly` : s.kind === 'fixed' ? (s.deposit ? `${s.paidCount} of ${s.payments} paid after a ${formatCurrency(s.deposit)} deposit` : `${s.paidCount} of ${s.payments} paid · no deposit`) : s.kind === 'legacy' ? `${s.paidCount} of ${s.payments} paid` : 'Paid at kickoff' }}
            </span>
            <div class="border-line-soft flex flex-col gap-[9px] border-t pt-3.5">
              <div class="flex justify-between gap-3 text-[13.5px] leading-[1.4]">
                <span class="text-fg-body whitespace-nowrap">{{ s.started ? 'Next payment' : 'First payment' }}</span>
                <span class="text-fg-heading whitespace-nowrap font-semibold tabular-nums">{{ s.nextDue ? ukDate(s.nextDue) : s.started ? '—' : 'After kickoff' }}</span>
              </div>
              <div class="flex justify-between gap-3 text-[13.5px] leading-[1.4]">
                <span class="text-fg-body whitespace-nowrap">Paid so far</span><span class="text-fg-heading whitespace-nowrap font-semibold tabular-nums">{{ formatCurrency(s.paid) }}</span>
              </div>
              <div class="flex justify-between gap-3 text-[13.5px] leading-[1.4]">
                <span class="text-fg-body whitespace-nowrap">{{ s.retainer ? 'Minimum term' : 'Remaining' }}</span>
                <span class="text-fg-heading whitespace-nowrap font-semibold tabular-nums">{{ formatCurrency(s.retainer ? s.total : Math.max(0, s.total - s.paid)) }}</span>
              </div>
            </div>
            <div class="mt-auto flex flex-wrap items-center justify-between gap-3">
              <NuxtLink :to="`/dashboards/orders?project=${o.id}`" class="apex-ring text-accent-ink rounded-md text-sm font-semibold hover:underline">
                View order →
              </NuxtLink>
              <ApexButton v-if="o.installmentPlan?.status === 'active' && s.nextDue" size="sm" variant="soft" :disabled="payingPlan === o.installmentPlan.id" @click="payNext(o)">
                Pay {{ formatCurrency(s.monthly) }} now
              </ApexButton>
            </div>
          </div>
        </div>
        <div v-else class="border-line-rule flex flex-col items-center gap-3 rounded-[22px] border-[1.5px] border-dashed px-6 py-14 text-center">
          <span class="font-heading text-fg-heading text-[19px] font-semibold">No payment plans</span>
          <span class="text-fg-body max-w-[44ch] text-[14.5px] leading-relaxed">A plan appears here when you order a service paid monthly.</span>
          <ApexButton to="/dashboards/services" size="sm">
            Start an order
          </ApexButton>
        </div>
        <p class="text-fg-muted m-0 max-w-[72ch] text-[13px] leading-relaxed">
          Instalment plans are payment schedules for our own services, agreed directly with Apex. They are not credit agreements, no interest is charged and no credit check is carried out.
        </p>
      </template>
    </template>

    <WalletTopUp :open="payOpen" :mode="payMode" @close="payOpen = false" @success="onPaySuccess" />
  </div>
</template>
