<script setup lang="ts">
/**
 * Support center — Apex Design redesign.
 * Three tabs: My tickets (split-pane inbox + thread + composer), New request
 * (category grid + form), Help & FAQ (static knowledge base + search).
 *
 * Real data: tickets + latest message from GET /api/support/tickets, full
 * thread from GET /api/support/[id]/messages, replies via POST
 * /api/support/[id]/reply, new tickets via POST /api/support/create.
 * "Related project" options come from /api/orders.
 *
 * Placeholders (TODO(api) — no backing model/endpoint yet):
 *  - File attachments (TicketMessage has no attachment field/storage) — the
 *    picker is functional for UX parity but files are not uploaded or sent.
 *  - Assigned agent identity (no assignee field on Ticket) — replies from
 *    staff render under a single "Apex Support" persona.
 *  - "Related project" is not a Ticket field — folded into the message text
 *    instead of being silently dropped.
 *  - FAQ content is static editorial copy, same as the Services catalogue.
 */
definePageMeta({
  title: 'Support',
  layout: 'sidenav',
  middleware: 'auth',
})

const toaster = useNuiToasts()

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

const tab = ref<'tickets' | 'new' | 'faq'>('tickets')
const activeId = ref<string | null>(null)
const mobileShowDetail = ref(false)
const statusFilter = ref<'all' | StatusKey>('all')
const catFilter = ref<'all' | CatKey>('all')
const q = ref('')

const openCount = computed(() => tickets.value.filter(t => statusKey(t.status) === 'open').length)
const TAB_DEFS = [
  ['tickets', 'My tickets'],
  ['new', 'New request'],
  ['faq', 'Help & FAQ'],
] as const

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
      unread: t.messages[0]?.isAdmin === true,
      preview: t.messages[0] ? (t.messages[0].isAdmin ? 'Apex Support: ' : 'You: ') + t.messages[0].content : 'No messages yet',
    }))
})

watchEffect(() => {
  if (!activeId.value && listRows.value.length)
    activeId.value = listRows.value[0]!.id
})
const activeTicket = computed(() => tickets.value.find(t => t.id === activeId.value) ?? null)

function selectTicket(id: string) {
  activeId.value = id
  mobileShowDetail.value = true
  loadThread(id)
}
function backToList() {
  mobileShowDetail.value = false
}

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

// ---- composer ----------------------------------------------------------------
const draft = ref('')
const draftFiles = ref<{ name: string, size: string }[]>([])
const sending = ref(false)
const fileRef = ref<HTMLInputElement | null>(null)

function formatSize(bytes: number) {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1_048_576)
    return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}
function triggerAttach() {
  fileRef.value?.click()
}
function onPickFiles(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? []).map(f => ({ name: f.name, size: formatSize(f.size) }))
  draftFiles.value = [...draftFiles.value, ...files]
  ;(e.target as HTMLInputElement).value = ''
}
function removeDraftFile(idx: number) {
  draftFiles.value = draftFiles.value.filter((_, i) => i !== idx)
}
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
    draftFiles.value = []
    scrollThread()
    await refreshTickets()
  }
  finally {
    sending.value = false
  }
}
function onDraftKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
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
const nFiles = ref<{ name: string, size: string }[]>([])
const newFileRef = ref<HTMLInputElement | null>(null)
const submitting = ref(false)
const submittedId = ref<string | null>(null)

