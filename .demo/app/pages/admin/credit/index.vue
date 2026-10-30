<script setup lang="ts">
/**
 * Admin — Credit lines. Customers apply for credit from their Wallet
 * (Wallet.dc.html, 2026-10-25); this is where those applications are decided.
 *
 * - The queue is oldest first, with everything the customer sent: business,
 *   applicant, home address, the photo ID and statements (downloaded through
 *   `/api/attachments`, which only credit approvers may read), and a link to
 *   the company's Companies House page for checking it.
 * - Approving sets a limit up to the ceiling in Platform settings and creates
 *   the customer's credit line; declining tells them they can still order one
 *   plan at a time. The note is internal and lands in the audit log.
 * - Lines in place can be adjusted, put on hold or released, through the
 *   existing `/api/admin/finance/credit/:userId` endpoint.
 *
 * `money.view` may look; only `credit.approve` gets the buttons, which is the
 * same rule the endpoints enforce.
 */
definePageMeta({
  title: 'Credit lines',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()
const { formatCurrency } = useCurrency()
const { can } = useStaffAccess()
const allowed = computed(() => can('money.view'))

const { data, refresh, pending } = await useFetch<any>('/api/admin/credit/applications', { immediate: allowed.value })
const waiting = computed<any[]>(() => data.value?.waiting ?? [])
const decided = computed<any[]>(() => data.value?.decided ?? [])
const lines = computed<any[]>(() => data.value?.lines ?? [])
const canDecide = computed(() => Boolean(data.value?.canDecide))
const ceiling = computed(() => Number(data.value?.ceiling ?? 0))

const committed = computed(() => lines.value.reduce((n, l) => n + (l.used ?? 0), 0))
const approvedTotal = computed(() => lines.value.reduce((n, l) => n + (l.limit ?? 0), 0))
const summary = computed(() => `${waiting.value.length} waiting · ${lines.value.length} ${lines.value.length === 1 ? 'line' : 'lines'} · ${formatCurrency(committed.value)} committed of ${formatCurrency(approvedTotal.value)} approved`)

const BIZ: Record<string, string> = { ltd: 'Limited company', llp: 'Partnership', sole: 'Sole trader' }
function name(u: any) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.email || u?.phone || 'Customer'
}
function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}

/* ------------------------------------------------------------ decisions */
const limits = reactive<Record<string, number>>({})
const notes = reactive<Record<string, string>>({})
watch(waiting, (list) => {
  for (const a of list) {
    limits[a.id] ??= Math.min(a.requestedLimit, ceiling.value || a.requestedLimit)
  }
}, { immediate: true })

