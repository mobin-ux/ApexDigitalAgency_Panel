<script setup lang="ts">
import { orderRef, ticketRef } from '~~/shared/refs'
import { CALL_TIMES, callDays, callLabel } from '~~/shared/support-call'

/**
 * Support — Panel v2 (`Support.dc.html`, revised 2026-10-25).
 *
 * Three screens, one at a time at every width:
 * - the hub: your project manager, what is waiting on you, and your requests
 *   grouped by the order they are about (Open · Resolved);
 * - a request: the thread with its composer, a details column, and once
 *   resolved a rating and "Ask a follow-up";
 * - New request: topic and order, details, review.
 *
 * URL state: `?ticket=<id>` opens a request, `?tab=new` the form,
 * `?order=<id>` the form about that order, and `?new=kickoff&order=<id>` (My
 * orders, the dashboard, the order done screen) the call dialog for it.
 *
 * Kept against the design, real or absent:
 * - "Your account manager" is the project manager of the newest active order
 *   (there is no per-client account manager); the card is absent when nobody
 *   is assigned.
 * - "Book a call" asks for a preferred slot. It becomes a support request the
 *   manager confirms by replying; nothing says the call is booked or that a
 *   calendar invite was emailed.
 * - Replies arrive here and in notifications, never "by email".
 * - A request about an order goes to that order's manager; the review step
 *   says so only when one is assigned.
 */
definePageMeta({
  title: 'Support',
  layout: 'sidenav',
  middleware: 'auth',
})

interface TicketRow {
  id: string
  subject: string
  status: string
  category: string
  createdAt: string
  updatedAt: string
  customerLastSeenAt: string | null
  relatedProject: { id: string, name: string } | null
  assignee: string | null
  lastAuthor: string | null
  rating: number | null
  callSlot: string | null
  messages: { content: string, isAdmin: boolean, createdAt: string }[]
}
interface Manager { id: string, name: string, orderId: string, orderName: string }
interface Attachment { id: string, name: string, size: number, mime: string }
interface Message { id: string, content: string, isAdmin: boolean, createdAt: string, author: string, attachments: Attachment[] }
interface OrderRow { id: string, name: string, category: string, status: string, manager: { firstName: string | null, lastName: string | null } | null }

const route = useRoute()
const router = useRouter()
const toaster = useNuiToasts()
const { data: config } = useApexConfig()
// The config serves "~15 min" or "~1 working day"; "We reply in ~15 min" reads
// as a sentence where "We reply ~15 min" does not.
const replyEta = computed(() => {
  const eta = ((config.value as any)?.support?.replyEta as string | undefined) ?? 'within one working day'
  return eta.startsWith('~') ? `in ${eta}` : eta
})

const { data, refresh } = await useFetch<{ tickets: TicketRow[], manager: Manager | null }>('/api/support/tickets', { key: 'support-tickets' })
const { data: ordersData } = useFetch<{ data: OrderRow[] }>('/api/orders', { key: 'orders', lazy: true })

const isOpenStatus = (s: string) => !['RESOLVED', 'CLOSED'].includes(s)
const first = (name: string | null | undefined) => (name ?? '').split(' ')[0] ?? ''
function initials(name: string) {
  return name.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase()
}
function personName(u: { firstName: string | null, lastName: string | null } | null | undefined) {
  return u ? [u.firstName, u.lastName].filter(Boolean).join(' ').trim() : ''
}

function chipFor(t: { status: string, messages: { isAdmin: boolean }[] }) {
  if (!isOpenStatus(t.status)) {
    return { label: 'Resolved', tone: 'success' as const }
  }
  return t.messages[0]?.isAdmin ? { label: 'Awaiting your reply', tone: 'warning' as const } : { label: 'With Apex', tone: 'info' as const }
}
/** "2h", "yesterday", "Mon", "14/10" — the request rows' "updated …". */
function when(v: string) {
  const d = new Date(v)
  const days = -daysUntil(d)
  if (days === 0) {
    const h = Math.round((Date.now() - d.getTime()) / 3_600_000)
    return h < 1 ? 'just now' : `${h}h`
  }
  if (days === 1) {
    return 'yesterday'
  }
  if (days < 7) {
    return d.toLocaleDateString('en-GB', { weekday: 'short' })
  }
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}
/** "2 hours ago", "yesterday", "on Mon", "on 14/10" — "Alex asked …". */
function ago(v: string) {
  const d = new Date(v)
  const days = -daysUntil(d)
  if (days === 0) {
    const h = Math.round((Date.now() - d.getTime()) / 3_600_000)
    return h < 1 ? 'just now' : `${h} hour${h === 1 ? '' : 's'} ago`
  }
  return days === 1 ? 'yesterday' : `on ${when(v)}`
}
function stamp(v: string) {
  const d = new Date(v)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return daysUntil(d) === 0 ? `Today, ${time}` : `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}, ${time}`
}

const orders = computed(() => (ordersData.value?.data ?? []).filter(o => o.status !== 'CANCELLED'))
const orderById = computed(() => new Map(orders.value.map(o => [o.id, o])))

const all = computed(() => (data.value?.tickets ?? []).map((t) => {
  const last = t.messages[0]
  return {
    ...t,
    open: isOpenStatus(t.status),
    chip: chipFor(t),
    unread: Boolean(last?.isAdmin && (!t.customerLastSeenAt || new Date(last.createdAt) > new Date(t.customerLastSeenAt))),
    group: t.relatedProject?.name ?? (t.category === 'billing' ? 'Billing' : t.category === 'account' ? 'Your account' : 'General'),
  }
}))

/* --------------------------------------------------------------- hub */
const manager = computed(() => data.value?.manager ?? null)
const callTicket = computed(() => all.value.find(t => t.callSlot && t.open) ?? null)
const waiting = computed(() => all.value.filter(t => t.open && t.chip.tone === 'warning'))

const box = ref<'open' | 'resolved'>('open')
const counts = computed(() => ({ open: all.value.filter(t => t.open).length, resolved: all.value.filter(t => !t.open).length }))
const groups = computed(() => {
  const inBox = all.value.filter(t => (box.value === 'open') === t.open)
  const byKey = new Map<string, typeof inBox>()
  for (const t of inBox) {
    const k = t.relatedProject?.id ?? ''
    byKey.set(k, [...(byKey.get(k) ?? []), t])
  }
  const out = [...byKey.entries()].filter(([k]) => k).map(([k, items]) => {
    const o = orderById.value.get(k)
    return { key: k, name: items[0]!.relatedProject!.name, meta: o ? `${o.category} · ${projectStatus(o.status).label}` : orderRef(k), href: `/dashboards/orders?project=${k}`, items }
  })
  const general = byKey.get('')
  if (general) {
    const money = general.every(t => ['billing', 'account'].includes(t.category))
    out.push({ key: 'general', name: money ? 'Billing and account' : 'Other requests', meta: 'Not linked to an order', href: '', items: general })
  }
  return out
})

