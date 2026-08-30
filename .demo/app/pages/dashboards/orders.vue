<script setup lang="ts">
/**
 * My Orders — Apex Design redesign.
 * List view: stat strip, filter tabs + search + sort, project card grid.
 * Detail view: milestone timeline, files, project summary + payment-plan rail
 * with segmented installment tracking.
 *
 * Data comes from /api/orders (projects + milestones + files + manager).
 * Projects created by the New Order wizard carry a real `installmentPlan` row
 * and use it directly (see realInst).
 *
 * TODO(api): `deriveInst()` is the fallback for legacy projects with no plan
 * row, and it hardcodes a 12-month term. Real plans can be 24 months, so the
 * same account can show "x/12" on a legacy project and "x/24" on a new one.
 * Backfill plans for pre-migration projects and this fallback can go.
 */
definePageMeta({
  title: 'My Orders',
  layout: 'sidenav',
  middleware: 'auth',
})

const router = useRouter()
const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()

// ---- fetch + mapping ------------------------------------------------------
const { data: apiResponse, pending, refresh: refreshOrders } = await useFetch('/api/orders', { lazy: true })

type UiStatus = 'active' | 'pending' | 'completed' | 'cancelled'
type IconKind = 'web' | 'mkt' | 'uiux' | 'brand'

interface Stage { n: number, name: string, date: string, state: 'done' | 'active' | 'todo' }
interface Inst { total: number, paid: number, amount: number, nextDate: string | null, dueInDays: number | null }
interface UiProject {
  id: string
  shortId: string
  name: string
  service: string
  icon: IconKind
  status: UiStatus
  progress: number
  stage: string
  budget: number
  start: string
  due: string
  pmName: string
  pmInitials: string
  pmGrad: string
  inst: Inst
  instId: string | null
  instSettled: boolean
  activity: string
  createdAt: number
  stages: Stage[]
  files: { id: string, name: string, size: string, type: string, url: string }[]
}

const PM_GRADS = [
  'linear-gradient(135deg,#9B79F6,#6C40E8)',
  'linear-gradient(135deg,#22B07D,#0f6e4d)',
  'linear-gradient(135deg,#F2C14E,#D9A521)',
  'linear-gradient(135deg,#EC6453,#b33a2c)',
]

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

function fmtDate(v: string | Date | null | undefined, fallback = 'TBD') {
  if (!v)
    return fallback
  return new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function relTime(v: string | Date) {
  const diff = Date.now() - new Date(v).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1)
    return 'Just now'
  if (h < 24)
    return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7)
    return `${days} day${days === 1 ? '' : 's'} ago`
  const w = Math.floor(days / 7)
  return `${w} week${w === 1 ? '' : 's'} ago`
}

// Real financing plan (Installment row linked to the project) — created by
// the New Order wizard, charged via /api/finance/installments/:id/pay.
function realInst(plan: any): Inst {
  const settled = plan.status === 'settled' || plan.monthsPaid >= plan.monthsTotal
  const dueInDays = settled ? null : Math.max(0, Math.ceil((new Date(plan.nextDue).getTime() - Date.now()) / 86_400_000))
  return {
    total: plan.monthsTotal,
    paid: plan.monthsPaid,
    amount: Math.round(plan.monthlyAmount || plan.amountDue || 0),
    nextDate: settled ? null : relativeDue(dueInDays) ?? fmtDate(plan.nextDue, 'Next cycle'),
    dueInDays,
  }
}

/** "today" / "tomorrow" / "in N days" for the next week; null beyond that. */
function relativeDue(days: number | null): string | null {
  if (days == null || days > 7)
    return null
  if (days <= 0)
    return 'today'
  if (days === 1)
    return 'tomorrow'
  return `in ${days} days`
}

// Legacy fallback for projects without a plan row (pre-migration data).
function deriveInst(status: UiStatus, amount: number, progress: number, deadline: string | null): Inst {
  const total = 12
  const per = Math.max(1, Math.round((amount || 0) / total))
  if (status === 'completed')
    return { total, paid: total, amount: per, nextDate: null, dueInDays: null }
  if (status === 'pending' || status === 'cancelled')
    return { total, paid: 0, amount: per, nextDate: 'On kickoff', dueInDays: null }
  const paid = Math.min(total - 1, Math.max(0, Math.floor((progress / 100) * total)))
  const dueInDays = deadline ? Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)) : null
  const nextDate = relativeDue(dueInDays) ?? fmtDate(deadline, 'Next cycle')
  return { total, paid, amount: per, nextDate, dueInDays }
}

const projects = computed<UiProject[]>(() => {
  const rows = (apiResponse.value as any)?.data ?? []
  return rows.map((o: any, i: number) => {
    let status: UiStatus = 'pending'
    if (o.status === 'IN_PROGRESS')
      status = 'active'
    else if (o.status === 'COMPLETED')
      status = 'completed'
    else if (o.status === 'CANCELLED')
      status = 'cancelled'

    const stages: Stage[] = (o.milestones ?? []).map((m: any, idx: number) => ({
      n: idx + 1,
      name: m.title,
      date: m.status === 'CURRENT' ? 'In progress' : m.date ? new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Upcoming',
      state: m.status === 'COMPLETED' ? 'done' : m.status === 'CURRENT' ? 'active' : 'todo',
    }))
    const activeStage = stages.find(s => s.state === 'active')

    const pmName = o.manager ? [o.manager.firstName, o.manager.lastName].filter(Boolean).join(' ') || 'Apex Team' : 'Apex Team'
    const pmInitials = pmName.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

    return {
      id: o.id,
      shortId: String(o.id).replace(/-/g, '').slice(0, 8).toUpperCase(),
      name: o.name,
      service: o.category || 'General',
      icon: iconKind(o.category),
      status,
      progress: o.progress ?? 0,
      stage: status === 'completed' ? 'Delivered' : status === 'pending' ? 'Awaiting kickoff' : (activeStage?.name || 'In progress'),
      budget: o.amount ?? 0,
      // "Awaiting kickoff" is the one term used for the not-yet-started state,
      // here, on the card's stage line and on the dashboard.
      start: status === 'pending' ? 'Awaiting kickoff' : fmtDate(o.startDate),
      due: fmtDate(o.deadline),
      pmName,
      pmInitials,
      pmGrad: PM_GRADS[i % PM_GRADS.length]!,
      inst: o.installmentPlan ? realInst(o.installmentPlan) : deriveInst(status, o.amount ?? 0, o.progress ?? 0, o.deadline),
      instId: o.installmentPlan?.id ?? null,
      instSettled: o.installmentPlan ? (o.installmentPlan.status === 'settled') : status === 'completed',
      activity: relTime(o.updatedAt || o.createdAt),
      createdAt: new Date(o.createdAt).getTime(),
      stages,
      files: (o.files ?? []).map((f: any) => ({ id: f.id, name: f.name, size: f.size, type: f.type, url: f.url })),
    }
  })
})

// ---- view state -----------------------------------------------------------
const filter = ref<'all' | 'active' | 'pending' | 'completed'>('all')
const q = ref('')
const sort = ref<'recent' | 'progress' | 'due' | 'name'>('recent')

/**
 * The open project lives in the URL, not in a ref.
 *
 * `/dashboards/orders?project=<id>` was already the deep link panel search
 * uses; making it the *only* representation of "a project is open" buys three
 * things at once. The shell's bar can tell it is inside a record without the
 * page having to tell it — which it could not do without a frame of the wrong
 * chrome first, since the toolbar renders before the page (V2 Phase 4 mobile,
 * §1). The browser's own back button returns to the list instead of leaving
 * the page. And searching again from this very page still lands on the row,
 * because there is no local state to fall out of step with the query.
 *
 * Guarded on the project actually existing, so a stale or hand-typed id leaves
 * the customer on the list rather than on an empty detail pane.
 */
