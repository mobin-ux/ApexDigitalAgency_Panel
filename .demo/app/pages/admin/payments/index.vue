<script setup lang="ts">
import { personName, ukDateTime } from '~/utils/adminFormat'
import { ADMIN_INPUT, ADMIN_TH } from '~/utils/adminUi'

/**
 * Admin console — Payments & credit (`Admin Console.dc.html`).
 *
 * The design's two tabs, Payments (the ledger, with refunds for the roles
 * that may give one) and Credit lines (every line in place: limit,
 * committed, available), plus the three money screens the console already
 * had and the design does not draw: the instalment plans (charge or
 * waive the next payment), the withdrawal queue, and Rails — the payment
 * providers' health (configured rails and mode, whether the ledger
 * balances, stuck intents and failed webhooks), which had an endpoint and
 * no screen. Every action goes through the console's confirmation; a
 * refund asks for the reason the receipt and the audit log carry.
 */
/**
 * Admin — Payments. Financial control centre: platform aggregates on
 * top, then three tabs — the transaction ledger (with once-only wallet
 * refunds), the withdrawal-request queue (approve = audited, atomic,
 * no-overdraft debit) and platform-wide installment plans (real rows
 * linked to projects — admins can charge the due installment from the
 * customer's wallet or waive it, both audited).
 * Deep links: ?tab=withdrawals, ?userId=<id> (from user detail).
 */
definePageMeta({
  title: 'Payments & credit',
  layout: 'admin',
  middleware: 'admin',
})

const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()
const route = useRoute()

type Tab = 'transactions' | 'credit' | 'installments' | 'withdrawals' | 'rails'
const TAB_KEYS: Tab[] = ['transactions', 'credit', 'installments', 'withdrawals', 'rails']
const tab = ref<Tab>(TAB_KEYS.includes(route.query.tab as Tab) ? route.query.tab as Tab : 'transactions')

const tabs: { key: Tab, label: string }[] = [
  { key: 'transactions', label: 'Payments' },
  { key: 'credit', label: 'Credit lines' },
  { key: 'installments', label: 'Instalments' },
  { key: 'withdrawals', label: 'Withdrawals' },
  { key: 'rails', label: 'Rails' },
]

// --- Summary tiles ---
const { data: summary, refresh: refreshSummary } = await useFetch('/api/admin/finance/summary')

// --- Transactions tab ---
const txSearch = ref('')
const txSearchDebounced = ref('')
const txType = ref('')
const txStatus = ref('')
const txUserId = ref<string>(typeof route.query.userId === 'string' ? route.query.userId : '')
const txPage = ref(1)

watchDebounced(txSearch, (value) => {
  txSearchDebounced.value = value.trim()
}, { debounce: 300 })

watch([txSearchDebounced, txType, txStatus], () => {
  txPage.value = 1
})

const txQuery = computed(() => ({
  page: txPage.value,
  pageSize: 20,
  ...(txSearchDebounced.value ? { search: txSearchDebounced.value } : {}),
  ...(txType.value ? { type: txType.value } : {}),
  ...(txStatus.value ? { status: txStatus.value } : {}),
  ...(txUserId.value ? { userId: txUserId.value } : {}),
}))

const { data: txData, pending: txPending, refresh: refreshTx } = await useFetch('/api/admin/finance/transactions', { query: txQuery })

/** Ledger sign convention: outflows render negative regardless of stored sign. */
function txDisplay(t: { amount: number, type: string }) {
  const outflow = t.type === 'PAYMENT' || t.type === 'WITHDRAWAL' || (t.type === 'ADJUSTMENT' && t.amount < 0)
  return {
    negative: outflow,
    text: `${outflow ? '−' : '+'}${formatCurrency(Math.abs(t.amount))}`,
  }
}

const txTypeMeta: Record<string, { icon: string, class: string }> = {
  DEPOSIT: { icon: 'lucide:arrow-down-left', class: 'bg-[#22B07D]/14 text-[#22B07D]' },
  PAYMENT: { icon: 'lucide:shopping-bag', class: 'bg-primary-500/14 text-primary-400' },
  WITHDRAWAL: { icon: 'lucide:arrow-up-right', class: 'bg-[#EC6453]/14 text-[#EC6453]' },
  REFUND: { icon: 'lucide:undo-2', class: 'bg-[#6EA8FE]/14 text-[#6EA8FE]' },
  ADJUSTMENT: { icon: 'lucide:sliders-horizontal', class: 'bg-[#D9A521]/14 text-[#F2C14E]' },
}