/* --------------------------------------------------------------- view */
const view = computed<'hub' | 'thread' | 'new'>(() => (route.query.tab === 'new' || (route.query.order && route.query.new !== 'kickoff') ? 'new' : route.query.ticket ? 'thread' : 'hub'))
const current = computed(() => all.value.find(t => t.id === route.query.ticket) ?? null)
const justSent = ref(false)

function openTicket(id: string) {
  justSent.value = false
  router.push({ query: { ticket: id } })
  window.scrollTo({ top: 0 })
}
function toHub() {
  justSent.value = false
  router.push({ query: {} })
  window.scrollTo({ top: 0 })
}

/* ------------------------------------------------------------- thread */
const RATE_WORDS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Excellent']
const rate = ref(0)
const rateNote = ref('')
const messages = ref<Message[]>([])
const threadLoading = ref(false)
const msgList = ref<HTMLElement | null>(null)
function toBottom(smooth = false) {
  nextTick(() => msgList.value?.scrollTo({ top: msgList.value.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }))
}
async function loadThread(id: string) {
  const res = await $fetch<{ messages: Message[] }>(`/api/support/${id}/messages`)
  if (current.value?.id === id) {
    messages.value = res.messages
  }
}
watch(() => current.value?.id, async (id) => {
  messages.value = []
  rate.value = 0
  rateNote.value = ''
  if (!id) {
    return
  }
  threadLoading.value = true
  try {
    await loadThread(id)
    toBottom()
    // The fetch stamped it read; refresh the list's unread dots.
    refresh()
  }
  catch (e) {
    toaster.add({ title: 'This request did not load', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    threadLoading.value = false
  }
}, { immediate: true })

function fileKind(a: { name: string, mime?: string }) {
  const ext = (a.name.split('.').pop() ?? '').toLowerCase()
  if (a.mime?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    return { image: true, icon: 'solar:gallery-linear', label: 'Image', note: '' }
  }
  if (ext === 'zip' || a.mime === 'application/zip') {
    return { image: false, icon: 'solar:zip-file-linear', label: 'ZIP archive', note: 'Archive, download to open' }
  }
  if (ext === 'pdf' || a.mime === 'application/pdf') {
    return { image: false, icon: 'solar:file-text-linear', label: 'PDF', note: 'Download to open' }
  }
  return { image: false, icon: 'solar:document-linear', label: 'Document', note: 'Download to open' }
}
const thread = computed(() => messages.value.map(m => ({
  ...m,
  files: m.attachments.map(a => ({ ...a, ...fileKind(a), meta: `${fileKind(a).label} · ${fileSize(a.size)}`, by: m.isAdmin ? m.author : 'You' })),
})))
const allFiles = computed(() => thread.value.flatMap(m => m.files))
const handler = computed(() => current.value?.assignee || [...messages.value].reverse().find(m => m.isAdmin && m.author !== 'Apex support')?.author || '')
const facts = computed(() => {
  const t = current.value
  if (!t) {
    return []
  }
  const rows: [string, string][] = [
    ['Request', ticketRef(t.id)],
    ['Order', t.relatedProject?.name ?? 'None'],
    ['Opened', ukDate(t.createdAt)],
    ['Handled by', handler.value || 'Apex support team'],
  ]
  if (t.callSlot) {
    rows.push(['Call asked for', `${callLabel(t.callSlot)}, UK time`])
  }
  return rows
})

type PreviewFile = Attachment & { image: boolean, icon: string, note: string, meta: string, by: string }
const preview = ref<PreviewFile | null>(null)
const previewOpen = computed({ get: () => Boolean(preview.value), set: (v) => {
  if (!v) {
    preview.value = null
  }
} })

const reply = ref('')
const replyFiles = useApexUploads()
const sending = ref(false)
// Enter sends with a keyboard; on a touch keyboard it is the only way to
// start a new line, so there it stays a newline (Phase 6 Mobile). Read on
// mount: the placeholder depends on it and the server cannot know.
const finePointer = ref(false)
onMounted(() => {
  finePointer.value = window.matchMedia('(pointer: fine)').matches
})
const replyRows = computed(() => (reply.value.split('\n').length > 2 || reply.value.length > 140 ? 4 : 2))
const canSend = computed(() => Boolean(reply.value.trim() || replyFiles.files.value.length) && !sending.value && !replyFiles.uploading.value)
async function send() {
  const t = current.value
  if (!t || !canSend.value) {
    return
  }
  sending.value = true
  try {
    await $fetch(`/api/support/${t.id}/reply`, { method: 'POST', body: { content: reply.value.trim(), attachmentIds: replyFiles.ids.value } })
    reply.value = ''
    replyFiles.reset()
    await loadThread(t.id)
    toBottom(true)
    await refresh()
  }
  catch (e) {
    toaster.add({ title: 'Reply not sent', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    sending.value = false
  }
}
function onReplyKey(e: KeyboardEvent) {
  if (finePointer.value && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    send()
  }
}
function onReplyFiles(e: Event) {
  const input = e.target as HTMLInputElement
  replyFiles.add(input.files)
  input.value = ''
}

async function setStatus(status: 'RESOLVED' | 'OPEN') {
  const t = current.value
  if (!t) {
    return
  }
  try {
    await $fetch(`/api/support/${t.id}`, { method: 'PATCH', body: { status } })
    await refresh()
    if (status === 'OPEN') {
      toBottom(true)
    }
  }
  catch (e) {
    toaster.add({ title: 'Not changed', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
}

const rating = ref(false)
async function submitRate() {
  const t = current.value
  if (!t || !rate.value || rating.value) {
    return
  }
  rating.value = true
  try {
    await $fetch(`/api/support/${t.id}/rating`, { method: 'POST', body: { rating: rate.value, note: rateNote.value.trim() || undefined } })
    await refresh()
  }
  catch (e) {
    toaster.add({ title: 'Feedback not sent', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    rating.value = false
  }
}

/* -------------------------------------------------------- new request */
type Topic = 'project' | 'billing' | 'account' | 'other'
const TOPICS: [Topic, string, string, string][] = [
  ['project', 'A project', 'Changes, feedback or questions about work in progress', 'solar:suitcase-linear'],
  ['billing', 'Billing', 'Payments, receipts and your wallet', 'solar:wallet-2-linear'],
  ['account', 'My account', 'Signing in and company details', 'solar:user-circle-linear'],
  ['other', 'Something else', 'Anything not covered above', 'solar:chat-round-dots-linear'],
]
const nStep = ref(1)
const topic = ref<Topic | null>(null)
/** An order id, `'none'` for "Not about one order", or null before choosing. */
const ord = ref<string | null>(null)
const nSubj = ref('')
const nMsg = ref('')
const tried = ref(false)
const newFiles = useApexUploads()
const submitting = ref(false)
const errMsg = computed(() => (tried.value && !nMsg.value.trim() ? 'Tell us what you need' : ''))
const ordReal = computed(() => (topic.value === 'project' && ord.value && ord.value !== 'none' ? ord.value : null))
const ordSel = computed(() => (ordReal.value ? orderById.value.get(ordReal.value) ?? null : null))
const goesTo = computed(() => personName(ordSel.value?.manager))
const autoSubj = computed(() => {
  const line = nMsg.value.trim().split('\n')[0] ?? ''
  return line.length > 60 ? `${line.slice(0, 57).trim()}…` : line
})
const review = computed(() => {
  const rows: { k: string, v: string, step: number }[] = [
    { k: 'Topic', v: TOPICS.find(t => t[0] === topic.value)?.[1] ?? '', step: 1 },
    { k: 'Order', v: ordSel.value ? `${ordSel.value.name} · ${orderRef(ordSel.value.id)}` : 'Not linked', step: 1 },
    { k: 'Subject', v: nSubj.value.trim() || autoSubj.value, step: 2 },
    { k: 'Message', v: nMsg.value.trim(), step: 2 },
  ]
  if (newFiles.files.value.length) {
    rows.push({ k: 'Attachments', v: newFiles.files.value.map(f => f.name).join(', '), step: 2 })
  }
  return rows
})

function resetNew(patch: Partial<{ step: number, topic: Topic | null, ord: string | null, subject: string }> = {}) {
  nStep.value = patch.step ?? 1
  topic.value = patch.topic ?? null
  ord.value = patch.ord ?? null
  nSubj.value = patch.subject ?? ''
  nMsg.value = ''
  tried.value = false
  newFiles.reset()
}
function openNew(patch?: Parameters<typeof resetNew>[0]) {
  resetNew(patch)
  justSent.value = false
  router.push({ query: { tab: 'new' } })
  window.scrollTo({ top: 0 })
}
watch(() => route.query.order, (o) => {
  if (o && route.query.new !== 'kickoff') {
    resetNew({ topic: 'project', ord: String(o) })
  }
}, { immediate: true })
function pickTopic(t: Topic) {
  topic.value = t
  if (t !== 'project') {
    ord.value = null
  }
}
function nBack() {
  nStep.value--
  window.scrollTo({ top: 0 })
}
function nNext() {
  if (nStep.value === 3) {
    return submitNew()
  }
  if (nStep.value === 2 && !nMsg.value.trim()) {
    tried.value = true
    return
  }
  tried.value = false
  nStep.value++
  window.scrollTo({ top: 0 })
}
async function submitNew() {
  if (submitting.value || !topic.value) {
    return
  }
  submitting.value = true
  try {
    const res = await $fetch<{ ticket: { id: string } }>('/api/support/create', {
      method: 'POST',
      body: {
        subject: nSubj.value.trim() || undefined,
        category: topic.value,
        relatedProjectId: ordReal.value ?? undefined,
        message: nMsg.value.trim(),
        attachmentIds: newFiles.ids.value,
      },
    })
    resetNew()
    box.value = 'open'
    await refresh()
    await router.push({ query: { ticket: res.ticket.id } })
    justSent.value = true
    window.scrollTo({ top: 0 })
    refreshNuxtData('dashboard-overview')
  }
  catch (e) {
    toaster.add({ title: 'Request not sent', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    submitting.value = false
  }
}
function followUp() {
  const t = current.value
  if (!t) {
    return
  }
  const cat = (['project', 'billing', 'account', 'other'].includes(t.category) ? t.category : 'other') as Topic
  openNew({ step: 2, topic: cat, ord: t.relatedProject?.id ?? (cat === 'project' ? 'none' : null), subject: `Follow-up: ${t.subject}`.slice(0, 200) })
}
function onNewFiles(e: Event) {
  const input = e.target as HTMLInputElement
  newFiles.add(input.files)
  input.value = ''
}

/* ---------------------------------------------------------- call request */
const bookOpen = ref(false)
const bookDone = ref(false)
const bookOrder = ref<string | null>(null)
const days = ref(callDays())
const day = ref(0)
const time = ref<string | null>(null)
const bookNote = ref('')
const booking = ref(false)
const bookedLabel = ref('')
const bookWith = computed(() => {
  if (bookOrder.value) {
    return personName(orderById.value.get(bookOrder.value)?.manager)
  }
  return manager.value?.name ?? ''
})
const slotLabel = computed(() => `${days.value[day.value]?.label ?? ''} at ${time.value ?? ''}`)

function openBook(orderId: string | null = null) {
  days.value = callDays()
  day.value = 0
  time.value = null
  bookNote.value = ''
  bookDone.value = false
  bookOrder.value = orderId
  bookOpen.value = true
}
async function confirmBook() {
  const d = days.value[day.value]
  if (!d || !time.value || booking.value) {
    return
  }
  booking.value = true
  try {
    const res = await $fetch<{ slot: string }>('/api/support/call', {
      method: 'POST',
      body: { date: d.date, time: time.value, note: bookNote.value.trim() || undefined, orderId: bookOrder.value ?? undefined },
    })
    bookedLabel.value = callLabel(res.slot)
    bookDone.value = true
    await refresh()
    refreshNuxtData('dashboard-overview')
  }
  catch (e) {
    toaster.add({ title: 'Call not requested', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    booking.value = false
  }
}
// The kickoff link opens the dialog for that order and then steps out of the
// URL, so a reload does not ask again. Done on mount: the dialog is client-only.
onMounted(() => {
  watch(() => route.query.new, (v) => {
    if (v === 'kickoff') {
      openBook(typeof route.query.order === 'string' ? route.query.order : null)
      router.replace({ query: {} })
    }
  }, { immediate: true })
})

const RING_ON = 'border-accent shadow-[0_0_0_3px_var(--accent-tint)]'
const SEC_LABEL = 'text-fg-muted text-xs font-bold uppercase tracking-[0.06em]'
const CARD = 'bg-card border-line-subtle shadow-panel rounded-[20px] border'
const BACK = 'apex-ring text-fg-body hover:text-fg-heading inline-flex min-h-10 cursor-pointer items-center gap-2 self-start rounded-lg text-sm font-semibold'
</script>

<template>
  <div class="@container mx-auto flex max-w-[1260px] flex-col gap-[clamp(22px,2.4vw,30px)] px-[clamp(16px,3vw,40px)] pb-[clamp(28px,4vw,56px)] pt-[clamp(20px,3vw,40px)]">
    <!-- ================================================================= hub -->
    <template v-if="view === 'hub'">
      <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3.5">
        <div class="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
          <h1 class="font-heading text-fg-heading m-0 text-[clamp(28px,1.3vw+18px,38px)] font-extrabold leading-[1.06] tracking-[-0.03em]">
            Support
          </h1>
          <p class="text-fg-body m-0 max-w-[56ch] text-[clamp(15px,.3vw+14px,17px)] leading-relaxed">
            Questions about a project, a payment or your account. We reply {{ replyEta }}.
          </p>
        </div>
        <ApexButton @click="openNew()">
          New request
        </ApexButton>
      </div>

      <div class="grid items-stretch gap-5" :class="manager ? '@min-[860px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]' : ''">
        <section v-if="manager" aria-labelledby="h-am" class="flex min-w-0 flex-col gap-4 p-[clamp(20px,2vw,26px)]" :class="CARD">
          <div class="flex items-center gap-3.5">
            <span aria-hidden="true" class="font-heading inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-[#7D53F2] text-lg font-semibold text-white">{{ initials(manager.name) }}</span>
            <div class="flex min-w-0 flex-col gap-[3px]">
              <span :class="SEC_LABEL">Your project manager</span>
              <h2 id="h-am" class="font-heading text-fg-heading m-0 text-xl font-bold tracking-[-0.02em]">
                {{ manager.name }}
              </h2>
            </div>
          </div>
          <p class="text-fg-body m-0 max-w-[52ch] text-[14.5px] leading-relaxed">
            {{ first(manager.name) }} looks after {{ manager.orderName }} from kickoff to launch. Message any time, or ask for a 30-minute video call if it is easier to talk.
          </p>
          <div v-if="callTicket" class="bg-raised flex items-center gap-3 rounded-xl px-3.5 py-3">
            <Icon name="solar:calendar-linear" class="text-accent-ink size-[19px] shrink-0" />
            <button type="button" class="apex-ring text-fg-heading min-w-0 grow cursor-pointer rounded text-left text-sm" @click="openTicket(callTicket.id)">
              <strong class="font-semibold">Call requested</strong> · {{ callLabel(callTicket.callSlot) }}
            </button>
            <button type="button" class="apex-ring text-accent-ink hover:bg-accent-tint min-h-9 cursor-pointer rounded-[10px] px-2.5 text-[13.5px] font-semibold" @click="openBook()">
              Change
            </button>
          </div>
          <div class="mt-auto flex flex-wrap gap-2.5">
            <ApexButton size="sm" @click="openNew({ topic: 'project', ord: manager.orderId })">
              Message {{ first(manager.name) }}
            </ApexButton>
            <ApexButton v-if="!callTicket" size="sm" variant="light" @click="openBook()">
              Request a call
            </ApexButton>
          </div>
        </section>

        <section aria-labelledby="h-wait" class="flex min-w-0 flex-col gap-3.5 p-[clamp(20px,2vw,26px)]" :class="CARD">
          <div class="flex items-center justify-between gap-3">
            <h2 id="h-wait" class="m-0" :class="SEC_LABEL">
              Waiting on you
            </h2>
            <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold" :class="waiting.length ? 'bg-accent text-white' : 'bg-raised text-fg-muted'">{{ waiting.length }}</span>
          </div>
          <button
            v-for="t in waiting"
            :key="t.id"
            type="button"
            class="apex-ring border-line-subtle bg-raised hover:border-line-strong flex cursor-pointer items-center gap-3 rounded-[14px] border p-3.5 text-left"
            @click="openTicket(t.id)"
          >
            <span class="flex min-w-0 grow flex-col gap-[3px]">
              <span class="text-fg-heading truncate text-[14.5px] font-semibold">{{ t.subject }}</span>
              <span class="text-fg-muted truncate text-[12.5px]">{{ first(t.lastAuthor) || 'We' }} asked {{ ago(t.messages[0]?.createdAt ?? t.updatedAt) }} · {{ t.group }}</span>
            </span>
            <span class="text-accent-ink shrink-0 text-[13.5px] font-semibold">Reply →</span>
          </button>
          <div v-if="!waiting.length" class="bg-raised text-fg-body flex grow items-center gap-3 rounded-[14px] p-3.5 text-sm">
            <span aria-hidden="true" class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#22B07D] text-[13px] text-white">✓</span>Nothing needs your reply right now.
          </div>
        </section>
      </div>

      <section aria-labelledby="h-req" class="flex flex-col gap-[22px]">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 id="h-req" class="font-heading text-fg-heading m-0 text-[21px] font-bold tracking-[-0.02em]">
            Your requests
          </h2>
          <div role="group" aria-label="Request status" class="bg-raised border-line-subtle inline-flex gap-0.5 rounded-xl border p-1">
            <button
              v-for="[id, label] in ([['open', 'Open'], ['resolved', 'Resolved']] as const)"
              :key="id"
              type="button"
              :aria-pressed="box === id"
              class="apex-ring inline-flex h-[34px] cursor-pointer items-center gap-[7px] rounded-[9px] px-3.5 text-[13.5px] font-semibold"
              :class="box === id ? 'bg-card shadow-panel text-fg-heading' : 'text-fg-muted'"
              @click="box = id"
            >
              {{ label }}<span class="text-xs opacity-70">{{ counts[id] }}</span>
            </button>
          </div>
        </div>
        <div v-for="g in groups" :key="g.key" class="flex flex-col gap-2.5">
          <div class="flex items-center gap-3 px-1">
            <span aria-hidden="true" class="bg-accent block h-[18px] w-[3px] shrink-0 rounded-sm" />
            <span class="flex min-w-0 grow flex-wrap items-baseline gap-x-2.5">
              <span class="text-fg-heading text-[12.5px] font-bold uppercase tracking-[0.06em]">{{ g.name }}</span>
              <span class="text-fg-muted text-[12.5px]">{{ g.meta }}</span>
            </span>
            <NuxtLink v-if="g.href" :to="g.href" class="apex-ring text-accent-ink shrink-0 whitespace-nowrap rounded text-[13px] font-semibold">
              View order →
            </NuxtLink>
          </div>
          <div role="list" class="bg-card border-line-subtle shadow-panel overflow-hidden rounded-2xl border">
            <button
              v-for="(t, i) in g.items"
              :key="t.id"
              type="button"
              role="listitem"
              :aria-label="`${t.subject}, ${t.chip.label}${t.unread ? ', new reply' : ''}`"
              class="apex-ring hover:bg-hover flex w-full cursor-pointer items-center gap-3 px-[18px] py-[15px] text-left"
              :class="i ? 'border-line-soft border-t' : ''"
              @click="openTicket(t.id)"
            >
              <span aria-hidden="true" class="block size-2 shrink-0 rounded-full" :class="t.unread ? 'bg-accent' : ''" />
              <span class="flex min-w-0 grow flex-col gap-1.5">
                <span class="text-fg-heading truncate text-[14.5px]" :class="t.unread ? 'font-bold' : 'font-semibold'">{{ t.subject }}</span>
                <span class="text-fg-muted flex flex-wrap items-center gap-2 text-[12.5px]">
                  <ApexStatusChip :tone="t.chip.tone">{{ t.chip.label }}</ApexStatusChip>
                  <span>{{ ticketRef(t.id) }} · updated {{ when(t.updatedAt) }}</span>
                </span>
              </span>
              <Icon name="lucide:chevron-right" class="text-fg-muted size-[18px] shrink-0" />
            </button>
          </div>
        </div>
        <div v-if="!groups.length" class="text-fg-body px-[22px] py-7 text-[14.5px] leading-relaxed" :class="CARD">
          {{ box === 'open' ? 'No open requests. Start a new request if you need anything.' : 'Nothing resolved yet.' }}
        </div>
      </section>
    </template>

    <!-- ============================================================== thread -->
    <template v-else-if="view === 'thread'">
      <button type="button" :class="BACK" @click="toHub">
        <Icon name="lucide:arrow-left" class="size-4" />Support
      </button>
      <div v-if="!current" class="text-fg-body px-[22px] py-7 text-[14.5px] leading-relaxed" :class="CARD">
        This request was not found. It may belong to another account.
      </div>
      <template v-else>
        <div v-if="justSent" role="status" class="apex-pop-in bg-st-success-bg text-st-success-fg flex items-center gap-3 rounded-[14px] px-4 py-3.5 text-sm font-semibold">
          <span aria-hidden="true" class="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#22B07D] text-xs text-white">✓</span>
          <span class="grow">Request sent. {{ handler ? `${first(handler)} will reply` : 'We reply' }} {{ replyEta }}, here and in your notifications.</span>
          <button type="button" aria-label="Dismiss" class="apex-ring inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg" @click="justSent = false">
            <Icon name="lucide:x" class="size-4" />
          </button>
        </div>
        <div class="grid items-start gap-5 @min-[980px]:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-labelledby="h-thread" class="flex h-[calc(100vh-286px)] min-h-[520px] min-w-0 flex-col overflow-hidden @min-[980px]:h-[calc(100vh-276px)] max-md:h-[calc(100dvh-236px)] max-md:min-h-[440px]" :class="CARD">
            <div class="border-line-soft flex shrink-0 flex-col gap-2 border-b px-[clamp(16px,2vw,24px)] py-[18px] max-md:px-4 max-md:py-3.5">
              <h1 id="h-thread" class="font-heading text-fg-heading m-0 text-[clamp(20px,.6vw+16px,24px)] font-bold leading-tight tracking-[-0.02em]">
                {{ current.subject }}
              </h1>
              <span class="text-fg-muted flex flex-wrap items-center gap-2 text-[13px]">
                <ApexStatusChip :tone="current.chip.tone">{{ current.chip.label }}</ApexStatusChip>{{ ticketRef(current.id) }} · {{ current.group }}
              </span>
            </div>
            <ol ref="msgList" aria-label="Messages" tabindex="0" class="bg-page m-0 flex min-h-40 grow list-none flex-col gap-[18px] overflow-y-auto overscroll-contain p-[clamp(16px,2vw,24px)] outline-none">
              <template v-if="threadLoading && !messages.length">
                <BasePlaceload v-for="i in 2" :key="i" class="h-16 w-2/3 rounded-2xl" />
              </template>
              <li v-for="m in thread" :key="m.id" class="flex items-start gap-2.5" :class="m.isAdmin ? 'flex-row' : 'flex-row-reverse'">
                <span v-if="m.isAdmin" aria-hidden="true" class="font-heading inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#7D53F2] text-[11.5px] font-semibold text-white">{{ initials(m.author) }}</span>
                <div class="flex max-w-[min(580px,86%)] flex-col gap-2" :class="m.isAdmin ? 'items-start' : 'items-end'">
                  <span class="text-fg-muted text-xs"><strong class="text-fg-heading font-semibold">{{ m.author }}</strong> · {{ stamp(m.createdAt) }}</span>
                  <div
                    v-if="m.content"
                    class="text-fg-heading whitespace-pre-wrap border px-4 py-3 text-[14.5px] leading-relaxed"
                    :class="m.isAdmin ? 'bg-card border-line-subtle rounded-[6px_18px_18px_18px]' : 'bg-accent-tint rounded-[18px_18px_6px_18px] border-transparent'"
                  >
                    {{ m.content }}
                  </div>
                  <div v-if="m.files.length" class="flex flex-wrap gap-2" :class="m.isAdmin ? 'justify-start' : 'justify-end'">
                    <button
                      v-for="f in m.files"
                      :key="f.id"
                      type="button"
                      :aria-label="`Preview ${f.name}`"
                      class="apex-ring border-line-subtle bg-card hover:border-line-strong flex w-[200px] max-w-full cursor-pointer flex-col overflow-hidden rounded-[14px] border text-left"
                      @click="preview = f"
                    >
                      <span class="bg-accent-tint text-accent-ink flex h-[84px] items-center justify-center"><Icon :name="f.icon" class="size-[30px]" /></span>
                      <span class="flex flex-col gap-0.5 px-3 pb-2.5 pt-[9px]">
                        <span class="text-fg-heading truncate text-[13px] font-semibold">{{ f.name }}</span>
                        <span class="text-fg-muted text-xs">{{ f.meta }}</span>
                      </span>
                    </button>
                  </div>
                </div>
              </li>
            </ol>

            <div v-if="current.open" class="border-line-soft bg-card flex shrink-0 flex-col gap-2 border-t px-[clamp(12px,2vw,20px)] py-3">
              <label for="reply" class="sr-only">Reply</label>
              <textarea
                id="reply"
                v-model="reply"
                :rows="replyRows"
                :placeholder="finePointer ? 'Write a reply · Enter to send, Shift+Enter for a new line' : 'Write a reply'"
                class="apex-ring border-line-rule bg-card text-fg-heading placeholder:text-fg-muted max-h-40 w-full resize-none rounded-[14px] border px-3.5 py-3 text-base leading-[1.55] outline-none md:text-[14.5px]"
                @keydown="onReplyKey"
              />
              <div v-if="replyFiles.files.value.length || replyFiles.error.value" class="flex flex-wrap items-center gap-1.5">
                <span v-for="f in replyFiles.files.value" :key="f.id" class="bg-raised border-line-subtle text-fg-heading inline-flex h-8 items-center gap-1.5 rounded-full border pl-2.5 pr-1.5 text-[12.5px] font-semibold">
                  <Icon :name="fileKind(f).icon" class="text-accent-ink size-3.5" />{{ f.name }}
                  <button type="button" :aria-label="`Remove ${f.name}`" class="apex-ring text-fg-muted inline-flex size-[22px] cursor-pointer items-center justify-center rounded-full" @click="replyFiles.remove(f.id)"><Icon name="lucide:x" class="size-3" /></button>
                </span>
                <span v-if="replyFiles.error.value" role="alert" class="text-st-danger-fg text-[12.5px]">{{ replyFiles.error.value }}</span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <label class="text-fg-body hover:bg-hover relative inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] px-2.5 text-[13.5px] font-semibold focus-within:outline-2 focus-within:outline-[var(--accent)]">
                  <Icon :name="replyFiles.uploading.value ? 'lucide:loader-circle' : 'solar:paperclip-linear'" class="size-[18px]" :class="replyFiles.uploading.value ? 'motion-safe:animate-spin' : ''" />Attach
                  <input type="file" multiple class="absolute size-px opacity-0" @change="onReplyFiles">
                </label>
                <ApexButton size="sm" :disabled="!canSend" @click="send">
                  {{ sending ? 'Sending…' : 'Send' }}
                </ApexButton>
              </div>
            </div>

            <div v-else class="border-line-soft flex max-h-[55%] shrink-0 flex-col gap-4 overflow-y-auto border-t px-[clamp(14px,2vw,24px)] py-[18px]">
              <div v-if="!current.rating" class="bg-raised flex flex-col gap-3 rounded-2xl p-[18px]">
                <span class="font-heading text-fg-heading text-[17px] font-semibold tracking-[-0.02em]">How did {{ handler ? first(handler) : 'we' }} do?</span>
                <div class="flex flex-wrap items-center gap-3">
                  <div role="radiogroup" aria-label="Rating out of 5" class="flex gap-1">
                    <button
                      v-for="n in 5"
                      :key="n"
                      type="button"
                      role="radio"
                      :aria-checked="rate === n"
                      :aria-label="`${n} out of 5, ${RATE_WORDS[n]}`"
                      class="apex-ring hover:bg-hover inline-flex size-10 cursor-pointer items-center justify-center rounded-[10px]"
                      :class="n <= rate ? 'text-accent' : 'text-fg-muted'"
                      @click="rate = n"
                    >
                      <Icon :name="n <= rate ? 'solar:star-bold' : 'solar:star-linear'" class="size-[26px]" />
                    </button>
                  </div>
                  <span class="text-fg-body text-sm font-semibold">{{ rate ? RATE_WORDS[rate] : 'Choose a rating' }}</span>
                </div>
                <template v-if="rate">
                  <label for="rate-note" class="sr-only">Comment</label>
                  <textarea id="rate-note" v-model="rateNote" rows="2" maxlength="1000" placeholder="Anything we could have done better? (optional)" class="apex-ring border-line-rule bg-card text-fg-heading placeholder:text-fg-muted w-full resize-y rounded-xl border px-3.5 py-3 text-base leading-[1.55] outline-none md:text-sm" />
                  <ApexButton size="sm" class="self-start" :disabled="rating" @click="submitRate">
                    {{ rating ? 'Sending…' : 'Send feedback' }}
                  </ApexButton>
                </template>
              </div>
              <div v-else class="text-fg-body flex items-center gap-2.5 text-sm">
                <Icon name="solar:star-bold" class="text-accent size-[18px] shrink-0" />You rated this {{ current.rating }} out of 5. Thanks for the feedback.
              </div>
              <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
                <span class="text-fg-body text-sm">Still not right, or something new came up?</span>
                <div class="flex flex-wrap gap-2">
                  <ApexButton size="sm" variant="light" @click="followUp">
                    Ask a follow-up
                  </ApexButton>
                  <ApexButton v-if="current.status === 'RESOLVED'" size="sm" variant="light" @click="setStatus('OPEN')">
                    Reopen
                  </ApexButton>
                </div>
              </div>
            </div>
          </section>

          <aside aria-label="Request details" class="flex min-w-0 flex-col gap-4 @min-[980px]:sticky @min-[980px]:top-24">
            <div class="flex flex-col gap-3.5 px-5 py-[18px]" :class="CARD">
              <span :class="SEC_LABEL">Details</span>
              <div v-for="[k, v] in facts" :key="k" class="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span class="text-fg-muted whitespace-nowrap">{{ k }}</span><span class="text-fg-heading min-w-0 text-right font-semibold">{{ v }}</span>
              </div>
              <NuxtLink v-if="current.relatedProject" :to="`/dashboards/orders?project=${current.relatedProject.id}`" class="apex-ring text-accent-ink self-start rounded text-[13.5px] font-semibold">
                View order →
              </NuxtLink>
              <button v-if="current.open" type="button" class="apex-ring border-line-rule bg-card text-fg-heading hover:border-line-strong mt-1 flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-xl border text-[13.5px] font-semibold" @click="setStatus('RESOLVED')">
                <Icon name="lucide:check" class="size-4 text-[#22B07D]" />Mark as resolved
              </button>
            </div>
            <div v-if="allFiles.length" class="flex flex-col gap-0.5 p-2" :class="CARD">
              <span class="px-3 pb-1.5 pt-2.5" :class="SEC_LABEL">Files in this request</span>
              <button
                v-for="f in allFiles"
                :key="f.id"
                type="button"
                class="apex-ring hover:bg-hover flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl px-3 py-1.5 text-left"
                @click="preview = f"
              >
                <span class="bg-accent-tint text-accent-ink inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]"><Icon :name="f.icon" class="size-[18px]" /></span>
                <span class="flex min-w-0 grow flex-col gap-px">
                  <span class="text-fg-heading truncate text-[13.5px] font-semibold">{{ f.name }}</span>
                  <span class="text-fg-muted text-xs">{{ f.meta }}</span>
                </span>
              </button>
            </div>
          </aside>
        </div>
      </template>
    </template>

    <!-- ========================================================= new request -->
    <section v-else aria-labelledby="h-new" class="flex w-full max-w-[760px] flex-col gap-[22px]">
      <button type="button" :class="BACK" @click="toHub">
        <Icon name="lucide:arrow-left" class="size-4" />Support
      </button>
      <div class="flex flex-col gap-3.5">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <h1 id="h-new" class="font-heading text-fg-heading m-0 text-[clamp(26px,1.2vw+18px,34px)] font-extrabold tracking-[-0.03em]">
            New request
          </h1>
          <span class="text-fg-muted text-[13px] font-semibold">Step {{ nStep }} of 3 · {{ ['Topic', 'Details', 'Review'][nStep - 1] }}</span>
        </div>
        <div aria-hidden="true" class="flex gap-1.5">
          <span v-for="k in 3" :key="k" class="block h-1 flex-1 rounded-full" :class="k <= nStep ? 'bg-accent' : 'bg-track'" />
        </div>
      </div>

      <template v-if="nStep === 1">
        <div class="flex flex-col gap-3">
          <h2 id="h-topic" class="font-heading text-fg-heading m-0 text-[19px] font-bold tracking-[-0.02em]">
            What is it about?
          </h2>
          <div role="radiogroup" aria-labelledby="h-topic" class="grid gap-3 @min-[600px]:grid-cols-2">
            <button
              v-for="[id, label, desc, icon] in TOPICS"
              :key="id"
              type="button"
              role="radio"
              :aria-checked="topic === id"
              class="apex-ring bg-card flex cursor-pointer items-start gap-3.5 rounded-[18px] border p-[18px] text-left"
              :class="topic === id ? RING_ON : 'border-line-subtle'"
              @click="pickTopic(id)"
            >
              <span class="bg-accent-tint text-accent-ink inline-flex size-10 shrink-0 items-center justify-center rounded-xl"><Icon :name="icon" class="size-5" /></span>
              <span class="flex min-w-0 grow flex-col gap-[3px]">
                <span class="text-fg-heading text-[15px] font-semibold">{{ label }}</span>
                <span class="text-fg-muted text-[13px] leading-normal">{{ desc }}</span>
              </span>
              <span aria-hidden="true" class="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] text-white" :class="topic === id ? 'bg-accent border-accent' : 'border-line-rule'">{{ topic === id ? '✓' : '' }}</span>
            </button>
          </div>
        </div>
        <div v-if="topic === 'project'" class="apex-pop-in flex flex-col gap-3">
          <h2 id="h-ord" class="font-heading text-fg-heading m-0 text-[19px] font-bold tracking-[-0.02em]">
            Which order?
          </h2>
          <div role="radiogroup" aria-labelledby="h-ord" class="flex flex-col gap-0.5 p-1.5" :class="CARD">
            <button
              v-for="o in [...orders.map(x => ({ id: x.id, name: x.name, meta: `${orderRef(x.id)} · ${x.category} · ${projectStatus(x.status).label}` })), { id: 'none', name: 'Not about one order', meta: 'General project question' }]"
              :key="o.id"
              type="button"
              role="radio"
              :aria-checked="ord === o.id"
              class="apex-ring hover:bg-hover flex min-h-[58px] cursor-pointer items-center gap-3 rounded-[14px] px-3.5 py-2 text-left"
              :class="ord === o.id ? 'bg-accent-tint' : ''"
              @click="ord = o.id"
            >
              <span class="flex min-w-0 grow flex-col gap-0.5">
                <span class="text-fg-heading text-[14.5px] font-semibold">{{ o.name }}</span>
                <span class="text-fg-muted text-[12.5px]">{{ o.meta }}</span>
              </span>
              <span aria-hidden="true" class="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] text-white" :class="ord === o.id ? 'bg-accent border-accent' : 'border-line-rule'">{{ ord === o.id ? '✓' : '' }}</span>
            </button>
          </div>
        </div>
      </template>

      <div v-else-if="nStep === 2" class="flex flex-col gap-5 p-[clamp(18px,2vw,26px)]" :class="CARD">
        <ApexField v-model="nSubj" label="Subject" placeholder="One line is enough" hint="Optional · We use the start of your message if you leave it blank" />
        <ApexField v-model="nMsg" label="Message" required multiline :rows="6" placeholder="What happened, and what would you like us to do?" :error="errMsg" />
        <div class="flex flex-col gap-2.5">
          <span class="text-fg-heading text-sm font-semibold">Attachments <span class="text-fg-muted font-normal">Optional</span></span>
          <label class="border-line-rule bg-raised relative flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] border-dashed p-4 focus-within:outline-2 focus-within:outline-[var(--accent)]">
            <Icon :name="newFiles.uploading.value ? 'lucide:loader-circle' : 'solar:paperclip-linear'" class="text-accent-ink size-[19px] shrink-0" :class="newFiles.uploading.value ? 'motion-safe:animate-spin' : ''" />
            <span class="text-fg-body grow text-[13.5px]">Screenshots or documents, up to 20 MB each</span>
            <span class="text-accent-ink text-[13.5px] font-semibold">Choose files</span>
            <input type="file" multiple class="absolute size-px opacity-0" @change="onNewFiles">
          </label>
          <p v-if="newFiles.error.value" role="alert" class="text-st-danger-fg m-0 text-[13px]">
            {{ newFiles.error.value }}
          </p>
          <div v-if="newFiles.files.value.length" class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2.5">
            <div v-for="f in newFiles.files.value" :key="f.id" class="border-line-subtle bg-card relative flex flex-col overflow-hidden rounded-[14px] border">
              <span class="bg-accent-tint text-accent-ink flex h-[72px] items-center justify-center"><Icon :name="fileKind(f).icon" class="size-[26px]" /></span>
              <span class="text-fg-heading truncate px-3 pb-2.5 pt-2 text-[12.5px] font-semibold">{{ f.name }}</span>
              <button type="button" :aria-label="`Remove ${f.name}`" class="apex-ring bg-card shadow-panel text-fg-heading absolute right-1.5 top-1.5 inline-flex size-7 cursor-pointer items-center justify-center rounded-full" @click="newFiles.remove(f.id)">
                <Icon name="lucide:x" class="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="overflow-hidden" :class="CARD">
        <div v-for="r in review" :key="r.k" class="border-line-soft flex items-start gap-4 border-b px-[clamp(16px,2vw,22px)] py-4">
          <span class="text-fg-muted w-[110px] shrink-0 text-[13.5px] max-sm:w-[84px]">{{ r.k }}</span>
          <span class="text-fg-heading min-w-0 grow whitespace-pre-wrap text-[14.5px] leading-[1.55] [overflow-wrap:anywhere]">{{ r.v }}</span>
          <button type="button" class="apex-ring text-accent-ink hover:bg-accent-tint min-h-8 shrink-0 cursor-pointer rounded-lg px-2 text-[13.5px] font-semibold" :aria-label="`Edit ${r.k.toLowerCase()}`" @click="nStep = r.step">
            Edit
          </button>
        </div>
        <div class="bg-raised flex items-center gap-3 px-[clamp(16px,2vw,22px)] py-4">
          <span v-if="goesTo" aria-hidden="true" class="font-heading inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#7D53F2] text-xs font-semibold text-white">{{ initials(goesTo) }}</span>
          <span v-else aria-hidden="true" class="bg-accent-tint text-accent-ink inline-flex size-9 shrink-0 items-center justify-center rounded-full"><Icon name="solar:headphones-round-linear" class="size-[18px]" /></span>
          <span class="text-fg-body text-sm leading-normal">
            <template v-if="goesTo">Goes to <strong class="text-fg-heading font-semibold">{{ goesTo }}</strong>, who manages this order.</template>
            <template v-else>Goes to the <strong class="text-fg-heading font-semibold">Apex support team</strong>.</template>
            We reply {{ replyEta }}, here and in your notifications.
          </span>
        </div>
      </div>

      <div class="flex items-center justify-between gap-3">
        <button v-if="nStep > 1" type="button" class="apex-ring border-line-rule bg-card text-fg-heading inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-[14px] border px-4 text-[15px] font-semibold" @click="nBack">
          <Icon name="lucide:arrow-left" class="size-4" />Back
        </button>
        <button v-else type="button" class="apex-ring text-fg-body min-h-[46px] cursor-pointer rounded-lg px-1 text-[15px] font-semibold" @click="toHub">
          Cancel
        </button>
        <ApexButton :disabled="(nStep === 1 && !topic) || submitting || newFiles.uploading.value" @click="nNext">
          {{ nStep === 3 ? (submitting ? 'Sending…' : 'Send request') : nStep === 2 ? 'Review request' : 'Continue' }}
        </ApexButton>
      </div>
    </section>

    <!-- ========================================================== call dialog -->
    <ApexPanelDialog v-model:open="bookOpen" :title="bookDone ? 'Call requested' : 'Request a call'" description="Choose a preferred day and time for a 30-minute video call. We confirm it by replying to your request.">
      <template v-if="!bookDone">
        <div class="flex items-center gap-3">
          <span v-if="bookWith" aria-hidden="true" class="font-heading inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#7D53F2] text-[13px] font-semibold text-white">{{ initials(bookWith) }}</span>
          <span class="text-fg-body text-sm leading-normal">30 minutes on video with <strong class="text-fg-heading font-semibold">{{ bookWith || 'the Apex team' }}</strong>. Times are UK time. Pick the slot that suits you and we confirm it by replying.</span>
        </div>
        <div class="flex flex-col gap-2.5">
          <span id="lbl-day" class="text-fg-heading text-sm font-semibold">Day</span>
          <div role="radiogroup" aria-labelledby="lbl-day" class="grid grid-cols-5 gap-1.5">
            <button
              v-for="(d, i) in days"
              :key="d.date"
              type="button"
              role="radio"
              :aria-checked="day === i"
              :aria-label="d.label"
              class="apex-ring flex cursor-pointer flex-col items-center gap-0.5 rounded-xl border py-2.5"
              :class="day === i ? `bg-accent-tint ${RING_ON}` : 'bg-card border-line-subtle'"
              @click="day = i"
            >
              <span class="text-fg-muted text-[11.5px] font-bold uppercase tracking-[0.04em]">{{ d.dow }}</span>
              <span class="font-heading text-fg-heading text-[17px] font-bold">{{ d.day }}</span>
            </button>
          </div>
        </div>
        <div class="flex flex-col gap-2.5">
          <span id="lbl-time" class="text-fg-heading text-sm font-semibold">Time</span>
          <div role="radiogroup" aria-labelledby="lbl-time" class="grid grid-cols-4 gap-1.5">
            <button
              v-for="tm in CALL_TIMES"
              :key="tm"
              type="button"
              role="radio"
              :aria-checked="time === tm"
              class="apex-ring text-fg-heading h-11 cursor-pointer rounded-xl border text-sm font-semibold tabular-nums"
              :class="time === tm ? `bg-accent-tint ${RING_ON}` : 'bg-card border-line-subtle'"
              @click="time = tm"
            >
              {{ tm }}
            </button>
          </div>
        </div>
        <ApexField v-model="bookNote" label="What would you like to discuss?" placeholder="Optional" />
        <ApexButton block :disabled="!time || booking" @click="confirmBook">
          {{ booking ? 'Sending…' : time ? `Request ${slotLabel}` : 'Choose a time' }}
        </ApexButton>
      </template>
      <div v-else class="flex flex-col items-start gap-3.5">
        <span aria-hidden="true" class="inline-flex size-[52px] items-center justify-center rounded-full bg-[#22B07D] text-[22px] text-white">✓</span>
        <span class="text-fg-body text-[15px] leading-relaxed">We have asked {{ bookWith ? first(bookWith) : 'the team' }} for <strong class="text-fg-heading font-semibold">{{ bookedLabel }}</strong>, UK time. Their reply confirming the call arrives in your support requests and your notifications.</span>
        <ApexButton block @click="bookOpen = false">
          Done
        </ApexButton>
      </div>
    </ApexPanelDialog>

    <!-- ========================================================= file preview -->
    <ApexPanelDialog v-model:open="previewOpen" :width="620" :title="preview?.name ?? ''" description="A preview of the file, with a download link.">
      <template v-if="preview" #title>
        <span class="flex min-w-0 flex-col gap-0.5">
          <span class="text-fg-heading truncate font-sans text-[15px] font-semibold tracking-normal">{{ preview.name }}</span>
          <span class="text-fg-muted font-sans text-[12.5px] font-normal tracking-normal">{{ preview.meta }} · shared by {{ preview.by }}</span>
        </span>
      </template>
      <template v-if="preview">
        <div class="bg-raised border-line-subtle text-accent-ink flex aspect-[4/3] flex-col items-center justify-center gap-2.5 overflow-hidden rounded-[14px] border">
          <img v-if="preview.image" :src="`/api/attachments/${preview.id}`" :alt="preview.name" class="size-full object-contain">
          <template v-else>
            <Icon :name="preview.icon" class="size-12" />
            <span class="text-fg-muted text-[13.5px]">{{ preview.note }}</span>
          </template>
        </div>
        <div class="flex justify-end">
          <a :href="`/api/attachments/${preview.id}`" download class="apex-ring bg-accent shadow-violet hover:bg-accent-hover inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white">Download</a>
        </div>
      </template>
    </ApexPanelDialog>
  </div>
</template>