const busy = ref<string | null>(null)
async function decide(a: any, action: 'approve' | 'decline') {
  busy.value = a.id
  try {
    await $fetch(`/api/admin/credit/applications/${a.id}/decide`, {
      method: 'POST',
      body: { action, ...(action === 'approve' ? { limit: Number(limits[a.id]) } : {}), ...(notes[a.id]?.trim() ? { note: notes[a.id]!.trim() } : {}) },
    })
    toaster.add({
      title: action === 'approve' ? 'Credit approved' : 'Application declined',
      description: action === 'approve' ? `${name(a.user)} has a credit line of ${formatCurrency(Number(limits[a.id]))}.` : `${name(a.user)} has been told they can still order one plan at a time.`,
      icon: 'lucide:check',
      progress: true,
    })
    await refresh()
  }
  catch (e) {
    toaster.add({ title: 'Not saved', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    busy.value = null
  }
}

/* ---------------------------------------------------------------- lines */
const editing = ref<string | null>(null)
const newLimit = ref(0)
async function lineAction(l: any, action: 'adjust' | 'freeze' | 'unfreeze') {
  busy.value = l.id
  try {
    await $fetch(`/api/admin/finance/credit/${l.userId}`, { method: 'PATCH', body: { action, ...(action === 'adjust' ? { limit: Number(newLimit.value) } : {}) } })
    editing.value = null
    await refresh()
  }
  catch (e) {
    toaster.add({ title: 'Not saved', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    busy.value = null
  }
}

const CARD = 'rounded-2xl border border-muted-200 bg-white dark:border-white/10 dark:bg-muted-800'
const LABEL = 'text-muted-500 text-xs font-bold uppercase tracking-[.06em]'
const GHOST_BTN = 'apex-focus inline-flex min-h-[38px] cursor-pointer items-center rounded-xl border border-muted-200 bg-muted-100 px-3.5 text-[13px] font-semibold text-muted-800 transition-colors hover:bg-muted-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'
const INPUT = 'apex-focus h-10 w-full rounded-xl border border-muted-200 bg-white px-3 text-sm text-muted-900 outline-none focus:border-primary-500 dark:border-white/10 dark:bg-muted-900 dark:text-white'
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1180px] px-4 pt-5 sm:px-8 sm:pt-7 flex-col gap-6 pb-8">
    <AdminAccessWall
      v-if="!allowed"
      permission="money.view"
      title="Credit lines are restricted"
      body="Approving and adjusting credit limits changes what a client can commit to spend, so it is limited to the roles below."
    />

    <template v-else>
      <AdminPageHeader dense title="Credit lines" :subtitle="summary" />

      <div v-if="pending && !data" class="flex flex-col gap-3" aria-hidden="true">
        <div v-for="i in 3" :key="i" class="bg-muted-100 h-[120px] animate-pulse rounded-2xl dark:bg-white/5" />
      </div>

      <!-- ===================================================== waiting -->
      <section aria-labelledby="h-waiting" class="flex flex-col gap-3">
        <h2 id="h-waiting" class="font-heading text-muted-900 m-0 text-lg font-bold dark:text-white">
          Waiting for a decision
        </h2>
        <p v-if="!waiting.length" :class="CARD" class="text-muted-600 dark:text-muted-300 m-0 p-5 text-sm">
          No applications are waiting. Customers apply from Wallet › Credit line.
        </p>
        <article v-for="a in waiting" :key="a.id" :class="CARD" class="flex flex-col gap-4 p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-primary-500 dark:text-primary-300 font-mono text-[12px] font-semibold">{{ a.ref }}</span>
                <span class="font-heading text-muted-900 text-base font-bold dark:text-white">{{ a.companyName || a.tradingName }}</span>
              </div>
              <div class="text-muted-500 mt-1 text-[13px]">
                {{ name(a.user) }} · submitted {{ fmtDate(a.submittedAt) }}
              </div>
            </div>
            <div class="text-right">
              <div :class="LABEL">
                Asked for
              </div>
              <div class="font-heading text-muted-900 text-2xl font-extrabold tabular-nums dark:text-white">
                {{ formatCurrency(a.requestedLimit) }}
              </div>
            </div>
          </div>

          <dl class="m-0 grid gap-x-6 gap-y-3 text-[13.5px] sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt :class="LABEL">
                Business
              </dt>
              <dd class="text-muted-800 m-0 mt-1 dark:text-white">
                {{ BIZ[a.businessType] ?? a.businessType }}<template v-if="a.companyNumber">
                  · {{ a.companyNumber }}
                  <a :href="`https://find-and-update.company-information.service.gov.uk/company/${a.companyNumber}`" target="_blank" rel="noopener noreferrer" class="text-primary-500 dark:text-primary-300 ms-1 font-semibold hover:underline">Companies House ↗</a>
                </template>
                <template v-else-if="a.businessPostcode">
                  · {{ a.businessPostcode }}
                </template>
              </dd>
            </div>
            <div>
              <dt :class="LABEL">
                Turnover
              </dt>
              <dd class="text-muted-800 m-0 mt-1 dark:text-white">
                {{ a.turnover }}
              </dd>
            </div>
            <div>
              <dt :class="LABEL">
                Applicant
              </dt>
              <dd class="text-muted-800 m-0 mt-1 dark:text-white">
                {{ a.firstName }} {{ a.lastName }}, {{ a.role }} · born {{ a.dateOfBirth }}
              </dd>
            </div>
            <div class="sm:col-span-2">
              <dt :class="LABEL">
                Home address
              </dt>
              <dd class="text-muted-800 m-0 mt-1 dark:text-white">
                {{ a.homeAddress }}
              </dd>
            </div>
            <div>
              <dt :class="LABEL">
                Customer account
              </dt>
              <dd class="m-0 mt-1">
                <NuxtLink :to="`/admin/users/${a.userId}`" class="text-primary-500 dark:text-primary-300 font-semibold hover:underline">
                  {{ a.user?.email || a.user?.phone }}
                </NuxtLink>
              </dd>
            </div>
          </dl>

          <div class="flex flex-wrap gap-2">
            <a v-for="f in a.files" :key="f.id" :href="`/api/attachments/${f.id}`" :class="GHOST_BTN">
              <Icon :name="f.isId ? 'solar:user-id-linear' : 'solar:document-text-linear'" class="me-2 size-4" />{{ f.isId ? 'Photo ID' : 'Statement' }} · {{ f.name }}
            </a>
          </div>

          <div v-if="canDecide" class="border-muted-200 flex flex-wrap items-end gap-3 border-t pt-4 dark:border-white/10">
            <label class="flex w-[170px] flex-col gap-1.5">
              <span :class="LABEL">Limit (£)</span>
              <input v-model.number="limits[a.id]" type="number" min="500" :max="ceiling" step="500" :class="INPUT" class="tabular-nums">
            </label>
            <label class="flex min-w-[220px] grow flex-col gap-1.5">
              <span :class="LABEL">Internal note (optional)</span>
              <input v-model="notes[a.id]" type="text" maxlength="500" placeholder="Seen in the audit log, never by the customer" :class="INPUT">
            </label>
            <button type="button" :class="GHOST_BTN" :disabled="busy === a.id" @click="decide(a, 'decline')">
              Decline
            </button>
            <BaseButton rounded="lg" variant="primary" :disabled="busy === a.id || !((limits[a.id] ?? 0) >= 500) || (limits[a.id] ?? 0) > ceiling" @click="decide(a, 'approve')">
              Approve {{ formatCurrency(Number(limits[a.id]) || 0) }}
            </BaseButton>
            <p v-if="(limits[a.id] ?? 0) > ceiling" class="m-0 w-full text-[13px] text-[#EC6453]">
              The ceiling in Platform settings is {{ formatCurrency(ceiling) }}.
            </p>
          </div>
          <p v-else class="text-muted-500 m-0 text-[13px]">
            Only an Owner or Admin can approve or decline credit.
          </p>
        </article>
      </section>

      <!-- ======================================================= lines -->
      <section aria-labelledby="h-lines" class="flex flex-col gap-3">
        <h2 id="h-lines" class="font-heading text-muted-900 m-0 text-lg font-bold dark:text-white">
          Credit lines in place
        </h2>
        <div :class="CARD" class="overflow-hidden">
          <p v-if="!lines.length" class="text-muted-600 dark:text-muted-300 m-0 p-5 text-sm">
            No customer has a credit line yet.
          </p>
          <div v-for="(l, i) in lines" :key="l.id" class="flex flex-wrap items-center gap-4 px-5 py-4" :class="i ? 'border-muted-200 border-t dark:border-white/5' : ''">
            <span class="min-w-0 flex-[1_1_200px]">
              <NuxtLink :to="`/admin/users/${l.userId}`" class="text-muted-900 block truncate text-[14.5px] font-semibold hover:underline dark:text-white">{{ name(l.user) }}</NuxtLink>
              <span class="text-muted-500 block text-[12.5px]">Approved {{ fmtDate(l.approvedAt) }}</span>
            </span>
            <span class="w-[150px] text-[13px]"><span class="text-muted-500">Limit</span> <strong class="text-muted-900 tabular-nums dark:text-white">{{ formatCurrency(l.limit) }}</strong></span>
            <span class="w-[150px] text-[13px]"><span class="text-muted-500">In use</span> <strong class="text-muted-900 tabular-nums dark:text-white">{{ formatCurrency(l.used) }}</strong></span>
            <AdminStatusChip :status="l.status" :tone="l.status === 'FROZEN' ? 'amber' : 'green'" :label="l.status === 'FROZEN' ? 'On hold' : 'Active'" />
            <span v-if="canDecide" class="flex flex-wrap items-center gap-2">
              <template v-if="editing === l.id">
                <input v-model.number="newLimit" type="number" min="0" step="500" aria-label="New limit" :class="INPUT" class="w-[120px] tabular-nums">
                <button type="button" :class="GHOST_BTN" :disabled="busy === l.id" @click="lineAction(l, 'adjust')">Save</button>
                <button type="button" :class="GHOST_BTN" @click="editing = null">Cancel</button>
              </template>
              <template v-else>
                <button type="button" :class="GHOST_BTN" @click="editing = l.id; newLimit = l.limit">Adjust limit</button>
                <button type="button" :class="GHOST_BTN" :disabled="busy === l.id" @click="lineAction(l, l.status === 'FROZEN' ? 'unfreeze' : 'freeze')">{{ l.status === 'FROZEN' ? 'Release hold' : 'Put on hold' }}</button>
              </template>
            </span>
          </div>
        </div>
      </section>

      <!-- ===================================================== decided -->
      <section v-if="decided.length" aria-labelledby="h-decided" class="flex flex-col gap-3">
        <h2 id="h-decided" class="font-heading text-muted-900 m-0 text-lg font-bold dark:text-white">
          Recent decisions
        </h2>
        <div :class="CARD" class="overflow-hidden">
          <div v-for="(a, i) in decided" :key="a.id" class="flex flex-wrap items-center gap-4 px-5 py-3.5 text-[13.5px]" :class="i ? 'border-muted-200 border-t dark:border-white/5' : ''">
            <span class="text-primary-500 dark:text-primary-300 w-[90px] font-mono text-[12px] font-semibold">{{ a.ref }}</span>
            <span class="text-muted-900 min-w-0 flex-[1_1_180px] truncate font-semibold dark:text-white">{{ a.companyName || a.tradingName }} · {{ name(a.user) }}</span>
            <span class="text-muted-500 w-[200px]">{{ a.status === 'WITHDRAWN' ? `Withdrawn ${fmtDate(a.withdrawnAt)}` : `Decided ${fmtDate(a.decidedAt)}` }}</span>
            <span class="text-muted-900 w-[110px] text-right tabular-nums dark:text-white">{{ a.status === 'APPROVED' ? formatCurrency(a.approvedLimit) : '—' }}</span>
            <AdminStatusChip :status="a.status" :tone="a.status === 'APPROVED' ? 'green' : a.status === 'DECLINED' ? 'coral' : 'muted'" :label="a.status === 'APPROVED' ? 'Approved' : a.status === 'DECLINED' ? 'Declined' : 'Withdrawn'" />
            <span v-if="a.decisionNote" class="text-muted-500 w-full text-[12.5px]">Note: {{ a.decisionNote }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
