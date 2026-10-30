<script setup lang="ts">
import { creditRef } from '~~/shared/credit'
import { personName, ukDateTime, waitedSince } from '~/utils/adminFormat'
import { ADMIN_INPUT, ADMIN_LABEL, ADMIN_TH } from '~/utils/adminUi'

/**
 * Admin console — Credit applications (`Admin Console.dc.html`). Customers apply for credit from their Wallet
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
  title: 'Credit applications',
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

/* ------------------------------------------------- console layout --- */

/**
 * The design's list (filters with counts; ref, business and applicant,
 * requested, stage, decided by, decision due) and, behind `?application=`,
 * one application on its own screen: a next-step card with the decision,
 * the business and applicant as submitted, the documents, and the record
 * of the decision. Clients are promised a decision within one working day,
 * so "Decision due" is the next working day after submission.
 *
 * Real or absent: the design's automated checks (Companies House status,
 * identity and bank-data checks with a fraud agency), the four-eyes second
 * review, the offer the client signs and the generated credit agreement
 * have nothing behind them. The application is decided on what the client
 * sent, by a role holding `credit.approve`, as before.
 */
const { ask } = useAdminConfirm()
const route = useRoute()
const router = useRouter()

type Filter = 'waiting' | 'approved' | 'declined' | 'withdrawn' | 'lines' | 'all'
const filter = ref<Filter>('waiting')
const all = computed<any[]>(() => [...waiting.value, ...decided.value])
const counts = computed(() => ({
  waiting: waiting.value.length,
  approved: decided.value.filter(a => a.status === 'APPROVED').length,
  declined: decided.value.filter(a => a.status === 'DECLINED').length,
  withdrawn: decided.value.filter(a => a.status === 'WITHDRAWN').length,
  lines: lines.value.length,
  all: all.value.length,
}))
const FILTERS: [Filter, string][] = [['waiting', 'To decide'], ['approved', 'Approved'], ['declined', 'Declined'], ['withdrawn', 'Withdrawn'], ['lines', 'Lines in place'], ['all', 'All']]
const rows = computed(() => {
  const f = filter.value
  if (f === 'waiting') {
    return waiting.value
  }
  if (f === 'all') {
    return all.value
  }
  return decided.value.filter(a => a.status === f.toUpperCase())
})