const route = useRoute()
const detail = computed(() => projects.value.find(p => p.id === route.query.project) || null)
const view = computed<'list' | 'detail'>(() => (detail.value ? 'detail' : 'list'))

/**
 * Where the list was when the customer opened a project, so returning puts
 * them back on the row they tapped rather than at the top of ten cards. Nuxt's
 * scroll behaviour does not restore across a query-only navigation.
 */
const listScroll = ref(0)

function openDetail(id: string) {
  if (import.meta.client) {
    listScroll.value = window.scrollY
  }
  router.push({ path: '/dashboards/orders', query: { ...route.query, project: id } })
}
function backToList() {
  const query = { ...route.query }
  delete query.project
  router.replace({ path: '/dashboards/orders', query })
}

watch(view, (now, before) => {
  if (!import.meta.client) {
    return
  }
  // A record always opens at its own top; the list resumes where it was.
  nextTick(() => window.scrollTo({ top: now === 'detail' ? 0 : (before === 'detail' ? listScroll.value : 0) }))
})

/**
 * The bar shows the project's name while one is open. Data, not route, so it
 * travels through shared state — see `useApexSubView`.
 */
const { title: subViewTitle } = useApexSubView()
watchEffect(() => {
  subViewTitle.value = detail.value?.name ?? null
})
onBeforeUnmount(() => {
  subViewTitle.value = null
})

function clearFilters() {
  filter.value = 'all'
  q.value = ''
}

// ---- list derivations -----------------------------------------------------
const counts = computed(() => {
  const c = { all: projects.value.length, active: 0, pending: 0, completed: 0 } as Record<string, number>
  projects.value.forEach((p) => {
    c[p.status] = (c[p.status] ?? 0) + 1
  })
  return c
})
/**
 * Third entry is the phone label. Only "Completed" needs one — four pills wrap
 * onto two lines at 393px and the design shortens it there — so the others
 * repeat themselves rather than carry a null the template has to test twice.
 */
const TABS = [
  ['all', 'All', 'All'],
  ['active', 'Active', 'Active'],
  ['pending', 'Pending', 'Pending'],
  ['completed', 'Completed', 'Done'],
] as const

/**
 * Sort: a themed listbox on desktop, a bottom sheet on a phone. A listbox
 * anchored to a control near the bottom of a 393px viewport opens over the
 * thing it belongs to, which is the same reason every other menu on this
 * breakpoint became a sheet (V2 Phase 1 mobile, §5).
 */
const SORT_OPTIONS = [
  ['recent', 'Recent activity'],
  ['progress', 'Progress'],
  ['due', 'Next payment'],
  ['name', 'Name'],
] as const
const sortSheetOpen = ref(false)
const sortLabel = computed(() => SORT_OPTIONS.find(([v]) => v === sort.value)?.[1] ?? 'Recent activity')
function pickSort(value: typeof sort.value) {
  sort.value = value
  sortSheetOpen.value = false
}

/**
 * "No projects at all" is a different screen from "nothing matches this
 * filter" (§8). Rendering the stat card and the filter pills as a wall of
 * zeros above an empty grid describes an account that has nothing to describe;
 * they are hidden, and one explanation takes their place.
 */
const hasProjects = computed(() => projects.value.length > 0)

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  let list = projects.value.filter((p) => {
    if (filter.value !== 'all' && p.status !== filter.value)
      return false
    if (needle && !(p.name.toLowerCase().includes(needle) || p.shortId.toLowerCase().includes(needle)))
      return false
    return true
  })
  if (sort.value === 'progress')
    list = [...list].sort((a, b) => b.progress - a.progress)
  else if (sort.value === 'name')
    list = [...list].sort((a, b) => a.name.localeCompare(b.name))
  else if (sort.value === 'due')
    list = [...list].sort((a, b) => (a.inst.dueInDays ?? 999) - (b.inst.dueInDays ?? 999))
  else
    list = [...list].sort((a, b) => b.createdAt - a.createdAt)
  return list
})

/**
 * Three tiles that always carry a real number.
 *
 * The previous four measured the wrong things: "Active projects" and
 * "Completed" both read 0 on an account whose projects are all PENDING, and
 * "Payments due soon" filtered on `status === 'active'`, so it could never fire
 * for a pending project however imminent its first installment. A strip of
 * zeros sitting above three visible projects reads as a broken page.
 *
 * Per-status counts still exist — on the filter tabs below, which is the one
 * place a zero is informative rather than dead.
 */
const stats = computed(() => {
  const open = projects.value.filter(p => p.status !== 'completed')
  const outstanding = open.reduce((sum, p) => sum + (p.inst.total - p.inst.paid) * p.inst.amount, 0)
  const active = counts.value.active ?? 0
  const pending = counts.value.pending ?? 0

  // Soonest scheduled payment across everything still running. `dueInDays` is
  // null for plans with no date yet, so those sort last rather than first.
  const next = [...open].sort((a, b) => (a.inst.dueInDays ?? 9999) - (b.inst.dueInDays ?? 9999))[0]

  return [
    {
      icon: 'lucide:box',
      tone: 'bg-primary-500/14 text-primary-400',
      value: String(projects.value.length),
      label: active ? `Projects · ${active} in progress` : `Projects · ${pending} awaiting kickoff`,
    },
    {
      icon: 'lucide:banknote',
      tone: 'bg-[#D9A521]/14 text-[#F2C14E]',
      value: formatCurrency(outstanding),
      label: `Outstanding across ${open.length} plan${open.length === 1 ? '' : 's'}`,
    },
    {
      icon: 'lucide:clock',
      tone: 'bg-[#22B07D]/14 text-[#22B07D]',
      value: next ? formatCurrency(next.inst.amount) : '—',
      label: next ? `Next payment · ${next.inst.nextDate ?? 'after kickoff'}` : 'No payments scheduled',
    },
  ]
})

// ---- presentation helpers ---------------------------------------------------
const SVC_META: Record<IconKind, { icon: string, tone: string }> = {
  web: { icon: 'lucide:code-2', tone: 'bg-primary-500/14 text-primary-400' },
  mkt: { icon: 'lucide:megaphone', tone: 'bg-[#EC6453]/14 text-[#EC6453]' },
  uiux: { icon: 'lucide:pen-tool', tone: 'bg-primary-500/14 text-primary-400' },
  brand: { icon: 'lucide:target', tone: 'bg-[#D9A521]/14 text-[#F2C14E]' },
}

function statusMeta(status: UiStatus) {
  switch (status) {
    case 'active': return { label: 'Active', chip: 'text-[#22B07D] bg-[#22B07D]/14' }
    case 'pending': return { label: 'Pending', chip: 'text-[#F2C14E] bg-[#D9A521]/14' }
    case 'completed': return { label: 'Completed', chip: 'text-[#6EA8FE] bg-[#6EA8FE]/14' }
    default: return { label: 'Cancelled', chip: 'text-muted-500 bg-white/5' }
  }
}

/**
 * Payment state, derived from the plan — not from the project's status.
 *
 * Both this and the detail rail used to branch on `p.status`, so a PENDING
 * project with two installments already paid rendered "First payment · 0/24"
 * on the card and a "Not started" chip beside "£226 of £2,712" in the rail.
 * Project status and payment progress are different facts: a project can be
 * awaiting kickoff while its plan is already part-paid.
 *
 * `payState()` answers one question — how far through the plan are we — and
 * everything else follows from it.
 */
