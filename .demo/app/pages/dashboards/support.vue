<script setup lang="ts">
/**
 * Support center — Apex Design redesign (V2 Phase 6, mobile pass Phase 6M).
 * Three sections: My tickets (split-pane inbox + thread + composer), New request
 * (category grid + form), Help & FAQ (knowledge base + search).
 *
 * Real data: tickets + latest message from GET /api/support/tickets, full
 * thread from GET /api/support/[id]/messages, replies via POST
 * /api/support/[id]/reply, new tickets via POST /api/support/create.
 * "Related project" options come from /api/orders.
 *
 * Below `lg` the two-pane inbox cannot follow, so the page becomes four
 * screens rather than three tabs and a pane: the inbox, one request, the new
 * form and help. Which one is showing lives in the **URL** (`?ticket=<id>`,
 * `?tab=new|faq`) rather than in a local ref, because the shell reads it too:
 * the bar swaps its hamburger for a back arrow and names the request, and the
 * bottom tab bar steps aside for the composer. Both of those render *before*
 * this page's `setup()` runs, so anything they need has to be in the route or
 * they show the wrong thing for a frame first. It also means the browser's own
 * back button walks back out of a request, and every screen is linkable.
 *
 * Placeholders (TODO(api) — no backing model/endpoint yet):
 *  - File attachments. `TicketMessage` has no attachment relation and there is
 *    no upload endpoint, so the page does not offer a file picker at all. It
 *    used to: files were accepted, shown as chips, then dropped on send — an
 *    interaction indistinguishable from success, so a customer who attached
 *    the screenshot we asked for believed we had it. Both composers now say
 *    how to send a file instead. Restore the picker in the same pass that
 *    adds `POST /api/support/:id/attachments`, never before. This matters more
 *    on a phone, which is where a customer actually takes the screenshot.
 *  - Assigned agent identity (no assignee field on Ticket) — replies from
 *    staff render under a single "Apex Support" persona.
 *  - "Related project" is not a Ticket field — folded into the message text
 *    instead of being silently dropped.
 *  - Read state. `Ticket` has no `readAt`, so "unread" is tracked per browser
 *    in localStorage (see `lastRead`). Swap the store for the server value if
 *    the field lands; the computed does not change.
 */
definePageMeta({
  title: 'Support',
  layout: 'sidenav',
  middleware: 'auth',
})

const route = useRoute()
const router = useRouter()

// ---- fetch -----------------------------------------------------------------
const { data: apiResponse, refresh: refreshTickets } = await useFetch('/api/support/tickets', { lazy: true })
const { data: ordersData } = await useFetch('/api/orders', { lazy: true })

const projectOpts = computed(() => ['None', ...((ordersData.value as any)?.data ?? []).map((o: any) => o.name)])

// ---- taxonomy ---------------------------------------------------------------
type CatKey = 'billing' | 'technical' | 'presales' | 'aftersales' | 'project' | 'general'
type PriKey = 'urgent' | 'high' | 'normal' | 'low'
type StatusKey = 'open' | 'pending' | 'resolved'

const CATEGORIES: Record<CatKey, { label: string, api: string, icon: string, text: string, bg: string, sub: string }> = {
  billing: { label: 'Billing', api: 'Billing', icon: 'lucide:wallet', text: 'text-primary-400', bg: 'bg-primary-500/14', sub: 'Invoices, payments, VAT' },
  technical: { label: 'Technical', api: 'Technical', icon: 'lucide:code-2', text: 'text-[#6EA8FE]', bg: 'bg-[#6EA8FE]/14', sub: 'Bugs, access, setup' },
  presales: { label: 'Pre-sales', api: 'Pre-sales', icon: 'lucide:arrow-up-right', text: 'text-[#22B07D]', bg: 'bg-[#22B07D]/14', sub: 'Quotes & new work' },
  aftersales: { label: 'After-sales', api: 'After-sales', icon: 'lucide:badge-check', text: 'text-[#F2C14E]', bg: 'bg-[#D9A521]/14', sub: 'Post-delivery help' },
  project: { label: 'Project', api: 'Project', icon: 'lucide:briefcase', text: 'text-primary-200', bg: 'bg-primary-500/12', sub: 'About an active project' },
  general: { label: 'General', api: 'General', icon: 'lucide:message-circle', text: 'text-muted-400', bg: 'bg-muted-700', sub: 'Anything else' },
}
const PRIORITIES: Record<PriKey, { label: string, api: string, text: string, bg: string }> = {
  urgent: { label: 'Urgent', api: 'URGENT', text: 'text-[#EC6453]', bg: 'bg-[#EC6453]/16' },
  high: { label: 'High', api: 'HIGH', text: 'text-[#F2C14E]', bg: 'bg-[#D9A521]/16' },
  normal: { label: 'Normal', api: 'NORMAL', text: 'text-muted-400', bg: 'bg-muted-700' },
  low: { label: 'Low', api: 'LOW', text: 'text-muted-500', bg: 'bg-muted-700' },
}
const STATUSES: Record<StatusKey, { label: string, text: string, bg: string }> = {
  open: { label: 'Open', text: 'text-[#22B07D]', bg: 'bg-[#22B07D]/14' },
  pending: { label: 'Awaiting you', text: 'text-[#F2C14E]', bg: 'bg-[#D9A521]/16' },
  resolved: { label: 'Resolved', text: 'text-muted-500', bg: 'bg-muted-700' },
}
const ETA: Record<PriKey, { label: string, color: string }> = {
  urgent: { label: 'under 5 minutes', color: '#EC6453' },
  high: { label: '~10 minutes', color: '#F2C14E' },
  normal: { label: '~15 minutes', color: '#22B07D' },
  low: { label: 'within a few hours', color: 'var(--color-muted-400)' },
}

/**
 * Category / priority / status arrive as free text (the schema does not
 * constrain them), so these three resolve by substring. Precedence is
 * deliberate and matters: "Billing enquiry — pre-sales" resolves to billing
 * because `bill` is tested first. Reorder only with that in mind.
 */
