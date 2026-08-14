<script setup lang="ts">
/**
 * Admin — Ticketing. Split-pane support inbox (same pattern as the
 * customer Support page): filterable ticket list on the left, thread +
 * triage on the right. Staff replies go to the customer; internal
 * notes (amber) are admin-panel-only — the customer thread endpoint
 * filters them out. Deep links: ?ticket=<id>, ?assignee=unassigned.
 */
definePageMeta({
  title: 'Tickets',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()
const route = useRoute()
const { user: me } = useUser()

// --- Inbox list ---
const STATUS_FILTERS: [string, string][] = [['', 'All'], ['OPEN', 'Open'], ['PENDING', 'Awaiting'], ['RESOLVED', 'Resolved'], ['CLOSED', 'Closed']]

const search = ref('')
const debouncedSearch = ref('')
const statusFilter = ref('')
const assigneeFilter = ref<string>(typeof route.query.assignee === 'string' ? route.query.assignee : '')
const page = ref(1)

watchDebounced(search, (value) => {
  debouncedSearch.value = value.trim()
}, { debounce: 300 })

watch([debouncedSearch, statusFilter, assigneeFilter], () => {
  page.value = 1
})

const listQuery = computed(() => ({
  page: page.value,
  pageSize: 15,
  ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
  ...(statusFilter.value ? { status: statusFilter.value } : {}),
  ...(assigneeFilter.value ? { assignee: assigneeFilter.value } : {}),
}))

const { data: listData, pending: listPending, refresh: refreshList } = await useFetch('/api/admin/tickets', { query: listQuery })

const tickets = computed(() => listData.value?.items ?? [])

// --- Selected ticket / thread ---
const selectedId = ref<string | null>(typeof route.query.ticket === 'string' ? route.query.ticket : null)

const { data: detailData, pending: detailPending, refresh: refreshDetail } = await useFetch(
  () => `/api/admin/tickets/${selectedId.value}`,
  { immediate: Boolean(selectedId.value), watch: [selectedId] },
)

const ticket = computed(() => (selectedId.value ? detailData.value?.ticket ?? null : null))
const staff = computed(() => detailData.value?.staff ?? [])

function select(id: string) {
  selectedId.value = id
}

function timeAgo(iso: string | Date) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1)
    return 'just now'
  if (mins < 60)
    return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24)
    return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function fmtDateTime(iso: string | Date) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function customerName(u: { email: string, firstName?: string | null, lastName?: string | null }) {
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email
}

// --- Triage actions ---
const triaging = ref(false)