type PayKind = 'paid' | 'pending' | 'due' | 'ontrack'
function payState(p: UiProject): { kind: PayKind, due: boolean } {
  const { total, paid, dueInDays } = p.inst
  const due = dueInDays != null && dueInDays <= 5
  if (paid >= total)
    return { kind: 'paid', due: false }
  if (paid === 0)
    return { kind: 'pending', due }
  return { kind: due ? 'due' : 'ontrack', due }
}

interface CardPay { label: string, accent: string, value: string, date: string, inst: string, sub: string, tone: PayKind }
function cardPay(p: UiProject): CardPay {
  const m = formatCurrency(p.inst.amount)
  const insts = `${p.inst.paid}/${p.inst.total}`
  const { kind, due } = payState(p)
  // `sub` is the phone's one-line version of the two stacked columns the
  // desktop card has room for. Built here so a plan with no scheduled date
  // cannot render a dangling separator.
  const sub = (date: string) => (date ? `${date} · ${insts} paid` : `${insts} paid`)
  if (kind === 'paid')
    return { label: 'Payment', accent: 'text-[#22B07D]', value: 'Paid in full', date: '', inst: insts, sub: sub(''), tone: 'paid' }
  if (kind === 'pending') {
    const date = p.inst.nextDate || 'On kickoff'
    return { label: 'First payment', accent: 'text-muted-500', value: m, date, inst: insts, sub: sub(date), tone: 'pending' }
  }
  const date = p.inst.nextDate || ''
  return { label: due ? 'Payment due' : 'Next payment', accent: due ? 'text-[#F2C14E]' : 'text-primary-200', value: m, date, inst: insts, sub: sub(date), tone: kind }
}
const PAY_TONES: Record<CardPay['tone'], string> = {
  due: 'bg-[#D9A521]/[0.07] border-[#D9A521]/22',
  paid: 'bg-[#22B07D]/[0.07] border-[#22B07D]/20',
  pending: 'bg-white/[0.02] border-white/10',
  ontrack: 'bg-primary-500/[0.06] border-primary-500/20',
}

// Detail payment plan (mirrors the design's payFor()).
const detailPay = computed(() => {
  const p = detail.value
  if (!p)
    return null
  const { total, paid, amount } = p.inst
  // Same source as the card, so the two can never disagree — see payState().
  const { kind, due } = payState(p)
  return {
    kind,
    chip: kind === 'paid'
      ? { label: 'Paid in full', cls: 'text-[#22B07D] bg-[#22B07D]/14' }
      : kind === 'pending'
        ? { label: 'Not started', cls: 'text-muted-500 bg-white/5' }
        : kind === 'due'
          ? { label: 'Due soon', cls: 'text-[#F2C14E] bg-[#D9A521]/16' }
          : { label: 'Up to date', cls: 'text-[#22B07D] bg-[#22B07D]/14' },
    paidFmt: formatCurrency(amount * paid),
    totalFmt: formatCurrency(amount * total),
    termLabel: `${total}-month plan`,
    // 24 segments survive a 393px card at ~12px each, which is what the mobile
    // design counts on. One fact gets one encoding, so desktop reads the same
    // segments rather than collapsing a 24-month plan to a bar at 16.
    useSegments: total <= 24,
    segments: Array.from({ length: total }, (_, i) => i < paid),
    barPct: Math.round((paid / total) * 100),
    countText: `${paid} of ${total} installments paid`,
    showNext: kind === 'ontrack' || kind === 'due',
    due,
    nextLabel: due ? 'Payment due' : 'Next payment',
    nextAmtFmt: formatCurrency(amount),
    // Nothing paid yet: say *when* it is due rather than always claiming
    // kickoff, which would be wrong for a project that has already started.
    pendingWhen: p.status === 'pending'
      ? 'is scheduled after project kickoff'
      : p.inst.nextDate
        ? `is scheduled for ${p.inst.nextDate}`
        : 'is not scheduled yet',
    scheduleLabel: kind === 'paid' ? 'View payment history' : 'View full schedule',
  }
})

// Ring geometry (R=36, C=2πR) per the design.
const RING_C = 2 * Math.PI * 36
const ringOffset = computed(() => detail.value ? RING_C * (1 - detail.value.progress / 100) : RING_C)

