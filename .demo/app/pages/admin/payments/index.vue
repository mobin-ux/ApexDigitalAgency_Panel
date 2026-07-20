<script setup lang="ts">
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
  title: 'Payments',
  layout: 'admin',
  middleware: 'admin',
})

const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()
const route = useRoute()

type Tab = 'transactions' | 'withdrawals' | 'installments'
const tab = ref<Tab>(route.query.tab === 'withdrawals' ? 'withdrawals' : route.query.tab === 'installments' ? 'installments' : 'transactions')

const tabs: { key: Tab, label: string, icon: string }[] = [
  { key: 'transactions', label: 'Transactions', icon: 'lucide:arrow-left-right' },
  { key: 'withdrawals', label: 'Withdrawals', icon: 'lucide:banknote' },
  { key: 'installments', label: 'Installments', icon: 'lucide:calendar-clock' },
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
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-6 pb-8 font-sans text-muted-400">
    <AdminPageHeader
      eyebrow="ADMIN · PAYMENTS"
      title="Payments"
      subtitle="The platform ledger, withdrawal queue and installment plans — every money movement in one place."
    />

    <!-- ========== SUMMARY TILES ========== -->
    <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Financial summary">
      <AdminStatTile
        label="Total revenue" :value="formatCurrency(summary?.totalRevenue ?? 0)" icon="lucide:trending-up" accent="green"
        :hint="`${formatCurrency(summary?.revenue30d ?? 0)} in the last 30 days`"
      />
      <AdminStatTile
        label="Wallet liability" :value="formatCurrency(summary?.walletLiability ?? 0)" icon="lucide:wallet" accent="violet"
        hint="Held across all customer wallets"
      />
      <AdminStatTile
        label="Pending withdrawals" :value="formatCurrency(summary?.pendingWithdrawalAmount ?? 0)" icon="lucide:banknote" accent="amber"
        :hint="`${summary?.pendingWithdrawalCount ?? 0} request(s) to review`"
      />
      <AdminStatTile
        label="Installments outstanding" :value="formatCurrency(summary?.installmentOutstanding ?? 0)" icon="lucide:calendar-clock" accent="blue"
        :hint="`${summary?.installmentCount ?? 0} active plan(s)`"
      />
    </section>

    <!-- ========== TAB BAR ========== -->
    <div class="flex items-center gap-2 overflow-x-auto rounded-full border border-white/8 bg-muted-800 p-[3px]" role="tablist" aria-label="Payments sections">
      <button
        v-for="t in tabs" :key="t.key"
        type="button"
        role="tab"
        :aria-selected="tab === t.key"
        class="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold transition"
        :class="tab === t.key ? 'bg-primary-500 text-white shadow-[0_6px_16px_rgba(125,83,242,0.32)]' : 'text-muted-400 hover:text-white'"
        @click="tab = t.key"
      >
        <Icon :name="t.icon" class="size-4" />{{ t.label }}
      </button>
    </div>

    <!-- ========== TRANSACTIONS ========== -->
    <section v-if="tab === 'transactions'" class="flex flex-col gap-4" aria-label="Transactions">
      <div v-if="txUserId" class="flex items-center gap-3 rounded-[14px] border border-primary-500/30 bg-primary-500/10 px-4 py-3 text-[13px] text-primary-200">
        <Icon name="lucide:filter" class="size-4 shrink-0" />
        Showing one customer's transactions only.
        <button type="button" class="ms-auto inline-flex items-center gap-1.5 font-semibold text-white hover:text-primary-200" @click="txUserId = ''">
          Clear <Icon name="lucide:x" class="size-3.5" />
        </button>
      </div>

      <div class="grid gap-3 rounded-[20px] border border-white/10 bg-muted-800 p-4 sm:grid-cols-2 xl:grid-cols-[1.8fr_1fr_1fr]">
        <label class="flex items-center gap-2.5 rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 focus-within:border-primary-400">
          <Icon name="lucide:search" class="size-4 shrink-0 text-muted-500" />
          <input v-model="txSearch" placeholder="Search description, id or customer email…" class="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-white outline-none placeholder:text-muted-500">
        </label>
        <select v-model="txType" aria-label="Filter by type" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-primary-400">
          <option value="">
            All types
          </option>
          <option value="DEPOSIT">
            Deposits
          </option>
          <option value="PAYMENT">
            Payments
          </option>
          <option value="WITHDRAWAL">
            Withdrawals
          </option>
          <option value="REFUND">
            Refunds
          </option>
          <option value="ADJUSTMENT">
            Adjustments
          </option>
        </select>
        <select v-model="txStatus" aria-label="Filter by status" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-primary-400">
          <option value="">
            All statuses
          </option>
          <option value="COMPLETED">
            Completed
          </option>
          <option value="PENDING">
            Pending
          </option>
          <option value="REFUNDED">
            Refunded
          </option>
        </select>
      </div>

      <div v-if="txPending" class="flex flex-col gap-2" aria-hidden="true">
        <div v-for="i in 6" :key="i" class="h-[68px] animate-pulse rounded-[16px] border border-white/5 bg-muted-800/60" />
      </div>

      <div v-else-if="txData?.items?.length" class="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.02]" role="list">
        <template v-for="(t, idx) in txData.items" :key="t.id">
          <div v-if="idx > 0" class="h-px bg-white/10" />
          <div role="listitem" class="flex items-center gap-4 px-[22px] py-4">
            <span class="flex size-[38px] shrink-0 items-center justify-center rounded-[10px]" :class="txTypeMeta[t.type]?.class ?? 'bg-white/5 text-muted-400'">
              <Icon :name="txTypeMeta[t.type]?.icon ?? 'lucide:circle'" class="size-[17px]" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[13.5px] font-semibold text-white">
                {{ t.description || t.type }}
              </div>
              <div class="mt-0.5 truncate text-[12.5px] text-muted-500">
                {{ t.user.email }} · {{ fmtDateTime(t.createdAt) }}
              </div>
            </div>
            <AdminStatusChip class="hidden sm:inline-flex" :status="t.status" />
            <span class="w-24 shrink-0 text-right text-[14px] font-bold tabular-nums" :class="txDisplay(t).negative ? 'text-[#EC6453]' : 'text-[#22B07D]'">
              {{ txDisplay(t).text }}
            </span>
            <button
              v-if="t.type === 'PAYMENT' && t.status !== 'REFUNDED'"
              type="button"
              class="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-muted-800 px-3 py-1.5 text-[12px] font-semibold text-muted-400 transition hover:border-[#6EA8FE]/40 hover:text-[#6EA8FE] md:inline-flex"
              @click="openRefund(t)"
            >
              <Icon name="lucide:undo-2" class="size-3.5" />Refund
            </button>
          </div>
        </template>
      </div>

      <AdminEmptyState v-else icon="lucide:receipt" title="No transactions match" subtitle="Try different filters." />

      <AdminPager
        v-if="txData" :page="txData.page" :page-count="txData.pageCount" :total="txData.total" noun="transactions"
        @update:page="txPage = $event"
      />
    </section>

    <!-- ========== WITHDRAWALS ========== -->
    <section v-else-if="tab === 'withdrawals'" class="flex flex-col gap-4" aria-label="Withdrawal requests">
      <div class="flex items-center gap-2 overflow-x-auto rounded-full border border-white/8 bg-muted-800 p-[3px] self-start" role="radiogroup" aria-label="Withdrawal status">
        <button
          v-for="s in ['Processing', 'Completed', 'Rejected', '']" :key="s || 'all'"
          type="button"
          role="radio"
          :aria-checked="wdStatus === s"
          class="shrink-0 rounded-full px-4 py-1.5 text-[13px] font-bold transition"
          :class="wdStatus === s ? 'bg-white/10 text-white' : 'text-muted-400 hover:text-white'"
          @click="wdStatus = s"
        >
          {{ s || 'All' }}
        </button>
      </div>

      <div v-if="wdPending" class="flex flex-col gap-2" aria-hidden="true">
        <div v-for="i in 4" :key="i" class="h-[68px] animate-pulse rounded-[16px] border border-white/5 bg-muted-800/60" />
      </div>

      <div v-else-if="wdData?.items?.length" class="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.02]" role="list">
        <template v-for="(w, idx) in wdData.items" :key="w.id">
          <div v-if="idx > 0" class="h-px bg-white/10" />
          <div role="listitem" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-[22px] py-4">
            <div class="min-w-0 flex-1 basis-52">
              <AdminUserCell :user="w.user" />
            </div>
            <span class="hidden text-[12.5px] text-muted-500 lg:block">
              Requested {{ fmtDate(w.createdAt) }}
            </span>
            <span class="hidden text-[12.5px] text-muted-500 md:block">
              Wallet: <span class="font-semibold text-white tabular-nums">{{ formatCurrency(w.user.walletBalance) }}</span>
            </span>
            <span class="w-24 shrink-0 text-right text-[14.5px] font-bold text-white tabular-nums">
              {{ formatCurrency(w.amount) }}
            </span>
            <template v-if="w.status === 'Processing'">
              <div class="flex shrink-0 items-center gap-2">
                <BaseButton
                  size="sm" rounded="full" class="!bg-[#22B07D] !text-white hover:!bg-[#22B07D]/85"
                  @click="wdConfirm = { id: w.id, amount: w.amount, action: 'approve', email: w.user.email }"
                >
                  <Icon name="lucide:check" class="size-3.5" />Approve
                </BaseButton>
                <BaseButton
                  size="sm" rounded="full" class="border border-[#EC6453]/30 bg-[#EC6453]/14 !text-[#EC6453] hover:bg-[#EC6453]/20"
                  @click="wdConfirm = { id: w.id, amount: w.amount, action: 'reject', email: w.user.email }"
                >
                  <Icon name="lucide:x" class="size-3.5" />Reject
                </BaseButton>
              </div>
            </template>
            <AdminStatusChip v-else :status="w.status" />
          </div>
        </template>
      </div>

      <AdminEmptyState v-else icon="lucide:banknote" title="No withdrawal requests" subtitle="Requests in this state will appear here." />

      <AdminPager
        v-if="wdData" :page="wdData.page" :page-count="wdData.pageCount" :total="wdData.total" noun="requests"
        @update:page="wdPage = $event"
      />
    </section>

    <!-- ========== INSTALLMENTS ========== -->
    <section v-else class="flex flex-col gap-4" aria-label="Installment plans">
      <div class="flex items-start gap-3 rounded-[14px] border border-white/10 bg-white/[0.02] px-4 py-3 text-[13px] leading-[1.5] text-muted-400">
        <Icon name="lucide:info" class="mt-0.5 size-4 shrink-0 text-[#6EA8FE]" />
        <span><strong class="text-white">Charge</strong> collects the due installment from the customer's wallet (fails safely if funds are short). <strong class="text-white">Waive</strong> advances the schedule with nothing to pay — the amount is deducted from the plan total. Every action is audited.</span>
      </div>

      <div v-if="instPending" class="flex flex-col gap-2" aria-hidden="true">
        <div v-for="i in 4" :key="i" class="h-[68px] animate-pulse rounded-[16px] border border-white/5 bg-muted-800/60" />
      </div>

      <div v-else-if="instData?.items?.length" class="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.02]" role="list">
        <template v-for="(inst, idx) in instData.items" :key="inst.id">
          <div v-if="idx > 0" class="h-px bg-white/10" />
          <div role="listitem" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-[22px] py-4">
            <div class="min-w-0 flex-1 basis-52">
              <div class="truncate text-[13.5px] font-semibold text-white">
                {{ inst.project }}
              </div>
              <div class="mt-0.5 truncate text-[12.5px] text-muted-500">
                {{ inst.user.email }}
              </div>
            </div>
            <div class="hidden w-[150px] shrink-0 items-center gap-2 md:flex">
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <div class="h-full rounded-full bg-primary-500" :style="{ width: `${inst.monthsTotal ? Math.round((inst.monthsPaid / inst.monthsTotal) * 100) : 0}%` }" />
              </div>
              <span class="text-xs font-bold text-white tabular-nums">{{ inst.monthsPaid }}/{{ inst.monthsTotal }}</span>
            </div>
            <span class="hidden text-[12.5px] text-muted-500 lg:block">
              Next due {{ fmtDate(inst.nextDue) }}
            </span>
            <span class="w-28 shrink-0 text-right text-[13.5px] font-bold text-white tabular-nums">
              {{ formatCurrency(inst.paid) }} <span class="font-normal text-muted-500">of {{ formatCurrency(inst.total) }}</span>
            </span>
            <AdminStatusChip :status="inst.status" :tone="inst.status === 'urgent' ? 'coral' : inst.status === 'settled' ? 'blue' : 'green'" />
            <div v-if="inst.status !== 'settled'" class="flex shrink-0 items-center gap-2">
              <button
                type="button"
                class="rounded-full bg-primary-500 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="instBusy === inst.id"
                @click="instAction(inst, 'charge')"
              >
                {{ instBusy === inst.id ? 'Working…' : 'Charge' }}
              </button>
              <button
                type="button"
                class="rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-bold text-muted-400 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="instBusy === inst.id"
                @click="instAction(inst, 'waive')"
              >
                Waive
              </button>
            </div>
          </div>
        </template>
      </div>

      <AdminEmptyState v-else icon="lucide:calendar-clock" title="No installment plans" subtitle="Plans appear here once customers finance a project." />

      <AdminPager
        v-if="instData" :page="instData.page" :page-count="instData.pageCount" :total="instData.total" noun="plans"
        @update:page="instPage = $event"
      />
    </section>

    <!-- ========== REFUND MODAL ========== -->
    <div v-if="refundTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Issue refund">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="refundTarget = null" />
      <div class="apex-pop relative w-full max-w-[440px] rounded-[20px] border border-white/10 bg-muted-800 p-6 shadow-[0_30px_60px_rgba(0,0,0,.5)]">
        <span class="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#6EA8FE]/14 text-[#6EA8FE]">
          <Icon name="lucide:undo-2" class="size-5" />
        </span>
        <div class="font-heading text-[19px] font-extrabold tracking-[-0.01em] text-white">
          Refund {{ formatCurrency(Math.abs(refundTarget.amount)) }}?
        </div>
        <p class="mt-2 text-[13.5px] leading-[1.55] text-muted-400">
          The amount goes back to <strong class="text-white">{{ refundTarget.user.email }}</strong>'s wallet and a refund entry is written to the ledger. A payment can be refunded only once.
        </p>
        <form class="mt-4 flex flex-col gap-4" @submit.prevent="submitRefund">
          <div>
            <label for="refund-reason" class="mb-2 block text-[12.5px] font-semibold text-white">Reason <span class="font-normal text-muted-500">(recorded in the audit trail)</span></label>
            <textarea id="refund-reason" v-model="refundReason" rows="2" required minlength="3" placeholder="e.g. Project cancelled before kickoff" class="w-full resize-y rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm leading-[1.55] text-white outline-none placeholder:text-muted-500 focus:border-primary-400" />
          </div>
          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <BaseButton rounded="full" class="border border-white/10 bg-muted-700 !text-white hover:bg-muted-600" @click="refundTarget = null">
              Cancel
            </BaseButton>
            <BaseButton type="submit" rounded="full" variant="primary" :loading="refunding" :disabled="refunding || refundReason.trim().length < 3">
              <Icon name="lucide:undo-2" class="size-4" />Issue refund
            </BaseButton>
          </div>
        </form>
      </div>
    </div>

    <!-- ========== WITHDRAWAL CONFIRM MODAL ========== -->
    <div v-if="wdConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Confirm withdrawal decision">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="wdConfirm = null" />
      <div class="apex-pop relative w-full max-w-[420px] rounded-[20px] border border-white/10 bg-muted-800 p-6 shadow-[0_30px_60px_rgba(0,0,0,.5)]">
        <span class="mb-4 flex size-11 items-center justify-center rounded-xl" :class="wdConfirm.action === 'approve' ? 'bg-[#22B07D]/14 text-[#22B07D]' : 'bg-[#EC6453]/14 text-[#EC6453]'">
          <Icon :name="wdConfirm.action === 'approve' ? 'lucide:check' : 'lucide:x'" class="size-5" />
        </span>
        <div class="font-heading text-[19px] font-extrabold tracking-[-0.01em] text-white">
          {{ wdConfirm.action === 'approve' ? 'Approve' : 'Reject' }} this withdrawal?
        </div>
        <p class="mt-2 text-[13.5px] leading-[1.55] text-muted-400">
          <template v-if="wdConfirm.action === 'approve'">
            <strong class="text-white tabular-nums">{{ formatCurrency(wdConfirm.amount) }}</strong> will be debited from {{ wdConfirm.email }}'s wallet and recorded in the ledger.
          </template>
          <template v-else>
            The request from {{ wdConfirm.email }} will be marked rejected — no money moves.
          </template>
        </p>
        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <BaseButton rounded="full" class="border border-white/10 bg-muted-700 !text-white hover:bg-muted-600" @click="wdConfirm = null">
            Cancel
          </BaseButton>
          <BaseButton
            rounded="full"
            :class="wdConfirm.action === 'approve' ? '!bg-[#22B07D] !text-white hover:!bg-[#22B07D]/85' : '!bg-[#EC6453] !text-white hover:!bg-[#EC6453]/85'"
            :loading="resolving" :disabled="resolving"
            @click="resolveWithdrawal"
          >
            {{ wdConfirm.action === 'approve' ? 'Approve & debit' : 'Reject request' }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes apex-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes apex-pop {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.apex-fade {
  animation: apex-fade 0.2s ease-out both;
}
.apex-pop {
  animation: apex-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  .apex-fade,
  .apex-pop {
    animation: none;
  }
}
</style>