function catKey(raw: string): CatKey {
  const c = (raw || '').toLowerCase()
  if (c.includes('bill'))
    return 'billing'
  if (c.includes('tech'))
    return 'technical'
  if (c.includes('pre') && c.includes('sale'))
    return 'presales'
  if (c.includes('after'))
    return 'aftersales'
  if (c.includes('project'))
    return 'project'
  return 'general'
}
function priKey(raw: string): PriKey {
  const p = (raw || '').toLowerCase()
  if (p.includes('urgent'))
    return 'urgent'
  if (p.includes('high'))
    return 'high'
  if (p.includes('low'))
    return 'low'
  return 'normal'
}
function statusKey(raw: string): StatusKey {
  const s = (raw || '').toUpperCase()
  if (s === 'ANSWERED')
    return 'pending'
  if (s === 'OPEN')
    return 'open'
  return 'resolved'
}
function relTime(v: string | Date) {
  const diff = Date.now() - new Date(v).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)
    return 'Just now'
  if (m < 60)
    return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24)
    return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days === 1)
    return 'Yesterday'
  if (days < 7)
    return `${days} days ago`
  const w = Math.floor(days / 7)
  return `${w} week${w === 1 ? '' : 's'} ago`
}
function clock(v: string | Date) {
  return new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
/** The customer-facing ticket reference. Defined once — it appears in four places. */
function ticketRef(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`
}
function firstReplyLabel(created: string | Date, msgs: { isAdmin: boolean, createdAt: string }[]) {
  const firstAdmin = msgs.find(m => m.isAdmin)
  if (!firstAdmin)
    return '—'
  const mins = Math.round((new Date(firstAdmin.createdAt).getTime() - new Date(created).getTime()) / 60_000)
  return mins < 1 ? '<1 min' : `${mins} min`
}

// ---- tickets (list) ---------------------------------------------------------
interface RawTicket { id: string, subject: string, category: string, priority: string, status: string, createdAt: string, updatedAt: string, messages: { id: string, content: string, isAdmin: boolean, createdAt: string }[] }
const tickets = computed<RawTicket[]>(() => (apiResponse.value as any)?.tickets ?? [])

/**
 * Which screen is showing, read from the route (see the file header).
 *
 * `?ticket=` wins over `?tab=`: arriving on Help with a request silently open
 * behind it would make a search result look like it did nothing.
 */
type TabKey = 'tickets' | 'new' | 'faq'

/**
 * Section labels, long and short. The three desktop names need about 430px of
 * pill against 361px of content at 393px, so below `sm` the strip is one
 * four-up segmented control and two of the labels shorten (§1). A third entry
 * here rather than a second array — one row, one set of names.
 */
const TAB_DEFS = [
  ['tickets', 'My tickets', 'Requests'],
  ['new', 'New request', 'New'],
  ['faq', 'Help & FAQ', 'Help'],
] as const

const openTicketId = computed(() => (typeof route.query.ticket === 'string' && route.query.ticket ? route.query.ticket : null))
const threadOpen = computed(() => openTicketId.value !== null)
const tab = computed<TabKey>(() => {
  if (threadOpen.value)
    return 'tickets'
  const t = route.query.tab
  return t === 'new' || t === 'faq' ? t : 'tickets'
})

function goTab(next: TabKey) {
  const query: Record<string, any> = { ...route.query }
  delete query.ticket
  if (next === 'tickets') {
    delete query.tab
  }
  else {
    query.tab = next
  }
  router.push({ path: route.path, query })
}

const statusFilter = ref<'all' | StatusKey>('all')
const catFilter = ref<'all' | CatKey>('all')
const q = ref('')
const catSheetOpen = ref(false)
const projSheetOpen = ref(false)

const openCount = computed(() => tickets.value.filter(t => statusKey(t.status) === 'open').length)

/**
 * Status filters: the phone spells the state out, the 360px desktop pane
 * cannot afford to (§2). Same list, same order, same values.
 */
const STATUS_FILTERS = [
  ['all', 'All', 'All'],
  ['open', 'Open', 'Open'],
  ['pending', 'Awaiting you', 'Awaiting'],
  ['resolved', 'Resolved', 'Resolved'],
] as const

const CAT_FILTERS = computed(() => [
  ['all', 'All categories'] as const,
  ...(Object.keys(CATEGORIES) as CatKey[]).map(k => [k, CATEGORIES[k].label] as const),
])
const catFilterLabel = computed(() => (catFilter.value === 'all' ? 'All' : CATEGORIES[catFilter.value].label))
function pickCat(key: 'all' | CatKey) {
  catFilter.value = key
  catSheetOpen.value = false
}

/**
 * Last-read timestamp per ticket.
 *
 * "Unread" used to mean "the newest message is from staff", which is true
 * forever once they answer — the dot lit on every answered ticket and never
 * went out, so it carried no information. There is no read state on the
 * model, so it is kept per browser here. Persisting it beats session state:
 * a dot that returns on every reload is the same permanently-on dot.
 */
const lastRead = useLocalStorage<Record<string, number>>('apex:support:lastRead', {})

const listRows = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return tickets.value
    .filter((t) => {
      if (statusFilter.value !== 'all' && statusKey(t.status) !== statusFilter.value)
        return false
      if (catFilter.value !== 'all' && catKey(t.category) !== catFilter.value)
        return false
      if (needle && !(t.subject.toLowerCase().includes(needle) || t.id.toLowerCase().includes(needle)))
        return false
      return true
    })
    .map(t => ({
      ...t,
      unread: t.messages[0]?.isAdmin === true
        && new Date(t.messages[0]!.createdAt).getTime() > (lastRead.value[t.id] ?? 0),
      preview: t.messages[0] ? (t.messages[0].isAdmin ? 'Apex Support: ' : 'You: ') + t.messages[0].content : 'No messages yet',
    }))
})

const anyFilter = computed(() => statusFilter.value !== 'all' || catFilter.value !== 'all' || !!q.value.trim())

/**
 * The desktop split pane always has a request selected — an empty right-hand
 * column is half a screen of nothing. A phone does not: until one is tapped
 * there is no thread. So the auto-selection stays a plain ref and never
 * touches the URL, and the URL is what "the customer opened this one" means.
 */
const autoId = ref<string | null>(null)
watchEffect(() => {
  if (!autoId.value && listRows.value.length) {
    autoId.value = listRows.value[0]!.id
  }
})
const activeId = computed(() => openTicketId.value ?? autoId.value)
const activeTicket = computed(() => tickets.value.find(t => t.id === activeId.value) ?? null)

/**
 * Marking read follows what is actually on screen, not what is selected.
 * Below `lg` the thread is a screen of its own, so the auto-selected first
 * request must not be marked read there — it would clear a dot for a reply
 * nobody has seen. From `lg` up both panes are visible at once and the active
 * thread is genuinely being read.
 *
 * `useMediaQuery` is false during SSR and resolves on the client; it only ever
 * drives this side effect, never markup, so it cannot cause a hydration
 * mismatch.
 */
const isSplitPane = useMediaQuery('(min-width: 1024px)')

function markRead(id: string) {
  lastRead.value = { ...lastRead.value, [id]: Date.now() }
}

watchEffect(() => {
  if (activeId.value && (isSplitPane.value || threadOpen.value)) {
    markRead(activeId.value)
  }
})

/**
 * Opening pushes so the browser's back button returns to the inbox; the bar's
 * back arrow (`useApexSubView`) replaces, so that button never goes *forward*
 * into the request again. Nuxt does not restore scroll across a query-only
 * navigation, hence the two lines either side.
 */
const listScroll = ref(0)
function selectTicket(id: string) {
  if (import.meta.client) {
    listScroll.value = window.scrollY
  }
  autoId.value = id
  const query = { ...route.query }
  delete query.tab
  router.push({ path: route.path, query: { ...query, ticket: id } })
}
watch(threadOpen, (now, before) => {
  if (!import.meta.client) {
    return
  }
  nextTick(() => window.scrollTo({ top: now ? 0 : (before ? listScroll.value : 0) }))
})

/**
 * The bar names the open request while one is open. Data, not route, so it
 * travels through shared state — see `useApexSubView`.
 */
const { title: subViewTitle } = useApexSubView()
watchEffect(() => {
  subViewTitle.value = threadOpen.value ? (activeTicket.value?.subject ?? null) : null
})
onBeforeUnmount(() => {
  subViewTitle.value = null
})

// ---- thread (full message history, fetched per ticket) ---------------------
const threadCache = ref<Record<string, { id: string, content: string, isAdmin: boolean, createdAt: string }[]>>({})
const threadLoading = ref(false)
const threadRef = ref<HTMLElement | null>(null)

async function loadThread(id: string) {
  if (threadCache.value[id])
    return
  threadLoading.value = true
  try {
    const res = await $fetch<any>(`/api/support/${id}/messages`)
    threadCache.value = { ...threadCache.value, [id]: res.messages ?? [] }
    scrollThread()
  }
  finally {
    threadLoading.value = false
  }
}
function scrollThread() {
  nextTick(() => {
    if (threadRef.value)
      threadRef.value.scrollTop = threadRef.value.scrollHeight
  })
}
watchEffect(() => {
  if (activeId.value)
    loadThread(activeId.value)
})

const thread = computed(() => (activeId.value && threadCache.value[activeId.value]) || [])

/**
 * The staff avatar belongs to a *run* of consecutive replies, not to every
 * bubble in it (§6). Below `lg` the repeats are hidden rather than removed, so
 * the 30px column — and therefore every bubble's left edge — is exactly where
 * it was; on desktop, where there is room, every reply keeps its face.
 */
const threadRows = computed(() => thread.value.map((m, i, arr) => ({
  ...m,
  runStart: !(i > 0 && arr[i - 1]!.isAdmin),
})))

// ---- composer ----------------------------------------------------------------
const draft = ref('')
const sending = ref(false)

const QUICK_REPLIES = ['Yes, please go ahead', 'Can you share a preview?', 'Thanks!']
function useQuick(text: string) {
  draft.value = draft.value ? `${draft.value} ${text}` : text
}
async function sendReply() {
  const text = draft.value.trim()
  if (!text || !activeId.value || sending.value)
    return
  sending.value = true
  try {
    const { message } = await $fetch<any>(`/api/support/${activeId.value}/reply`, { method: 'POST', body: { content: text } })
    threadCache.value = { ...threadCache.value, [activeId.value]: [...thread.value, message] }
    draft.value = ''
    scrollThread()
    await refreshTickets()
  }
  finally {
    sending.value = false
  }
}
/**
 * Enter sends on a hardware keyboard. On a touch keyboard it is the only way
 * to start a new line, so sending there would make a multi-line reply
 * impossible to write — and the textarea grows to several lines precisely
 * because customers write them. Read at event time, so nothing is decided
 * during SSR.
 */
function onDraftKey(e: KeyboardEvent) {
  const coarse = import.meta.client && window.matchMedia('(pointer: coarse)').matches
  if (e.key === 'Enter' && !e.shiftKey && !coarse) {
    e.preventDefault()
    sendReply()
  }
}

// ---- new request ---------------------------------------------------------------
const nCat = ref<CatKey>('technical')
const nPriority = ref<PriKey>('normal')
const nProject = ref('None')
const nSubject = ref('')
const nMessage = ref('')
const submitting = ref(false)
const submittedId = ref<string | null>(null)

const canSubmit = computed(() => nSubject.value.trim() && nMessage.value.trim())

function pickProject(v: string) {
  nProject.value = v
  projSheetOpen.value = false
}

async function submitNew() {
  if (!canSubmit.value || submitting.value)
    return
  submitting.value = true
  try {
    const body = nProject.value !== 'None' ? `Project: ${nProject.value}\n\n${nMessage.value.trim()}` : nMessage.value.trim()
    const { ticket } = await $fetch<any>('/api/support/create', {
      method: 'POST',
      body: { subject: nSubject.value.trim(), category: CATEGORIES[nCat.value].api, priority: PRIORITIES[nPriority.value].api, message: body },
    })
    submittedId.value = ticket.id
    await refreshTickets()
  }
  finally {
    submitting.value = false
  }
}
function viewNewTicket() {
  if (!submittedId.value)
    return
  const id = submittedId.value
  resetNew()
  selectTicket(id)
}
function resetNew() {
  submittedId.value = null
  nCat.value = 'technical'
  nPriority.value = 'normal'
  nProject.value = 'None'
  nSubject.value = ''
  nMessage.value = ''
}
function openNew() {
  resetNew()
  goTab('new')
}

// ---- FAQ (served by /api/config — Setting support.faq, admin-editable) -----------
interface Faq { id: string, cat: CatKey, q: string, a: string }
const { data: appConfig } = await useFetch('/api/config', { lazy: true })
const FAQS = computed<Faq[]>(() =>
  (((appConfig.value as any)?.support?.faq ?? []) as { cat: string, q: string, a: string }[])
    .map((f, i) => ({ id: `f${i + 1}`, cat: f.cat as CatKey, q: f.q, a: f.a })),
)
const replyEta = computed<string>(() => (appConfig.value as any)?.support?.replyEta ?? '~15 min')
const faqQ = ref('')
const faqOpen = ref<Record<string, boolean>>({ f1: true })
function toggleFaq(id: string) {
  faqOpen.value = { ...faqOpen.value, [id]: !faqOpen.value[id] }
}
const faqRows = computed(() => {
  const needle = faqQ.value.trim().toLowerCase()
  return FAQS.value.filter(f => !needle || f.q.toLowerCase().includes(needle) || f.a.toLowerCase().includes(needle))
})
</script>

<template>
  <!--
    Split-pane inbox needs a bounded height so the thread scrolls internally.
    `dvh` tracks the mobile URL bar (unlike `vh`); subtracting the top+bottom
    safe-area insets keeps the whole pane — and the composer at its foot — clear
    of the notch and the home indicator. Insets are 0 in a normal browser tab.

    That bounded height is right on desktop, where both panes are on screen at
    once, and right on a phone *while reading a request* — it is what keeps the
    composer pinned above the keyboard, which is also why the bottom tab bar
    steps aside there (`useApexTaskBar`). It is wrong on a phone showing the
    inbox: the heading and filters leave barely 250px of actual list, so the
    list is given the normal page flow instead and the whole page scrolls.
  -->
  <div
    class="apex-support mx-auto flex max-w-[1180px] flex-col pb-[22px] font-sans text-muted-400"
    :class="[
      threadOpen ? 'apex-pane-h max-lg:pb-0' : '',
      tab === 'new' && !submittedId ? 'max-lg:pb-0' : '',
    ]"
  >
    <!-- A request is a screen of its own below `lg`, so the visible h1 goes with
         the rest of the page chrome; this keeps the heading order intact for
         anyone navigating by headings. -->
    <h1 v-if="threadOpen" class="sr-only lg:hidden">
      Support center
    </h1>

    <!-- ============ TITLE ============ -->
    <ApexPageHeader
      title="Support"
      accent="center"
      subtitle="Message our team, track requests and find quick answers — all in one place."
      class="mb-8 flex-shrink-0 max-lg:mb-3.5"
      :class="threadOpen ? 'max-lg:hidden' : ''"
    >
      <template #actions>
        <!--
          Availability is reassurance, not a control. On a phone it becomes a
          full-width row directly under the copy (§1) rather than a pill it has
          to share a line with; the ETA is the same config value quoted in the
          form footer and the still-stuck card.
        -->
        <div class="flex w-full items-center gap-2.5 rounded-xl border border-[#22B07D]/24 bg-[#22B07D]/10 px-3.5 py-2.5 sm:h-11 sm:w-auto sm:rounded-full sm:px-4 sm:py-0">
          <span class="size-2 shrink-0 rounded-full bg-[#22B07D] shadow-[0_0_0_3px_rgba(34,176,125,0.18)]" />
          <span class="text-muted-900 text-[13px] font-semibold sm:text-[12.5px] dark:text-white">Team online · replies in {{ replyEta }}</span>
        </div>
        <!--
          One entry point per action (§1). The section strip below already
          carries "New", and on a phone the two would sit within a hundred
          pixels of each other. `sm:contents` rather than a class on the button:
          `BaseButton` declares its own `display` later in the same layer and
          would win over `hidden`.
        -->
        <span class="hidden sm:contents">
          <BaseButton rounded="full" variant="primary" class="h-11! px-6 shadow-[0_10px_24px_rgba(125,83,242,0.32)]" @click="openNew">
            <Icon name="lucide:plus" class="size-4" />
            <span>New request</span>
          </BaseButton>
        </span>
      </template>
    </ApexPageHeader>

    <!-- ============ SECTIONS ============ -->
    <!-- `aria-pressed` buttons rather than tabs: there is no `tabpanel` here
         either, and this matches the choice made on My Orders (Phase 4) and
         Wallet (Phase 5), so all three pages describe themselves the same way. -->
    <div
      role="group" aria-label="Support sections"
      class="mb-[18px] flex w-full flex-shrink-0 gap-[3px] rounded-full border border-white/8 bg-muted-800 p-1 sm:inline-flex sm:w-auto sm:max-w-full sm:gap-1 sm:self-start sm:overflow-x-auto"
      :class="threadOpen ? 'max-lg:hidden' : ''"
    >
      <button
        v-for="[key, label, short] in TAB_DEFS" :key="key"
        type="button" :aria-pressed="tab === key"
        class="apex-focus inline-flex min-h-10 flex-1 shrink-0 items-center justify-center rounded-full px-2 text-[13.5px] transition-all sm:min-h-0 sm:flex-none sm:px-[18px] sm:py-[9px]"
        :class="tab === key ? 'bg-primary-500 font-bold text-white' : 'font-semibold text-muted-400 hover:text-white'"
        @click="goTab(key)"
      >
        <span class="sm:hidden">{{ short }}</span><span class="hidden sm:inline">{{ label }}</span>
        <span v-if="key === 'tickets' && openCount > 0" class="ml-[7px] rounded-full px-[7px] py-px text-[11px] font-bold sm:ml-2" :class="tab === key ? 'bg-white/20 text-white' : 'bg-muted-700 text-muted-400'">{{ openCount }}</span>
      </button>
    </div>

    <!-- ============================================================ TICKETS -->
    <div v-if="tab === 'tickets'" class="apex-rise flex min-h-0 flex-1 flex-col">
      <div v-if="listRows.length || tickets.length || threadOpen" class="apex-inbox grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <!--
          LIST PANE. From `lg` up it is a bordered column beside the thread;
          below, it is simply the page — the card chrome would be a box drawn
          around the whole viewport, and the requests inside it read better as
          separate surfaces (§3).
        -->
        <div
          class="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/8 bg-muted-800 max-lg:overflow-visible max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent"
          :class="threadOpen ? 'hidden lg:flex' : 'flex'"
        >
          <div class="flex-shrink-0 border-b border-white/8 p-3.5 pb-3 max-lg:border-b-0 max-lg:p-0">
            <!-- 48px and 16px on a phone: under 16px iOS zooms the page in on
                 focus and the customer has to pinch back out to see the field
                 they are filling (§2). -->
            <label class="flex items-center gap-2.5 rounded-xl border border-white/8 bg-muted-700 px-3 py-2.5 focus-within:border-primary-400 max-lg:h-12 max-lg:bg-muted-800 max-lg:px-3.5 max-lg:py-0">
              <Icon name="lucide:search" class="size-4 shrink-0 text-muted-500 max-lg:size-[19px]" />
              <input v-model="q" aria-label="Search requests" placeholder="Search requests…" class="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-white outline-none placeholder:text-muted-500 max-lg:text-[16px]">
            </label>
            <!--
              Below `sm` the group's own pill container goes and the four
              filters wrap onto two lines as standalone 38px controls, so
              "Awaiting you" can be spelled out instead of clipped against the
              right edge (§2). 38px is the design's; these are secondary
              controls in a wrapped group and raising them to the shell's 44px
              floor would push the two lines further apart than drawn.
            -->
            <div role="group" aria-label="Filter requests by status" class="mt-3 flex flex-wrap gap-2 sm:mt-2.5 sm:flex-nowrap sm:items-center sm:gap-2 sm:overflow-x-auto sm:rounded-full sm:border sm:border-white/8 sm:bg-muted-700 sm:p-[3px]">
              <button
                v-for="[key, long, short] in STATUS_FILTERS" :key="key"
                type="button" :aria-pressed="statusFilter === key"
                class="apex-focus inline-flex min-h-[38px] shrink-0 items-center whitespace-nowrap rounded-full border px-[15px] text-[13px] transition-all sm:min-h-0 sm:border-0 sm:px-3.5 sm:py-1.5 sm:text-[12.5px]"
                :class="statusFilter === key ? 'border-primary-500 bg-primary-500 font-bold text-white' : 'border-white/8 bg-muted-800 font-semibold text-muted-400 hover:text-white sm:bg-transparent'"
                @click="statusFilter = key"
              >
                <span class="sm:hidden">{{ long }}</span><span class="hidden sm:inline">{{ short }}</span>
              </button>
            </div>
            <!--
              Category: a themed listbox on desktop, a 44px trigger and a bottom
              sheet on a phone (§2). A listbox anchored near the foot of a 393px
              viewport opens over the field it belongs to. Only one of the two is
              ever mounted, so there is one control to label and one to test.
            -->
            <button
              type="button"
              aria-haspopup="dialog"
              :aria-expanded="catSheetOpen"
              class="apex-focus mt-2.5 flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-white/8 bg-muted-800 px-3.5 text-start lg:hidden"
              @click="catSheetOpen = true"
            >
              <Icon name="lucide:sliders-horizontal" aria-hidden="true" class="size-[17px] shrink-0 text-muted-500" />
              <span class="grow truncate text-sm text-muted-400">Category <strong class="font-semibold text-white">{{ catFilterLabel }}</strong></span>
              <Icon name="lucide:chevron-down" aria-hidden="true" class="size-[18px] shrink-0 text-muted-500" />
            </button>
            <!-- `BaseSelect` renders its own element, so the breakpoint gate goes on a wrapper. -->
            <div class="mt-2.5 hidden lg:block">
              <BaseSelect
                v-model="catFilter"
                aria-label="Filter by category"
                rounded="lg"
                size="lg"
                class="bg-muted-700! h-11! w-full! rounded-xl! border-white/8! text-white!"
                :classes="{ text: 'text-[13px]' }"
              >
                <BaseSelectItem value="all">
                  All categories
                </BaseSelectItem>
                <BaseSelectItem v-for="(c, key) in CATEGORIES" :key="key" :value="key">
                  {{ c.label }}
                </BaseSelectItem>
              </BaseSelect>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-2 max-lg:mt-[18px] max-lg:overflow-visible max-lg:p-0">
            <!--
              One control, two compositions. The phone's card is a 16px surface
              of its own with the unread state spelled out; the desktop row is a
              12px item inside the list pane whose selected state is what marks
              it. Both read the same `t`, and the click target, the focus ring
              and the accessible name belong to the single `<button>`.
            -->
            <button
              v-for="t in listRows" :key="t.id"
              type="button"
              :aria-label="`${t.subject}, ${CATEGORIES[catKey(t.category)].label}, ${STATUSES[statusKey(t.status)].label}${t.unread ? ', new reply' : ''}`"
              class="apex-focus mb-3 block w-full rounded-2xl border bg-muted-800 p-4 text-left transition-colors lg:mb-1.5 lg:rounded-xl lg:p-3.5"
              :class="[
                t.unread ? 'border-primary-500/[0.34]' : 'border-white/8',
                t.id === activeId
                  ? 'lg:border-primary-500/45 lg:bg-primary-500/10 lg:shadow-[inset_3px_0_0_var(--color-primary-500)]'
                  : 'lg:border-transparent lg:bg-transparent lg:hover:bg-muted-700',
              ]"
              @click="selectTicket(t.id)"
            >
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center rounded-full px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em] max-lg:px-2.5 max-lg:py-[5px]" :class="[CATEGORIES[catKey(t.category)].text, CATEGORIES[catKey(t.category)].bg]">{{ CATEGORIES[catKey(t.category)].label }}</span>
                <span class="text-[11px] font-semibold max-lg:text-[11.5px]" :class="PRIORITIES[priKey(t.priority)].text">{{ PRIORITIES[priKey(t.priority)].label }}</span>
                <span class="flex-1" />
                <!--
                  An 8px dot is easy to miss on a phone and said nothing on its
                  own, so it gains the word beside it and a violet border on the
                  card (§3). The dot itself is decorative now — the button's
                  accessible name carries the state.
                -->
                <span v-if="t.unread" class="inline-flex shrink-0 items-center gap-1.5">
                  <span aria-hidden="true" class="size-2 shrink-0 rounded-full bg-primary-400" />
                  <span class="text-[11px] font-bold text-primary-200 lg:hidden">New reply</span>
                </span>
              </div>
              <div
                class="mt-2.5 text-sm font-semibold max-lg:line-clamp-2 max-lg:text-[15.5px] max-lg:leading-[1.35] lg:truncate"
                :class="t.id === activeId || t.unread ? 'text-white' : 'text-[#E4E9EB]'"
              >
                {{ t.subject }}
              </div>
              <div class="mt-1 truncate text-[12.5px] text-muted-500 max-lg:mt-[5px] max-lg:text-[13px] max-lg:leading-[1.4]">
                {{ t.preview }}
              </div>
              <div class="mt-2.5 flex items-center gap-2 max-lg:mt-3 max-lg:gap-[9px]">
                <span class="inline-flex items-center rounded-full px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em] max-lg:px-2.5 max-lg:py-[5px]" :class="[STATUSES[statusKey(t.status)].text, STATUSES[statusKey(t.status)].bg]">{{ STATUSES[statusKey(t.status)].label }}</span>
                <span class="text-[11.5px] text-muted-500 max-lg:text-xs">{{ ticketRef(t.id) }}</span>
                <span class="flex-1" />
                <span class="text-[11.5px] text-muted-500 max-lg:text-xs">{{ relTime(t.updatedAt) }}</span>
              </div>
            </button>

            <!--
              Nothing matched. On a phone this replaces the whole list, so it
              says which of the two empty states it is and offers the way out;
              in the desktop pane the filters, the tabs and the header button
              are all still on screen beside it, and a sentence is enough.
            -->
            <template v-if="!listRows.length">
              <div class="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-[30px] text-center lg:hidden">
                <span class="inline-flex size-14 items-center justify-center rounded-2xl bg-primary-500/[0.13] text-primary-400"><Icon name="lucide:inbox" class="size-[26px]" /></span>
                <div class="font-heading mt-4 text-[18px] font-bold text-white">
                  {{ anyFilter ? 'No matching requests' : 'No requests yet' }}
                </div>
                <p class="mb-[18px] mt-2 text-[13.5px] leading-[1.55] text-muted-500">
                  {{ anyFilter
                    ? 'Nothing matches these filters. Clear one, or start a new request and we\'ll pick it up.'
                    : 'When you ask us something it appears here with the full conversation and our reply times.' }}
                </p>
                <BaseButton rounded="full" variant="primary" class="h-[52px]! w-full" @click="openNew">
                  <Icon name="lucide:plus" class="size-4" />
                  <span>New request</span>
                </BaseButton>
              </div>
              <div class="hidden p-11 text-center text-[13.5px] text-muted-500 lg:block">
                No requests match your filters.
              </div>
            </template>
          </div>
        </div>

        <!--
          THREAD. Below `lg` it is the whole screen: the bar carries the back
          arrow and the subject (`useApexSubView`), the tab bar steps aside for
          the composer, and the surfaces span the viewport rather than sitting
          inside the page gutter.
        -->
        <div
          v-if="activeTicket"
          class="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/8 bg-muted-800 max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent"
          :class="[threadOpen ? 'flex apex-edge' : 'hidden lg:flex']"
        >
          <div class="flex-shrink-0 border-b border-white/8 p-[18px] pb-[18px] max-lg:bg-muted-800 max-lg:p-4">
            <div class="flex items-start gap-3.5">
              <div class="min-w-0 flex-1">
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center rounded-full px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em]" :class="[CATEGORIES[catKey(activeTicket.category)].text, CATEGORIES[catKey(activeTicket.category)].bg]">{{ CATEGORIES[catKey(activeTicket.category)].label }}</span>
                  <span class="inline-flex items-center rounded-full px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em]" :class="[PRIORITIES[priKey(activeTicket.priority)].text, PRIORITIES[priKey(activeTicket.priority)].bg]">{{ PRIORITIES[priKey(activeTicket.priority)].label }} priority</span>
                  <span class="inline-flex items-center rounded-full px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em]" :class="[STATUSES[statusKey(activeTicket.status)].text, STATUSES[statusKey(activeTicket.status)].bg]">{{ STATUSES[statusKey(activeTicket.status)].label }}</span>
                  <span class="text-xs text-muted-500">{{ ticketRef(activeTicket.id) }}</span>
                </div>
                <h2 class="font-heading text-xl font-bold leading-[1.25] tracking-[-0.01em] text-white max-lg:text-[19px] max-lg:leading-[1.3]">
                  {{ activeTicket.subject }}
                </h2>
              </div>
            </div>
            <!--
              Below `lg` this is a two-column grid — face, then name over reply
              time — because a phone has no room for the desktop row's divider
              and second identity line. The wrapper below dissolves into
              `display: contents` there so its two children become grid items;
              from `lg` it is a real flex row again, exactly as it was.
            -->
            <div class="mt-3.5 flex flex-wrap items-center gap-4 max-lg:mt-3.5 max-lg:grid max-lg:grid-cols-[34px_1fr] max-lg:gap-x-2.5 max-lg:gap-y-[3px]">
              <div class="contents lg:flex lg:items-center lg:gap-2">
                <span class="inline-flex size-[34px] items-center justify-center rounded-full text-xs font-bold text-white max-lg:row-span-2 max-lg:self-center" style="background: linear-gradient(135deg, #9B79F6, #6C40E8);">AS</span>
                <div>
                  <div class="text-[12.5px] font-semibold leading-tight text-white max-lg:text-[13px]">
                    Apex Support
                  </div>
                  <div class="text-[11px] text-muted-500 max-lg:hidden">
                    Support team
                  </div>
                </div>
              </div>
              <span class="h-[26px] w-px bg-white/8 max-lg:hidden" />
              <div class="flex items-center gap-2 text-[12.5px] text-muted-400 max-lg:col-start-2 max-lg:gap-1.5 max-lg:text-xs">
                <Icon name="lucide:clock" class="size-[15px] text-[#22B07D]" />
                <!-- `thread` is fetched lazily per ticket, so this rendered
                     "First reply —" for a beat and then corrected itself. A
                     skeleton says "loading" instead of stating a wrong value. -->
                First reply
                <span v-if="threadLoading" class="inline-block h-3 w-10 animate-pulse rounded bg-muted-700" aria-label="Loading first reply time" />
                <strong v-else class="font-semibold text-white">{{ firstReplyLabel(activeTicket.createdAt, thread) }}</strong>
              </div>
            </div>
          </div>

          <div ref="threadRef" class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[22px] pb-2 pt-[22px] max-lg:gap-3.5 max-lg:p-4">
            <div class="self-center rounded-full border border-white/8 bg-muted-700 px-3.5 py-1.5 text-xs text-muted-500">
              Ticket opened · {{ relTime(activeTicket.createdAt) }}
            </div>
            <div v-for="m in threadRows" :key="m.id" class="flex items-end gap-2.5 max-lg:gap-[9px]" :class="!m.isAdmin ? 'flex-row-reverse' : ''">
              <span
                v-if="m.isAdmin"
                aria-hidden="true"
                class="inline-flex size-8 shrink-0 items-center justify-center self-end rounded-full text-[11px] font-bold text-white max-lg:size-[30px] max-lg:text-[10.5px]"
                :class="m.runStart ? '' : 'max-lg:invisible'"
                style="background: linear-gradient(135deg, #9B79F6, #6C40E8);"
              >AS</span>
              <div class="flex max-w-[76%] flex-col max-lg:max-w-[84%]" :class="!m.isAdmin ? 'items-end' : 'items-start'">
                <div class="mb-1 text-[11.5px] text-muted-500">
                  {{ m.isAdmin ? 'Apex Support' : 'You' }} · {{ clock(m.createdAt) }}
                </div>
                <div
                  class="apex-bubble rounded-2xl px-[15px] py-3 text-sm leading-[1.55] max-lg:px-3.5 max-lg:text-[15px] max-lg:leading-[1.5]"
                  :class="!m.isAdmin ? 'rounded-br-[4px] bg-gradient-to-br from-primary-500 to-primary-600 text-white' : 'rounded-bl-[4px] border border-white/8 bg-muted-700 text-[#E4E9EB]'"
                >
                  {{ m.content }}
                </div>
              </div>
            </div>
            <div v-if="threadLoading" class="self-center text-xs text-muted-500">
              Loading conversation…
            </div>
          </div>

          <!--
            The composer. Below `lg` it takes the bottom edge the tab bar
            usually holds, so the field sits directly above the keyboard (§4),
            and the quick replies move above it into a single scrolling row —
            `order` on a flex column, so the desktop block layout is untouched.
          -->
          <div class="flex-shrink-0 border-t border-white/8 p-[14px] pb-4 pt-[14px] max-lg:flex max-lg:flex-col max-lg:bg-white/95 max-lg:px-3 max-lg:pb-[max(10px,env(safe-area-inset-bottom))] max-lg:pt-2.5 dark:max-lg:bg-muted-950/95">
            <div class="flex items-end gap-2.5 rounded-xl border border-white/8 bg-muted-700 py-2 pl-3.5 pr-2 focus-within:border-primary-400 max-lg:order-2 max-lg:bg-muted-800 max-lg:py-1.5 max-lg:pr-1.5">
              <textarea
                v-model="draft" rows="1" aria-label="Reply to this request"
                placeholder="Write a reply…"
                class="max-h-[120px] min-w-0 flex-1 resize-none border-none bg-transparent py-1.5 text-sm leading-[1.5] text-white outline-none placeholder:text-muted-500 max-lg:py-2.5 max-lg:text-[16px] max-lg:leading-[1.45]"
                @keydown="onDraftKey"
              />
              <button aria-label="Send reply" class="apex-focus inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white shadow-[0_6px_16px_rgba(125,83,242,0.32)] disabled:cursor-not-allowed disabled:opacity-50 sm:size-[38px]" :disabled="!draft.trim() || sending" @click="sendReply">
                <Icon name="lucide:send" class="size-[17px]" />
              </button>
            </div>
            <!--
              There is no upload endpoint, so there is no paperclip. A disabled
              one would be the dead end Phase 5 removed from the credit card;
              a working-looking one that discards the file is worse than both.
              This says what to do instead — and it matters most here, because
              the phone is where the screenshot gets taken.
            -->
            <div class="mt-2.5 flex items-start gap-2.5 rounded-xl border border-white/8 bg-muted-700 px-3.5 py-3 max-lg:order-3 max-lg:mt-2 max-lg:gap-[9px] max-lg:border-0 max-lg:bg-transparent max-lg:p-0">
              <Icon name="lucide:paperclip" class="mt-px size-[17px] shrink-0 text-primary-400 max-lg:size-4" />
              <span class="text-[12.5px] leading-relaxed text-muted-400 max-lg:text-xs max-lg:leading-[1.45]">
                <span class="lg:hidden">Need to send a file? Ask here and we'll reply with a secure upload link.</span>
                <span class="hidden lg:inline">Need to send a file? Ask us here and we'll reply with a secure upload link — screenshots, briefs and PDFs all welcome.</span>
              </span>
            </div>
            <div class="apex-hscroll mt-2.5 flex flex-wrap items-center gap-2 max-lg:order-1 max-lg:mb-2.5 max-lg:mt-0 max-lg:flex-nowrap max-lg:overflow-x-auto">
              <span class="mr-0.5 text-[11.5px] text-muted-500 max-lg:hidden">Quick:</span>
              <button v-for="qr in QUICK_REPLIES" :key="qr" type="button" class="apex-focus shrink-0 whitespace-nowrap rounded-full border border-white/8 bg-muted-700 px-3 py-1.5 text-xs text-muted-400 hover:border-white/15 hover:text-white max-lg:min-h-9 max-lg:bg-muted-800 max-lg:px-3.5 max-lg:text-[13px]" @click="useQuick(qr)">
                {{ qr }}
              </button>
            </div>
          </div>
        </div>

        <!-- A deep link arrives before the list has loaded, so the thread has a
             shape before it has content. -->
        <div v-else-if="threadOpen" class="apex-edge flex min-h-0 flex-col gap-4 p-4">
          <div class="h-24 animate-pulse rounded-2xl bg-muted-800" />
          <div class="h-16 w-3/4 animate-pulse rounded-2xl bg-muted-800" />
          <div class="h-16 w-2/3 animate-pulse self-end rounded-2xl bg-muted-800" />
        </div>
      </div>

      <!-- empty (no tickets yet) -->
      <div v-else class="flex min-h-0 flex-1 items-center justify-center">
        <div class="max-w-[520px] rounded-2xl border border-white/8 bg-muted-800 px-10 py-[52px] text-center max-sm:px-5 max-sm:py-8">
          <span class="mb-5 inline-flex size-[66px] items-center justify-center rounded-full bg-primary-500/14 text-primary-400">
            <Icon name="lucide:message-square" class="size-[30px]" />
          </span>
          <h3 class="font-heading text-[23px] font-extrabold tracking-[-0.01em] text-white">
            How can we help?
          </h3>
          <p class="mb-6 mt-2.5 text-[14.5px] leading-[1.6] text-muted-400">
            <!-- Same commitment as the header pill, from the same config value.
                 Hardcoding "15 minutes" here meant changing the setting made
                 this sentence quietly false. -->
            You don't have any requests yet. Start a conversation with our team — billing, technical, pre-sales or anything about your projects. We usually reply in {{ replyEta }}.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-3">
            <BaseButton rounded="full" variant="primary" class="shadow-[0_10px_24px_rgba(125,83,242,0.3)] max-sm:h-[52px]! max-sm:w-full" @click="openNew">
              <Icon name="lucide:plus" class="size-4" />
              <span>Start a request</span>
            </BaseButton>
            <BaseButton rounded="full" class="border border-white/8 bg-muted-700 !text-white max-sm:h-12! max-sm:w-full" @click="goTab('faq')">
              Browse FAQ
            </BaseButton>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================ NEW REQUEST -->
    <!--
      `overflow-visible` below `lg` is load-bearing: `overflow-y: auto` makes an
      element a scrollport even when it never scrolls, and a `sticky` footer
      inside one is pinned to a box that never moves. The footer has to stick to
      the *page*, so this stops being a scroll container there.
    -->
    <div v-else-if="tab === 'new'" class="apex-rise min-h-0 flex-1 overflow-y-auto max-lg:overflow-visible">
      <div v-if="!submittedId" class="mx-auto max-w-[760px]">
        <div class="mb-3 text-xs font-bold uppercase tracking-[0.05em] text-muted-500">
          What do you need help with?
        </div>
        <!-- Six tiles 2-up, icon and label left-aligned on a phone (§8): centred
             text under a 40px mark leaves a ragged column at this width. -->
        <div class="grid grid-cols-2 gap-3 max-sm:gap-2.5 sm:grid-cols-3">
          <button
            v-for="(c, key) in CATEGORIES" :key="key"
            type="button" :aria-pressed="nCat === key"
            class="apex-focus rounded-xl border p-[18px] text-center transition-all max-lg:p-3.5 max-lg:text-left"
            :class="nCat === key ? 'border-primary-500 bg-primary-500/10' : 'border-white/8 bg-muted-800 hover:border-white/15'"
            @click="nCat = key"
          >
            <span class="inline-flex size-10 items-center justify-center rounded-xl" :class="[c.bg, c.text]">
              <Icon :name="c.icon" class="size-5" />
            </span>
            <span class="mt-3 block text-sm font-semibold text-white max-lg:mt-2.5 max-lg:text-[14.5px]">{{ c.label }}</span>
            <span class="mt-0.5 block text-xs leading-[1.4] text-muted-500 max-lg:mt-[3px]">{{ c.sub }}</span>
          </button>
        </div>

        <!-- The card is a card on desktop and simply the page on a phone, where
             a border drawn around every field on screen adds nothing. -->
        <div class="mt-[18px] flex flex-col gap-[18px] rounded-2xl border border-white/8 bg-muted-800 p-6 max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:p-0">
          <div>
            <label for="support-subject" class="mb-2 block text-[12.5px] font-semibold text-white max-lg:text-[13px]">Subject</label>
            <input id="support-subject" v-model="nSubject" placeholder="Briefly, what's this about?" class="w-full rounded-xl border border-white/8 bg-muted-700 px-3.5 py-3 text-sm text-white outline-none placeholder:text-muted-500 focus:border-primary-400 max-lg:h-[52px] max-lg:bg-muted-800 max-lg:py-0 max-lg:text-[16px]">
          </div>

          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <!-- A button group is not an input, so this heading is a span and
                   the group carries the accessible name instead of a `for=`. -->
              <span class="mb-2 block text-[12.5px] font-semibold text-white max-lg:text-[13px]">Priority</span>
              <div role="group" aria-label="Priority" class="flex gap-1.5 rounded-xl border border-white/8 bg-muted-700 p-1 max-lg:gap-1 max-lg:bg-muted-800">
                <button
                  v-for="(p, key) in PRIORITIES" :key="key"
                  type="button" :aria-pressed="nPriority === key"
                  class="apex-focus flex-1 rounded-xl px-1 py-2 text-[12.5px] transition-all max-lg:min-h-11 max-lg:py-0 max-lg:text-[13.5px]"
                  :class="nPriority === key ? 'bg-primary-500 font-bold text-white' : 'font-semibold text-muted-400 hover:text-white'"
                  @click="nPriority = key"
                >
                  {{ p.label }}
                </button>
              </div>
            </div>
            <div>
              <!-- Labels a listbox trigger, not an input, so this is a plain
                   heading and the control carries its own `aria-label`. -->
              <span class="mb-2 block text-[12.5px] font-semibold text-white max-lg:text-[13px]">Related project <span class="font-normal text-muted-500">(optional)</span></span>
              <!-- Same trade as the category filter above: a sheet on a phone,
                   the themed listbox on desktop, one of the two mounted. -->
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label="Related project"
                :aria-expanded="projSheetOpen"
                class="apex-focus flex h-[52px] w-full cursor-pointer items-center gap-2.5 rounded-xl border border-white/8 bg-muted-800 px-3.5 text-start lg:hidden"
                @click="projSheetOpen = true"
              >
                <span class="grow truncate text-[16px] text-white">{{ nProject }}</span>
                <Icon name="lucide:chevron-down" aria-hidden="true" class="size-[18px] shrink-0 text-muted-500" />
              </button>
              <div class="hidden lg:block">
                <BaseSelect
                  v-model="nProject"
                  aria-label="Related project"
                  rounded="lg"
                  size="lg"
                  class="bg-muted-700! h-11! w-full! rounded-xl! border-white/8! text-white!"
                  :classes="{ text: 'text-sm' }"
                >
                  <BaseSelectItem v-for="pj in projectOpts" :key="pj" :value="pj">
                    {{ pj }}
                  </BaseSelectItem>
                </BaseSelect>
              </div>
            </div>
          </div>

          <div>
            <label for="support-message" class="mb-2 block text-[12.5px] font-semibold text-white max-lg:text-[13px]">Message</label>
            <textarea id="support-message" v-model="nMessage" rows="5" placeholder="Share as much detail as you can — links, error messages, what you expected to happen…" class="w-full resize-y rounded-xl border border-white/8 bg-muted-700 px-3.5 py-3 text-sm leading-[1.55] text-white outline-none placeholder:text-muted-500 focus:border-primary-400 max-lg:min-h-[177px] max-lg:bg-muted-800 max-lg:p-3.5 max-lg:text-[16px]" />
          </div>

          <!-- Same reasoning as the reply composer: no upload endpoint, so no
               drop zone. The ETA comes from config, like every other one. -->
          <div>
            <span class="mb-2 block text-[12.5px] font-semibold text-white max-lg:text-[13px]">Attachments <span class="font-normal text-muted-500">(optional)</span></span>
            <div class="flex items-start gap-2.5 rounded-xl border border-white/8 bg-muted-700 px-3.5 py-3 max-lg:bg-muted-800 max-lg:p-3.5">
              <Icon name="lucide:paperclip" class="mt-px size-[17px] shrink-0 text-primary-400" />
              <span class="text-[12.5px] leading-relaxed text-muted-400 max-lg:text-[13px]">
                Mention any files in your message and we'll reply with a secure upload link — usually within {{ replyEta }}.
              </span>
            </div>
          </div>

          <!--
            The primary action never scrolls away on a phone (§8): the row
            sticks to the bottom edge, with the ETA above it rather than beside
            it — `flex-col-reverse` against one DOM order, not a second copy of
            either. `order` and `position` are both ignored on the desktop block
            layout, so this is the same row it has always been there.
          -->
          <div class="apex-edge flex flex-wrap items-center gap-3.5 pt-1 max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:flex-col-reverse max-lg:items-stretch max-lg:gap-2.5 max-lg:border-t max-lg:border-white/8 max-lg:bg-white/95 max-lg:px-4 max-lg:pb-[max(12px,env(safe-area-inset-bottom))] max-lg:pt-3 max-lg:backdrop-blur-[10px] dark:max-lg:bg-muted-950/95">
            <button
              type="button"
              class="rounded-full px-6 py-3 text-sm font-bold transition-all max-lg:min-h-[52px] max-lg:py-0 max-lg:text-base"
              :class="canSubmit && !submitting ? 'cursor-pointer bg-primary-500 text-white shadow-[0_10px_24px_rgba(125,83,242,0.3)] hover:bg-primary-600' : 'cursor-not-allowed bg-muted-700 text-muted-500'"
              :disabled="!canSubmit || submitting"
              @click="submitNew"
            >
              {{ submitting ? 'Sending…' : 'Send request' }}
            </button>
            <div class="flex items-center gap-2 text-[12.5px] text-muted-400">
              <Icon name="lucide:clock" class="size-[15px]" :style="{ color: ETA[nPriority].color }" />
              Estimated first reply: <strong class="font-semibold text-white">{{ ETA[nPriority].label }}</strong>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="apex-pop mx-auto mt-6 max-w-[560px] rounded-2xl border border-white/8 bg-muted-800 px-10 py-12 text-center max-sm:px-5 max-sm:py-9">
        <span class="mb-5 inline-flex size-[66px] items-center justify-center rounded-full bg-[#22B07D]/16 text-[#22B07D]">
          <Icon name="lucide:check" class="size-8" />
        </span>
        <h3 class="font-heading text-[23px] font-extrabold tracking-[-0.01em] text-white">
          Request sent
        </h3>
        <p class="mb-6 mt-2.5 text-[14.5px] leading-[1.6] text-muted-400">
          Your ticket <strong class="text-white">{{ ticketRef(submittedId) }}</strong> is with our team. We'll reply within <strong class="text-white">{{ ETA[nPriority].label }}</strong> — you'll get a notification here and by email.
        </p>
        <div class="flex flex-wrap items-center justify-center gap-3">
          <BaseButton rounded="full" variant="primary" class="shadow-[0_10px_24px_rgba(125,83,242,0.3)] max-sm:h-[52px]! max-sm:w-full" @click="viewNewTicket">
            View conversation
          </BaseButton>
          <BaseButton rounded="full" class="border border-white/8 bg-muted-700 !text-white max-sm:h-12! max-sm:w-full" @click="resetNew">
            Send another
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- ============================================================ FAQ -->
    <div v-else class="apex-rise min-h-0 flex-1 overflow-y-auto max-lg:overflow-visible">
      <div class="mx-auto max-w-[820px]">
        <div class="relative mb-5 overflow-hidden rounded-2xl border border-white/8 p-6 max-sm:px-[18px] max-sm:py-5 sm:p-[30px]" style="background: radial-gradient(120% 140% at 85% 15%, rgba(125,83,242,.28), transparent 50%), linear-gradient(150deg, #16252A, #101D21);">
          <h3 class="font-heading text-2xl font-extrabold tracking-[-0.01em] text-white max-lg:text-[21px] max-lg:leading-[1.2]">
            Find an answer in seconds
          </h3>
          <p class="mb-[18px] mt-2 text-sm text-muted-400 max-lg:mb-4 max-lg:text-[13.5px] max-lg:leading-[1.55]">
            Search our knowledge base, or browse the most common questions below.
          </p>
          <label class="flex max-w-[520px] items-center gap-2.5 rounded-xl border border-white/15 bg-[rgba(11,21,23,0.6)] px-4 py-3.5 focus-within:border-primary-400 max-lg:h-[52px] max-lg:max-w-none max-lg:px-3.5 max-lg:py-0">
            <Icon name="lucide:search" class="size-[18px] shrink-0 text-muted-500" />
            <input v-model="faqQ" aria-label="Search help articles" placeholder="Search help articles…" class="min-w-0 flex-1 border-none bg-transparent text-[14.5px] text-white outline-none placeholder:text-muted-500 max-lg:text-[16px]">
          </label>
        </div>

        <div v-if="faqRows.length" class="flex flex-col gap-2.5">
          <div v-for="f in faqRows" :key="f.id" class="overflow-hidden rounded-xl border bg-muted-800" :class="faqOpen[f.id] ? 'border-primary-500/35' : 'border-white/8'">
            <button type="button" :aria-expanded="!!faqOpen[f.id]" class="apex-focus flex w-full items-center gap-3.5 px-5 py-[17px] text-left hover:bg-muted-700 max-sm:min-h-[60px] max-sm:items-start max-sm:gap-3 max-sm:p-4" @click="toggleFaq(f.id)">
              <!--
                A category tag plus a two-line question cannot share 361px, so
                below `sm` the tag sits above the question (§9). `contents` from
                `sm` up dissolves this wrapper, which is how the desktop row
                stays the row it always was rather than a second description of
                it.
              -->
              <span class="block min-w-0 flex-1 sm:contents">
                <span class="inline-flex items-center rounded-full px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em]" :class="[CATEGORIES[f.cat].text, CATEGORIES[f.cat].bg]">{{ CATEGORIES[f.cat].label }}</span>
                <span class="flex-1 text-[14.5px] font-semibold text-white max-sm:mt-[9px] max-sm:block max-sm:text-[15px] max-sm:leading-[1.4]">{{ f.q }}</span>
              </span>
              <Icon name="lucide:chevron-down" class="size-[18px] shrink-0 text-muted-500 transition-transform max-sm:mt-0.5" :class="faqOpen[f.id] ? 'rotate-180' : ''" />
            </button>
            <div v-if="faqOpen[f.id]" class="apex-fade px-5 pb-[18px] text-[13.5px] leading-[1.65] text-muted-400 max-sm:px-4 max-sm:pb-4 max-sm:text-sm">
              {{ f.a }}
            </div>
          </div>
        </div>
        <div v-else class="rounded-2xl border border-white/8 bg-muted-800 px-[30px] py-10 text-center text-sm text-muted-400 max-sm:px-5 max-sm:py-7">
          No articles match "{{ faqQ }}".
        </div>

        <div class="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/8 bg-muted-800 px-6 py-5 max-sm:mt-[18px] max-sm:gap-3.5 max-sm:p-[18px]">
          <div>
            <div class="font-heading text-base font-bold text-white max-sm:text-[17px]">
              Still stuck?
            </div>
            <!-- One commitment, one source: the same config ETA the header pill
                 and the form footer quote (§9). It used to say only that the
                 team was online, which promised nothing and dated badly. -->
            <div class="mt-0.5 text-[13px] text-muted-400 max-sm:mt-[7px] max-sm:text-[13.5px] max-sm:leading-[1.55]">
              Send us the details and a real person replies — usually within {{ replyEta }}.
            </div>
          </div>
          <BaseButton rounded="full" variant="primary" class="shadow-[0_8px_20px_rgba(125,83,242,0.28)] max-sm:h-[52px]! max-sm:w-full" @click="openNew">
            <Icon name="lucide:plus" class="size-[15px]" />
            <span>Contact support</span>
          </BaseButton>
        </div>
      </div>
    </div>

    <!--
      `ink` because this page is navy in both themes until Phase 9 gives it a
      light treatment; a white sheet would be the only light surface on screen.
    -->
    <ApexBottomSheet
      v-model:open="catSheetOpen"
      surface="ink"
      title="Filter by category"
      description="Choose which category of request to show."
    >
      <template #header>
        <div class="font-heading shrink-0 border-b border-white/10 px-[18px] pb-2.5 pt-1.5 text-base font-bold text-white">
          Category
        </div>
      </template>
      <div class="flex flex-col gap-0.5 p-2.5">
        <button
          v-for="[key, label] in CAT_FILTERS" :key="key"
          type="button"
          :aria-pressed="catFilter === key"
          class="apex-focus flex min-h-[52px] w-full cursor-pointer items-center gap-2.5 rounded-xl px-3.5 text-[15px] transition-colors"
          :class="catFilter === key ? 'bg-primary-500/12 font-semibold text-white' : 'text-muted-300 hover:bg-white/5'"
          @click="pickCat(key)"
        >
          <span class="grow text-start">{{ label }}</span>
          <Icon v-if="catFilter === key" name="lucide:check" aria-hidden="true" class="size-[18px] shrink-0 text-primary-400" />
        </button>
      </div>
    </ApexBottomSheet>

    <ApexBottomSheet
      v-model:open="projSheetOpen"
      surface="ink"
      title="Related project"
      description="Choose which of your projects this request is about."
      scrollable
    >
      <template #header>
        <div class="font-heading shrink-0 border-b border-white/10 px-[18px] pb-2.5 pt-1.5 text-base font-bold text-white">
          Related project
        </div>
      </template>
      <div class="flex flex-col gap-0.5 p-2.5">
        <button
          v-for="pj in projectOpts" :key="pj"
          type="button"
          :aria-pressed="nProject === pj"
          class="apex-focus flex min-h-[52px] w-full cursor-pointer items-center gap-2.5 rounded-xl px-3.5 text-start text-[15px] transition-colors"
          :class="nProject === pj ? 'bg-primary-500/12 font-semibold text-white' : 'text-muted-300 hover:bg-white/5'"
          @click="pickProject(pj)"
        >
          <span class="grow truncate">{{ pj }}</span>
          <Icon v-if="nProject === pj" name="lucide:check" aria-hidden="true" class="size-[18px] shrink-0 text-primary-400" />
        </button>
      </div>
    </ApexBottomSheet>
  </div>
</template>

<style scoped>
/*
 * Bounded pane height, in one place (see the template comment for when it is
 * applied). Written as CSS rather than an arbitrary utility because it is
 * toggled per-state and per-breakpoint, and because `env()` inside a Tailwind
 * arbitrary value has bitten this project before.
 *
 * The height of the shell above this page comes from `--apex-shell-offset`
 * (main.css), so the page cannot fall out of step with the top bar again — it
 * did once already, when Phase 1 took that band from 56px to 76px and this
 * file kept subtracting the old figure.
 */
.apex-pane-h {
  height: calc(100dvh - var(--apex-shell-offset) - env(safe-area-inset-top) - env(safe-area-inset-bottom));
}
/* From lg up both panes are visible together, so the shell is always bounded. */
@media (min-width: 1024px) {
  .apex-support {
    height: calc(100dvh - var(--apex-shell-offset) - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }
}

/*
 * Cancels the layout's shared page gutter so a surface can span the viewport
 * below `lg` — the thread, and the new-request footer. Not a Tailwind
 * arbitrary value: the figure has to track the layout's own
 * `max(<gutter>, env(inset))` pattern rather than a bare 16px, and `env()`
 * inside an arbitrary utility has 500'd this project's build before. No
 * padding is given back; the elements inside carry their own.
 */
@media (max-width: 1023.98px) {
  .apex-edge {
    margin-left: calc(-1 * max(1rem, env(safe-area-inset-left)));
    margin-right: calc(-1 * max(1rem, env(safe-area-inset-right)));
  }
}
@media (min-width: 768px) and (max-width: 1023.98px) {
  .apex-edge {
    margin-left: calc(-1 * max(1.5rem, env(safe-area-inset-left)));
    margin-right: calc(-1 * max(1.5rem, env(safe-area-inset-right)));
  }
}

/* Quick replies scroll sideways on a phone rather than wrapping to a second
   row above the field they feed. */
.apex-hscroll {
  scrollbar-width: none;
}
.apex-hscroll::-webkit-scrollbar {
  display: none;
}

.apex-rise {
  animation: apexRise 0.3s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.apex-fade,
.apex-bubble {
  animation: apexFade 0.2s both;
}
.apex-pop {
  animation: apexPop 0.3s cubic-bezier(0.22, 0.61, 0.36, 1) both;
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
  .apex-bubble,
  .apex-pop {
    animation: none;
  }
}
</style>