const paying = ref(false)
async function payNow() {
  const d = detail.value
  if (!d || paying.value)
    return
  // Legacy projects without a real plan row still settle from the Wallet.
  if (!d.instId) {
    toaster.add({ title: 'Pay from your wallet', description: 'Installments are settled from your Wallet & Credit page.', icon: 'lucide:wallet', progress: true })
    router.push('/dashboards/wallet')
    return
  }
  paying.value = true
  try {
    const res: any = await $fetch(`/api/finance/installments/${d.instId}/pay`, { method: 'POST' })
    toaster.add({
      title: res.settled ? 'Plan fully paid 🎉' : 'Installment paid',
      description: res.settled ? 'That was the final installment — the plan is settled.' : `${formatCurrency(res.charged)} was paid from your wallet.`,
      icon: 'lucide:check',
      progress: true,
    })
    await refreshOrders()
  }
  catch (e: any) {
    toaster.add({ title: 'Payment failed', description: e?.data?.message || 'Please try again in a moment.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    paying.value = false
  }
}
</script>

<template>
  <!-- Location lives in the toolbar breadcrumb; this page no longer prints its own. -->
  <div class="mx-auto flex max-w-[1180px] flex-col gap-7 pb-14 font-sans text-muted-400 md:gap-8">
    <!-- ============================ LIST VIEW ============================ -->
    <div v-if="view === 'list'">
      <!-- title + primary action -->
      <ApexPageHeader
        title="My"
        accent="orders"
        subtitle="Every project you've ordered, its progress and what's left to pay."
        class="mb-[18px] sm:mb-8"
      >
        <template #actions>
          <!--
            No header action on a phone. The list ends in a "Start a new
            project" row and the bottom bar's centre control is a create action
            that never scrolls away, so a third route to the same place would
            sit within one viewport of the other two. `sm:contents` rather than
            a class on the button itself: `BaseButton` declares its own
            `display` later in the same layer and would win over `hidden`.
          -->
          <span class="hidden sm:contents">
            <BaseButton rounded="full" variant="primary" to="/dashboards/services" class="h-12! w-full px-6 shadow-[0_10px_24px_rgba(125,83,242,.32)] sm:h-11! sm:w-auto">
              <Icon name="lucide:plus" class="size-4" />New project
            </BaseButton>
          </span>
        </template>
      </ApexPageHeader>

      <!--
        Stat strip. Three tiles side by side leave about 110px each at 393px —
        not enough for `£10,622` above a label that names what it counts — so
        below `sm` they become one card of three labelled rows divided by
        hairlines (§2). Same three measures, same order, same figures: the
        Phase 4 rule that every tile carries a real number in every account
        state is what makes one card legible rather than a wall of zeros.

        The row reads label-then-value on a phone and value-then-label on
        desktop, which is `flex-col-reverse` against the DOM order rather than
        a second copy of either line.
      -->
      <div v-if="hasProjects || pending" class="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-muted-800 sm:mb-[22px] sm:grid sm:grid-cols-3 sm:gap-3.5 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent">
        <div
          v-for="st in stats" :key="st.label"
          class="flex items-center gap-[13px] px-4 py-[15px] [&:not(:last-child)]:border-b [&:not(:last-child)]:border-white/10 sm:gap-3 sm:rounded-2xl sm:border sm:border-white/10 sm:bg-muted-800 sm:px-[18px] sm:py-4"
        >
          <span class="flex size-10 shrink-0 items-center justify-center rounded-[11px] sm:rounded-xl" :class="st.tone"><Icon :name="st.icon" class="size-[19px]" /></span>
          <div class="flex min-w-0 flex-1 flex-col-reverse gap-[3px] sm:flex-col sm:gap-1">
            <div class="font-heading text-[21px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white tabular-nums sm:text-[22px] sm:leading-none sm:tracking-[-0.01em]">
              {{ st.value }}
            </div>
            <div class="text-[12.5px] text-muted-500">
              {{ st.label }}
            </div>
          </div>
        </div>
      </div>

      <!-- controls -->
      <div v-if="hasProjects || pending" class="mb-[18px] flex flex-wrap items-center gap-3 sm:mb-[22px] sm:gap-3.5">
        <!--
          `aria-pressed` buttons, not a tablist: these filter one grid in place
          and there is no tabpanel to point at, so tab semantics would promise
          a structure that does not exist.
        -->
        <!--
          Below `sm` the group's own pill container goes and the four filters
          wrap onto two lines as standalone 38px pills (§3) — a single scrolling
          strip at 393px clipped "Completed" against the right edge with nothing
          to say it had. The height is the design's; these are secondary
          controls in a wrapped group, and raising them to 44px would put the
          two lines further apart than drawn.
        -->
        <div role="group" aria-label="Filter projects by status" class="flex w-full flex-wrap gap-2 sm:w-auto sm:min-w-0 sm:flex-nowrap sm:gap-1 sm:rounded-full sm:border sm:border-white/10 sm:bg-muted-800 sm:p-1">
          <button
            v-for="[key, label, short] in TABS" :key="key"
            type="button" :aria-pressed="filter === key"
            class="apex-focus inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] transition sm:min-h-0 sm:border-0 sm:py-2"
            :class="filter === key ? 'border-primary-500 bg-primary-500 font-bold text-white' : 'border-white/10 bg-muted-800 font-semibold text-muted-400 hover:text-white sm:bg-transparent'"
            @click="filter = key"
          >
            <span class="sm:hidden">{{ short }}</span><span class="hidden sm:inline">{{ label }}</span>
            <span class="rounded-full px-1.5 py-px text-[11px] font-bold" :class="filter === key ? 'bg-white/20 text-white' : 'bg-white/5 text-muted-500'">{{ counts[key] ?? 0 }}</span>
          </button>
        </div>
        <div class="hidden flex-1 sm:block" />
        <!--
          Search is a bar control on a phone, not a page control: the shell's
          search opens over the whole panel and already indexes this customer's
          projects, and its results link to `?project=<id>` — which is now the
          detail's own address, so a hit lands on the project rather than back
          on this list. Duplicating it inside the page would spend a row on the
          second-best of the two.

          py-3 under sm keeps both controls at a 44px touch height; the design's
          tighter py-2 returns at sm where these are pointer targets.
        -->
        <label class="hidden w-full items-center gap-2 rounded-xl border border-white/10 bg-muted-800 px-3 py-3 transition focus-within:border-primary-400 sm:flex sm:w-[230px] sm:py-2">
          <Icon name="lucide:search" class="size-4 shrink-0 text-muted-500" />
          <input v-model="q" placeholder="Search name or ID" class="w-full min-w-0 border-none bg-transparent text-[13.5px] text-white outline-none placeholder:text-muted-500">
        </label>
        <!--
          Themed listbox rather than a native <select>, whose popup is an OS
          menu — white on black text over this dark surface, and unreachable
          from CSS. Same treatment as the New Order form (Phase 3).
        -->
        <!--
          The phone's sort control: a full-width 44px trigger that says what the
          list is currently sorted by, opening a sheet. It states the current
          value in words, which the collapsed listbox opposite it does too — but
          without needing to open upward over itself at the bottom of a screen.
        -->
        <button
          type="button"
          aria-haspopup="dialog"
          :aria-expanded="sortSheetOpen"
          class="apex-focus flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-muted-800 px-3.5 text-start sm:hidden"
          @click="sortSheetOpen = true"
        >
          <Icon name="lucide:arrow-down-wide-narrow" aria-hidden="true" class="size-[17px] shrink-0 text-muted-500" />
          <span class="grow truncate text-sm text-muted-400">Sorted by <strong class="font-semibold text-white">{{ sortLabel }}</strong></span>
          <Icon name="lucide:chevron-down" aria-hidden="true" class="size-[18px] shrink-0 text-muted-500" />
        </button>
        <!-- `BaseSelect` renders its own element, so the breakpoint gate goes on a wrapper. -->
        <div class="hidden w-full sm:block sm:w-auto">
          <BaseSelect
            v-model="sort"
            aria-label="Sort projects"
            rounded="lg"
            size="lg"
            class="bg-muted-800! h-11! w-full! rounded-xl! border-white/10! text-white! sm:w-[200px]!"
            :classes="{ text: 'text-[13.5px] font-semibold' }"
          >
            <BaseSelectItem value="recent">
              Recent activity
            </BaseSelectItem>
            <BaseSelectItem value="progress">
              Progress
            </BaseSelectItem>
            <BaseSelectItem value="due">
              Next payment
            </BaseSelectItem>
            <BaseSelectItem value="name">
              Name
            </BaseSelectItem>
          </BaseSelect>
        </div>
      </div>

      <!-- loading skeletons -->
      <div v-if="pending" class="grid grid-cols-1 gap-3.5 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="i in 3" :key="i" class="h-[230px] rounded-2xl border border-white/10 bg-muted-800 p-4 sm:h-[290px] sm:p-[22px]">
          <div class="apex-shimmer size-12 rounded-xl" />
          <div class="apex-shimmer mt-5 h-5 w-3/5 rounded-md" />
          <div class="apex-shimmer mt-3 h-3 w-2/5 rounded-md" />
          <div class="apex-shimmer mt-6 h-2 w-full rounded-md" />
          <div class="apex-shimmer mt-6 h-14 w-full rounded-xl" />
        </div>
      </div>

      <!--
        No projects at all (§8) — a different screen from "nothing matches this
        filter", which keeps its filters because clearing them is the fix. Here
        there is nothing to filter, so the strip and the pills above are absent
        and this explains what will appear once an order exists.
      -->
      <div v-else-if="!hasProjects" class="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-7 text-center sm:px-7 sm:py-10">
        <span class="inline-flex size-14 items-center justify-center rounded-2xl bg-primary-500/[0.13] text-primary-400"><Icon name="lucide:package" class="size-[26px]" /></span>
        <h3 class="font-heading mt-4 text-[18px] font-bold text-white">
          No projects yet
        </h3>
        <p class="mx-auto mb-[18px] mt-2 max-w-sm text-[13.5px] leading-[1.55] text-muted-500">
          Once you place your first order it appears here with its progress, files and payment schedule.
        </p>
        <BaseButton rounded="full" variant="primary" to="/dashboards/services" class="h-[50px]! w-full px-6 sm:w-auto">
          <Icon name="lucide:plus" class="size-4" />Start a new project
        </BaseButton>
      </div>

      <!-- card grid -->
      <div v-else-if="filtered.length" class="grid grid-cols-1 gap-3.5 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
        <!--
          The whole card is the control, so it needs a concise accessible name:
          without one a screen reader announces the entire card body — icon,
          status, name, service, stage, percentage, payment box and PM — as the
          button's label.
        -->
        <!--
          One control, two compositions (§4). The phone's card leads with
          identity and a chevron and reads top to bottom; the desktop card puts
          the status chip beside the icon and pushes its footer to the bottom of
          a fixed-height tile. Those are different arrangements of the same
          elements rather than a reflow of one — the chip, the chevron and the
          short id each move between rows — so each body is written out and the
          other is `display:none`, which keeps it out of the accessible tree
          too. Both read the same `p`, so they cannot describe different
          projects; and the `aria-label`, the click target and the focus ring
          belong to the single `<button>` around them.
        -->
        <button
          v-for="p in filtered" :key="p.id"
          type="button"
          :aria-label="`${p.name}, ${statusMeta(p.status).label}, ${p.stage}, ${p.progress}% complete`"
          class="apex-focus flex flex-col rounded-2xl border border-white/10 bg-muted-800 p-4 text-left transition duration-200 hover:border-primary-500/50 sm:min-h-[280px] sm:p-[22px] sm:hover:-translate-y-0.5 sm:hover:border-white/15 sm:hover:shadow-[0_18px_40px_rgba(0,0,0,.28)]"
          @click="openDetail(p.id)"
        >
          <!-- phone -->
          <span class="flex w-full flex-col sm:hidden">
            <span class="flex items-center gap-3">
              <span class="flex size-11 shrink-0 items-center justify-center rounded-xl" :class="SVC_META[p.icon].tone"><Icon :name="SVC_META[p.icon].icon" class="size-[22px]" /></span>
              <span class="min-w-0 flex-1">
                <span class="font-heading block truncate text-[17px] font-bold text-white">{{ p.name }}</span>
                <span class="mt-[3px] flex items-center gap-[7px] text-xs text-muted-500">
                  <span class="truncate">{{ p.service }}</span>
                  <span aria-hidden="true" class="size-[5px] shrink-0 rounded-full bg-muted-500" />
                  <span class="shrink-0">#{{ p.shortId }}</span>
                </span>
              </span>
              <Icon name="lucide:chevron-right" aria-hidden="true" class="size-[18px] shrink-0 text-muted-500" />
            </span>

            <span class="mt-3.5 flex items-center gap-[9px]">
              <span class="shrink-0 rounded-full px-[11px] py-[5px] text-[11px] font-extrabold uppercase tracking-[0.05em]" :class="statusMeta(p.status).chip">{{ statusMeta(p.status).label }}</span>
              <span class="truncate text-[12.5px] text-muted-500">{{ p.stage }}</span>
            </span>

            <span class="mt-3 flex items-center gap-2.5">
              <span class="block h-[7px] flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <span class="block h-full rounded-full" :class="p.status === 'completed' ? 'bg-gradient-to-r from-[#22B07D] to-[#1a8f66]' : 'bg-gradient-to-r from-primary-400 to-primary-500'" :style="{ width: `${p.progress}%` }" />
              </span>
              <span class="shrink-0 text-[12.5px] font-bold text-white tabular-nums">{{ p.progress }}%</span>
            </span>

            <span class="mt-3.5 flex items-center gap-3 rounded-xl border px-3.5 py-3" :class="PAY_TONES[cardPay(p).tone]">
              <span class="min-w-0 flex-1">
                <span class="block text-[11px] font-bold uppercase tracking-[0.05em]" :class="cardPay(p).accent">{{ cardPay(p).label }}</span>
                <span class="mt-[3px] block truncate text-[12.5px] text-muted-400">{{ cardPay(p).sub }}</span>
              </span>
              <span class="font-heading shrink-0 text-[19px] font-extrabold text-white tabular-nums">{{ cardPay(p).value }}</span>
            </span>

            <span class="mt-[13px] flex items-center gap-[9px]">
              <span class="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" :class="p.pmGrad.includes('F2C14E') ? 'text-[#3a2c00]' : 'text-white'" :style="{ background: p.pmGrad }">{{ p.pmInitials }}</span>
              <span class="truncate text-[12.5px] text-muted-500">Managed by <strong class="font-semibold text-white">{{ p.pmName }}</strong></span>
            </span>
          </span>

          <!-- desktop -->
          <span class="hidden w-full grow flex-col sm:flex">
            <div class="flex items-start justify-between gap-3">
              <span class="flex size-12 shrink-0 items-center justify-center rounded-xl" :class="SVC_META[p.icon].tone"><Icon :name="SVC_META[p.icon].icon" class="size-[22px]" /></span>
              <span class="rounded-full px-2.5 py-[5px] text-[11px] font-extrabold uppercase tracking-[0.05em]" :class="statusMeta(p.status).chip">{{ statusMeta(p.status).label }}</span>
            </div>
            <div class="mt-4">
              <div class="font-heading text-[19px] font-bold leading-[1.2] tracking-[-0.01em] text-white">
                {{ p.name }}
              </div>
              <div class="mt-1 text-[13px] text-muted-500">
                {{ p.service }}
              </div>
            </div>
            <div class="mt-[18px]">
              <div class="mb-2 flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 text-[12.5px] text-muted-400">
                  <span class="inline-block size-1.5 rounded-full" :class="p.status === 'completed' ? 'bg-[#22B07D]' : p.status === 'pending' ? 'bg-muted-500' : 'bg-primary-500'" />{{ p.stage }}
                </span>
                <span class="font-heading text-[13px] font-bold text-white tabular-nums">{{ p.progress }}%</span>
              </div>
              <div class="h-[7px] overflow-hidden rounded-full bg-white/[0.06]">
                <div class="h-full rounded-full transition-all duration-500" :class="p.status === 'completed' ? 'bg-gradient-to-r from-[#22B07D] to-[#1a8f66]' : 'bg-gradient-to-r from-primary-400 to-primary-500'" :style="{ width: `${p.progress}%` }" />
              </div>
            </div>
            <div class="mt-4 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3" :class="PAY_TONES[cardPay(p).tone]">
              <div class="min-w-0">
                <div class="text-[11px] font-bold uppercase tracking-[0.04em]" :class="cardPay(p).accent">
                  {{ cardPay(p).label }}
                </div>
                <div class="mt-0.5 truncate text-sm font-semibold text-white">
                  {{ cardPay(p).value }}
                </div>
              </div>
              <div class="shrink-0 text-right">
                <div class="text-xs text-muted-500 tabular-nums">
                  {{ cardPay(p).inst }}
                </div>
                <div class="mt-0.5 text-[11.5px] text-muted-500">
                  {{ cardPay(p).date }}
                </div>
              </div>
            </div>
            <div class="mt-auto flex items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div class="flex min-w-0 items-center gap-2.5">
                <span class="flex size-[30px] shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold" :class="p.pmGrad.includes('F2C14E') ? 'text-[#3a2c00]' : 'text-white'" :style="{ background: p.pmGrad }">{{ p.pmInitials }}</span>
                <div class="min-w-0">
                  <div class="truncate text-[12.5px] font-semibold leading-tight text-white">
                    {{ p.pmName }}
                  </div>
                  <div class="text-[10.5px] tracking-[0.03em] text-muted-500">
                    #{{ p.shortId }}
                  </div>
                </div>
              </div>
              <!-- Chevron only: "Details" was a link that is not a link, inviting a
                 click the card already owns, and it read out as part of the label. -->
              <Icon name="lucide:chevron-right" aria-hidden="true" class="size-[18px] shrink-0 text-primary-400" />
            </div>
          </span>
        </button>

        <!--
          Start a new project. A 200px centred tile is a grid cell on desktop; in
          a single stacked column it is a screenful of empty space, so on a
          phone it is a 72px row that reads like the cards above it (§4).
        -->
        <NuxtLink to="/dashboards/services" class="flex min-h-[72px] items-center gap-[13px] rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3.5 transition hover:border-primary-400 hover:bg-primary-500/5 sm:hidden">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-500/14 text-primary-400"><Icon name="lucide:plus" class="size-5" /></span>
          <span class="min-w-0 flex-1">
            <span class="font-heading block text-[15.5px] font-bold text-white">Start a new project</span>
            <span class="mt-0.5 block text-[12.5px] text-muted-500">Zero upfront plans available</span>
          </span>
          <Icon name="lucide:chevron-right" aria-hidden="true" class="size-[18px] shrink-0 text-muted-500" />
        </NuxtLink>
        <NuxtLink to="/dashboards/services" class="hidden min-h-[200px] flex-col items-center justify-center gap-3.5 rounded-2xl border-[1.5px] border-dashed border-white/15 p-7 text-center transition hover:border-primary-400 hover:bg-primary-500/5 sm:flex">
          <span class="flex size-[52px] items-center justify-center rounded-full bg-primary-500/14 text-primary-400"><Icon name="lucide:plus" class="size-6" /></span>
          <div>
            <div class="font-heading text-[17px] font-bold text-white">
              Start a new project
            </div>
            <div class="mt-1 text-[13px] text-muted-500">
              Get an instant estimate &amp; installment plan
            </div>
          </div>
        </NuxtLink>
      </div>

      <!-- empty state -->
      <div v-else class="rounded-2xl border border-white/10 bg-muted-800 px-7 py-14 text-center">
        <span class="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-white/5 text-muted-500"><Icon name="lucide:file-x" class="size-[30px]" /></span>
        <h3 class="font-heading text-[20px] font-bold text-white">
          No projects found
        </h3>
        <p class="mb-5 mt-2 text-sm text-muted-400">
          {{ q ? `No projects match “${q}”. Try a different search or filter.` : 'Nothing in this category yet. Switch tabs or start a new project.' }}
        </p>
        <BaseButton rounded="full" class="border border-white/10 bg-white/5 !text-white hover:border-white/15" @click="clearFilters">
          Clear filters
        </BaseButton>
      </div>

      <!--
        `ink` because this page is navy in both themes until Phase 9 gives it a
        light treatment; a white sheet would be the only light surface on the
        screen.
      -->
      <ApexBottomSheet
        v-model:open="sortSheetOpen"
        surface="ink"
        title="Sort projects"
        description="Choose the order your projects are listed in."
      >
        <template #header>
          <div class="font-heading shrink-0 border-b border-white/10 px-[18px] pb-2.5 pt-1.5 text-base font-bold text-white">
            Sort by
          </div>
        </template>
        <div class="flex flex-col gap-0.5 p-2.5">
          <button
            v-for="[value, label] in SORT_OPTIONS" :key="value"
            type="button"
            :aria-pressed="sort === value"
            class="apex-focus flex min-h-[52px] w-full cursor-pointer items-center gap-2.5 rounded-xl px-3.5 text-[15px] transition-colors"
            :class="sort === value ? 'bg-primary-500/12 font-semibold text-white' : 'text-muted-300 hover:bg-white/5'"
            @click="pickSort(value)"
          >
            <span class="grow text-start">{{ label }}</span>
            <Icon v-if="sort === value" name="lucide:check" aria-hidden="true" class="size-[18px] shrink-0 text-primary-400" />
          </button>
        </div>
      </ApexBottomSheet>
    </div>

    <!-- ============================ DETAIL VIEW ============================ -->
    <div v-else-if="detail" class="apex-rise">
      <!--
        The way back lives in the top bar below `lg` (§1), where it stays put
        while the page scrolls — a control inside the scroll is gone exactly
        when it is wanted. This row is the desktop copy of it.
      -->
      <div class="mb-[22px] hidden flex-wrap items-center justify-between gap-4 lg:flex">
        <BaseButton rounded="full" class="border border-white/10 bg-muted-800 !text-white hover:bg-muted-700" @click="backToList">
          <Icon name="lucide:arrow-left" class="size-[15px]" />All projects
        </BaseButton>
        <div class="inline-flex items-center gap-1.5 text-[12.5px] text-muted-500">
          <Icon name="lucide:clock" class="size-3.5" />Last update {{ detail.activity }}
        </div>
      </div>

      <!--
        Below `lg` the two columns collapse and the sections stand on their own,
        so the order stops being "left column, then rail" and becomes the order
        a phone should read them in (§7): identity, then money, then the work,
        then its files, then the facts, then the way to ask about any of it.

        Both column wrappers are `display: contents` below `lg`, which dissolves
        them so every section becomes a direct child of this grid and can take
        an `order`. From `lg` they become real containers again with exactly the
        classes they had, and `order` stops applying because their children are
        no longer grid items — so the desktop arrangement is reproduced rather
        than restated.
      -->
      <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-[22px]">
        <!-- LEFT column -->
        <div class="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-[22px]">
          <!-- header + milestones: one card on desktop, two sections on a phone -->
          <div class="contents lg:block lg:rounded-2xl lg:border lg:border-white/10 lg:bg-muted-800 lg:p-7">
            <div class="order-1 lg:order-none">
              <div class="flex flex-wrap items-start justify-between gap-5">
                <div class="flex min-w-0 items-start gap-[13px] lg:gap-4">
                  <span class="flex size-[52px] shrink-0 items-center justify-center rounded-[14px] lg:rounded-xl" :class="SVC_META[detail.icon].tone"><Icon :name="SVC_META[detail.icon].icon" class="size-[25px]" /></span>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2.5">
                      <!-- Customer-supplied names can be one unbroken token; let it break rather than overflow. -->
                      <h2 class="font-heading text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em] text-white [overflow-wrap:anywhere] lg:text-[26px] lg:leading-[1.1]">
                        {{ detail.name }}
                      </h2>
                      <span class="hidden rounded-full px-2.5 py-[5px] text-[11px] font-extrabold uppercase tracking-[0.05em] lg:inline-block" :class="statusMeta(detail.status).chip">{{ statusMeta(detail.status).label }}</span>
                    </div>
                    <div class="mt-1.5 text-[12.5px] text-muted-500 lg:text-[13.5px]">
                      {{ detail.service }} · #{{ detail.shortId }}
                    </div>
                  </div>
                </div>
                <div class="hidden items-center gap-3.5 lg:flex">
                  <div class="relative size-[82px] shrink-0">
                    <!-- Decorative: the percentage is written out beside it. -->
                    <svg width="82" height="82" viewBox="0 0 82 82" aria-hidden="true">
                      <circle cx="41" cy="41" r="36" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7" />
                      <circle cx="41" cy="41" r="36" fill="none" :stroke="detail.status === 'completed' ? '#22B07D' : '#7D53F2'" stroke-width="7" stroke-linecap="round" :stroke-dasharray="RING_C" :stroke-dashoffset="ringOffset" transform="rotate(-90 41 41)" />
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center font-heading text-[19px] font-extrabold text-white">
                      {{ detail.progress }}%
                    </div>
                  </div>
                  <div class="text-xs leading-snug text-muted-500">
                    Overall<br>progress
                  </div>
                </div>
              </div>

              <!-- Status and stage get their own line once the ring is gone. -->
              <div class="mt-3.5 flex flex-wrap items-center gap-[9px] lg:hidden">
                <span class="rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.05em]" :class="statusMeta(detail.status).chip">{{ statusMeta(detail.status).label }}</span>
                <span class="text-[13px] text-muted-500">{{ detail.stage }}</span>
              </div>

              <!--
              The 82px ring becomes a labelled bar (§5). A ring beside a name at
              393px costs a third of the column to say one number, and it cannot
              show how far along a mid-build project is at a glance the way a
              bar can.
            -->
              <div class="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-muted-800 px-4 py-3.5 lg:hidden">
                <div class="min-w-0 flex-1">
                  <div class="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-500">
                    Overall progress
                  </div>
                  <div class="mt-[9px] h-2 overflow-hidden rounded-full bg-white/[0.07]">
                    <div class="h-full rounded-full" :class="detail.status === 'completed' ? 'bg-gradient-to-r from-[#22B07D] to-[#1a8f66]' : 'bg-gradient-to-r from-primary-400 to-primary-500'" :style="{ width: `${detail.progress}%` }" />
                  </div>
                </div>
                <div class="font-heading shrink-0 text-2xl font-extrabold text-white tabular-nums">
                  {{ detail.progress }}%
                </div>
              </div>
            </div>

            <div class="my-6 hidden h-px bg-white/10 lg:block" />

            <div class="order-3 lg:order-none">
              <ApexSectionLabel as="h3" label="Milestones" class="mb-3 lg:mb-5" />
              <div class="rounded-2xl border border-white/10 bg-muted-800 p-[18px] lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
                <div v-for="(st, i) in detail.stages" :key="st.n" class="flex gap-[13px] lg:gap-4" :class="i === detail.stages.length - 1 ? '' : 'pb-1'">
                  <div class="flex w-[30px] shrink-0 flex-col items-center">
                    <span
                      v-if="st.state === 'done'"
                      class="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#22B07D] ring-4 ring-[#22B07D]/14"
                    ><Icon name="lucide:check" class="size-[15px] text-white" /></span>
                    <span v-else-if="st.state === 'active'" class="apex-spin box-border size-[30px] shrink-0 rounded-full border-[3px] border-primary-500/30 border-t-primary-500" />
                    <span v-else class="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 font-heading text-[12.5px] font-bold text-muted-500">{{ st.n }}</span>
                    <div v-if="i < detail.stages.length - 1" class="mt-1.5 w-0.5 flex-1 rounded" :class="st.state === 'done' ? 'bg-[#22B07D]' : 'bg-white/10'" style="min-height: 26px;" />
                  </div>
                  <div class="min-w-0 flex-1 pb-4 lg:pb-1">
                    <!-- Name and date share a line only where there is room for both. -->
                    <div class="flex flex-col items-start gap-[3px] lg:flex-row lg:items-center lg:justify-between lg:gap-3">
                      <span class="font-heading text-[15px]" :class="st.state === 'active' ? 'font-bold text-white' : st.state === 'done' ? 'font-semibold text-white' : 'font-medium text-muted-500'">{{ st.name }}</span>
                      <span class="text-[12.5px] text-muted-500 lg:whitespace-nowrap lg:rounded-[7px] lg:bg-white/5 lg:px-2 lg:py-[3px] lg:text-[11.5px]">{{ st.date }}</span>
                    </div>
                    <!-- Only claim work is underway when the project itself is active. -->
                    <div v-if="st.state === 'active' && detail.status === 'active'" class="mt-1 text-[12.5px] text-muted-500">
                      Team is currently working on this stage.
                    </div>
                  </div>
                </div>
                <div v-if="!detail.stages.length" class="rounded-xl border border-dashed border-white/10 p-6 text-center text-[13.5px] text-muted-500">
                  Milestones will appear once your project is scoped.
                </div>
              </div>
            </div>
          </div>

          <!-- files -->
          <section class="order-4 lg:order-none lg:rounded-2xl lg:border lg:border-white/10 lg:bg-muted-800 lg:px-7 lg:py-6">
            <!-- Phone: the label sits outside the card, with the count opposite it. -->
            <div class="mb-3 flex items-center lg:hidden">
              <ApexSectionLabel as="h3" label="Files" />
              <span class="grow" />
              <span class="text-[12.5px] text-muted-500">{{ detail.files.length }} item{{ detail.files.length === 1 ? '' : 's' }}</span>
            </div>
            <div class="mb-4 hidden items-center gap-2.5 lg:flex">
              <Icon name="lucide:folder" class="size-[19px] text-primary-400" />
              <h3 class="font-heading text-[17px] font-bold text-white">
                Project files
              </h3>
              <span class="rounded-full bg-white/5 px-2 py-px text-xs text-muted-500">{{ detail.files.length }}</span>
            </div>
            <!--
              One list with dividers on a phone, the desktop's two-up grid of
              bordered pills from `lg`. `grid-cols-*` is inert while the
              container is a flex column, so the desktop columns can stay
              declared where they were.
            -->
            <div v-if="detail.files.length" class="flex grid-cols-1 flex-col gap-0 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-muted-800 sm:grid-cols-2 lg:grid lg:gap-3 lg:divide-y-0 lg:rounded-none lg:border-0 lg:bg-transparent">
              <a v-for="f in detail.files" :key="f.id" :href="f.url || '#'" class="flex min-h-16 items-center gap-3 px-4 py-3 transition lg:min-h-0 lg:rounded-xl lg:border lg:border-white/10 lg:bg-white/5 lg:px-3.5 lg:hover:border-white/15">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-[11px] border border-white/10 bg-white/5 text-muted-500 lg:size-[38px] lg:rounded-xl lg:border-0 lg:bg-primary-500/14 lg:text-primary-400"><Icon :name="f.type === 'zip' ? 'lucide:folder-archive' : 'lucide:file-text'" class="size-[18px]" /></span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-[14px] font-semibold text-white lg:text-[13.5px]">{{ f.name }}</div>
                  <div class="mt-0.5 text-[12px] text-muted-500 lg:mt-0 lg:text-[11.5px]">{{ f.size }}</div>
                </div>
                <Icon name="lucide:download" aria-hidden="true" class="size-[18px] shrink-0 text-muted-500 lg:size-4" />
              </a>
            </div>
            <div v-else class="rounded-xl border border-dashed border-white/10 p-6 text-center text-[13.5px] text-muted-500">
              No files shared yet. Deliverables will appear here as your team uploads them.
            </div>
          </section>
        </div>

        <!-- RIGHT rail -->
        <aside class="contents lg:sticky lg:top-4 lg:flex lg:flex-col lg:gap-[18px]">
          <!-- summary -->
          <section class="order-5 lg:order-none">
            <ApexSectionLabel as="h3" label="Project summary" class="mb-3 lg:hidden" />
            <!--
              The rail's gradient is a desktop treatment; the phone's summary is
              a flat card like every other section beside it. It lives in scoped
              CSS because an inline `style` cannot carry a media query — and an
              inline background beats any class that tries to override it.
            -->
            <div class="apex-summary-card overflow-hidden rounded-2xl border border-white/10 bg-muted-800">
              <div class="hidden border-b border-white/10 px-[22px] py-[18px] lg:block">
                <ApexSectionLabel as="h3" label="Project summary" />
              </div>
              <div class="px-[18px] py-1.5 lg:px-[22px] lg:pb-3.5 lg:pt-2">
                <div class="flex items-center justify-between border-b border-white/10 py-[13px] lg:py-3">
                  <span class="text-[13.5px] text-muted-500 lg:text-[13px]">Project value</span><span class="text-[13.5px] font-semibold text-white tabular-nums lg:font-heading lg:text-sm lg:font-bold">{{ formatCurrency(detail.budget) }}</span>
                </div>
                <div class="flex items-center justify-between border-b border-white/10 py-[13px] lg:py-3">
                  <span class="text-[13.5px] text-muted-500 lg:text-[13px]">Start date</span><span class="text-[13.5px] font-semibold text-white">{{ detail.start }}</span>
                </div>
                <div class="flex items-center justify-between py-[13px] lg:py-3">
                  <span class="text-[13.5px] text-muted-500 lg:text-[13px]">Due date</span><span class="text-[13.5px] font-semibold text-white">{{ detail.due }}</span>
                </div>
              </div>
              <div class="px-[18px] pb-[18px] lg:px-[22px] lg:pb-5">
                <div class="flex items-center gap-3 rounded-xl border border-white/10 bg-muted-800 px-3.5 py-3">
                  <span class="flex size-[38px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold" :class="detail.pmGrad.includes('F2C14E') ? 'text-[#3a2c00]' : 'text-white'" :style="{ background: detail.pmGrad }">{{ detail.pmInitials }}</span>
                  <div>
                    <div class="text-[11px] font-bold tracking-[0.05em] text-muted-500">
                      PROJECT MANAGER
                    </div>
                    <div class="mt-0.5 text-sm font-semibold text-white">
                      {{ detail.pmName }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- payment plan -->
          <section v-if="detailPay" class="order-2 lg:order-none">
            <ApexSectionLabel as="h3" label="Payment plan" class="mb-3 lg:hidden" />
            <div class="overflow-hidden rounded-2xl border border-white/10 bg-muted-800">
              <!--
              Desktop leads with the card's own title and puts the state chip
              opposite it; with the section label already outside the card on a
              phone, the chip takes the lead and the plan's length sits opposite.
            -->
              <div class="flex items-center gap-3 px-[18px] pb-3.5 pt-[18px] lg:justify-between lg:px-[22px] lg:pb-4">
                <div class="hidden items-center gap-2.5 lg:flex">
                  <span class="flex size-8 items-center justify-center rounded-xl bg-primary-500/16 text-primary-400"><Icon name="lucide:credit-card" class="size-[17px]" /></span>
                  <span class="font-heading text-[15px] font-bold text-white">Payment plan</span>
                </div>
                <span class="shrink-0 rounded-full px-2.5 py-[5px] text-[11px] font-extrabold uppercase tracking-[0.04em]" :class="detailPay.chip.cls">{{ detailPay.chip.label }}</span>
                <span class="grow lg:hidden" />
                <span class="shrink-0 text-[12.5px] text-muted-500 lg:hidden">{{ detailPay.termLabel }}</span>
              </div>

              <div class="px-[18px] pb-1 lg:px-[22px]">
                <div class="flex items-baseline gap-2 lg:justify-between lg:gap-2.5">
                  <span class="font-heading text-[28px] font-extrabold leading-none tracking-[-0.02em] text-white tabular-nums lg:text-[22px] lg:leading-normal lg:tracking-[-0.01em]">{{ detailPay.paidFmt }}</span>
                  <span class="text-[13.5px] text-muted-500 lg:text-[12.5px]">of {{ detailPay.totalFmt }}<span class="lg:hidden"> paid</span></span>
                </div>
                <div v-if="detailPay.useSegments" class="mt-3.5 flex gap-[3px] lg:mt-3 lg:gap-1">
                  <div v-for="(on, i) in detailPay.segments" :key="i" class="h-[7px] min-w-0 flex-1 rounded-[2px] lg:rounded-[3px]" :class="on ? 'bg-primary-500' : 'bg-white/[0.08]'" />
                </div>
                <div v-else class="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div class="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-500" :style="{ width: `${detailPay.barPct}%` }" />
                </div>
                <div class="mt-2.5 text-[12.5px] text-muted-500">
                  {{ detailPay.countText }}
                </div>
              </div>

              <!-- next payment -->
              <div v-if="detailPay.showNext" class="mx-[18px] mt-4 rounded-xl border p-3.5 lg:mx-[22px] lg:p-4" :class="detailPay.due ? 'border-[#D9A521]/24 bg-[#D9A521]/[0.08]' : 'border-primary-500/22 bg-primary-500/[0.08]'">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-[11px] font-bold uppercase tracking-[0.05em] lg:text-[11.5px] lg:tracking-[0.04em]" :class="detailPay.due ? 'text-[#F2C14E]' : 'text-primary-200'">
                      {{ detailPay.nextLabel }}
                    </div>
                    <div class="mt-0.5 text-[13px] font-semibold text-white">
                      {{ detail.inst.nextDate }}
                    </div>
                  </div>
                  <div class="font-heading text-[22px] font-extrabold tracking-[-0.01em] text-white tabular-nums">
                    {{ detailPay.nextAmtFmt }}
                  </div>
                </div>
                <button
                  type="button"
                  class="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl border-none py-2.5 text-[13.5px] font-bold text-white transition"
                  :class="detailPay.due ? 'bg-gradient-to-r from-[#E0A93A] to-[#c98d1f] shadow-[0_8px_20px_rgba(217,165,33,.28)]' : 'bg-primary-500 shadow-[0_8px_20px_rgba(125,83,242,.30)] hover:bg-primary-600'"
                  @click="payNow"
                >
                  Pay {{ detailPay.nextAmtFmt }}{{ detailPay.due ? ' now' : '' }}<Icon name="lucide:arrow-right" class="size-[15px]" />
                </button>
              </div>

              <!-- paid in full -->
              <div v-if="detailPay.kind === 'paid'" class="mx-[18px] mt-4 flex items-center gap-3 rounded-xl border border-[#22B07D]/26 bg-[#22B07D]/10 p-3.5 lg:mx-[22px] lg:p-4">
                <span class="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#22B07D]/18 text-[#22B07D]"><Icon name="lucide:check" class="size-[18px]" /></span>
                <div>
                  <div class="text-sm font-semibold text-white">
                    Paid in full
                  </div>
                  <div class="mt-0.5 text-xs text-muted-500">
                    All {{ detail.inst.total }} installments cleared.
                  </div>
                </div>
              </div>

              <!-- pending note -->
              <div v-if="detailPay.kind === 'pending'" class="mx-[18px] mt-4 flex items-start gap-3 rounded-xl border border-[#D9A521]/22 bg-[#D9A521]/[0.08] p-3.5 lg:mx-[22px] lg:p-4">
                <Icon name="lucide:clock" class="mt-px size-[17px] shrink-0 text-[#F2C14E]" />
                <div class="text-[12.5px] leading-[1.5] text-muted-400">
                  Your first installment of <strong class="font-semibold text-white">{{ detailPay.nextAmtFmt }}</strong> {{ detailPay.pendingWhen }}. Nothing is due today.
                </div>
              </div>

              <NuxtLink to="/dashboards/wallet" class="m-[18px] mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[14px] font-semibold text-white transition hover:border-white/15 lg:m-[22px] lg:mt-4 lg:min-h-0 lg:text-[13.5px]">
                <Icon name="lucide:wallet" class="size-4" />{{ detailPay.scheduleLabel }}<Icon name="lucide:chevron-right" class="size-[15px] opacity-70" />
              </NuxtLink>
            </div>
          </section>

          <!-- support entry point -->
          <NuxtLink to="/dashboards/support" class="order-6 flex min-h-[72px] items-center lg:order-none gap-3 rounded-2xl border border-white/10 bg-muted-800 px-4 py-3.5 transition hover:border-white/15 hover:bg-muted-700 lg:min-h-0">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-primary-500/14 text-primary-400 lg:rounded-xl"><Icon name="lucide:message-circle" class="size-[19px]" /></span>
            <div class="min-w-0 flex-1">
              <div class="text-[14.5px] font-semibold text-white lg:text-sm">
                Message your team
              </div>
              <div class="mt-0.5 text-[12.5px] text-muted-500 lg:text-xs">
                Opens Tickets &amp; Support
              </div>
            </div>
            <Icon name="lucide:arrow-up-right" aria-hidden="true" class="size-[17px] shrink-0 text-muted-500" />
          </NuxtLink>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The summary card's rail gradient is desktop-only; see the template note. */
@media (min-width: 1024px) {
  .apex-summary-card {
    background: linear-gradient(160deg, #16252a, #101d21);
  }
}

@keyframes apex-shimmer {
  0% {
    background-position: -760px 0;
  }
  100% {
    background-position: 760px 0;
  }
}
.apex-shimmer {
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.04));
  background-size: 760px 100%;
  animation: apex-shimmer 1.4s infinite linear;
}
@keyframes apex-rise {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}
.apex-rise {
  animation: apex-rise 0.3s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
@keyframes apex-spin {
  to {
    transform: rotate(360deg);
  }
}
.apex-spin {
  animation: apex-spin 0.9s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .apex-shimmer,
  .apex-rise,
  .apex-spin {
    animation: none;
  }
}
</style>
