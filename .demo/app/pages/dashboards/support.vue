<script setup lang="ts">
import { orderRef, ticketRef } from '~~/shared/refs'

/**
 * Support — Panel v2 (`Support.dc.html`).
 *
 * An inbox (Open · Resolved) beside the open thread once there is 900px of
 * content, one screen at a time below that; a New request form with a topic,
 * an optional order, a message and attachments. Customers can now mark a
 * request resolved and reopen it (`PATCH /api/support/:id`), and files attach
 * for real (`/api/uploads`) — the picker that Phase 6 had to remove because
 * nothing stored its files is back with storage behind it.
 *
 * URL state, as before: `?ticket=<id>` opens a thread, `?tab=new` the form,
 * and `?order=<id>` / `?new=kickoff&order=<id>` (from My orders and the
 * dashboard) open the form about that order.
 *
 * Copy differs from the mockup where it promised email: there is no mail
 * provider, so replies are announced here and in notifications. The FAQ tab
 * is gone, as drawn; the reply-time promise in the header reads the same
 * config value the admin panel sets.
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
  updatedAt: string
  customerLastSeenAt: string | null
  relatedProject: { id: string, name: string } | null
  messages: { content: string, isAdmin: boolean, createdAt: string }[]
}
interface Message { id: string, content: string, isAdmin: boolean, createdAt: string, author: string, attachments: { id: string, name: string, size: number }[] }

const route = useRoute()
const router = useRouter()
const toaster = useNuiToasts()
const { user } = useUser()
const { data: config } = useApexConfig()
const replyEta = computed(() => ((config.value as any)?.support?.replyEta as string | undefined) ?? 'within one working day')

const { data, refresh } = await useFetch<{ tickets: TicketRow[] }>('/api/support/tickets', { key: 'support-tickets' })
const { data: ordersData } = useFetch<{ data: { id: string, name: string, category: string, status: string }[] }>('/api/orders', { key: 'orders', lazy: true })

const box = ref<'open' | 'resolved'>('open')
const isOpenStatus = (s: string) => !['RESOLVED', 'CLOSED'].includes(s)

function chipFor(t: { status: string, messages: { isAdmin: boolean }[] }) {
  if (!isOpenStatus(t.status)) {
    return { label: 'Resolved', tone: 'success' as const }
  }
  return t.messages[0]?.isAdmin ? { label: 'Awaiting your reply', tone: 'warning' as const } : { label: 'With Apex', tone: 'info' as const }
}
function when(v: string) {
  const d = new Date(v)
  const days = -daysUntil(d)
  if (days === 0) {
    const h = Math.round((Date.now() - d.getTime()) / 3_600_000)
    return h < 1 ? 'Now' : `${h}h`
  }
  if (days === 1) {
    return 'Yesterday'
  }
  if (days < 7) {
    return d.toLocaleDateString('en-GB', { weekday: 'short' })
  }
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}
const TOPIC_TAG: Record<string, string> = { billing: 'Billing', account: 'Account', other: 'General', project: 'Project' }

const all = computed(() => (data.value?.tickets ?? []).map((t) => {
  const last = t.messages[0]
  return {
    ...t,
    chip: chipFor(t),
    unread: Boolean(last?.isAdmin && (!t.customerLastSeenAt || new Date(last.createdAt) > new Date(t.customerLastSeenAt))),
    preview: last ? `${last.isAdmin ? '' : 'You: '}${last.content}` : '',
    tag: t.relatedProject ? `${orderRef(t.relatedProject.id)} · ${t.relatedProject.name}` : (TOPIC_TAG[t.category] ?? t.category),
    when: when(t.updatedAt),
  }
}))
const counts = computed(() => ({ open: all.value.filter(t => isOpenStatus(t.status)).length, resolved: all.value.filter(t => !isOpenStatus(t.status)).length }))
const inBox = computed(() => all.value.filter(t => (box.value === 'open') === isOpenStatus(t.status)))

/* --------------------------------------------------------- layout */
const wrap = ref<HTMLElement | null>(null)
const { width } = useElementSize(wrap)
const split = computed(() => width.value >= 900)