function fmtDateTime(iso: string | Date) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// --- Refund modal ---
const refundTarget = ref<{ id: string, amount: number, user: { email: string } } | null>(null)
const refundReason = ref('')
const refunding = ref(false)

function openRefund(t: any) {
  refundTarget.value = t
  refundReason.value = ''
}

async function submitRefund() {
  if (!refundTarget.value || refunding.value)
    return
  refunding.value = true
  try {
    await $fetch('/api/admin/finance/refund', {
      method: 'POST',
      body: { transactionId: refundTarget.value.id, reason: refundReason.value },
    })
    toaster.add({ title: 'Refund issued', description: `${formatCurrency(Math.abs(refundTarget.value.amount))} returned to ${refundTarget.value.user.email}'s wallet.`, icon: 'lucide:check', progress: true })
    refundTarget.value = null
    await Promise.all([refreshTx(), refreshSummary()])
  }
  catch (error: any) {
    toaster.add({ title: 'Refund failed', description: error?.data?.message || 'The refund was not applied.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    refunding.value = false
  }
}

// --- Withdrawals tab ---
const wdStatus = ref('Processing')
const wdPage = ref(1)

watch(wdStatus, () => {
  wdPage.value = 1
})

const wdQuery = computed(() => ({
  page: wdPage.value,
  pageSize: 20,
  ...(wdStatus.value ? { status: wdStatus.value } : {}),
}))

const { data: wdData, pending: wdPending, refresh: refreshWd } = await useFetch('/api/admin/finance/withdrawals', { query: wdQuery })

const wdConfirm = ref<{ id: string, amount: number, action: 'approve' | 'reject', email: string } | null>(null)
const resolving = ref(false)

async function resolveWithdrawal() {
  if (!wdConfirm.value || resolving.value)
    return
  resolving.value = true
  try {
    await $fetch(`/api/admin/finance/withdrawals/${wdConfirm.value.id}`, {
      method: 'PATCH',
      body: { action: wdConfirm.value.action },
    })
    toaster.add({
      title: wdConfirm.value.action === 'approve' ? 'Withdrawal approved' : 'Withdrawal rejected',
      description: wdConfirm.value.action === 'approve' ? `${formatCurrency(wdConfirm.value.amount)} debited and recorded in the ledger.` : 'The request was rejected — no money moved.',
      icon: 'lucide:check',
      progress: true,
    })
    wdConfirm.value = null
    await Promise.all([refreshWd(), refreshSummary()])
  }
  catch (error: any) {
    toaster.add({ title: 'Could not resolve the request', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    resolving.value = false
  }
}

// --- Installments tab ---
const instPage = ref(1)
const instQuery = computed(() => ({ page: instPage.value, pageSize: 20 }))
const { data: instData, pending: instPending, refresh: refreshInst } = await useFetch('/api/admin/finance/installments', { query: instQuery })

// Admin actions on a plan: charge the due installment from the customer
// wallet, or waive it (no money movement). Both audited server-side.
const instBusy = ref<string | null>(null)
async function instAction(inst: any, action: 'charge' | 'waive') {
  if (instBusy.value)
    return
  instBusy.value = inst.id
  try {
    await $fetch(`/api/admin/finance/installments/${inst.id}`, { method: 'PATCH', body: { action } })
    toaster.add({
      title: action === 'charge' ? 'Installment charged' : 'Installment waived',
      description: action === 'charge'
        ? `Installment ${inst.monthsPaid + 1}/${inst.monthsTotal} was collected from ${inst.user.email}'s wallet.`
        : `Installment ${inst.monthsPaid + 1}/${inst.monthsTotal} for ${inst.project} was waived.`,
      icon: 'lucide:check',
      progress: true,
    })
    await Promise.all([refreshInst(), refreshSummary()])
  }
  catch (e: any) {
    toaster.add({ title: 'Action failed', description: e?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    instBusy.value = null
  }
}

function fmtDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ------------------------------------------------- console additions --- */

const { can } = useStaffAccess()
const { ask } = useAdminConfirm()
const canRefund = computed(() => can('money.refund'))

// Credit lines and rails load when their tab is first opened.
const { data: creditData, pending: creditPending, execute: loadCredit } = useFetch<any>('/api/admin/credit/applications', { immediate: false, server: false })
const { data: health, pending: healthPending, error: healthError, execute: loadHealth } = useFetch<any>('/api/admin/payments/health', { immediate: false, server: false })
watch(tab, (t) => {
  if (t === 'credit' && !creditData.value) {
    loadCredit()
  }
  if (t === 'rails' && !health.value) {
    loadHealth()
  }
}, { immediate: true })

const TX_LABEL: Record<string, string> = { DEPOSIT: 'Top-up', PAYMENT: 'Payment', WITHDRAWAL: 'Withdrawal', REFUND: 'Refund', ADJUSTMENT: 'Adjustment', AD_CREDIT: 'Ad credit', CREDIT_REPAY: 'Credit repayment', INSTALLMENT: 'Instalment' }
function txStatusTone(status: string) {
  const s = (status ?? '').toUpperCase()
  return s === 'REFUNDED' ? 'neutral' : s === 'FAILED' ? 'danger' : s === 'PENDING' ? 'warning' : 'success'
}

async function askRefund(t: any) {
  const reason = await ask({
    title: `Refund ${formatCurrency(Math.abs(t.amount))} to ${personName(t.user, 'the client')}?`,
    body: `${t.description || 'Payment'}. The money returns to the client’s wallet now.`,
    points: [{ tone: 'info', text: 'The payment is marked refunded in the ledger and on the client’s receipts.' }],
    reason: { required: true, label: 'Reason', placeholder: 'e.g. Duplicate charge', hint: 'Stored with the audit entry and shown on the client’s receipt.' },
    confirmLabel: 'Refund payment',
    danger: true,
  })
  if (reason === null) {
    return
  }
  refundTarget.value = t
  refundReason.value = reason
  await submitRefund()
}

async function askWithdrawal(w: any, action: 'approve' | 'reject') {
  const reason = await ask(action === 'approve'
    ? { title: `Approve ${formatCurrency(w.amount)} to ${w.user.email}?`, body: 'The amount is debited from the client’s wallet and recorded in the ledger.', points: [{ tone: 'info', text: `Wallet balance now ${formatCurrency(w.user.walletBalance)}.` }], confirmLabel: 'Approve and debit' }
    : { title: `Reject the withdrawal of ${formatCurrency(w.amount)}?`, body: 'No money moves. The client sees the request as rejected.', confirmLabel: 'Reject request', danger: true })
  if (reason === null) {
    return
  }
  wdConfirm.value = { id: w.id, amount: w.amount, action, email: w.user.email }
  await resolveWithdrawal()
}

async function askInstalment(inst: any, action: 'charge' | 'waive') {
  const reason = await ask(action === 'charge'
    ? { title: `Collect instalment ${inst.monthsPaid + 1} of ${inst.monthsTotal}?`, body: `${formatCurrency(inst.amountDue)} is taken from ${inst.user.email}’s wallet for ${inst.project}. If the wallet is short, nothing is charged.`, confirmLabel: 'Collect now' }
    : { title: `Waive instalment ${inst.monthsPaid + 1} of ${inst.monthsTotal}?`, body: `The client is not charged for this instalment of ${inst.project}. It is recorded as waived.`, points: [{ tone: 'warning', text: 'This reduces what the client owes; it cannot be undone from here.' }], confirmLabel: 'Waive instalment', danger: true })
  if (reason !== null) {
    await instAction(inst, action)
  }
}

const PILL = 'apex-ring inline-flex h-8 cursor-pointer items-center whitespace-nowrap rounded-full border px-[13px] text-[13px]'
const TAB_CLS = 'apex-ring -mb-px inline-flex h-10 shrink-0 cursor-pointer items-center border-b-2 text-sm'
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="Payments &" accent="credit" subtitle="Instalments collected through the portal. Figures include VAT. Failed payments stay visible until resolved." />

    <section class="grid grid-cols-2 gap-3.5 xl:grid-cols-4" aria-label="Summary">
      <AdminStatTile label="Collected, all time" :value="formatCurrency(summary?.totalRevenue ?? 0)" :hint="`${formatCurrency(summary?.revenue30d ?? 0)} in the last 30 days`" />
      <AdminStatTile label="Held in client wallets" :value="formatCurrency(summary?.walletLiability ?? 0)" />
      <AdminStatTile label="Outstanding on plans" :value="formatCurrency(summary?.installmentOutstanding ?? 0)" :hint="`${summary?.installmentCount ?? 0} active plans`" />
      <AdminStatTile label="Withdrawals to review" :value="summary?.pendingWithdrawalCount ?? 0" :hint="formatCurrency(summary?.pendingWithdrawalAmount ?? 0)" />
    </section>

    <div class="border-line-subtle flex gap-6 overflow-x-auto border-b" role="tablist" aria-label="Money sections">
      <button
        v-for="t in tabs" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key"
        :class="[TAB_CLS, tab === t.key ? 'border-accent text-fg-heading font-semibold' : 'text-fg-muted border-transparent font-medium']"
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- ===================================================== Payments -->
    <template v-if="tab === 'transactions'">
      <div class="flex flex-wrap items-center gap-2" role="tabpanel">
        <div class="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          <button
            v-for="[k, l] in ([['', 'All'], ['COMPLETED', 'Completed'], ['PENDING', 'Pending'], ['FAILED', 'Failed'], ['REFUNDED', 'Refunded']] as const)" :key="k || 'all'"
            type="button" :aria-pressed="txStatus === k"
            :class="[PILL, txStatus === k ? 'bg-accent border-transparent font-semibold text-white' : 'border-line-subtle text-fg-heading hover:bg-hover font-medium']"
            @click="txStatus = k"
          >
            {{ l }}
          </button>
        </div>
        <span class="hidden flex-1 xl:block" />
        <input v-model="txSearch" type="search" placeholder="Search client or description" aria-label="Search payments" :class="ADMIN_INPUT" class="h-9! min-w-0 flex-1 xl:w-[260px]! xl:flex-none">
      </div>
      <div v-if="txUserId" class="bg-accent-tint text-fg-heading flex items-center gap-3 rounded-xl px-4 py-3 text-[13.5px]">
        Showing one client’s payments.
        <button type="button" class="apex-ring text-accent-ink ms-auto rounded font-semibold" @click="txUserId = ''">
          Show everyone
        </button>
      </div>
      <section class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
        <div class="hidden grid-cols-[150px_170px_minmax(0,1fr)_110px_120px_100px] gap-3.5 px-[22px] py-3.5 xl:grid" :class="ADMIN_TH">
          <span>Date</span><span>Client</span><span>Description</span><span class="text-end">Amount</span><span>Status</span><span />
        </div>
        <div v-if="txPending" aria-hidden="true">
          <div v-for="i in 6" :key="i" class="border-line-soft h-[52px] animate-pulse border-t" />
        </div>
        <ul v-else-if="txData?.items?.length">
          <li v-for="t in txData.items" :key="t.id" class="border-line-soft grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 border-t px-[18px] py-3 sm:px-[22px] xl:grid-cols-[150px_170px_minmax(0,1fr)_110px_120px_100px]">
            <span class="text-fg-muted order-3 text-[12.5px] tabular-nums xl:order-none"><ClientOnly>{{ ukDateTime(t.createdAt) }}</ClientOnly></span>
            <span class="text-fg-heading truncate text-[13.5px] font-semibold">{{ personName(t.user) }}</span>
            <span class="text-fg-body order-4 col-span-2 truncate text-[13px] xl:order-none xl:col-span-1">{{ TX_LABEL[t.type] ?? t.type }} · {{ t.description || '—' }}</span>
            <span class="text-fg-heading text-end text-sm tabular-nums">{{ txDisplay(t).text }}</span>
            <AdminStatusChip :tone="txStatusTone(t.status)" :status="t.status" dot class="hidden xl:inline-flex" />
            <span class="hidden text-end xl:block">
              <button v-if="canRefund && t.type === 'PAYMENT' && t.status !== 'REFUNDED'" type="button" class="apex-ring text-accent-ink rounded text-[13px] font-semibold" :disabled="refunding" @click="askRefund(t)">Refund</button>
            </span>
          </li>
        </ul>
        <p v-else class="border-line-soft text-fg-body border-t px-[22px] py-8 text-center text-sm">
          No payments match these filters.
        </p>
      </section>
      <AdminPager v-if="txData && txData.pageCount > 1" :page="txData.page" :page-count="txData.pageCount" :total="txData.total" noun="payments" @update:page="txPage = $event" />
      <p class="text-fg-muted text-[12.5px]">
        {{ canRefund ? 'A refund returns the payment to the client’s wallet and marks it refunded.' : 'Refunds need Owner or Finance, so the control is not shown for your role.' }}
      </p>
    </template>

    <!-- ================================================== Credit lines -->
    <section v-else-if="tab === 'credit'" role="tabpanel" class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
      <div class="hidden grid-cols-[minmax(0,1fr)_150px_150px_150px_170px] gap-3.5 px-[22px] py-3.5 lg:grid" :class="ADMIN_TH">
        <span>Client</span><span class="text-end">Limit</span><span class="text-end">Committed</span><span class="text-end">Available</span><span>Credit line</span>
      </div>
      <div v-if="creditPending && !creditData" aria-hidden="true">
        <div v-for="i in 4" :key="i" class="border-line-soft h-[52px] animate-pulse border-t" />
      </div>
      <ul v-else-if="creditData?.lines?.length">
        <li v-for="l in creditData.lines" :key="l.id" class="border-line-soft grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 border-t px-[18px] py-3 sm:px-[22px] lg:grid-cols-[minmax(0,1fr)_150px_150px_150px_170px]">
          <NuxtLink :to="`/admin/users/${l.user.id}`" class="apex-ring text-fg-heading truncate rounded text-sm font-semibold">
            {{ personName(l.user) }}
          </NuxtLink>
          <span class="text-fg-heading text-end text-[13.5px] tabular-nums"><span class="text-fg-muted lg:hidden">Limit </span>{{ formatCurrency(l.limit) }}</span>
          <span class="text-fg-body text-[13.5px] tabular-nums lg:text-end"><span class="text-fg-muted lg:hidden">Committed </span>{{ formatCurrency(l.used) }}</span>
          <span class="text-fg-body text-end text-[13.5px] tabular-nums"><span class="text-fg-muted lg:hidden">Available </span>{{ formatCurrency(Math.max(0, l.limit - l.used)) }}</span>
          <AdminStatusChip :tone="l.status === 'FROZEN' ? 'danger' : 'success'" :label="l.status === 'FROZEN' ? 'Frozen' : 'Active'" dot />
        </li>
      </ul>
      <p v-else class="border-line-soft text-fg-body border-t px-[22px] py-8 text-center text-sm">
        No credit lines are in place. Lines are created when an application is approved.
      </p>
      <p class="border-line-soft text-fg-muted border-t px-[22px] py-3 text-[12.5px]">
        Applications are decided in <NuxtLink to="/admin/credit" class="apex-ring text-accent-ink rounded font-semibold">
          Credit applications
        </NuxtLink>.
      </p>
    </section>

    <!-- =================================================== Instalments -->
    <section v-else-if="tab === 'installments'" role="tabpanel" class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
      <div class="hidden grid-cols-[minmax(0,1fr)_150px_120px_130px_190px] gap-3.5 px-[22px] py-3.5 lg:grid" :class="ADMIN_TH">
        <span>Plan</span><span>Paid</span><span class="text-end">Next payment</span><span>Due</span><span />
      </div>
      <div v-if="instPending" aria-hidden="true">
        <div v-for="i in 4" :key="i" class="border-line-soft h-[56px] animate-pulse border-t" />
      </div>
      <ul v-else-if="instData?.items?.length">
        <li v-for="inst in instData.items" :key="inst.id" class="border-line-soft grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 border-t px-[18px] py-3 sm:px-[22px] lg:grid-cols-[minmax(0,1fr)_150px_120px_130px_190px]">
          <span class="min-w-0">
            <span class="text-fg-heading block truncate text-sm font-semibold">{{ inst.project }}</span>
            <span class="text-fg-muted mt-0.5 block truncate text-[12.5px]">{{ personName(inst.user) }}</span>
          </span>
          <span class="text-fg-body text-[13px] tabular-nums">{{ inst.monthsPaid }} of {{ inst.monthsTotal }} · {{ formatCurrency(inst.paid) }}</span>
          <span class="text-fg-heading text-[13.5px] tabular-nums lg:text-end">{{ formatCurrency(inst.amountDue) }}</span>
          <span class="text-fg-muted text-[12.5px]"><ClientOnly>{{ inst.status === 'settled' ? 'Settled' : inst.status === 'pending' ? 'After kickoff' : fmtDate(inst.nextDue) }}</ClientOnly></span>
          <span class="flex gap-2 lg:justify-end">
            <template v-if="inst.status !== 'settled' && inst.status !== 'pending' && inst.monthsPaid < inst.monthsTotal">
              <AdminButton size="sm" :disabled="instBusy === inst.id" @click="askInstalment(inst, 'charge')">Collect</AdminButton>
              <AdminButton size="sm" variant="danger-text" :disabled="instBusy === inst.id" @click="askInstalment(inst, 'waive')">Waive</AdminButton>
            </template>
            <AdminStatusChip v-else :tone="inst.status === 'settled' ? 'violet' : 'neutral'" :label="inst.status === 'settled' ? 'Complete' : 'Not started'" />
          </span>
        </li>
      </ul>
      <p v-else class="border-line-soft text-fg-body border-t px-[22px] py-8 text-center text-sm">
        No instalment plans yet.
      </p>
      <AdminPager v-if="instData && instData.pageCount > 1" :page="instData.page" :page-count="instData.pageCount" :total="instData.total" noun="plans" class="px-[22px] pb-3" @update:page="instPage = $event" />
    </section>

    <!-- =================================================== Withdrawals -->
    <template v-else-if="tab === 'withdrawals'">
      <div class="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        <button
          v-for="[k, l] in ([['Processing', 'To review'], ['Completed', 'Approved'], ['Rejected', 'Rejected'], ['', 'All']] as const)" :key="k || 'all'"
          type="button" :aria-pressed="wdStatus === k"
          :class="[PILL, wdStatus === k ? 'bg-accent border-transparent font-semibold text-white' : 'border-line-subtle text-fg-heading hover:bg-hover font-medium']"
          @click="wdStatus = k"
        >
          {{ l }}
        </button>
      </div>
      <section role="tabpanel" class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
        <div v-if="wdPending" aria-hidden="true">
          <div v-for="i in 3" :key="i" class="border-line-soft h-[56px] animate-pulse border-t first:border-t-0" />
        </div>
        <ul v-else-if="wdData?.items?.length">
          <li v-for="w in wdData.items" :key="w.id" class="border-line-soft flex flex-wrap items-center gap-3.5 border-t px-[18px] py-3 first:border-t-0 sm:px-[22px]">
            <span class="min-w-[180px] flex-1">
              <span class="text-fg-heading block truncate text-sm font-semibold">{{ personName(w.user) }}</span>
              <span class="text-fg-muted mt-0.5 block text-[12.5px]"><ClientOnly>Requested {{ fmtDate(w.createdAt) }}</ClientOnly> · wallet {{ formatCurrency(w.user.walletBalance) }}</span>
            </span>
            <span class="text-fg-heading text-sm font-semibold tabular-nums">{{ formatCurrency(w.amount) }}</span>
            <template v-if="w.status === 'Processing'">
              <AdminButton size="sm" variant="danger-text" :disabled="resolving" @click="askWithdrawal(w, 'reject')">
                Reject
              </AdminButton>
              <AdminButton size="sm" variant="primary" :disabled="resolving" @click="askWithdrawal(w, 'approve')">
                Approve
              </AdminButton>
            </template>
            <AdminStatusChip v-else :status="w.status" dot />
          </li>
        </ul>
        <p v-else class="text-fg-body px-[22px] py-8 text-center text-sm">
          Nothing here.
        </p>
      </section>
      <AdminPager v-if="wdData && wdData.pageCount > 1" :page="wdData.page" :page-count="wdData.pageCount" :total="wdData.total" noun="requests" @update:page="wdPage = $event" />
    </template>

    <!-- ========================================================= Rails -->
    <div v-else role="tabpanel" class="flex flex-col gap-5">
      <div v-if="healthError" role="alert" class="bg-st-danger-bg text-fg-heading rounded-xl px-4 py-3 text-[13.5px]">
        The rails’ health could not be read. {{ healthError.statusMessage }}
      </div>
      <div v-else-if="healthPending || !health" class="bg-card border-line-subtle h-40 animate-pulse rounded-2xl border" aria-hidden="true" />
      <template v-else>
        <div class="flex flex-wrap gap-2.5 rounded-xl px-4 py-3 text-[13.5px]" :class="health.status === 'healthy' ? 'bg-st-success-bg' : 'bg-st-warning-bg'">
          <Icon :name="health.status === 'healthy' ? 'lucide:check-circle' : 'lucide:alert-triangle'" class="text-fg-heading mt-0.5 size-4 shrink-0" />
          <span class="text-fg-heading flex-1">
            <template v-if="health.status === 'healthy'">The rails are healthy: the ledger balances and nothing is stuck.</template>
            <template v-else>
              <span v-for="w in health.warnings" :key="w" class="block">{{ w }}</span>
            </template>
          </span>
        </div>
        <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <AdminCard label="Providers" padded>
            <ul class="flex flex-col">
              <li v-for="p in health.providers" :key="p.name" class="border-line-soft flex flex-wrap items-center gap-2.5 border-t py-2.5 first:border-t-0">
                <span class="text-fg-heading flex-1 text-sm font-semibold capitalize">{{ p.name }}</span>
                <span class="text-fg-muted text-[12.5px]">{{ p.capabilities.join(', ') }}</span>
                <AdminStatusChip :tone="p.mode === 'live' ? 'success' : 'neutral'" :label="p.mode === 'live' ? 'Live' : 'Sandbox'" />
              </li>
            </ul>
          </AdminCard>
          <AdminCard label="Ledger" :meta="health.ledger.balanced ? 'Balanced' : 'Does not balance'" padded>
            <dl class="flex flex-col">
              <div v-for="a in health.ledger.accounts" :key="a.account" class="border-line-soft flex items-center gap-3 border-t py-2 first:border-t-0">
                <dt class="text-fg-body flex-1 font-mono text-xs">
                  {{ a.account }}
                </dt>
                <dd class="text-fg-heading text-[13.5px] tabular-nums">
                  {{ formatCurrency(a.balance) }}
                </dd>
              </div>
            </dl>
          </AdminCard>
          <AdminCard label="Intents and webhooks" padded>
            <dl class="grid grid-cols-2 gap-x-5 gap-y-3">
              <div>
                <dt class="text-fg-muted text-xs">
                  Stuck over an hour
                </dt><dd class="text-fg-heading text-sm tabular-nums">
                  {{ health.stuckIntents }}
                </dd>
              </div>
              <div>
                <dt class="text-fg-muted text-xs">
                  Refunds processing
                </dt><dd class="text-fg-heading text-sm tabular-nums">
                  {{ health.refundsPending }}
                </dd>
              </div>
              <div>
                <dt class="text-fg-muted text-xs">
                  Failed webhooks (all time)
                </dt><dd class="text-fg-heading text-sm tabular-nums">
                  {{ health.webhooks.failedTotal }}
                </dd>
              </div>
              <div>
                <dt class="text-fg-muted text-xs">
                  Webhooks, last 24h
                </dt><dd class="text-fg-heading text-sm tabular-nums">
                  {{ health.webhooks.last24h.reduce((n: number, r: any) => n + r.count, 0) }}
                </dd>
              </div>
            </dl>
          </AdminCard>
        </div>
      </template>
    </div>
  </AdminPage>
</template>
