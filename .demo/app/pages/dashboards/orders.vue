<script setup lang="ts">
import type { StaffRole } from '~~/shared/permissions'
import { ROLES } from '~~/shared/permissions'
import { orderRef } from '~~/shared/refs'

/**
 * My orders — Panel v2 (`My Orders.dc.html`).
 *
 * A list of order cards with status filters, search and sort, and an order
 * screen with Overview · Files · Payments. The open order is in the URL
 * (`?project=<id>`, the deep link the dashboard, search and notifications
 * already use), so the browser's back button returns to the list.
 *
 * What is real behind each part:
 *  - "Waiting on you" is a `ClientAction` staff raised, answered through
 *    `POST /api/orders/:id/actions/:actionId/complete`; or, for an order still
 *    awaiting kickoff, the kickoff call to arrange.
 *  - Files are the team's deliverables (download links withheld server-side
 *    while held, ADR-017) plus the client's own uploads (`/api/uploads`).
 *  - Payments are `orderSchedule()` over the kickoff payment and the plan.
 * The design's milestone descriptions are not drawn: `Milestone` has a title
 * and a date, and nothing else to show.
 */
definePageMeta({
  title: 'My orders',
  layout: 'sidenav',
  middleware: 'auth',
})

interface OrderFile { id: string, name: string, url: string, size: string, type: string, createdAt: string }
interface Upload { id: string, name: string, size: number, createdAt: string }
interface Action { id: string, title: string, body: string | null, ctaLabel: string, doneLine: string | null, status: string, resolvedAt: string | null }
interface Order {
  id: string
  name: string
  category: string
  status: string
  progress: number
  createdAt: string
  deadline: string | null
  serviceId: string | null
  planName: string | null
  payMode: string | null
  kickoffAmount: number
  kickoffPaidAt: string | null
  amount: number
  brief: string | null
  milestones: { id: string, title: string, status: string, date: string | null }[]
  files: OrderFile[]
  attachments: Upload[]
  clientActions: Action[]
  manager: { firstName: string | null, lastName: string | null, staffRole: string | null } | null
  installmentPlan: any
  deliverables: { held: boolean }
}

const route = useRoute()
const router = useRouter()
const toaster = useNuiToasts()
const { formatCurrency } = useCurrency()
const { data, pending, error, refresh } = await useFetch<{ data: Order[] }>('/api/orders', { key: 'orders' })
const orders = computed(() => data.value?.data ?? [])

/* ------------------------------------------------------------- derived */
function openAction(o: Order) {
  return o.clientActions.find(a => a.status === 'OPEN') ?? null
}
function stageOf(o: Order) {
  const current = o.milestones.find(m => m.status === 'CURRENT') ?? o.milestones.find(m => m.status !== 'COMPLETED')
  return current?.title ?? (o.status === 'COMPLETED' ? 'Delivered' : 'Getting started')
}
function payLine(o: Order) {
  const s = orderSchedule(o)
  if (s.kind === 'retainer') {
    return `${formatCurrency(s.monthly)}/mo · ${s.started ? `${s.paidCount} paid` : 'first month at kickoff'}`
  }
  if (s.kind === 'fixed' || s.kind === 'legacy') {
    return `${s.paidCount} of ${s.payments} paid · ${formatCurrency(s.monthly)}/mo`
  }
  if (s.kind === 'full') {
    return s.started ? `Paid in full · ${formatCurrency(s.total)}` : `${formatCurrency(s.total)} at kickoff`
  }
  if (s.kind === 'scope') {
    return s.total ? `${formatCurrency(s.total)} when discovery starts` : 'Free scoping call'
  }
  return formatCurrency(o.amount)
}
function actionTitle(o: Order) {
  const a = openAction(o)
  if (a) {
    return a.title
  }
  return o.status === 'PENDING' && o.serviceId && !o.kickoffPaidAt ? 'Book your kickoff call' : ''
}