const view = computed<'inbox' | 'thread' | 'new'>(() => (route.query.tab === 'new' || route.query.new || route.query.order ? 'new' : route.query.ticket ? 'thread' : 'inbox'))
// Desktop picks the first request so the right pane is never empty; that
// choice stays local and never writes to the address bar (Phase 6 Mobile).
const selectedId = computed(() => (route.query.ticket as string | undefined) ?? (split.value ? inBox.value[0]?.id : undefined))
const current = computed(() => all.value.find(t => t.id === selectedId.value) ?? null)
const showList = computed(() => view.value !== 'new' && (split.value || view.value === 'inbox'))
const showThread = computed(() => view.value !== 'new' && Boolean(current.value) && (split.value || view.value === 'thread'))

function openTicket(id: string) {
  router.push({ query: { ticket: id } })
  if (!split.value) {
    window.scrollTo({ top: 0 })
  }
}
function toInbox() {
  router.push({ query: {} })
}

/* --------------------------------------------------------- thread */
const messages = ref<Message[]>([])
const threadLoading = ref(false)
watch(() => current.value?.id, async (id) => {
  messages.value = []
  if (!id) {
    return
  }
  threadLoading.value = true
  try {
    const res = await $fetch<{ messages: Message[] }>(`/api/support/${id}/messages`)
    if (current.value?.id === id) {
      messages.value = res.messages
    }
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

const myInitials = computed(() => {
  const u = user.value as any
  return ([u?.firstName, u?.lastName].filter(Boolean).map((p: string) => p[0]).join('') || 'Y').toUpperCase().slice(0, 2)
})
function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}
function stamp(v: string) {
  const d = new Date(v)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return daysUntil(d) === 0 ? `Today, ${time}` : `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}, ${time}`
}

const reply = ref('')
const replyFiles = useApexUploads()
const sending = ref(false)
async function send() {
  const t = current.value
  const text = reply.value.trim()
  if (!t || !text || sending.value) {
    return
  }
  sending.value = true
  try {
    await $fetch(`/api/support/${t.id}/reply`, { method: 'POST', body: { content: text, attachmentIds: replyFiles.ids.value } })
    reply.value = ''
    replyFiles.reset()
    const res = await $fetch<{ messages: Message[] }>(`/api/support/${t.id}/messages`)
    messages.value = res.messages
    await refresh()
  }
  catch (e) {
    toaster.add({ title: 'Reply not sent', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    sending.value = false
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
    box.value = status === 'OPEN' ? 'open' : box.value
  }
  catch (e) {
    toaster.add({ title: 'Not changed', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
}

/* --------------------------------------------------------- new request */
type Topic = 'project' | 'billing' | 'account' | 'other'
const TOPICS: [Topic, string, string][] = [['project', 'A project', 'solar:suitcase-linear'], ['billing', 'Billing', 'solar:wallet-2-linear'], ['account', 'My account', 'solar:user-circle-linear'], ['other', 'Something else', 'solar:chat-round-dots-linear']]
const topic = ref<Topic>('project')
const ord = ref<string | null>(null)
const ordOpen = ref(false)
const ordBox = ref<HTMLElement | null>(null)
onClickOutside(ordBox, () => {
  ordOpen.value = false
})
const nSubj = ref('')
const nMsg = ref('')
const msgTouched = ref(false)
const newFiles = useApexUploads()
const submitting = ref(false)
const orders = computed(() => (ordersData.value?.data ?? []).filter(o => o.status !== 'CANCELLED'))
const ordSel = computed(() => orders.value.find(o => o.id === ord.value))
const errMsg = computed(() => (msgTouched.value && !nMsg.value.trim() ? 'Tell us what you need' : ''))

watch(() => [route.query.order, route.query.new], () => {
  if (route.query.order) {
    topic.value = 'project'
    ord.value = String(route.query.order)
  }
  if (route.query.new === 'kickoff' && !nSubj.value) {
    nSubj.value = 'Book my kickoff call'
  }
}, { immediate: true })

function openNew() {
  router.push({ query: { tab: 'new' } })
}
function closeNew() {
  msgTouched.value = false
  router.push({ query: {} })
}
function onNewFiles(e: Event) {
  const input = e.target as HTMLInputElement
  newFiles.add(input.files)
  input.value = ''
}
async function submitNew() {
  if (!nMsg.value.trim()) {
    msgTouched.value = true
    return
  }
  submitting.value = true
  try {
    const res = await $fetch<{ ticket: { id: string } }>('/api/support/create', {
      method: 'POST',
      body: {
        subject: nSubj.value.trim() || undefined,
        category: topic.value,
        relatedProjectId: topic.value === 'project' ? (ord.value ?? undefined) : undefined,
        message: nMsg.value.trim(),
        attachmentIds: newFiles.ids.value,
      },
    })
    nSubj.value = ''
    nMsg.value = ''
    ord.value = null
    msgTouched.value = false
    newFiles.reset()
    box.value = 'open'
    await refresh()
    router.push({ query: { ticket: res.ticket.id } })
    refreshNuxtData('dashboard-overview')
  }
  catch (e) {
    toaster.add({ title: 'Request not sent', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    submitting.value = false
  }
}

const PILL = 'apex-ring inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-semibold'
</script>

<template>
  <div ref="wrap" class="mx-auto flex max-w-[1260px] flex-col gap-[clamp(20px,2.2vw,28px)] px-[clamp(16px,3vw,40px)] pb-[clamp(28px,4vw,56px)] pt-[clamp(20px,3vw,40px)]">
    <div v-if="view !== 'new' && (split || view === 'inbox')" class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3.5">
      <div class="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
        <h1 class="font-heading text-fg-heading m-0 text-[clamp(28px,1.3vw+18px,38px)] font-extrabold leading-[1.06] tracking-[-0.03em]">
          Support
        </h1>
        <p class="text-fg-body m-0 max-w-[56ch] text-[clamp(15px,.3vw+14px,17px)] leading-relaxed">
          Questions about a project, a payment or your account. We reply {{ replyEta }}.
        </p>
      </div>
      <ApexButton @click="openNew">
        New request
      </ApexButton>
    </div>

    <!-- ================================================================ new -->
    <section v-if="view === 'new'" aria-labelledby="h-new" class="flex w-full max-w-[760px] flex-col gap-[18px]">
      <button type="button" class="apex-ring text-fg-body inline-flex min-h-10 cursor-pointer items-center gap-2 self-start rounded-lg px-1 text-sm font-semibold" @click="closeNew">
        <Icon name="lucide:arrow-left" class="size-4" />All requests
      </button>
      <div class="flex flex-col gap-2">
        <h1 id="h-new" class="font-heading text-fg-heading m-0 text-[clamp(26px,1.2vw+18px,34px)] font-extrabold tracking-[-0.03em]">
          New request
        </h1>
        <p class="text-fg-body m-0 text-[15px] leading-relaxed">
          Goes to the person who can answer it. Their reply appears here and in your notifications.
        </p>
      </div>
      <div class="bg-card border-line-subtle shadow-panel flex flex-col gap-5 rounded-[22px] border p-[clamp(18px,2vw,26px)]">
        <div class="flex flex-col gap-2.5">
          <span id="lbl-topic" class="text-fg-heading text-sm font-semibold">What is it about?</span>
          <div role="radiogroup" aria-labelledby="lbl-topic" class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-2.5">
            <button
              v-for="[id, label, icon] in TOPICS"
              :key="id"
              type="button"
              role="radio"
              :aria-checked="topic === id"
              class="apex-ring text-fg-heading flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-[14px] border px-3.5 text-left text-sm font-semibold"
              :class="topic === id ? 'border-accent bg-accent-tint shadow-[0_0_0_3px_var(--accent-tint)]' : 'border-line-subtle bg-card'"
              @click="topic = id"
            >
              <Icon :name="icon" class="text-accent-ink size-[19px]" />{{ label }}
            </button>
          </div>
        </div>
        <div v-if="topic === 'project'" ref="ordBox" class="relative flex flex-col gap-2">
          <span id="lbl-ord" class="text-fg-heading text-sm font-semibold">Which order?</span>
          <button type="button" aria-haspopup="listbox" :aria-expanded="ordOpen" aria-labelledby="lbl-ord" class="apex-ring bg-card border-line-rule flex h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 text-left text-base md:text-[15px]" @click="ordOpen = !ordOpen">
            <span class="grow truncate" :class="ordSel ? 'text-fg-heading' : 'text-fg-muted'">{{ ordSel ? `${ordSel.name} · ${orderRef(ordSel.id)}` : 'Choose an order (optional)' }}</span>
            <Icon name="lucide:chevron-down" class="text-fg-muted size-[17px]" />
          </button>
          <div v-if="ordOpen" role="listbox" aria-labelledby="lbl-ord" class="apex-pop-in bg-card border-line-subtle shadow-pop absolute inset-x-0 top-[84px] z-20 flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-[14px] border p-1.5">
            <button
              v-for="o in orders"
              :key="o.id"
              type="button"
              role="option"
              :aria-selected="ord === o.id"
              class="apex-ring hover:bg-hover flex min-h-[46px] cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-left"
              :class="ord === o.id ? 'bg-accent-tint' : ''"
              @click="ord = ord === o.id ? null : o.id; ordOpen = false"
            >
              <span class="flex grow flex-col"><span class="text-fg-heading text-[14.5px] font-semibold">{{ o.name }}</span><span class="text-fg-muted text-[12.5px]">{{ o.category }} · {{ projectStatus(o.status).label }}</span></span>
              <span class="text-accent-ink">{{ ord === o.id ? '✓' : '' }}</span>
            </button>
            <p v-if="!orders.length" class="text-fg-body m-0 px-3 py-3 text-sm">
              You have no orders yet.
            </p>
          </div>
        </div>
        <ApexField v-model="nSubj" label="Subject" placeholder="One line is enough" hint="Optional · We use the start of your message if you leave it blank" />
        <ApexField v-model="nMsg" label="Message" required multiline :rows="5" placeholder="What happened, and what would you like us to do?" :error="errMsg" @blur="msgTouched = true" />
        <div class="flex flex-col gap-2">
          <label class="border-line-rule bg-raised relative flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] border-dashed px-4 py-3.5 focus-within:outline-2 focus-within:outline-[var(--accent)]">
            <Icon :name="newFiles.uploading.value ? 'lucide:loader-circle' : 'solar:paperclip-linear'" class="text-accent-ink size-[19px]" :class="newFiles.uploading.value ? 'motion-safe:animate-spin' : ''" />
            <span class="text-fg-body grow text-[13.5px]">Screenshots or documents, up to 20 MB each</span>
            <span class="text-accent-ink text-[13.5px] font-semibold">Attach</span>
            <input type="file" multiple class="absolute size-px opacity-0" @change="onNewFiles">
          </label>
          <p v-if="newFiles.error.value" role="alert" class="text-st-danger-fg m-0 text-[13px]">
            {{ newFiles.error.value }}
          </p>
          <div v-if="newFiles.files.value.length" class="flex flex-wrap gap-2">
            <span v-for="f in newFiles.files.value" :key="f.id" class="bg-card border-line-subtle text-fg-heading inline-flex items-center gap-2 rounded-xl border py-1.5 pl-3 pr-1 text-[13px] font-semibold">
              <Icon name="solar:file-check-linear" class="size-4 text-[#22B07D]" />{{ f.name }}
              <button type="button" :aria-label="`Remove ${f.name}`" class="apex-ring text-fg-muted inline-flex size-7 cursor-pointer items-center justify-center rounded-lg" @click="newFiles.remove(f.id)"><Icon name="lucide:x" class="size-3.5" /></button>
            </span>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-3">
          <button type="button" class="apex-ring text-fg-body min-h-[46px] cursor-pointer rounded-xl px-4 text-[15px] font-semibold" @click="closeNew">
            Cancel
          </button>
          <ApexButton :disabled="submitting || newFiles.uploading.value" @click="submitNew">
            {{ submitting ? 'Sending…' : 'Send request' }}
          </ApexButton>
        </div>
      </div>
    </section>

    <!-- ============================================================== inbox -->
    <div v-else class="grid items-start gap-5" :class="split ? 'grid-cols-[360px_minmax(0,1fr)]' : 'grid-cols-1'">
      <section v-if="showList" aria-label="Requests" class="flex min-w-0 flex-col gap-3" :class="split ? 'sticky top-24' : ''">
        <div role="group" aria-label="Request status" class="flex gap-1.5">
          <button
            v-for="[id, label] in ([['open', 'Open'], ['resolved', 'Resolved']] as const)"
            :key="id"
            type="button"
            :aria-pressed="box === id"
            :class="[PILL, box === id ? 'bg-fg-heading border-fg-heading text-card' : 'bg-card border-line-subtle text-fg-body']"
            @click="box = id"
          >
            {{ label }}<span class="text-xs font-bold opacity-75">{{ counts[id] }}</span>
          </button>
        </div>
        <div role="list" class="bg-card border-line-subtle shadow-panel overflow-hidden rounded-[20px] border">
          <button
            v-for="t in inBox"
            :key="t.id"
            type="button"
            role="listitem"
            :aria-current="split && t.id === selectedId ? 'true' : undefined"
            :aria-label="`${t.subject}, ${t.chip.label}${t.unread ? ', new reply' : ''}`"
            class="apex-ring border-line-soft hover:bg-hover flex w-full cursor-pointer flex-col gap-[7px] border-b px-[18px] py-4 text-left"
            :class="split && t.id === selectedId ? 'bg-accent-tint shadow-[inset_3px_0_0_var(--accent)]' : ''"
            @click="openTicket(t.id)"
          >
            <span class="flex items-center gap-2">
              <span v-if="t.unread" aria-hidden="true" class="bg-accent block size-2 shrink-0 rounded-full" />
              <span class="text-fg-heading min-w-0 grow truncate text-[14.5px]" :class="t.unread ? 'font-bold' : 'font-semibold'">{{ t.subject }}</span>
              <span class="text-fg-muted shrink-0 text-xs">{{ t.when }}</span>
            </span>
            <span class="text-fg-body truncate text-[13px] leading-[1.45]">{{ t.preview }}</span>
            <span class="flex flex-wrap items-center gap-2">
              <ApexStatusChip :tone="t.chip.tone">{{ t.chip.label }}</ApexStatusChip>
              <span class="text-fg-muted text-xs">{{ t.tag }}</span>
            </span>
          </button>
          <p v-if="!inBox.length" class="text-fg-body m-0 px-5 py-7 text-center text-sm leading-relaxed">
            {{ box === 'open' ? 'No open requests. Start one and the right person will pick it up.' : 'Nothing resolved yet.' }}
          </p>
        </div>
      </section>

      <section v-if="showThread && current" aria-labelledby="h-thread" class="bg-card border-line-subtle shadow-panel flex min-w-0 flex-col overflow-hidden rounded-[22px] border">
        <div class="border-line-soft flex flex-col gap-2.5 border-b px-[clamp(16px,2vw,24px)] py-[18px]">
          <button v-if="!split" type="button" class="apex-ring text-fg-body inline-flex min-h-9 cursor-pointer items-center gap-2 self-start rounded-lg text-sm font-semibold" @click="toInbox">
            <Icon name="lucide:arrow-left" class="size-4" />All requests
          </button>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
              <h2 id="h-thread" class="font-heading text-fg-heading m-0 text-xl font-bold leading-tight tracking-[-0.02em]">
                {{ current.subject }}
              </h2>
              <span class="text-fg-muted flex flex-wrap items-center gap-2 text-[13px]">
                <ApexStatusChip :tone="current.chip.tone">{{ current.chip.label }}</ApexStatusChip>{{ ticketRef(current.id) }} · {{ current.tag }}
              </span>
            </div>
            <button v-if="isOpenStatus(current.status)" type="button" class="apex-ring border-line-rule bg-card text-fg-heading hover:border-line-strong inline-flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 text-[13.5px] font-semibold" @click="setStatus('RESOLVED')">
              <Icon name="lucide:check" class="size-4 text-[#22B07D]" />Mark as resolved
            </button>
          </div>
        </div>
        <ol aria-label="Messages" class="bg-page m-0 flex list-none flex-col gap-[18px] p-[clamp(16px,2vw,24px)]">
          <template v-if="threadLoading && !messages.length">
            <BasePlaceload v-for="i in 2" :key="i" class="h-16 w-2/3 rounded-2xl" />
          </template>
          <li v-for="m in messages" :key="m.id" class="flex items-end gap-2.5" :class="m.isAdmin ? 'flex-row' : 'flex-row-reverse'">
            <span aria-hidden="true" class="font-heading inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold text-white" :class="m.isAdmin ? 'bg-[#7D53F2]' : 'bg-[#101828] dark:bg-white/15'">{{ m.isAdmin ? initials(m.author) : myInitials }}</span>
            <div class="flex max-w-[min(560px,82%)] flex-col gap-1.5" :class="m.isAdmin ? 'items-start' : 'items-end'">
              <span class="text-fg-muted text-xs"><strong class="text-fg-heading font-semibold">{{ m.author }}</strong> · {{ stamp(m.createdAt) }}</span>
              <div
                class="text-fg-heading whitespace-pre-wrap border px-4 py-3 text-[14.5px] leading-relaxed"
                :class="m.isAdmin ? 'bg-card border-line-subtle rounded-[18px_18px_18px_6px]' : 'bg-accent-tint rounded-[18px_18px_6px_18px] border-transparent'"
              >
                {{ m.content }}
              </div>
              <a
                v-for="a in m.attachments"
                :key="a.id"
                :href="`/api/attachments/${a.id}`"
                download
                class="apex-ring bg-card border-line-subtle text-fg-heading hover:border-line-strong inline-flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] font-semibold"
              >
                <Icon name="solar:file-text-linear" class="text-accent-ink size-[17px]" />{{ a.name }}<span class="text-fg-muted font-normal">{{ fileSize(a.size) }}</span>
              </a>
            </div>
          </li>
        </ol>
        <div v-if="isOpenStatus(current.status)" class="border-line-soft flex flex-col gap-2.5 border-t px-[clamp(14px,2vw,20px)] py-3.5">
          <label for="reply" class="sr-only">Reply</label>
          <textarea id="reply" v-model="reply" placeholder="Write a reply" rows="3" class="apex-ring border-line-rule bg-card text-fg-heading placeholder:text-fg-muted min-h-20 w-full resize-y rounded-[14px] border px-3.5 py-3 text-base leading-[1.55] outline-none md:text-[14.5px]" />
          <div v-if="replyFiles.files.value.length || replyFiles.error.value" class="flex flex-wrap items-center gap-2">
            <span v-for="f in replyFiles.files.value" :key="f.id" class="bg-raised text-fg-heading inline-flex items-center gap-1.5 rounded-lg py-1 pl-2.5 pr-1 text-[12.5px] font-semibold">
              {{ f.name }}<button type="button" :aria-label="`Remove ${f.name}`" class="apex-ring text-fg-muted inline-flex size-6 cursor-pointer items-center justify-center rounded" @click="replyFiles.remove(f.id)"><Icon name="lucide:x" class="size-3" /></button>
            </span>
            <span v-if="replyFiles.error.value" role="alert" class="text-st-danger-fg text-[12.5px]">{{ replyFiles.error.value }}</span>
          </div>
          <div class="flex items-center justify-between gap-3">
            <label class="text-fg-body relative inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] px-2.5 text-[13.5px] font-semibold focus-within:outline-2 focus-within:outline-[var(--accent)]">
              <Icon :name="replyFiles.uploading.value ? 'lucide:loader-circle' : 'solar:paperclip-linear'" class="size-[18px]" :class="replyFiles.uploading.value ? 'motion-safe:animate-spin' : ''" />Attach
              <input type="file" multiple class="absolute size-px opacity-0" @change="onReplyFiles">
            </label>
            <ApexButton size="sm" :disabled="!reply.trim() || sending || replyFiles.uploading.value" @click="send">
              {{ sending ? 'Sending…' : 'Send' }}
            </ApexButton>
          </div>
        </div>
        <div v-else class="border-line-soft text-fg-body flex flex-wrap items-center justify-between gap-3 border-t px-[clamp(16px,2vw,24px)] py-4 text-sm">
          <span>This request is resolved. Reopen it if something is still wrong.</span>
          <button type="button" class="apex-ring text-accent-ink hover:bg-accent-tint min-h-10 cursor-pointer rounded-[10px] px-3 text-sm font-semibold" @click="setStatus('OPEN')">
            Reopen
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