function triggerNewAttach() {
  newFileRef.value?.click()
}
function onNewFiles(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? []).map(f => ({ name: f.name, size: formatSize(f.size) }))
  nFiles.value = [...nFiles.value, ...files]
  ;(e.target as HTMLInputElement).value = ''
}
function removeNewFile(idx: number) {
  nFiles.value = nFiles.value.filter((_, i) => i !== idx)
}
const canSubmit = computed(() => nSubject.value.trim() && nMessage.value.trim())

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
  tab.value = 'tickets'
  selectTicket(submittedId.value)
  resetNew()
}
function resetNew() {
  submittedId.value = null
  nCat.value = 'technical'
  nPriority.value = 'normal'
  nProject.value = 'None'
  nSubject.value = ''
  nMessage.value = ''
  nFiles.value = []
}
function openNew() {
  tab.value = 'new'
  resetNew()
}
function goFaq() {
  tab.value = 'faq'
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
    once, and right on a phone *while reading a thread* — it is what keeps the
    composer pinned above the keyboard. It is wrong on a phone showing the
    ticket list: the header and filters leave barely 250px of actual list, so
    the list is given the normal page flow instead and the whole page scrolls.
  -->
  <div
    class="apex-support mx-auto flex max-w-[1240px] flex-col pb-[22px] pt-[26px] font-sans text-muted-400"
    :class="{ 'apex-pane-h': tab === 'tickets' && mobileShowDetail }"
  >
    <!-- ============ TITLE ============ -->
    <div class="mb-[18px] flex flex-shrink-0 flex-wrap items-end justify-between gap-4 sm:gap-5">
      <div>
        <h1 class="font-heading text-[28px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white sm:text-[34px]">
          Support <span class="text-primary-400">center</span>
        </h1>
        <p class="mt-2 text-[14px] text-muted-400 sm:text-[15px]">
          Message our team, track requests and find quick answers — all in one place.
        </p>
      </div>
      <div class="flex w-full items-center gap-3 sm:w-auto">
        <!-- The availability pill is reassurance, not a control; on a phone the
             vertical space it costs is better spent on the list itself. The same
             ETA is repeated inside every thread. -->
        <div class="hidden items-center gap-2.5 rounded-full border border-[#22B07D]/24 bg-[#22B07D]/10 px-3.5 py-2 sm:flex">
          <span class="size-2 rounded-full bg-[#22B07D] shadow-[0_0_0_3px_rgba(34,176,125,0.18)]" />
          <span class="text-[12.5px] font-semibold text-white">Team online · replies in {{ replyEta }}</span>
        </div>
        <BaseButton rounded="full" size="lg" variant="primary" class="w-full shadow-[0_10px_24px_rgba(125,83,242,0.32)] sm:w-auto" @click="openNew">
          <Icon name="lucide:plus" class="size-4" />
          <span>New request</span>
        </BaseButton>
      </div>
    </div>

    <!-- ============ TABS ============ -->
    <div role="tablist" class="mb-[18px] inline-flex max-w-full flex-shrink-0 gap-1 self-start overflow-x-auto rounded-full border border-white/8 bg-muted-800 p-1">
      <button
        v-for="[key, label] in TAB_DEFS" :key="key"
        role="tab" :aria-selected="tab === key"
        class="inline-flex shrink-0 items-center rounded-full px-[18px] py-[11px] text-[13.5px] transition-all sm:py-[9px]"
        :class="tab === key ? 'bg-primary-500 font-bold text-white' : 'font-semibold text-muted-400 hover:text-white'"
        @click="tab = key"
      >
        {{ label }}
        <span v-if="key === 'tickets' && openCount > 0" class="ml-2 rounded-full px-[7px] py-px text-[11px] font-bold" :class="tab === key ? 'bg-white/20 text-white' : 'bg-muted-700 text-muted-400'">{{ openCount }}</span>
      </button>
    </div>

    <!-- ============================================================ TICKETS -->
    <div v-if="tab === 'tickets'" class="apex-rise flex min-h-0 flex-1 flex-col">
      <div v-if="listRows.length || tickets.length" class="apex-inbox grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <!-- LIST PANE -->
        <div class="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/8 bg-muted-800" :class="mobileShowDetail ? 'hidden lg:flex' : 'flex'">
          <div class="flex-shrink-0 border-b border-white/8 p-3.5 pb-3">
            <label class="flex items-center gap-2.5 rounded-[11px] border border-white/8 bg-muted-700 px-3 py-2.5 focus-within:border-primary-400">
              <Icon name="lucide:search" class="size-4 shrink-0 text-muted-500" />
              <input v-model="q" placeholder="Search requests…" class="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-white outline-none placeholder:text-muted-500">
            </label>
            <div class="mt-2.5 flex items-center gap-2 overflow-x-auto rounded-full border border-white/8 bg-muted-700 p-[3px]">
              <button
                v-for="[key, label] in [['all', 'All'], ['open', 'Open'], ['pending', 'Awaiting'], ['resolved', 'Resolved']]" :key="key"
                class="whitespace-nowrap rounded-full px-3.5 py-2.5 text-[12.5px] transition-all sm:py-1.5"
                :class="statusFilter === key ? 'bg-primary-500 font-bold text-white' : 'font-semibold text-muted-400 hover:text-white'"
                @click="statusFilter = key as any"
              >
                {{ label }}
              </button>
            </div>
            <select v-model="catFilter" class="mt-2.5 w-full cursor-pointer rounded-[10px] border border-white/8 bg-muted-700 px-3 py-3 sm:py-2.5 text-[13px] text-white outline-none">
              <option value="all">
                All categories
              </option>
              <option v-for="(c, key) in CATEGORIES" :key="key" :value="key">
                {{ c.label }}
              </option>
            </select>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            <button
              v-for="t in listRows" :key="t.id"
              class="mb-1.5 block w-full rounded-[13px] border p-3.5 text-left transition-colors"
              :class="t.id === activeId ? 'border-primary-500/45 bg-primary-500/10 shadow-[inset_3px_0_0_var(--color-primary-500)]' : 'border-transparent hover:bg-muted-700'"
              @click="selectTicket(t.id)"
            >
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center rounded-full px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em]" :class="[CATEGORIES[catKey(t.category)].text, CATEGORIES[catKey(t.category)].bg]">{{ CATEGORIES[catKey(t.category)].label }}</span>
                <span class="text-[11px] font-semibold" :class="PRIORITIES[priKey(t.priority)].text">{{ PRIORITIES[priKey(t.priority)].label }}</span>
                <span class="flex-1" />
                <span v-if="t.unread" class="size-2 shrink-0 rounded-full bg-primary-400" />
              </div>
              <div class="mt-2.5 truncate text-sm font-semibold" :class="t.id === activeId || t.unread ? 'text-white' : 'text-[#E4E9EB]'">
                {{ t.subject }}
              </div>
              <div class="mt-1 truncate text-[12.5px] text-muted-500">
                {{ t.preview }}
              </div>
              <div class="mt-2.5 flex items-center gap-2">
                <span class="inline-flex items-center rounded-full px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em]" :class="[STATUSES[statusKey(t.status)].text, STATUSES[statusKey(t.status)].bg]">{{ STATUSES[statusKey(t.status)].label }}</span>
                <span class="text-[11.5px] text-muted-500">#{{ t.id.slice(0, 8).toUpperCase() }}</span>
                <span class="flex-1" />
                <span class="text-[11.5px] text-muted-500">{{ relTime(t.updatedAt) }}</span>
              </div>
            </button>
            <div v-if="!listRows.length" class="p-11 text-center text-[13.5px] text-muted-500">
              No requests match your filters.
            </div>
          </div>
        </div>

        <!-- DETAIL PANE -->
        <div v-if="activeTicket" class="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/8 bg-muted-800" :class="mobileShowDetail ? 'flex' : 'hidden lg:flex'">
          <div class="flex-shrink-0 border-b border-white/8 p-[18px] pb-[18px]">
            <button class="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-400 hover:text-white lg:hidden" @click="backToList">
              <Icon name="lucide:chevron-left" class="size-3.5" /> Back to requests
            </button>
            <div class="flex items-start gap-3.5">
              <div class="min-w-0 flex-1">
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center rounded-full px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em]" :class="[CATEGORIES[catKey(activeTicket.category)].text, CATEGORIES[catKey(activeTicket.category)].bg]">{{ CATEGORIES[catKey(activeTicket.category)].label }}</span>
                  <span class="inline-flex items-center rounded-full px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em]" :class="[PRIORITIES[priKey(activeTicket.priority)].text, PRIORITIES[priKey(activeTicket.priority)].bg]">{{ PRIORITIES[priKey(activeTicket.priority)].label }} priority</span>
                  <span class="inline-flex items-center rounded-full px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em]" :class="[STATUSES[statusKey(activeTicket.status)].text, STATUSES[statusKey(activeTicket.status)].bg]">{{ STATUSES[statusKey(activeTicket.status)].label }}</span>
                  <span class="text-xs text-muted-500">#{{ activeTicket.id.slice(0, 8).toUpperCase() }}</span>
                </div>
                <h2 class="font-heading text-xl font-bold leading-[1.25] tracking-[-0.01em] text-white">
                  {{ activeTicket.subject }}
                </h2>
              </div>
            </div>
            <div class="mt-3.5 flex flex-wrap items-center gap-4">
              <div class="flex items-center gap-2">
                <span class="inline-flex size-[34px] items-center justify-center rounded-full text-xs font-bold text-white" style="background: linear-gradient(135deg, #9B79F6, #6C40E8);">AS</span>
                <div>
                  <div class="text-[12.5px] font-semibold leading-tight text-white">
                    Apex Support
                  </div>
                  <div class="text-[11px] text-muted-500">
                    Support team
                  </div>
                </div>
              </div>
              <span class="h-[26px] w-px bg-white/8" />
              <div class="flex items-center gap-2 text-[12.5px] text-muted-400">
                <Icon name="lucide:clock" class="size-[15px] text-[#22B07D]" />
                First reply <strong class="font-semibold text-white">{{ firstReplyLabel(activeTicket.createdAt, thread) }}</strong>
              </div>
            </div>
          </div>

          <div ref="threadRef" class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[22px] pb-2 pt-[22px]">
            <div class="self-center rounded-full border border-white/8 bg-muted-700 px-3.5 py-1.5 text-xs text-muted-500">
              Ticket opened · {{ relTime(activeTicket.createdAt) }}
            </div>
            <div v-for="m in thread" :key="m.id" class="flex items-end gap-2.5" :class="!m.isAdmin ? 'flex-row-reverse' : ''">
              <span v-if="m.isAdmin" class="inline-flex size-8 shrink-0 items-center justify-center self-end rounded-full text-[11px] font-bold text-white" style="background: linear-gradient(135deg, #9B79F6, #6C40E8);">AS</span>
              <div class="flex max-w-[76%] flex-col" :class="!m.isAdmin ? 'items-end' : 'items-start'">
                <div class="mb-1 text-[11.5px] text-muted-500">
                  {{ m.isAdmin ? 'Apex Support' : 'You' }} · {{ clock(m.createdAt) }}
                </div>
                <div
                  class="apex-bubble rounded-2xl px-[15px] py-3 text-sm leading-[1.55]"
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

          <div class="flex-shrink-0 border-t border-white/8 p-[14px] pb-4 pt-[14px]">
            <div v-if="draftFiles.length" class="mb-2.5 flex flex-wrap gap-2">
              <div v-for="(f, i) in draftFiles" :key="i" class="flex items-center gap-2 rounded-[9px] border border-white/8 bg-muted-700 py-1.5 pl-[11px] pr-1.5 text-xs text-white">
                <Icon name="lucide:file-text" class="size-[13px] text-primary-400" />
                {{ f.name }}
                <button aria-label="Remove file" class="inline-flex size-8 items-center justify-center rounded-md text-muted-500 hover:text-[#EC6453] sm:size-6" @click="removeDraftFile(i)">
                  <Icon name="lucide:x" class="size-3" />
                </button>
              </div>
            </div>
            <div class="flex items-end gap-2.5 rounded-[14px] border border-white/8 bg-muted-700 py-2 pl-3.5 pr-2 focus-within:border-primary-400">
              <textarea
                v-model="draft" rows="1" placeholder="Write a reply…  (Enter to send, Shift+Enter for a new line)"
                class="max-h-[120px] min-w-0 flex-1 resize-none border-none bg-transparent py-1.5 text-sm leading-[1.5] text-white outline-none placeholder:text-muted-500"
                @keydown="onDraftKey"
              />
              <input ref="fileRef" type="file" multiple class="hidden" @change="onPickFiles">
              <button aria-label="Attach file" class="inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-white/8 text-muted-400 hover:border-white/15 hover:text-white sm:size-[38px]" @click="triggerAttach">
                <Icon name="lucide:paperclip" class="size-[17px]" />
              </button>
              <button aria-label="Send reply" class="inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-primary-500 text-white shadow-[0_6px_16px_rgba(125,83,242,0.32)] disabled:cursor-not-allowed disabled:opacity-50 sm:size-[38px]" :disabled="!draft.trim() || sending" @click="sendReply">
                <Icon name="lucide:send" class="size-[17px]" />
              </button>
            </div>
            <div class="mt-2.5 flex flex-wrap items-center gap-2">
              <span class="mr-0.5 text-[11.5px] text-muted-500">Quick:</span>
              <button v-for="qr in QUICK_REPLIES" :key="qr" class="rounded-full border border-white/8 bg-muted-700 px-3 py-1.5 text-xs text-muted-400 hover:border-white/15 hover:text-white" @click="useQuick(qr)">
                {{ qr }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- empty (no tickets yet) -->
      <div v-else class="flex min-h-0 flex-1 items-center justify-center">
        <div class="max-w-[520px] rounded-[28px] border border-white/8 bg-muted-800 px-10 py-[52px] text-center">
          <span class="mb-5 inline-flex size-[66px] items-center justify-center rounded-full bg-primary-500/14 text-primary-400">
            <Icon name="lucide:message-square" class="size-[30px]" />
          </span>
          <h3 class="font-heading text-[23px] font-extrabold tracking-[-0.01em] text-white">
            How can we help?
          </h3>
          <p class="mb-6 mt-2.5 text-[14.5px] leading-[1.6] text-muted-400">
            You don't have any requests yet. Start a conversation with our team — billing, technical, pre-sales or anything about your projects. We usually reply within 15 minutes.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-3">
            <BaseButton rounded="full" variant="primary" class="shadow-[0_10px_24px_rgba(125,83,242,0.3)]" @click="openNew">
              <Icon name="lucide:plus" class="size-4" />
              <span>Start a request</span>
            </BaseButton>
            <BaseButton rounded="full" class="border border-white/8 bg-muted-700 !text-white" @click="goFaq">
              Browse FAQ
            </BaseButton>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================ NEW REQUEST -->
    <div v-else-if="tab === 'new'" class="apex-rise min-h-0 flex-1 overflow-y-auto">
      <div v-if="!submittedId" class="mx-auto max-w-[760px]">
        <div class="mb-3 text-xs font-bold uppercase tracking-[0.05em] text-muted-500">
          What do you need help with?
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button
            v-for="(c, key) in CATEGORIES" :key="key"
            class="rounded-[14px] border p-[18px] text-center transition-all"
            :class="nCat === key ? 'border-primary-500 bg-primary-500/10' : 'border-white/8 bg-muted-800 hover:border-white/15'"
            @click="nCat = key"
          >
            <span class="inline-flex size-10 items-center justify-center rounded-[11px]" :class="[c.bg, c.text]">
              <Icon :name="c.icon" class="size-5" />
            </span>
            <span class="mt-3 block text-sm font-semibold text-white">{{ c.label }}</span>
            <span class="mt-0.5 block text-xs leading-[1.4] text-muted-500">{{ c.sub }}</span>
          </button>
        </div>

        <div class="mt-[18px] flex flex-col gap-[18px] rounded-[28px] border border-white/8 bg-muted-800 p-6">
          <div>
            <label class="mb-2 block text-[12.5px] font-semibold text-white">Subject</label>
            <input v-model="nSubject" placeholder="Briefly, what's this about?" class="w-full rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 text-sm text-white outline-none placeholder:text-muted-500 focus:border-primary-400">
          </div>

          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label class="mb-2 block text-[12.5px] font-semibold text-white">Priority</label>
              <div class="flex gap-1.5 rounded-[11px] border border-white/8 bg-muted-700 p-1">
                <button
                  v-for="(p, key) in PRIORITIES" :key="key"
                  class="flex-1 rounded-[9px] px-1 py-2 text-[12.5px] transition-all"
                  :class="nPriority === key ? 'bg-primary-500 font-bold text-white' : 'font-semibold text-muted-400 hover:text-white'"
                  @click="nPriority = key"
                >
                  {{ p.label }}
                </button>
              </div>
            </div>
            <div>
              <label class="mb-2 block text-[12.5px] font-semibold text-white">Related project <span class="font-normal text-muted-500">(optional)</span></label>
              <select v-model="nProject" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 text-sm text-white outline-none focus:border-primary-400">
                <option v-for="pj in projectOpts" :key="pj" :value="pj">
                  {{ pj }}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label class="mb-2 block text-[12.5px] font-semibold text-white">Message</label>
            <textarea v-model="nMessage" rows="5" placeholder="Share as much detail as you can — links, error messages, what you expected to happen…" class="w-full resize-y rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 text-sm leading-[1.55] text-white outline-none placeholder:text-muted-500 focus:border-primary-400" />
          </div>

          <div>
            <label class="mb-2 block text-[12.5px] font-semibold text-white">Attachments <span class="font-normal text-muted-500">(optional)</span></label>
            <button class="flex w-full flex-col items-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-white/15 bg-muted-700 p-[22px] text-muted-400 hover:border-primary-400 hover:bg-primary-500/5 hover:text-white" @click="triggerNewAttach">
              <Icon name="lucide:upload" class="size-[22px]" />
              <span class="text-[13px]">Drop files here or <span class="font-semibold text-primary-400">browse</span></span>
              <span class="text-[11.5px] text-muted-500">Screenshots, PDFs, briefs — up to 20 MB each</span>
            </button>
            <input ref="newFileRef" type="file" multiple class="hidden" @change="onNewFiles">
            <div v-if="nFiles.length" class="mt-2.5 flex flex-wrap gap-2">
              <div v-for="(f, i) in nFiles" :key="i" class="flex items-center gap-2.5 rounded-[10px] border border-white/8 bg-muted-700 py-2 pl-3 pr-2">
                <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-primary-500/14 text-primary-400">
                  <Icon name="lucide:file-text" class="size-3.5" />
                </span>
                <span class="min-w-0">
                  <span class="block max-w-[160px] truncate text-[12.5px] font-semibold text-white">{{ f.name }}</span>
                  <span class="block text-[11px] text-muted-500">{{ f.size }}</span>
                </span>
                <button aria-label="Remove" class="inline-flex size-9 items-center justify-center rounded-md text-muted-500 hover:text-[#EC6453] sm:size-7" @click="removeNewFile(i)">
                  <Icon name="lucide:x" class="size-3" />
                </button>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3.5 pt-1">
            <button
              class="rounded-full px-6 py-3 text-sm font-bold transition-all"
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

      <div v-else class="apex-pop mx-auto mt-6 max-w-[560px] rounded-[28px] border border-white/8 bg-muted-800 px-10 py-12 text-center">
        <span class="mb-5 inline-flex size-[66px] items-center justify-center rounded-full bg-[#22B07D]/16 text-[#22B07D]">
          <Icon name="lucide:check" class="size-8" />
        </span>
        <h3 class="font-heading text-[23px] font-extrabold tracking-[-0.01em] text-white">
          Request sent
        </h3>
        <p class="mb-6 mt-2.5 text-[14.5px] leading-[1.6] text-muted-400">
          Your ticket <strong class="text-white">#{{ submittedId.slice(0, 8).toUpperCase() }}</strong> is with our team. We'll reply within <strong class="text-white">{{ ETA[nPriority].label }}</strong> — you'll get a notification here and by email.
        </p>
        <div class="flex flex-wrap items-center justify-center gap-3">
          <BaseButton rounded="full" variant="primary" class="shadow-[0_10px_24px_rgba(125,83,242,0.3)]" @click="viewNewTicket">
            View conversation
          </BaseButton>
          <BaseButton rounded="full" class="border border-white/8 bg-muted-700 !text-white" @click="resetNew">
            Send another
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- ============================================================ FAQ -->
    <div v-else class="apex-rise min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto max-w-[820px]">
        <div class="relative mb-5 overflow-hidden rounded-[28px] border border-white/8 p-6 sm:p-[30px]" style="background: radial-gradient(120% 140% at 85% 15%, rgba(125,83,242,.28), transparent 50%), linear-gradient(150deg, #16252A, #101D21);">
          <h3 class="font-heading text-2xl font-extrabold tracking-[-0.01em] text-white">
            Find an answer in seconds
          </h3>
          <p class="mb-[18px] mt-2 text-sm text-muted-400">
            Search our knowledge base, or browse the most common questions below.
          </p>
          <label class="flex max-w-[520px] items-center gap-2.5 rounded-[13px] border border-white/15 bg-[rgba(11,21,23,0.6)] px-4 py-3.5 focus-within:border-primary-400">
            <Icon name="lucide:search" class="size-[18px] shrink-0 text-muted-500" />
            <input v-model="faqQ" placeholder="Search help articles…" class="min-w-0 flex-1 border-none bg-transparent text-[14.5px] text-white outline-none placeholder:text-muted-500">
          </label>
        </div>

        <div v-if="faqRows.length" class="flex flex-col gap-2.5">
          <div v-for="f in faqRows" :key="f.id" class="overflow-hidden rounded-[14px] border bg-muted-800" :class="faqOpen[f.id] ? 'border-primary-500/35' : 'border-white/8'">
            <button class="flex w-full items-center gap-3.5 px-5 py-[17px] text-left hover:bg-muted-700" @click="toggleFaq(f.id)">
              <span class="inline-flex items-center rounded-full px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em]" :class="[CATEGORIES[f.cat].text, CATEGORIES[f.cat].bg]">{{ CATEGORIES[f.cat].label }}</span>
              <span class="flex-1 text-[14.5px] font-semibold text-white">{{ f.q }}</span>
              <Icon name="lucide:chevron-down" class="size-[18px] shrink-0 text-muted-500 transition-transform" :class="faqOpen[f.id] ? 'rotate-180' : ''" />
            </button>
            <div v-if="faqOpen[f.id]" class="apex-fade px-5 pb-[18px] text-[13.5px] leading-[1.65] text-muted-400">
              {{ f.a }}
            </div>
          </div>
        </div>
        <div v-else class="rounded-[28px] border border-white/8 bg-muted-800 px-[30px] py-10 text-center text-sm text-muted-400">
          No articles match "{{ faqQ }}".
        </div>

        <div class="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/8 bg-muted-800 px-6 py-5">
          <div>
            <div class="font-heading text-base font-bold text-white">
              Still stuck?
            </div>
            <div class="mt-0.5 text-[13px] text-muted-400">
              Our team is online and ready to help.
            </div>
          </div>
          <BaseButton rounded="full" variant="primary" class="shadow-[0_8px_20px_rgba(125,83,242,0.28)]" @click="openNew">
            <Icon name="lucide:plus" class="size-[15px]" />
            <span>Contact support</span>
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * Bounded pane height, in one place (see the template comment for when it is
 * applied). Written as CSS rather than an arbitrary utility because it is
 * toggled per-state and per-breakpoint, and because `env()` inside a Tailwind
 * arbitrary value has bitten this project before.
 */
.apex-pane-h {
  height: calc(100dvh - 101px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
}
/* From lg up both panes are visible together, so the shell is always bounded. */
@media (min-width: 1024px) {
  .apex-support {
    height: calc(100dvh - 101px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }
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
