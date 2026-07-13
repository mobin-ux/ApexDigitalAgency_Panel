<script setup lang="ts">
/**
 * My Orders — Apex Design redesign.
 * List view: stat strip, filter tabs + search + sort, project card grid.
 * Detail view: milestone timeline, files, project summary + payment-plan rail
 * with segmented installment tracking.
 *
 * Data comes from /api/orders (projects + milestones + files + manager).
 * The per-project installment plan is DERIVED for presentation (12-month plan,
 * amount/12, paid inferred from status/progress) — TODO(api): replace with real
 * Installment records once the API links them to projects.
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
const { data: apiResponse, pending } = await useFetch('/api/orders', { lazy: true })

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

// TODO(api): presentation-only installment plan derived from the project.
function deriveInst(status: UiStatus, amount: number, progress: number, deadline: string | null): Inst {
  const total = 12
  const per = Math.max(1, Math.round((amount || 0) / total))
  if (status === 'completed')
    return { total, paid: total, amount: per, nextDate: null, dueInDays: null }
  if (status === 'pending' || status === 'cancelled')
    return { total, paid: 0, amount: per, nextDate: 'On kickoff', dueInDays: null }
  const paid = Math.min(total - 1, Math.max(0, Math.floor((progress / 100) * total)))
  const dueInDays = deadline ? Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)) : null
  const nextDate = dueInDays != null && dueInDays <= 7 ? `in ${dueInDays} day${dueInDays === 1 ? '' : 's'}` : fmtDate(deadline, 'Next cycle')
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
      start: status === 'pending' ? 'Not started' : fmtDate(o.startDate),
      due: fmtDate(o.deadline),
      pmName,
      pmInitials,
      pmGrad: PM_GRADS[i % PM_GRADS.length]!,
      inst: deriveInst(status, o.amount ?? 0, o.progress ?? 0, o.deadline),
      activity: relTime(o.updatedAt || o.createdAt),
      createdAt: new Date(o.createdAt).getTime(),
      stages,
      files: (o.files ?? []).map((f: any) => ({ id: f.id, name: f.name, size: f.size, type: f.type, url: f.url })),
    }
  })
})

// ---- view state -----------------------------------------------------------
const view = ref<'list' | 'detail'>('list')
const selId = ref<string | null>(null)
const filter = ref<'all' | 'active' | 'pending' | 'completed'>('all')
const q = ref('')
const sort = ref<'recent' | 'progress' | 'due' | 'name'>('recent')

const detail = computed(() => projects.value.find(p => p.id === selId.value) || null)

function openDetail(id: string) {
  selId.value = id
  view.value = 'detail'
  window.scrollTo({ top: 0 })
}
function backToList() {
  view.value = 'list'
  selId.value = null
  window.scrollTo({ top: 0 })
}
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
const TABS = [['all', 'All'], ['active', 'Active'], ['pending', 'Pending'], ['completed', 'Completed']] as const

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

const stats = computed(() => {
  const dueSoon = projects.value.filter(p => p.status === 'active' && p.inst.dueInDays != null && p.inst.dueInDays <= 5).length
  const outstanding = projects.value.reduce((a, p) => a + (p.status === 'completed' ? 0 : (p.inst.total - p.inst.paid) * p.inst.amount), 0)
  return [
    { icon: 'lucide:box', tone: 'bg-primary-500/14 text-primary-400', value: String(counts.value.active ?? 0), label: 'Active projects' },
    { icon: 'lucide:check', tone: 'bg-[#22B07D]/14 text-[#22B07D]', value: String(counts.value.completed ?? 0), label: 'Completed' },
    { icon: 'lucide:banknote', tone: 'bg-[#D9A521]/14 text-[#F2C14E]', value: formatCurrency(outstanding), label: 'Outstanding balance' },
    { icon: 'lucide:clock', tone: 'bg-[#EC6453]/14 text-[#EC6453]', value: String(dueSoon), label: 'Payments due soon' },
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

interface CardPay { label: string, accent: string, value: string, date: string, inst: string, tone: 'paid' | 'pending' | 'due' | 'ontrack' }
function cardPay(p: UiProject): CardPay {
  const m = formatCurrency(p.inst.amount)
  if (p.status === 'completed')
    return { label: 'Payment', accent: 'text-[#22B07D]', value: 'Paid in full', date: '', inst: `${p.inst.total}/${p.inst.total}`, tone: 'paid' }
  if (p.status !== 'active')
    return { label: 'First payment', accent: 'text-muted-500', value: m, date: 'On kickoff', inst: `0/${p.inst.total}`, tone: 'pending' }
  const due = p.inst.dueInDays != null && p.inst.dueInDays <= 5
  return { label: due ? 'Payment due' : 'Next payment', accent: due ? 'text-[#F2C14E]' : 'text-primary-200', value: m, date: p.inst.nextDate || '', inst: `${p.inst.paid}/${p.inst.total}`, tone: due ? 'due' : 'ontrack' }
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
  const due = p.status === 'active' && p.inst.dueInDays != null && p.inst.dueInDays <= 5
  const kind = p.status === 'completed' ? 'paid' : p.status !== 'active' ? 'pending' : due ? 'due' : 'ontrack'
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
    useSegments: total <= 16,
    segments: Array.from({ length: total }, (_, i) => i < paid),
    barPct: Math.round((paid / total) * 100),
    countText: `${paid} of ${total} installments paid`,
    showNext: kind === 'ontrack' || kind === 'due',
    due,
    nextLabel: due ? 'Payment due' : 'Next payment',
    nextAmtFmt: formatCurrency(amount),
    scheduleLabel: kind === 'paid' ? 'View payment history' : 'View full schedule',
  }
})

// Ring geometry (R=36, C=2πR) per the design.
const RING_C = 2 * Math.PI * 36
const ringOffset = computed(() => detail.value ? RING_C * (1 - detail.value.progress / 100) : RING_C)

function payNow() {
  // TODO(api): no installment-charge endpoint yet — installments are settled
  // from the Wallet. Send the customer there rather than faking a payment.
  toaster.add({ title: 'Pay from your wallet', description: 'Installments are settled from your Wallet & Credit page.', icon: 'lucide:wallet', progress: true })
  router.push('/dashboards/wallet')
}
</script>

<template>
  <div class="mx-auto flex max-w-[1220px] flex-col gap-6 pb-14 font-sans text-muted-400">
    <!-- breadcrumb strip -->
    <div class="flex items-center gap-2 text-[13.5px] text-muted-500">
      <span>Services</span><span class="opacity-50">/</span><span class="font-semibold text-white">My orders</span>
    </div>

    <!-- ============================ LIST VIEW ============================ -->
    <div v-if="view === 'list'">
      <!-- title + primary action -->
      <div class="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 class="font-heading text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white">
            My <span class="text-primary-400">orders</span>
          </h1>
          <p class="mt-2 text-[15px] text-muted-400">
            Track active projects, milestones and installments — all in one place.
          </p>
        </div>
        <BaseButton rounded="full" variant="primary" to="/dashboards/services" class="shadow-[0_10px_24px_rgba(125,83,242,.32)]">
          <Icon name="lucide:plus" class="size-4" />New project
        </BaseButton>
      </div>

      <!-- stat strip -->
      <div class="mb-[22px] grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="st in stats" :key="st.label" class="flex items-center gap-3 rounded-[20px] border border-white/10 bg-muted-800 px-[18px] py-4">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-[11px]" :class="st.tone"><Icon :name="st.icon" class="size-[19px]" /></span>
          <div>
            <div class="font-heading text-[22px] font-extrabold leading-none tracking-[-0.01em] text-white tabular-nums">
              {{ st.value }}
            </div>
            <div class="mt-1 text-[12.5px] text-muted-500">
              {{ st.label }}
            </div>
          </div>
        </div>
      </div>

      <!-- controls -->
      <div class="mb-[22px] flex flex-wrap items-center gap-3.5">
        <div role="tablist" class="flex min-w-0 flex-nowrap gap-1 overflow-x-auto rounded-full border border-white/10 bg-muted-800 p-1">
          <button
            v-for="[key, label] in TABS" :key="key"
            type="button" role="tab" :aria-selected="filter === key"
            class="inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] transition"
            :class="filter === key ? 'bg-primary-500 font-bold text-white' : 'font-semibold text-muted-400 hover:text-white'"
            @click="filter = key"
          >
            {{ label }}
            <span class="rounded-full px-1.5 py-px text-[11px] font-bold" :class="filter === key ? 'bg-white/20 text-white' : 'bg-white/5 text-muted-500'">{{ counts[key] ?? 0 }}</span>
          </button>
        </div>
        <div class="flex-1" />
        <label class="flex w-full items-center gap-2 rounded-[11px] border border-white/10 bg-muted-800 px-3 py-2 transition focus-within:border-primary-400 sm:w-[230px]">
          <Icon name="lucide:search" class="size-4 shrink-0 text-muted-500" />
          <input v-model="q" placeholder="Search name or ID" class="w-full min-w-0 border-none bg-transparent text-[13.5px] text-white outline-none placeholder:text-muted-500">
        </label>
        <label class="flex items-center gap-2 rounded-[11px] border border-white/10 bg-muted-800 px-3 py-2 text-[13px] text-muted-500">
          <span class="whitespace-nowrap">Sort</span>
          <select v-model="sort" class="cursor-pointer border-none bg-transparent text-[13.5px] font-semibold text-white outline-none [color-scheme:dark]">
            <option value="recent">Recent activity</option>
            <option value="progress">Progress</option>
            <option value="due">Next payment</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      <!-- loading skeletons -->
      <div v-if="pending" class="grid grid-cols-1 gap-[18px] md:grid-cols-2 xl:grid-cols-3">
        <div v-for="i in 3" :key="i" class="h-[290px] rounded-[28px] border border-white/10 bg-muted-800 p-[22px]">
          <div class="apex-shimmer size-12 rounded-[13px]" />
          <div class="apex-shimmer mt-5 h-5 w-3/5 rounded-md" />
          <div class="apex-shimmer mt-3 h-3 w-2/5 rounded-md" />
          <div class="apex-shimmer mt-6 h-2 w-full rounded-md" />
          <div class="apex-shimmer mt-6 h-14 w-full rounded-xl" />
        </div>
      </div>

      <!-- card grid -->
      <div v-else-if="filtered.length" class="grid grid-cols-1 gap-[18px] md:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="p in filtered" :key="p.id"
          type="button"
          class="flex min-h-[280px] flex-col rounded-[28px] border border-white/10 bg-muted-800 p-[22px] text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_18px_40px_rgba(0,0,0,.28)]"
          @click="openDetail(p.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <span class="flex size-12 shrink-0 items-center justify-center rounded-[13px]" :class="SVC_META[p.icon].tone"><Icon :name="SVC_META[p.icon].icon" class="size-[22px]" /></span>
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
            <span class="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-bold text-primary-400">Details<Icon name="lucide:chevron-right" class="size-[15px]" /></span>
          </div>
        </button>

        <!-- start new project tile -->
        <NuxtLink to="/dashboards/services" class="flex min-h-[200px] flex-col items-center justify-center gap-3.5 rounded-[28px] border-[1.5px] border-dashed border-white/15 p-7 text-center transition hover:border-primary-400 hover:bg-primary-500/5">
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
      <div v-else class="rounded-[28px] border border-white/10 bg-muted-800 px-7 py-14 text-center">
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
    </div>

    <!-- ============================ DETAIL VIEW ============================ -->
    <div v-else-if="detail" class="apex-rise">
      <div class="mb-[22px] flex flex-wrap items-center justify-between gap-4">
        <BaseButton rounded="full" class="border border-white/10 bg-muted-800 !text-white hover:bg-muted-700" @click="backToList">
          <Icon name="lucide:arrow-left" class="size-[15px]" />All projects
        </BaseButton>
        <div class="inline-flex items-center gap-1.5 text-[12.5px] text-muted-500">
          <Icon name="lucide:clock" class="size-3.5" />Last update {{ detail.activity }}
        </div>
      </div>

      <div class="grid items-start gap-[22px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <!-- LEFT column -->
        <div class="flex min-w-0 flex-col gap-[22px]">
          <!-- header + milestones -->
          <section class="rounded-[28px] border border-white/10 bg-muted-800 p-7">
            <div class="flex flex-wrap items-start justify-between gap-5">
              <div class="flex min-w-0 items-start gap-4">
                <span class="flex size-[52px] shrink-0 items-center justify-center rounded-[14px]" :class="SVC_META[detail.icon].tone"><Icon :name="SVC_META[detail.icon].icon" class="size-[25px]" /></span>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2.5">
                    <h2 class="font-heading text-[26px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white">
                      {{ detail.name }}
                    </h2>
                    <span class="rounded-full px-2.5 py-[5px] text-[11px] font-extrabold uppercase tracking-[0.05em]" :class="statusMeta(detail.status).chip">{{ statusMeta(detail.status).label }}</span>
                  </div>
                  <div class="mt-1.5 text-[13.5px] text-muted-500">
                    {{ detail.service }} · #{{ detail.shortId }}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-3.5">
                <div class="relative size-[82px] shrink-0">
                  <svg width="82" height="82" viewBox="0 0 82 82">
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

            <div class="my-6 h-px bg-white/10" />

            <div class="mb-5 text-xs font-bold tracking-[0.06em] text-muted-500">
              MILESTONES
            </div>
            <div>
              <div v-for="(st, i) in detail.stages" :key="st.n" class="flex gap-4" :class="i === detail.stages.length - 1 ? '' : 'pb-1'">
                <div class="flex w-[30px] shrink-0 flex-col items-center">
                  <span
                    v-if="st.state === 'done'"
                    class="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#22B07D] ring-4 ring-[#22B07D]/14"
                  ><Icon name="lucide:check" class="size-[15px] text-white" /></span>
                  <span v-else-if="st.state === 'active'" class="apex-spin box-border size-[30px] shrink-0 rounded-full border-[3px] border-primary-500/30 border-t-primary-500" />
                  <span v-else class="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 font-heading text-[12.5px] font-bold text-muted-500">{{ st.n }}</span>
                  <div v-if="i < detail.stages.length - 1" class="mt-1.5 w-0.5 flex-1 rounded" :class="st.state === 'done' ? 'bg-[#22B07D]' : 'bg-white/10'" style="min-height: 26px;" />
                </div>
                <div class="flex-1 pb-1">
                  <div class="flex items-center justify-between gap-3">
                    <span class="font-heading text-[15px]" :class="st.state === 'active' ? 'font-bold text-white' : st.state === 'done' ? 'font-semibold text-white' : 'font-medium text-muted-500'">{{ st.name }}</span>
                    <span class="whitespace-nowrap rounded-[7px] bg-white/5 px-2 py-[3px] text-[11.5px] text-muted-500">{{ st.date }}</span>
                  </div>
                  <div v-if="st.state === 'active'" class="mt-1 text-[12.5px] text-muted-500">
                    Team is currently working on this stage.
                  </div>
                </div>
              </div>
              <div v-if="!detail.stages.length" class="rounded-xl border border-dashed border-white/10 p-6 text-center text-[13.5px] text-muted-500">
                Milestones will appear once your project is scoped.
              </div>
            </div>
          </section>

          <!-- files -->
          <section class="rounded-[28px] border border-white/10 bg-muted-800 px-7 py-6">
            <div class="mb-4 flex items-center gap-2.5">
              <Icon name="lucide:folder" class="size-[19px] text-primary-400" />
              <h3 class="font-heading text-[17px] font-bold text-white">
                Project files
              </h3>
              <span class="rounded-full bg-white/5 px-2 py-px text-xs text-muted-500">{{ detail.files.length }}</span>
            </div>
            <div v-if="detail.files.length" class="grid gap-3 sm:grid-cols-2">
              <a v-for="f in detail.files" :key="f.id" :href="f.url || '#'" class="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 transition hover:border-white/15">
                <span class="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-primary-500/14 text-primary-400"><Icon :name="f.type === 'zip' ? 'lucide:folder-archive' : 'lucide:file-text'" class="size-[18px]" /></span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-[13.5px] font-semibold text-white">{{ f.name }}</div>
                  <div class="text-[11.5px] text-muted-500">{{ f.size }}</div>
                </div>
                <Icon name="lucide:download" class="size-4 text-muted-500" />
              </a>
            </div>
            <div v-else class="rounded-xl border border-dashed border-white/10 p-6 text-center text-[13.5px] text-muted-500">
              No files shared yet. Deliverables will appear here as your team uploads them.
            </div>
          </section>
        </div>

        <!-- RIGHT rail -->
        <aside class="flex flex-col gap-[18px] lg:sticky lg:top-4">
          <!-- summary -->
          <section class="overflow-hidden rounded-[28px] border border-white/10" style="background: linear-gradient(160deg, #16252A, #101D21);">
            <div class="border-b border-white/10 px-[22px] py-[18px] text-xs font-bold tracking-[0.06em] text-muted-500">
              PROJECT SUMMARY
            </div>
            <div class="px-[22px] pb-3.5 pt-2">
              <div class="flex items-center justify-between border-b border-white/10 py-3">
                <span class="text-[13px] text-muted-500">Project value</span><span class="font-heading text-sm font-bold text-white tabular-nums">{{ formatCurrency(detail.budget) }}</span>
              </div>
              <div class="flex items-center justify-between border-b border-white/10 py-3">
                <span class="text-[13px] text-muted-500">Start date</span><span class="text-[13.5px] font-semibold text-white">{{ detail.start }}</span>
              </div>
              <div class="flex items-center justify-between py-3">
                <span class="text-[13px] text-muted-500">Due date</span><span class="text-[13.5px] font-semibold text-white">{{ detail.due }}</span>
              </div>
            </div>
            <div class="px-[22px] pb-5">
              <div class="flex items-center gap-3 rounded-[13px] border border-white/10 bg-muted-800 px-3.5 py-3">
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
          </section>

          <!-- payment plan -->
          <section v-if="detailPay" class="overflow-hidden rounded-[28px] border border-white/10 bg-muted-800">
            <div class="flex items-center justify-between gap-3 px-[22px] pb-4 pt-[18px]">
              <div class="flex items-center gap-2.5">
                <span class="flex size-8 items-center justify-center rounded-[9px] bg-primary-500/16 text-primary-400"><Icon name="lucide:credit-card" class="size-[17px]" /></span>
                <span class="font-heading text-[15px] font-bold text-white">Payment plan</span>
              </div>
              <span class="rounded-full px-2.5 py-[5px] text-[11px] font-extrabold uppercase tracking-[0.04em]" :class="detailPay.chip.cls">{{ detailPay.chip.label }}</span>
            </div>

            <div class="px-[22px] pb-1">
              <div class="flex items-baseline justify-between gap-2.5">
                <span class="font-heading text-[22px] font-extrabold tracking-[-0.01em] text-white tabular-nums">{{ detailPay.paidFmt }}</span>
                <span class="text-[12.5px] text-muted-500">of {{ detailPay.totalFmt }}</span>
              </div>
              <div v-if="detailPay.useSegments" class="mt-3 flex gap-1">
                <div v-for="(on, i) in detailPay.segments" :key="i" class="h-[7px] flex-1 rounded-[3px]" :class="on ? 'bg-primary-500' : 'bg-white/[0.08]'" />
              </div>
              <div v-else class="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div class="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-500" :style="{ width: `${detailPay.barPct}%` }" />
              </div>
              <div class="mt-2.5 text-[12.5px] text-muted-500">
                {{ detailPay.countText }}
              </div>
            </div>

            <!-- next payment -->
            <div v-if="detailPay.showNext" class="mx-[22px] mt-4 rounded-[14px] border p-4" :class="detailPay.due ? 'border-[#D9A521]/24 bg-[#D9A521]/[0.08]' : 'border-primary-500/22 bg-primary-500/[0.08]'">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-[11.5px] font-bold uppercase tracking-[0.04em]" :class="detailPay.due ? 'text-[#F2C14E]' : 'text-primary-200'">
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
                class="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[11px] border-none py-2.5 text-[13.5px] font-bold text-white transition"
                :class="detailPay.due ? 'bg-gradient-to-r from-[#E0A93A] to-[#c98d1f] shadow-[0_8px_20px_rgba(217,165,33,.28)]' : 'bg-primary-500 shadow-[0_8px_20px_rgba(125,83,242,.30)] hover:bg-primary-600'"
                @click="payNow"
              >
                Pay {{ detailPay.nextAmtFmt }}{{ detailPay.due ? ' now' : '' }}<Icon name="lucide:arrow-right" class="size-[15px]" />
              </button>
            </div>

            <!-- paid in full -->
            <div v-if="detailPay.kind === 'paid'" class="mx-[22px] mt-4 flex items-center gap-3 rounded-[14px] border border-[#22B07D]/26 bg-[#22B07D]/10 p-4">
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
            <div v-if="detailPay.kind === 'pending'" class="mx-[22px] mt-4 flex items-start gap-3 rounded-[14px] border border-[#D9A521]/22 bg-[#D9A521]/[0.08] p-4">
              <Icon name="lucide:clock" class="mt-px size-[17px] shrink-0 text-[#F2C14E]" />
              <div class="text-[12.5px] leading-[1.5] text-muted-400">
                Your first installment of <strong class="font-semibold text-white">{{ detailPay.nextAmtFmt }}</strong> is scheduled after project kickoff. Nothing is due today.
              </div>
            </div>

            <NuxtLink to="/dashboards/wallet" class="m-[22px] mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[13.5px] font-semibold text-white transition hover:border-white/15">
              <Icon name="lucide:wallet" class="size-4" />{{ detailPay.scheduleLabel }}<Icon name="lucide:chevron-right" class="size-[15px] opacity-70" />
            </NuxtLink>
          </section>

          <!-- support entry point -->
          <NuxtLink to="/dashboards/support" class="flex items-center gap-3 rounded-[20px] border border-white/10 bg-muted-800 px-4 py-3.5 transition hover:border-white/15 hover:bg-muted-700">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-primary-500/14 text-primary-400"><Icon name="lucide:message-circle" class="size-[19px]" /></span>
            <div class="flex-1">
              <div class="text-sm font-semibold text-white">
                Message your team
              </div>
              <div class="mt-0.5 text-xs text-muted-500">
                Opens Tickets &amp; Support
              </div>
            </div>
            <Icon name="lucide:arrow-up-right" class="size-[17px] text-muted-500" />
          </NuxtLink>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