async function patchTicket(body: Record<string, unknown>, successTitle: string) {
  if (!selectedId.value || triaging.value)
    return
  triaging.value = true
  try {
    await $fetch(`/api/admin/tickets/${selectedId.value}`, { method: 'PATCH', body })
    toaster.add({ title: successTitle, icon: 'lucide:check', progress: true })
    await Promise.all([refreshDetail(), refreshList()])
  }
  catch (error: any) {
    toaster.add({ title: 'Update failed', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    triaging.value = false
  }
}

// --- Composer ---
const draft = ref('')
const draftInternal = ref(false)
const sending = ref(false)

async function sendReply() {
  if (!selectedId.value || !draft.value.trim() || sending.value)
    return
  sending.value = true
  try {
    await $fetch(`/api/admin/tickets/${selectedId.value}/reply`, {
      method: 'POST',
      body: { content: draft.value.trim(), isInternal: draftInternal.value },
    })
    draft.value = ''
    await Promise.all([refreshDetail(), refreshList()])
  }
  catch (error: any) {
    toaster.add({ title: 'Message not sent', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    sending.value = false
  }
}

function onDraftKey(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendReply()
  }
}

/** Sender line for a thread message. */
function senderLabel(m: { isAdmin: boolean, isInternal: boolean, senderId?: string | null }) {
  if (!m.isAdmin)
    return ticket.value ? customerName(ticket.value.user) : 'Customer'
  const agent = staff.value.find(s => s.id === m.senderId)
  const name = agent ? ([agent.firstName, agent.lastName].filter(Boolean).join(' ').trim() || agent.email) : 'Apex Support'
  return m.isInternal ? `${name} · internal note` : name
}
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-6 pb-8 font-sans text-muted-400">
    <AdminPageHeader
      eyebrow="ADMIN · SUPPORT"
      title="Tickets"
      subtitle="Triage, assign and answer every customer request. Internal notes never reach the customer."
    />

    <div class="grid grid-cols-1 items-start gap-5 xl:grid-cols-[0.9fr_1.35fr]">
      <!-- ========== LEFT: INBOX ========== -->
      <section class="flex flex-col gap-3 rounded-[20px] border border-white/10 bg-muted-800 p-4" aria-label="Ticket inbox">
        <label class="flex items-center gap-2.5 rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 focus-within:border-primary-400">
          <Icon name="lucide:search" class="size-4 shrink-0 text-muted-500" />
          <input v-model="search" placeholder="Search subject or customer…" class="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-white outline-none placeholder:text-muted-500">
        </label>

        <div class="flex items-center gap-2 overflow-x-auto rounded-full border border-white/8 bg-muted-700 p-[3px]" role="radiogroup" aria-label="Status filter">
          <button
            v-for="[key, label] in STATUS_FILTERS" :key="key"
            type="button"
            role="radio"
            :aria-checked="statusFilter === key"
            class="shrink-0 rounded-full px-3.5 py-2.5 text-[12.5px] font-bold transition sm:py-1.5"
            :class="statusFilter === key ? 'bg-white/10 text-white' : 'text-muted-400 hover:text-white'"
            @click="statusFilter = key"
          >
            {{ label }}
          </button>
        </div>

        <select v-model="assigneeFilter" aria-label="Filter by assignee" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 sm:py-2.5 text-[13px] text-white outline-none focus:border-primary-400">
          <option value="">
            Any assignee
          </option>
          <option value="me">
            Assigned to me
          </option>
          <option value="unassigned">
            Unassigned
          </option>
        </select>

        <div v-if="listPending" class="flex flex-col gap-2" aria-hidden="true">
          <div v-for="i in 5" :key="i" class="h-[76px] animate-pulse rounded-[14px] border border-white/5 bg-muted-700/50" />
        </div>

        <div v-else-if="tickets.length" class="flex flex-col gap-1.5" role="list">
          <button
            v-for="t in tickets" :key="t.id"
            type="button"
            role="listitem"
            class="flex flex-col gap-1.5 rounded-[14px] border px-4 py-3 text-left transition"
            :class="selectedId === t.id ? 'border-primary-500/50 bg-primary-500/10' : 'border-transparent hover:border-white/10 hover:bg-white/[0.03]'"
            @click="select(t.id)"
          >
            <div class="flex items-center gap-2">
              <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-white">{{ t.subject }}</span>
              <AdminStatusChip :status="t.status" />
            </div>
            <div class="flex items-center gap-2 text-[12px] text-muted-500">
              <span class="min-w-0 truncate">{{ customerName(t.user) }}</span>
              <span aria-hidden="true">·</span>
              <span class="shrink-0">{{ timeAgo(t.updatedAt) }}</span>
              <span v-if="t.priority && /high|urgent/i.test(t.priority)" class="ms-auto inline-flex shrink-0 items-center gap-1 font-bold text-[#EC6453]">
                <Icon name="lucide:flame" class="size-3" />{{ t.priority.toLowerCase() }}
              </span>
            </div>
            <div v-if="t.messages?.[0]" class="truncate text-[12.5px] text-muted-400">
              <Icon v-if="t.messages[0].isInternal" name="lucide:lock" class="mb-px inline size-3 text-[#F2C14E]" />
              {{ t.messages[0].content }}
            </div>
            <div class="flex items-center gap-1.5 text-[11.5px]" :class="t.assignee ? 'text-muted-500' : 'text-[#F2C14E]'">
              <Icon :name="t.assignee ? 'lucide:user-check' : 'lucide:user-plus'" class="size-3" />
              {{ t.assignee ? (customerName(t.assignee)) : 'Unassigned' }}
            </div>
          </button>
        </div>

        <AdminEmptyState v-else icon="lucide:inbox" title="No tickets match" subtitle="Adjust the filters above." />

        <AdminPager
          v-if="listData" :page="listData.page" :page-count="listData.pageCount" :total="listData.total" noun="tickets"
          @update:page="page = $event"
        />
      </section>

      <!-- ========== RIGHT: THREAD ========== -->
      <section class="flex min-h-[540px] flex-col rounded-[20px] border border-white/10 bg-muted-800" aria-label="Ticket thread">
        <template v-if="ticket">
          <!-- triage header -->
          <div class="border-b border-white/10 p-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="truncate font-heading text-[18px] font-extrabold tracking-[-0.01em] text-white">
                  {{ ticket.subject }}
                </h2>
                <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-500">
                  <NuxtLink :to="`/admin/users/${ticket.user.id}`" class="inline-flex items-center gap-1.5 font-semibold text-primary-400 hover:text-white">
                    <Icon name="lucide:user" class="size-3.5" />{{ customerName(ticket.user) }}
                  </NuxtLink>
                  <span>{{ ticket.category }}</span>
                  <span>{{ ticket.user._count.tickets }} ticket(s) · {{ ticket.user._count.projects }} project(s)</span>
                </div>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div>
                <label for="tk-status" class="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-muted-500">Status</label>
                <select
                  id="tk-status" :value="ticket.status" :disabled="triaging"
                  class="w-full cursor-pointer rounded-[10px] border border-white/8 bg-muted-700 px-3 py-2 text-[13px] text-white outline-none focus:border-primary-400 disabled:opacity-50"
                  @change="patchTicket({ status: ($event.target as HTMLSelectElement).value }, 'Status updated')"
                >
                  <option value="OPEN">
                    Open
                  </option>
                  <option value="PENDING">
                    Awaiting customer
                  </option>
                  <option value="RESOLVED">
                    Resolved
                  </option>
                  <option value="CLOSED">
                    Closed
                  </option>
                </select>
              </div>
              <div>
                <label for="tk-priority" class="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-muted-500">Priority</label>
                <select
                  id="tk-priority" :value="ticket.priority.toUpperCase()" :disabled="triaging"
                  class="w-full cursor-pointer rounded-[10px] border border-white/8 bg-muted-700 px-3 py-2 text-[13px] text-white outline-none focus:border-primary-400 disabled:opacity-50"
                  @change="patchTicket({ priority: ($event.target as HTMLSelectElement).value }, 'Priority updated')"
                >
                  <option value="LOW">
                    Low
                  </option>
                  <option value="NORMAL">
                    Normal
                  </option>
                  <option value="HIGH">
                    High
                  </option>
                  <option value="URGENT">
                    Urgent
                  </option>
                </select>
              </div>
              <div>
                <label for="tk-assignee" class="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-muted-500">Assignee</label>
                <select
                  id="tk-assignee" :value="ticket.assigneeId ?? ''" :disabled="triaging"
                  class="w-full cursor-pointer rounded-[10px] border border-white/8 bg-muted-700 px-3 py-2 text-[13px] text-white outline-none focus:border-primary-400 disabled:opacity-50"
                  @change="patchTicket({ assigneeId: ($event.target as HTMLSelectElement).value || null }, 'Assignee updated')"
                >
                  <option value="">
                    Unassigned
                  </option>
                  <option v-for="s in staff" :key="s.id" :value="s.id">
                    {{ [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email }}{{ s.id === me?.id ? ' (you)' : '' }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- thread -->
          <div class="flex-1 space-y-4 overflow-y-auto p-5" role="log" aria-label="Conversation">
            <div
              v-for="m in ticket.messages" :key="m.id"
              class="flex" :class="m.isAdmin ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[85%] rounded-[14px] border px-4 py-3"
                :class="m.isInternal
                  ? 'border-[#D9A521]/35 bg-[#D9A521]/10'
                  : m.isAdmin
                    ? 'border-primary-500/30 bg-primary-500/12'
                    : 'border-white/8 bg-muted-700/70'"
              >
                <div class="mb-1 flex items-center gap-2 text-[11.5px] font-bold" :class="m.isInternal ? 'text-[#F2C14E]' : m.isAdmin ? 'text-primary-200' : 'text-muted-500'">
                  <Icon v-if="m.isInternal" name="lucide:lock" class="size-3" />
                  {{ senderLabel(m) }}
                  <span class="font-normal text-muted-500">· {{ fmtDateTime(m.createdAt) }}</span>
                </div>
                <div class="whitespace-pre-line text-[13.5px] leading-[1.55] text-white">
                  {{ m.content }}
                </div>
              </div>
            </div>
            <p v-if="!ticket.messages.length" class="pt-10 text-center text-[13px] text-muted-500">
              No messages on this ticket yet.
            </p>
          </div>

          <!-- composer -->
          <div class="border-t border-white/10 p-4">
            <div class="mb-2.5 flex items-center gap-2">
              <button
                type="button"
                role="switch"
                :aria-checked="draftInternal"
                class="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition"
                :class="draftInternal ? 'border-[#D9A521]/40 bg-[#D9A521]/14 text-[#F2C14E]' : 'border-white/10 bg-muted-700 text-muted-400 hover:text-white'"
                @click="draftInternal = !draftInternal"
              >
                <Icon name="lucide:lock" class="size-3.5" />
                Internal note
              </button>
              <span class="text-[11.5px] text-muted-500">{{ draftInternal ? 'Only staff will see this.' : 'The customer will see this reply.' }}</span>
            </div>
            <div
              class="flex items-end gap-2.5 rounded-[14px] border px-3.5 py-2.5 transition"
              :class="draftInternal ? 'border-[#D9A521]/35 bg-[#D9A521]/[0.06]' : 'border-white/8 bg-muted-700'"
            >
              <textarea
                v-model="draft" rows="1"
                :placeholder="draftInternal ? 'Write an internal note…  (Enter to save)' : 'Write a reply…  (Enter to send, Shift+Enter for a new line)'"
                class="max-h-[120px] min-w-0 flex-1 resize-none border-none bg-transparent py-1.5 text-sm leading-[1.5] text-white outline-none placeholder:text-muted-500"
                @keydown="onDraftKey"
              />
              <button
                :aria-label="draftInternal ? 'Save note' : 'Send reply'"
                class="inline-flex size-[38px] shrink-0 items-center justify-center rounded-[10px] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                :class="draftInternal ? 'bg-[#D9A521]' : 'bg-primary-500 shadow-[0_6px_16px_rgba(125,83,242,0.32)]'"
                :disabled="!draft.trim() || sending"
                @click="sendReply"
              >
                <Icon :name="draftInternal ? 'lucide:sticky-note' : 'lucide:send'" class="size-[17px]" />
              </button>
            </div>
          </div>
        </template>

        <div v-else-if="detailPending && selectedId" class="flex flex-1 items-center justify-center" aria-hidden="true">
          <Icon name="lucide:loader-circle" class="size-6 animate-spin text-muted-500" />
        </div>

        <div v-else class="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
          <span class="flex size-14 items-center justify-center rounded-full bg-white/5 text-muted-500">
            <Icon name="lucide:mouse-pointer-click" class="size-7" />
          </span>
          <div class="text-base font-bold text-white">
            Pick a ticket
          </div>
          <p class="max-w-[240px] text-[13px] text-muted-500">
            Select a request from the inbox to read the thread and reply.
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