const STAGE: Record<string, { label: string, tone: 'warning' | 'success' | 'danger' | 'neutral' }> = {
  SUBMITTED: { label: 'Waiting for a decision', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  DECLINED: { label: 'Declined', tone: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' },
}

/** The next working day after submission, at the same time. */
function decisionDue(iso: string) {
  const d = new Date(iso)
  do {
    d.setDate(d.getDate() + 1)
  } while (d.getDay() === 0 || d.getDay() === 6)
  return d
}

const selectedId = computed(() => (typeof route.query.application === 'string' ? route.query.application : null))
const app = computed<any>(() => all.value.find(a => a.id === selectedId.value) ?? null)
useAdminCrumb(() => (app.value ? `${creditRef(app.value.id)} · ${app.value.companyName || personName(app.value)}` : null), '/admin/credit')
function open(id: string) {
  router.push({ query: { application: id } })
}

const tab = ref<'overview' | 'application' | 'decision'>('overview')
watch(selectedId, () => {
  tab.value = 'overview'
})

async function askDecide(a: any, action: 'approve' | 'decline') {
  const limit = Number(limits[a.id])
  if (action === 'approve' && (!limit || limit < 500 || (ceiling.value && limit > ceiling.value))) {
    toaster.add({ title: 'Check the limit', description: `Set a limit between ${formatCurrency(500)} and ${formatCurrency(ceiling.value)}.`, icon: 'lucide:circle-alert', progress: true })
    return
  }
  const reason = await ask(action === 'approve'
    ? {
        title: `Approve ${formatCurrency(limit)} for ${a.companyName || personName(a)}?`,
        body: 'A credit line is created at once and the client is told in their Wallet. They can start fixed monthly plans up to the limit.',
        points: limit < a.requestedLimit ? [{ tone: 'info', text: `They asked for ${formatCurrency(a.requestedLimit)}. Say why in the note if it helps the next reviewer.` }] : [],
        reason: { required: false, label: 'Internal note (optional)', placeholder: 'e.g. Statements show steady monthly inflow', hint: 'Stored in the audit log. The client never sees it.' },
        confirmLabel: 'Approve credit',
      }
    : {
        title: `Decline ${a.companyName || personName(a)}?`,
        body: 'The client is told they can still order one monthly plan at a time without a credit line. Their documents are kept with the decision.',
        reason: { required: true, label: 'Internal note', placeholder: 'e.g. Statements do not show regular income', hint: 'Stored in the audit log. The client never sees it.' },
        confirmLabel: 'Decline application',
        danger: true,
      })
  if (reason === null) {
    return
  }
  notes[a.id] = reason
  await decide(a, action)
}

async function askLine(l: any, action: 'freeze' | 'unfreeze') {
  const reason = await ask(action === 'freeze'
    ? { title: `Put ${personName(l.user)}’s line on hold?`, body: 'No new plans can draw on it until it is released. Plans already running continue.', confirmLabel: 'Put on hold', danger: true }
    : { title: `Release ${personName(l.user)}’s line?`, body: 'They can start new plans against it again.', confirmLabel: 'Release line' })
  if (reason !== null) {
    await lineAction(l, action)
  }
}

const PILL = 'apex-ring inline-flex h-8 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-full border px-[13px] text-[13px]'
const TAB_CLS = 'apex-ring -mb-px inline-flex h-10 shrink-0 cursor-pointer items-center border-b-2 text-sm'
const GRID = 'xl:grid-cols-[96px_minmax(0,1fr)_110px_190px_150px_130px]'
</script>

<template>
  <AdminPage gap="md">
    <!-- ================================================ One application -->
    <template v-if="selectedId">
      <AdminEmptyState v-if="!app && !pending" icon="lucide:file-x" title="Application not found" subtitle="It may have been withdrawn and removed, or the link is wrong.">
        <AdminButton to="/admin/credit">
          Back to applications
        </AdminButton>
      </AdminEmptyState>
      <template v-else-if="app">
        <div class="flex flex-wrap items-start gap-3.5">
          <div class="flex min-w-0 flex-1 basis-[320px] flex-col gap-1.5">
            <div class="text-fg-muted flex flex-wrap items-center gap-2.5 text-[13px]">
              <span class="bg-chip border-line-subtle text-fg-heading rounded-[7px] border px-2 py-[3px] font-mono text-xs">{{ creditRef(app.id) }}</span>
              <span>{{ BIZ[app.businessType] ?? app.businessType }} · asked for {{ formatCurrency(app.requestedLimit) }}</span>
            </div>
            <h1 class="font-heading text-fg-heading text-[23px] font-extrabold leading-[1.1] tracking-[-0.025em] sm:text-[30px]">
              {{ app.companyName || app.tradingName || `${app.firstName} ${app.lastName}` }}
            </h1>
            <p class="text-fg-body text-sm">
              {{ app.firstName }} {{ app.lastName }}, {{ app.role }} · submitted <ClientOnly>{{ ukDateTime(app.submittedAt) }}</ClientOnly>
            </p>
          </div>
          <div class="flex flex-col items-start gap-2 pt-1 sm:items-end">
            <AdminStatusChip :tone="STAGE[app.status]?.tone" :label="STAGE[app.status]?.label ?? app.status" dot />
            <NuxtLink :to="`/admin/users/${app.user.id}`" class="apex-ring text-accent-ink rounded text-[13px] font-semibold">
              {{ personName(app.user) }}’s account →
            </NuxtLink>
          </div>
        </div>

        <div class="border-line-subtle flex gap-6 overflow-x-auto border-b" role="tablist" aria-label="Application sections">
          <button
            v-for="[k, l] in ([['overview', 'Overview'], ['application', 'Application'], ['decision', 'Decision']] as const)" :key="k"
            type="button" role="tab" :aria-selected="tab === k"
            :class="[TAB_CLS, tab === k ? 'border-accent text-fg-heading font-semibold' : 'text-fg-muted border-transparent font-medium']"
            @click="tab = k"
          >
            {{ l }}
          </button>
        </div>

        <div v-if="tab === 'overview'" role="tabpanel" class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <section v-if="app.status === 'SUBMITTED'" class="border-accent/40 bg-accent-tint flex flex-col gap-3 rounded-2xl border px-[22px] py-5">
            <span class="text-accent-ink text-[11.5px] font-bold uppercase tracking-[0.07em]">Next step · {{ canDecide ? 'You' : 'Owner or Admin' }}</span>
            <span class="font-heading text-fg-heading text-[21px] font-bold tracking-[-0.02em]">Decide on {{ formatCurrency(app.requestedLimit) }}</span>
            <span class="text-fg-heading text-sm leading-[1.6] opacity-85">
              Waiting <ClientOnly>{{ waitedSince(app.submittedAt) }}</ClientOnly>. The client was promised a decision by <ClientOnly>{{ ukDateTime(decisionDue(app.submittedAt)) }}</ClientOnly>. Check the documents in Application before deciding.
            </span>
            <template v-if="canDecide">
              <div class="flex flex-wrap items-end gap-2.5">
                <div class="w-full sm:w-[200px]">
                  <label :for="`lim-${app.id}`" :class="ADMIN_LABEL">Limit (£)</label>
                  <input :id="`lim-${app.id}`" v-model.number="limits[app.id]" type="number" min="500" :max="ceiling || undefined" step="100" :class="ADMIN_INPUT">
                </div>
                <AdminButton variant="primary" :disabled="busy === app.id" @click="askDecide(app, 'approve')">
                  Approve
                </AdminButton>
                <AdminButton variant="danger-text" :disabled="busy === app.id" @click="askDecide(app, 'decline')">
                  Decline
                </AdminButton>
              </div>
              <span class="text-fg-muted text-[12.5px]">The most any line can be is {{ formatCurrency(ceiling) }}, set in Platform settings.</span>
            </template>
            <span v-else class="text-fg-muted text-[12.5px]">Deciding needs Owner or Admin.</span>
          </section>
          <section v-else class="bg-card border-line-subtle flex flex-col gap-2 rounded-2xl border px-[22px] py-5">
            <ApexSectionLabel>Outcome</ApexSectionLabel>
            <span class="font-heading text-fg-heading text-[19px] font-bold">
              {{ app.status === 'APPROVED' ? `Approved for ${formatCurrency(app.approvedLimit ?? 0)}` : app.status === 'DECLINED' ? 'Declined' : 'Withdrawn by the client' }}
            </span>
            <span class="text-fg-body text-sm"><ClientOnly>{{ ukDateTime(app.decidedAt ?? app.withdrawnAt) }}</ClientOnly></span>
          </section>

          <AdminCard label="At a glance" padded>
            <dl class="grid grid-cols-2 gap-x-5 gap-y-3.5">
              <div
                v-for="f in [
                  { k: 'Requested', v: formatCurrency(app.requestedLimit) },
                  { k: 'Turnover', v: app.turnover },
                  { k: 'Business', v: BIZ[app.businessType] ?? app.businessType },
                  { k: 'Company number', v: app.companyNumber || 'None (sole trader)' },
                  { k: 'Decision due', v: ukDateTime(decisionDue(app.submittedAt)) },
                  { k: 'Documents', v: `${app.files?.length ?? 0} file${app.files?.length === 1 ? '' : 's'}` },
                ]" :key="f.k" class="flex min-w-0 flex-col gap-[3px]"
              >
                <dt class="text-fg-muted text-xs">
                  {{ f.k }}
                </dt>
                <dd class="text-fg-heading text-sm tabular-nums">
                  <ClientOnly>{{ f.v }}</ClientOnly>
                </dd>
              </div>
            </dl>
          </AdminCard>
        </div>

        <div v-else-if="tab === 'application'" role="tabpanel" class="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <AdminCard label="Business" padded>
            <dl class="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13.5px]">
              <dt class="text-fg-muted">
                Name
              </dt><dd class="text-fg-heading">
                {{ app.companyName || '—' }}
              </dd>
              <dt class="text-fg-muted">
                Trading as
              </dt><dd class="text-fg-heading">
                {{ app.tradingName || '—' }}
              </dd>
              <dt class="text-fg-muted">
                Type
              </dt><dd class="text-fg-heading">
                {{ BIZ[app.businessType] ?? app.businessType }}
              </dd>
              <dt class="text-fg-muted">
                Number
              </dt><dd class="text-fg-heading">
                <a v-if="app.companyNumber" :href="`https://find-and-update.company-information.service.gov.uk/company/${app.companyNumber}`" target="_blank" rel="noopener" class="apex-ring text-accent-ink rounded font-semibold">{{ app.companyNumber }} on Companies House ↗</a>
                <template v-else>
                  —
                </template>
              </dd>
              <dt class="text-fg-muted">
                Postcode
              </dt><dd class="text-fg-heading">
                {{ app.businessPostcode || '—' }}
              </dd>
              <dt class="text-fg-muted">
                Turnover
              </dt><dd class="text-fg-heading">
                {{ app.turnover }}
              </dd>
            </dl>
          </AdminCard>
          <AdminCard label="Applicant" padded>
            <dl class="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13.5px]">
              <dt class="text-fg-muted">
                Name
              </dt><dd class="text-fg-heading">
                {{ app.firstName }} {{ app.lastName }}
              </dd>
              <dt class="text-fg-muted">
                Role
              </dt><dd class="text-fg-heading">
                {{ app.role }}
              </dd>
              <dt class="text-fg-muted">
                Date of birth
              </dt><dd class="text-fg-heading">
                {{ app.dateOfBirth }}
              </dd>
              <dt class="text-fg-muted">
                Home address
              </dt><dd class="text-fg-heading">
                {{ app.homeAddress }}
              </dd>
              <dt class="text-fg-muted">
                Contact
              </dt><dd class="text-fg-heading break-all">
                {{ [app.user?.email, app.user?.phone].filter(Boolean).join(' · ') }}
              </dd>
            </dl>
          </AdminCard>
          <AdminCard label="Documents" padded class="lg:col-span-2">
            <ul v-if="app.files?.length" class="flex flex-col gap-2">
              <li v-for="f in app.files" :key="f.id">
                <a :href="`/api/attachments/${f.id}`" target="_blank" class="apex-ring border-line-subtle hover:bg-raised flex items-center gap-2.5 rounded-[10px] border px-3 py-[9px]">
                  <Icon :name="f.isId ? 'lucide:id-card' : 'lucide:file-text'" class="text-fg-muted size-4" />
                  <span class="text-fg-heading min-w-0 flex-1 truncate text-[13.5px]">{{ f.name }}</span>
                  <span class="text-fg-muted text-xs">{{ f.isId ? 'Photo ID' : 'Bank statement' }} · {{ Math.max(1, Math.round(f.size / 1024)) }} KB</span>
                </a>
              </li>
            </ul>
            <p v-else class="text-fg-body text-[13.5px]">
              {{ app.status === 'SUBMITTED' ? 'No documents attached.' : 'Documents are kept with waiting applications; decided ones list the decision only.' }}
            </p>
          </AdminCard>
        </div>

        <AdminCard v-else role="tabpanel" label="Decision record" padded>
          <dl class="grid grid-cols-[150px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13.5px]">
            <dt class="text-fg-muted">
              Submitted
            </dt><dd class="text-fg-heading">
              <ClientOnly>{{ ukDateTime(app.submittedAt) }}</ClientOnly>
            </dd>
            <dt class="text-fg-muted">
              Status
            </dt><dd class="text-fg-heading">
              {{ STAGE[app.status]?.label ?? app.status }}
            </dd>
            <template v-if="app.decidedAt">
              <dt class="text-fg-muted">
                Decided
              </dt><dd class="text-fg-heading">
                <ClientOnly>{{ ukDateTime(app.decidedAt) }}</ClientOnly>
              </dd>
            </template>
            <template v-if="app.approvedLimit">
              <dt class="text-fg-muted">
                Approved limit
              </dt><dd class="text-fg-heading">
                {{ formatCurrency(app.approvedLimit) }}
              </dd>
            </template>
            <template v-if="app.decisionNote">
              <dt class="text-fg-muted">
                Internal note
              </dt><dd class="text-fg-heading">
                “{{ app.decisionNote }}”
              </dd>
            </template>
          </dl>
          <p class="text-fg-muted text-[12.5px]">
            The decision, the reviewer and their role at the time are in the audit log.
          </p>
        </AdminCard>
      </template>
    </template>

    <!-- ================================================== The list -->
    <template v-else>
      <AdminPageHeader title="Credit" accent="applications" :subtitle="`Every application from Wallet, from submission to a line in place. Clients are promised a decision within one working day. ${summary}`" />

      <div class="flex flex-wrap gap-2" role="group" aria-label="Filter applications">
        <button
          v-for="[k, l] in FILTERS" :key="k" type="button" :aria-pressed="filter === k"
          :class="[PILL, filter === k ? 'bg-accent border-transparent font-semibold text-white' : 'border-line-subtle text-fg-heading hover:bg-hover font-medium']"
          @click="filter = k"
        >
          {{ l }} <span class="tabular-nums opacity-70">{{ counts[k] }}</span>
        </button>
      </div>

      <!-- Lines in place, with hold and release (credit.approve). -->
      <section v-if="filter === 'lines'" class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
        <ul v-if="lines.length">
          <li v-for="l in lines" :key="l.id" class="border-line-soft flex flex-wrap items-center gap-3.5 border-t px-[18px] py-3 first:border-t-0 sm:px-[22px]">
            <span class="min-w-[180px] flex-1">
              <span class="text-fg-heading block truncate text-sm font-semibold">{{ personName(l.user) }}</span>
              <span class="text-fg-muted mt-0.5 block text-[12.5px] tabular-nums">{{ formatCurrency(l.used) }} committed of {{ formatCurrency(l.limit) }}</span>
            </span>
            <AdminStatusChip :tone="l.status === 'FROZEN' ? 'danger' : 'success'" :label="l.status === 'FROZEN' ? 'On hold' : 'Active'" dot />
            <template v-if="canDecide">
              <template v-if="editing === l.id">
                <label :for="`nl-${l.id}`" class="sr-only">New limit</label>
                <input :id="`nl-${l.id}`" v-model.number="newLimit" type="number" min="0" step="100" :class="ADMIN_INPUT" class="w-[130px]!">
                <AdminButton size="sm" variant="primary" :disabled="busy === l.id" @click="lineAction(l, 'adjust')">
                  Save
                </AdminButton>
                <AdminButton size="sm" @click="editing = null">
                  Cancel
                </AdminButton>
              </template>
              <template v-else>
                <AdminButton size="sm" @click="editing = l.id; newLimit = l.limit">
                  Change limit
                </AdminButton>
                <AdminButton size="sm" :variant="l.status === 'FROZEN' ? 'light' : 'danger-text'" :disabled="busy === l.id" @click="askLine(l, l.status === 'FROZEN' ? 'unfreeze' : 'freeze')">
                  {{ l.status === 'FROZEN' ? 'Release' : 'Put on hold' }}
                </AdminButton>
              </template>
            </template>
          </li>
        </ul>
        <p v-else class="text-fg-body px-[22px] py-8 text-center text-sm">
          No credit lines are in place.
        </p>
      </section>

      <section v-else class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
        <div :class="[GRID, ADMIN_TH]" class="hidden gap-3.5 px-[22px] py-3.5 xl:grid">
          <span>Ref</span><span>Business · applicant</span><span class="text-end">Requested</span><span>Stage</span><span>Decided</span><span>Decision due</span>
        </div>
        <div v-if="pending" aria-hidden="true">
          <div v-for="i in 4" :key="i" class="border-line-soft h-[60px] animate-pulse border-t" />
        </div>
        <ul v-else-if="rows.length">
          <li v-for="a in rows" :key="a.id">
            <button type="button" :class="GRID" class="apex-ring border-line-soft hover:bg-raised grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 border-t px-[18px] py-3 text-start sm:px-[22px]" @click="open(a.id)">
              <span class="text-fg-muted hidden font-mono text-[12.5px] xl:block">{{ creditRef(a.id) }}</span>
              <span class="min-w-0">
                <span class="text-fg-heading block truncate text-sm font-semibold">{{ a.companyName || a.tradingName || `${a.firstName} ${a.lastName}` }}</span>
                <span class="text-fg-muted mt-0.5 block truncate text-[12.5px]">{{ a.firstName }} {{ a.lastName }} · {{ BIZ[a.businessType] ?? a.businessType }}<span class="xl:hidden"> · {{ creditRef(a.id) }}</span></span>
              </span>
              <span class="text-fg-heading text-end text-[13.5px] tabular-nums">{{ formatCurrency(a.requestedLimit) }}</span>
              <AdminStatusChip :tone="STAGE[a.status]?.tone" :label="STAGE[a.status]?.label ?? a.status" class="justify-self-start" />
              <span class="text-fg-body hidden text-[13px] xl:block"><ClientOnly>{{ a.decidedAt ? ukDateTime(a.decidedAt) : '—' }}</ClientOnly></span>
              <span class="hidden text-[12.5px] xl:block" :class="a.status === 'SUBMITTED' && decisionDue(a.submittedAt).getTime() < Date.now() ? 'text-st-danger-fg font-semibold' : 'text-fg-muted'">
                <ClientOnly>{{ a.status === 'SUBMITTED' ? ukDateTime(decisionDue(a.submittedAt)) : '—' }}</ClientOnly>
              </span>
            </button>
          </li>
        </ul>
        <p v-else class="border-line-soft text-fg-body border-t px-[22px] py-8 text-center text-sm">
          {{ filter === 'waiting' ? 'Nothing to decide. New applications appear here oldest first.' : 'No applications here.' }}
        </p>
      </section>
    </template>
  </AdminPage>
</template>