/* -------------------------------------------------------------- list */
type Filter = 'all' | 'progress' | 'review' | 'kickoff' | 'done'
const FILTERS: [Filter, string][] = [['all', 'All'], ['progress', 'In progress'], ['review', 'In review'], ['kickoff', 'Awaiting kickoff'], ['done', 'Completed']]
const filter = ref<Filter>('all')
const q = ref('')
const sort = ref<'recent' | 'due' | 'name'>('recent')
const sortOpen = ref(false)
const SORTS = [['recent', 'Newest first'], ['due', 'Due soonest'], ['name', 'Name A–Z']] as const
const sortBox = ref<HTMLElement | null>(null)
onClickOutside(sortBox, () => {
  sortOpen.value = false
})

const counts = computed(() => {
  const c: Record<Filter, number> = { all: 0, progress: 0, review: 0, kickoff: 0, done: 0 }
  for (const o of orders.value) {
    const g = projectStatus(o.status).group
    c.all++
    if (g in c) {
      c[g as Filter]++
    }
  }
  return c
})

const rows = computed(() => {
  const term = q.value.trim().toLowerCase()
  const list = orders.value.filter((o) => {
    const g = projectStatus(o.status).group
    return (filter.value === 'all' || g === filter.value) && (!term || `${o.name} ${o.category} ${orderRef(o.id)}`.toLowerCase().includes(term))
  })
  const due = (o: Order) => (o.deadline ? new Date(o.deadline).getTime() : Number.POSITIVE_INFINITY)
  list.sort((a, b) => sort.value === 'name'
    ? a.name.localeCompare(b.name)
    : sort.value === 'due' ? due(a) - due(b) : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return list.map(o => ({ o, st: projectStatus(o.status), glyph: glyphFor(o.serviceId, o.category), stage: stageOf(o), action: actionTitle(o), pay: payLine(o) }))
})
const filterLabel = computed(() => FILTERS.find(f => f[0] === filter.value)![1])

/* ------------------------------------------------------------ detail */
const selected = computed(() => orders.value.find(o => o.id === route.query.project) ?? null)
const tab = ref<'overview' | 'files' | 'payments'>('overview')
watch(() => route.query.project, () => {
  tab.value = 'overview'
})

function open(o: Order) {
  router.push({ query: { ...route.query, project: o.id } })
  window.scrollTo({ top: 0 })
}
function close() {
  const { project: _p, ...rest } = route.query
  router.push({ query: rest })
}

const d = computed(() => {
  const o = selected.value
  if (!o) {
    return null
  }
  const st = projectStatus(o.status)
  const sched = orderSchedule(o)
  const action = openAction(o)
  const done = o.clientActions.find(a => a.status === 'DONE' && a.doneLine && a.resolvedAt && Date.now() - new Date(a.resolvedAt).getTime() < 14 * 86_400_000)
  let brief: { label: string, value: string }[] = []
  try {
    brief = o.brief ? JSON.parse(o.brief) : []
  }
  catch {
    brief = []
  }
  const goal = brief.find(b => /achieve|goal|describe/i.test(b.label))
  const lead = o.manager ? [o.manager.firstName, o.manager.lastName].filter(Boolean).join(' ') : ''
  const files = [
    ...o.files.map(f => ({ id: f.id, name: f.name, ext: extOf(f.name, f.type), meta: `${f.size} · Apex · ${ukDate(f.createdAt)}`, href: f.url || '', held: !f.url })),
    ...o.attachments.map(a => ({ id: a.id, name: a.name, ext: extOf(a.name), meta: `${fileSize(a.size)} · You · ${ukDate(a.createdAt)}`, href: `/api/attachments/${a.id}`, held: false })),
  ]
  return {
    o,
    st,
    sched,
    action,
    kickoff: !action && o.status === 'PENDING' && Boolean(o.serviceId) && !o.kickoffPaidAt,
    doneLine: done?.doneLine ?? '',
    ref: orderRef(o.id),
    meta: [o.category, o.planName].filter(Boolean).join(' · '),
    started: o.kickoffPaidAt ? `Started ${ukDate(o.kickoffPaidAt)}` : `Ordered ${ukDate(o.createdAt)}`,
    due: o.status === 'PENDING' ? 'Starts after your kickoff call' : o.deadline ? `Due ${ukDate(o.deadline)}` : 'Dates agreed at kickoff',
    goal: goal?.value ?? '',
    briefRest: brief.filter(b => b !== goal),
    lead,
    leadInit: lead ? lead.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '',
    leadRole: o.manager?.staffRole ? (ROLES[o.manager.staffRole as StaffRole]?.label ?? 'Project lead') : 'Project lead',
    files,
    msgTo: `/dashboards/support?order=${o.id}`,
  }
})

function extOf(name: string, type?: string) {
  const e = (name.split('.').pop() ?? type ?? '').toUpperCase()
  return e.length <= 4 ? e : (type ?? 'FILE').toUpperCase().slice(0, 4)
}

function milestoneRows(o: Order) {
  return o.milestones.map((m, i) => {
    const done = m.status === 'COMPLETED'
    const now = m.status === 'CURRENT'
    return {
      id: m.id,
      title: m.title,
      date: done ? (m.date ? ukDate(m.date) : 'Done') : now ? 'In progress' : '',
      mark: done ? '✓' : String(i + 1),
      done,
      now,
      last: i === o.milestones.length - 1,
    }
  })
}

/* ------------------------------------------------------------ actions */
const busy = ref(false)
async function complete(o: Order, a: Action) {
  busy.value = true
  try {
    await $fetch(`/api/orders/${o.id}/actions/${a.id}/complete`, { method: 'POST' })
    await refresh()
    refreshNuxtData('dashboard-overview')
  }
  catch (e) {
    toaster.add({ title: 'That did not go through', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    busy.value = false
  }
}

const uploads = useApexUploads()
async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const o = selected.value
  if (!o) {
    return
  }
  uploads.reset()
  await uploads.add(input.files)
  input.value = ''
  if (uploads.ids.value.length) {
    try {
      await $fetch(`/api/orders/${o.id}/files`, { method: 'POST', body: { attachmentIds: uploads.ids.value } })
      await refresh()
      toaster.add({ title: 'Files added', description: 'Your team can see them now.', icon: 'lucide:check', progress: true })
    }
    catch (err) {
      toaster.add({ title: 'Files not added', description: errorMessage(err), icon: 'lucide:circle-alert', progress: true })
    }
    uploads.reset()
  }
}

const CARD = 'bg-card border-line-subtle shadow-panel rounded-[20px] border'
const OVERLINE = 'text-fg-muted text-xs font-bold uppercase tracking-[.06em]'
</script>

<template>
  <div class="@container mx-auto flex max-w-[1260px] flex-col gap-[clamp(22px,2.4vw,32px)] px-[clamp(16px,3vw,40px)] pb-[clamp(28px,4vw,56px)] pt-[clamp(20px,3vw,40px)]">
    <div v-if="error" role="alert" class="bg-st-danger-bg text-st-danger-fg flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4 text-sm">
      <Icon name="lucide:circle-alert" class="size-5 shrink-0" />
      <span class="grow">Your orders did not load. Nothing has changed on them.</span>
      <ApexButton size="sm" variant="light" @click="refresh()">
        Try again
      </ApexButton>
    </div>

    <!-- ================================================================ list -->
    <template v-if="!d">
      <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3.5">
        <div class="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
          <h1 class="font-heading text-fg-heading m-0 text-[clamp(28px,1.3vw+18px,38px)] font-extrabold leading-[1.06] tracking-[-0.03em]">
            My <span class="text-fg-accent">orders</span>
          </h1>
          <p class="text-fg-body m-0 max-w-[52ch] text-[clamp(15px,.3vw+14px,17px)] leading-relaxed">
            Progress, files and payments for every project.
          </p>
        </div>
        <ApexButton to="/dashboards/services">
          New order
        </ApexButton>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Filter by status" class="flex min-w-0 flex-[1_1_420px] gap-1.5 overflow-x-auto p-0.5 [scrollbar-width:none]">
          <button
            v-for="[id, label] in FILTERS"
            :key="id"
            type="button"
            :aria-pressed="filter === id"
            class="apex-ring inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold"
            :class="filter === id ? 'bg-fg-heading border-fg-heading text-card' : 'bg-card border-line-subtle text-fg-body'"
            @click="filter = id"
          >
            {{ label }}<span class="text-xs font-bold tabular-nums opacity-75">{{ counts[id] }}</span>
          </button>
        </div>
        <div class="flex max-w-[440px] flex-[1_1_300px] items-center gap-2.5">
          <label class="bg-card border-line-subtle text-fg-muted flex h-[42px] grow items-center gap-[9px] rounded-xl border px-3.5 focus-within:border-[var(--accent)]">
            <Icon name="lucide:search" class="size-4 shrink-0" />
            <input v-model="q" type="search" placeholder="Search orders" aria-label="Search orders" class="text-fg-heading min-w-0 grow border-none bg-transparent text-base outline-none md:text-sm">
          </label>
          <div ref="sortBox" class="relative shrink-0">
            <button type="button" aria-haspopup="listbox" :aria-expanded="sortOpen" class="apex-ring bg-card border-line-subtle text-fg-heading inline-flex h-[42px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border pl-3.5 pr-3 text-sm font-semibold" @click="sortOpen = !sortOpen">
              <Icon name="lucide:arrow-up-down" class="text-fg-muted size-[15px]" /><span class="hidden sm:inline">{{ SORTS.find(s => s[0] === sort)![1] }}</span><Icon name="lucide:chevron-down" class="text-fg-muted size-[15px]" />
            </button>
            <div v-if="sortOpen" role="listbox" aria-label="Sort" class="apex-pop-in bg-card border-line-subtle shadow-pop absolute right-0 top-12 z-20 flex w-[200px] flex-col gap-0.5 rounded-[14px] border p-1.5">
              <button
                v-for="[id, label] in SORTS"
                :key="id"
                type="button"
                role="option"
                :aria-selected="sort === id"
                class="apex-ring text-fg-heading hover:bg-hover flex min-h-10 cursor-pointer items-center justify-between rounded-[10px] px-3 text-left text-sm"
                :class="sort === id ? 'bg-accent-tint' : ''"
                @click="sort = id; sortOpen = false"
              >
                {{ label }}<span class="text-accent-ink">{{ sort === id ? '✓' : '' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="pending && !data" class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,330px),1fr))] gap-5">
        <BasePlaceload v-for="i in 3" :key="i" class="h-[230px] rounded-[22px]" />
      </div>
      <div v-else-if="rows.length" role="list" class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,330px),1fr))] gap-[clamp(14px,1.4vw,20px)]">
        <button
          v-for="r in rows"
          :key="r.o.id"
          type="button"
          role="listitem"
          :aria-label="`Open ${r.o.name}, ${r.st.label}`"
          class="apex-ring bg-card border-line-subtle shadow-panel hover:shadow-panel-hover flex min-w-0 cursor-pointer flex-col gap-4 rounded-[22px] border p-[22px] text-left transition-[box-shadow,transform] duration-200 hover:-translate-y-[3px] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          @click="open(r.o)"
        >
          <span class="flex items-start gap-3.5">
            <span class="bg-accent-tint inline-flex size-[46px] shrink-0 items-center justify-center rounded-[14px]"><ApexGlyph :kind="r.glyph" /></span>
            <span class="flex min-w-0 grow flex-col gap-[3px]">
              <span class="font-heading text-fg-heading truncate text-lg font-semibold tracking-[-0.02em]">{{ r.o.name }}</span>
              <span class="text-fg-muted truncate text-[13.5px]">{{ [r.o.category, r.o.planName].filter(Boolean).join(' · ') }}</span>
            </span>
            <ApexStatusChip :tone="r.st.tone">
              {{ r.st.label }}
            </ApexStatusChip>
          </span>
          <span class="flex flex-col gap-2">
            <span class="text-fg-muted flex justify-between gap-3 text-[13px]"><span class="truncate">{{ r.stage }}</span><span class="text-fg-heading font-bold tabular-nums">{{ r.o.progress }}%</span></span>
            <span class="bg-track block h-1.5 overflow-hidden rounded-full"><span class="bg-accent block h-full rounded-full" :style="{ width: `${r.o.progress}%` }" /></span>
          </span>
          <span v-if="r.action" class="bg-st-warning-bg text-st-warning-fg flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold">
            <span aria-hidden="true" class="block size-[7px] shrink-0 rounded-full bg-[#D9A521]" />{{ r.action }}
          </span>
          <span class="border-line-soft text-fg-muted mt-auto flex items-center justify-between gap-3 border-t pt-3.5 text-[13px]">
            <span>{{ r.pay }}</span>
            <span class="text-accent-ink inline-flex items-center gap-1 font-semibold">Open<Icon name="lucide:arrow-right" class="size-3.5" /></span>
          </span>
        </button>
      </div>
      <div v-else-if="!orders.length" class="border-line-rule flex flex-col items-center gap-3 rounded-[22px] border-[1.5px] border-dashed px-6 py-14 text-center">
        <span class="font-heading text-fg-heading text-[19px] font-semibold">No orders yet</span>
        <span class="text-fg-body max-w-[44ch] text-[14.5px] leading-relaxed">Choose a service and a plan. Nothing is charged until your kickoff call.</span>
        <ApexButton to="/dashboards/services" size="sm">
          Start an order
        </ApexButton>
      </div>
      <div v-else class="border-line-rule flex flex-col items-center gap-3 rounded-[22px] border-[1.5px] border-dashed px-6 py-14 text-center">
        <span class="font-heading text-fg-heading text-[19px] font-semibold">{{ q.trim() ? `No orders match “${q.trim()}”` : `No ${filterLabel.toLowerCase()} orders` }}</span>
        <span class="text-fg-body max-w-[44ch] text-[14.5px] leading-relaxed">{{ q.trim() ? 'Try the project name, the service or the order number.' : 'Orders move here when they reach that stage.' }}</span>
        <button type="button" class="apex-ring text-accent-ink min-h-11 cursor-pointer rounded-lg px-3.5 text-sm font-semibold" @click="filter = 'all'; q = ''">
          Show all orders
        </button>
      </div>
    </template>

    <!-- ============================================================== detail -->
    <template v-else>
      <button type="button" class="apex-ring text-fg-body -mb-2 inline-flex min-h-10 cursor-pointer items-center gap-2 self-start rounded-lg px-1 text-sm font-semibold" @click="close">
        <Icon name="lucide:arrow-left" class="size-4" />All orders
      </button>

      <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3.5">
        <div class="flex min-w-0 flex-[1_1_360px] flex-col gap-3">
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="font-heading text-fg-heading m-0 text-[clamp(26px,1.2vw+18px,36px)] font-extrabold leading-[1.08] tracking-[-0.03em]">
              {{ d.o.name }}
            </h1>
            <ApexStatusChip :tone="d.st.tone">
              {{ d.st.label }}
            </ApexStatusChip>
          </div>
          <span class="text-fg-muted flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
            <span>{{ d.ref }}</span><span aria-hidden="true" class="text-line-strong">·</span><span>{{ d.meta }}</span><span aria-hidden="true" class="text-line-strong">·</span><span>{{ d.started }}</span>
          </span>
        </div>
        <ApexButton variant="light" :to="d.msgTo">
          Message the team
        </ApexButton>
      </div>

      <div role="group" aria-label="Order sections" class="border-line-subtle flex gap-1 overflow-x-auto border-b [scrollbar-width:none]">
        <button
          v-for="[id, label, count] in ([['overview', 'Overview', ''], ['files', 'Files', String(d.files.length)], ['payments', 'Payments', String(d.sched.rows.length)]] as const)"
          :key="id"
          type="button"
          :aria-pressed="tab === id"
          class="apex-ring inline-flex h-[46px] shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap bg-transparent px-3.5 text-[14.5px]"
          :class="tab === id ? 'text-fg-heading font-bold shadow-[inset_0_-2px_0_var(--accent)]' : 'text-fg-muted font-semibold'"
          @click="tab = id"
        >
          {{ label }}<span v-if="count" class="text-fg-muted text-xs font-bold">{{ count }}</span>
        </button>
      </div>

      <div class="grid items-start gap-[clamp(20px,2vw,28px)] @min-[900px]:grid-cols-[minmax(0,1fr)_320px]">
        <div class="flex min-w-0 flex-col gap-5">
          <template v-if="tab === 'overview'">
            <div v-if="d.action || d.kickoff" :class="CARD" class="flex flex-wrap items-center gap-x-5 gap-y-3.5 px-[22px] py-5">
              <span class="bg-st-warning-bg inline-flex size-11 shrink-0 items-center justify-center rounded-[13px] text-[#D9A521]"><Icon name="solar:bell-bing-linear" class="size-[22px]" /></span>
              <span class="flex min-w-0 flex-[1_1_220px] flex-col gap-[3px]">
                <span :class="OVERLINE">Waiting on you</span>
                <span class="font-heading text-fg-heading text-lg font-semibold tracking-[-0.015em]">{{ d.action?.title ?? 'Book your kickoff call' }}</span>
                <span class="text-fg-body text-[13.5px]">{{ d.action ? (d.action.body ?? '') : 'Thirty minutes on video. The kickoff payment is taken after this call.' }}</span>
              </span>
              <div class="flex flex-wrap gap-2.5">
                <template v-if="d.action">
                  <ApexButton variant="light" size="sm" :to="d.msgTo">
                    Request changes
                  </ApexButton>
                  <ApexButton size="sm" :disabled="busy" @click="complete(d.o, d.action)">
                    {{ d.action.ctaLabel }}
                  </ApexButton>
                </template>
                <ApexButton v-else size="sm" :to="`/dashboards/support?new=kickoff&order=${d.o.id}`">
                  Book a time
                </ApexButton>
              </div>
            </div>
            <div v-else-if="d.doneLine" role="status" class="bg-st-success-bg text-st-success-fg flex items-center gap-3 rounded-2xl px-5 py-4 text-sm font-semibold">
              <span aria-hidden="true" class="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#22B07D] text-[11px] text-white">✓</span>{{ d.doneLine }}
            </div>

            <div :class="CARD" class="flex flex-col gap-5 p-[clamp(20px,2vw,26px)]">
              <div class="flex flex-wrap items-end justify-between gap-4">
                <div class="flex flex-col gap-1">
                  <span class="text-fg-heading text-sm font-semibold">Progress</span><span class="text-fg-muted text-[13.5px]">{{ d.due }}</span>
                </div>
                <span class="font-heading text-fg-heading text-4xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">{{ d.o.progress }}%</span>
              </div>
              <span role="progressbar" aria-label="Progress" :aria-valuenow="d.o.progress" aria-valuemin="0" aria-valuemax="100" class="bg-track block h-2 overflow-hidden rounded-full"><span class="bg-accent block h-full rounded-full" :style="{ width: `${d.o.progress}%` }" /></span>
              <ol class="m-0 flex list-none flex-col p-0">
                <li v-for="m in milestoneRows(d.o)" :key="m.id" class="flex gap-4">
                  <span class="flex flex-col items-center">
                    <span
                      class="font-heading inline-flex size-[30px] shrink-0 items-center justify-center rounded-full text-[12.5px] font-extrabold"
                      :class="m.done ? 'bg-[#22B07D] text-white' : m.now ? 'bg-accent text-white' : 'border-line-rule text-fg-muted border-2'"
                    >{{ m.mark }}</span>
                    <span class="block min-h-[18px] w-0.5 grow" :class="m.last ? 'bg-transparent' : m.done ? 'bg-[#22B07D]' : 'bg-line-subtle'" />
                  </span>
                  <span class="flex min-w-0 grow flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-5 pt-[5px]">
                    <span class="text-[15px] font-semibold" :class="m.done || m.now ? 'text-fg-heading' : 'text-fg-body'">{{ m.title }}</span>
                    <span class="whitespace-nowrap text-[13px] font-semibold tabular-nums" :class="m.now ? 'text-accent-ink' : 'text-fg-muted'">{{ m.date }}</span>
                  </span>
                </li>
              </ol>
            </div>

            <div v-if="d.goal || d.briefRest.length" :class="CARD" class="flex flex-col gap-3 p-[clamp(20px,2vw,26px)]">
              <span class="text-fg-heading text-sm font-semibold">Your brief</span>
              <p v-if="d.goal" class="text-fg-body m-0 max-w-[68ch] text-[15px] leading-[1.65]">
                {{ d.goal }}
              </p>
              <dl v-if="d.briefRest.length" class="m-0 grid gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-[auto_1fr]">
                <template v-for="b in d.briefRest" :key="b.label">
                  <dt class="text-fg-muted">
                    {{ b.label }}
                  </dt>
                  <dd class="text-fg-heading m-0 font-medium">
                    {{ b.value }}
                  </dd>
                </template>
              </dl>
            </div>
          </template>

          <div v-if="tab === 'files'" :class="CARD" class="overflow-hidden">
            <div class="border-line-soft flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <span class="text-fg-heading text-sm font-semibold">Shared files</span>
              <label class="apex-ring border-line-rule bg-card text-fg-heading relative inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold focus-within:outline-2 focus-within:outline-[var(--accent)]">
                <Icon :name="uploads.uploading.value ? 'lucide:loader-circle' : 'solar:upload-linear'" class="size-[17px]" :class="uploads.uploading.value ? 'motion-safe:animate-spin' : ''" />Upload
                <input type="file" multiple class="absolute size-px opacity-0" :disabled="uploads.uploading.value" @change="onUpload">
              </label>
            </div>
            <p v-if="uploads.error.value" role="alert" class="text-st-danger-fg border-line-soft m-0 border-b px-5 py-3 text-[13px]">
              {{ uploads.error.value }}
            </p>
            <div v-for="f in d.files" :key="f.id" class="border-line-soft flex items-center gap-3.5 border-b px-5 py-3.5">
              <span class="bg-raised text-accent-ink inline-flex size-10 shrink-0 items-center justify-center rounded-[11px] text-[10.5px] font-extrabold tracking-[.04em]">{{ f.ext }}</span>
              <span class="flex min-w-0 grow flex-col gap-0.5">
                <span class="text-fg-heading truncate text-[14.5px] font-semibold">{{ f.name }}</span>
                <span class="text-fg-muted text-[12.5px]">{{ f.held ? 'Released when the project is paid' : f.meta }}</span>
              </span>
              <a v-if="f.href" :href="f.href" :aria-label="`Download ${f.name}`" download class="apex-ring border-line-subtle bg-card text-fg-heading hover:border-line-strong inline-flex size-10 shrink-0 items-center justify-center rounded-[11px] border">
                <Icon name="solar:download-minimalistic-linear" class="size-[18px]" />
              </a>
              <Icon v-else name="lucide:lock" class="text-fg-muted size-[18px] shrink-0" aria-label="Held" />
            </div>
            <p v-if="!d.files.length" class="text-fg-body m-0 px-5 py-6 text-sm">
              No files yet. Upload anything your team needs: logos, copy, photos or an existing brief.
            </p>
            <span class="text-fg-muted block px-5 py-3.5 text-[12.5px]">Files are kept for the life of the project and handed over in full at the end.</span>
          </div>

          <div v-if="tab === 'payments'" :class="CARD" class="overflow-hidden">
            <div class="border-line-soft flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <span class="text-fg-heading text-sm font-semibold">Payment schedule</span>
              <span class="text-fg-muted text-[13px]">{{ d.sched.retainer ? `Rolling monthly after ${d.sched.payments} months` : 'No interest · figures include VAT' }}</span>
            </div>
            <div v-for="(py, i) in d.sched.rows" :key="i" class="border-line-soft flex flex-wrap items-center gap-3 border-b px-5 py-[13px] text-sm">
              <span class="block size-[9px] shrink-0 rounded-full" :class="py.state === 'Paid' ? 'bg-accent' : 'bg-dot-unpaid'" />
              <span class="text-fg-heading min-w-0 flex-[1_1_140px] font-medium">{{ py.label }}</span>
              <span class="text-fg-muted whitespace-nowrap tabular-nums">{{ py.date }}</span>
              <span class="text-fg-heading min-w-[60px] text-right font-semibold tabular-nums">{{ formatCurrency(py.amount) }}</span>
              <span class="flex min-w-[86px] justify-end"><ApexStatusChip :tone="py.tone">{{ py.state }}</ApexStatusChip></span>
            </div>
            <p v-if="!d.sched.rows.length" class="text-fg-body m-0 px-5 py-6 text-sm">
              This order has no payment schedule.
            </p>
            <p v-if="!d.sched.started && d.sched.rows.length > 1" class="text-fg-muted border-line-soft m-0 border-b px-5 py-3 text-[12.5px]">
              Dates are estimates until the kickoff payment is taken.
            </p>
            <div class="bg-raised flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
              <span class="text-fg-body">Paid <strong class="text-fg-heading tabular-nums">{{ formatCurrency(d.sched.paid) }}</strong> of {{ formatCurrency(d.sched.total) }}</span>
              <NuxtLink to="/dashboards/wallet?tab=tx" class="apex-ring text-accent-ink rounded-md font-semibold hover:underline">
                Receipts in Wallet →
              </NuxtLink>
            </div>
          </div>
        </div>

        <aside aria-label="Project details" class="flex min-w-0 flex-col gap-4">
          <div :class="CARD" class="flex flex-col gap-3.5 p-5">
            <span :class="OVERLINE">Your project lead</span>
            <div v-if="d.lead" class="flex items-center gap-3">
              <span aria-hidden="true" class="font-heading inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#7D53F2] text-sm font-semibold text-white shadow-[0_0_0_3px_var(--accent-tint)]">{{ d.leadInit }}</span>
              <span class="flex min-w-0 grow flex-col gap-0.5"><span class="text-fg-heading text-[15px] font-semibold">{{ d.lead }}</span><span class="text-fg-muted text-[13px]">{{ d.leadRole }}</span></span>
            </div>
            <p v-else class="text-fg-body m-0 text-[13.5px]">
              Your project lead is named at the kickoff call.
            </p>
            <NuxtLink :to="d.msgTo" class="apex-ring bg-raised border-line-subtle text-fg-heading hover:border-line-strong flex min-h-[42px] items-center justify-center gap-2 rounded-xl border text-sm font-semibold">
              <Icon name="solar:chat-round-line-linear" class="size-[17px]" />Message
            </NuxtLink>
          </div>
          <div v-if="d.sched.kind !== 'none'" :class="CARD" class="flex flex-col gap-3.5 p-5">
            <span :class="OVERLINE">Payment plan</span>
            <span class="font-heading text-fg-heading text-3xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">
              {{ formatCurrency(d.sched.monthly || d.sched.total) }}<span v-if="d.sched.monthly" class="text-fg-muted text-[13px] font-semibold"> /mo</span>
            </span>
            <div v-if="!d.sched.retainer && d.sched.payments && d.sched.payments <= 24" aria-hidden="true" class="flex flex-wrap gap-[5px]">
              <span v-for="i in d.sched.payments" :key="i" class="block size-2.5 rounded-full" :class="i <= d.sched.paidCount ? 'bg-accent' : 'bg-dot-unpaid'" />
            </div>
            <span class="text-fg-muted text-[13px]">
              {{ d.sched.retainer ? `${d.sched.payments}-month minimum, then rolling monthly` : d.sched.payments ? `${d.sched.paidCount} of ${d.sched.payments} paid · no interest` : d.sched.kind === 'full' ? 'One payment at kickoff' : 'Fixed price' }}
            </span>
            <div class="border-line-soft flex flex-col gap-2.5 border-t pt-3.5">
              <div class="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span class="text-fg-body">{{ d.sched.started ? 'Next payment' : 'First payment' }}</span>
                <span class="text-fg-heading text-right font-semibold tabular-nums">{{ d.sched.nextDue ? ukDate(d.sched.nextDue) : d.sched.started ? '—' : 'At kickoff' }}</span>
              </div>
              <div class="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span class="text-fg-body">Paid so far</span><span class="text-fg-heading font-semibold tabular-nums">{{ formatCurrency(d.sched.paid) }}</span>
              </div>
              <div class="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span class="text-fg-body">{{ d.sched.retainer ? 'Minimum term' : 'Total, all in' }}</span><span class="text-fg-heading font-semibold tabular-nums">{{ formatCurrency(d.sched.total) }}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>
