<script setup lang="ts">
import type { ReplyPriority } from '~~/shared/support-eta'
import type { ApexTone } from '~/utils/panel'
import { ticketRef } from '~~/shared/refs'
import { callLabel } from '~~/shared/support-call'
import { formatReplyEta } from '~~/shared/support-eta'
import { personName, ukDateTime } from '~/utils/adminFormat'
import { ADMIN_INPUT, ADMIN_TH } from '~/utils/adminUi'

/**
 * Admin console — Support inbox (`Admin Console.dc.html`, 2026-10-31).
 *
 * One table, open requests first and the latest against their reply
 * promise first: priority, request and client, assignee, "waiting /
 * target" measured from the customer's unanswered message against the
 * target Platform settings sets for that priority, and status. A row
 * opens the request in the drawer: assignee, priority and status, the
 * thread with staff-only notes marked, and a composer that switches
 * between a reply to the client and an internal note.
 *
 * Kept from the previous inbox: search, status and assignee filters,
 * paging, the call-request slot and the customer's rating. Deep links:
 * ?ticket=<id>, ?assignee=unassigned|me.
 */
definePageMeta({
  title: 'Support inbox',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()
const route = useRoute()
const router = useRouter()
const { user: me } = useUser()

/* -------------------------------------------------------------- list --- */

const STATUS_FILTERS: [string, string][] = [['', 'All'], ['OPEN', 'Open'], ['PENDING', 'Waiting on client'], ['RESOLVED', 'Resolved'], ['CLOSED', 'Closed']]
const ASSIGNEE_FILTERS: [string, string][] = [['', 'Anyone'], ['me', 'Mine'], ['unassigned', 'Unassigned']]
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
  pageSize: 25,
  ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
  ...(statusFilter.value ? { status: statusFilter.value } : {}),
  ...(assigneeFilter.value ? { assignee: assigneeFilter.value } : {}),
}))

const { data: listData, pending: listPending, error: listError, refresh: refreshList } = await useFetch('/api/admin/tickets', { query: listQuery })

const PRIORITY: Record<string, { label: string, tone: ApexTone }> = {
  urgent: { label: 'Urgent', tone: 'danger' },
  high: { label: 'High', tone: 'warning' },
  normal: { label: 'Normal', tone: 'neutral' },
  low: { label: 'Low', tone: 'neutral' },
}
const STATUS: Record<string, { label: string, tone: ApexTone, order: number }> = {
  OPEN: { label: 'Open', tone: 'info', order: 0 },
  PENDING: { label: 'Waiting on client', tone: 'neutral', order: 1 },
  RESOLVED: { label: 'Resolved', tone: 'success', order: 2 },
  CLOSED: { label: 'Closed', tone: 'neutral', order: 3 },
}

function priorityKey(p: string | null | undefined): ReplyPriority {
  const v = (p ?? '').toLowerCase()
  return v.includes('urgent') ? 'urgent' : v.includes('high') ? 'high' : v.includes('low') ? 'low' : 'normal'
}
function statusOf(s: string) {
  return STATUS[s?.toUpperCase()] ?? { label: s, tone: 'neutral' as const, order: 4 }
}

/** Minutes the customer has waited for a first answer to their latest message. */
function waitedMinutes(since: string | Date | null) {
  return since ? Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60_000)) : 0
}
function fmtMinutes(m: number) {
  if (m < 60) {
    return `${m}m`
  }
  if (m < 1440) {
    return `${Math.floor(m / 60)}h`
  }
  const d = Math.floor(m / 1440)
  return `${d} ${d === 1 ? 'day' : 'days'}`
}

const rows = computed(() => {
  const targets = listData.value?.replyTargets
  return (listData.value?.items ?? []).map((t: any) => {
    const pk = priorityKey(t.priority)
    const target = targets?.[pk] ?? 15
    const open = t.status === 'OPEN' && t.waitingSince
    const waited = open ? waitedMinutes(t.waitingSince) : 0
    const late = Boolean(open && waited > target)
    return {
      ...t,
      pk,
      late,
      status: statusOf(t.status),
      waitLabel: open ? `${fmtMinutes(waited)} / ${formatReplyEta(target).replace('~', '')}${late ? ' · late' : ''}` : '—',
      sort: [statusOf(t.status).order, -(open ? waited / target : 0)],
    }
  }).sort((a: any, b: any) => a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1])
})

/* ------------------------------------------------------------ drawer --- */

const selectedId = ref<string | null>(typeof route.query.ticket === 'string' ? route.query.ticket : null)
const drawerOpen = computed({
  get: () => Boolean(selectedId.value),
  set: (v) => {
    if (!v) {
      selectedId.value = null
    }
  },
})
watch(selectedId, (id) => {
  router.replace({ query: { ...route.query, ticket: id ?? undefined } })
})

const { data: detailData, pending: detailPending, refresh: refreshDetail } = await useFetch(
  () => `/api/admin/tickets/${selectedId.value}`,
  { immediate: Boolean(selectedId.value), watch: [selectedId] },
)
const ticket = computed<any>(() => (selectedId.value ? detailData.value?.ticket ?? null : null))
const staff = computed(() => detailData.value?.staff ?? [])

const triaging = ref(false)
async function patchTicket(body: Record<string, unknown>, successTitle: string) {
  if (!selectedId.value || triaging.value) {
    return
  }
  triaging.value = true
  try {
    await $fetch(`/api/admin/tickets/${selectedId.value}`, { method: 'PATCH', body })
    toaster.add({ title: successTitle, icon: 'lucide:check', progress: true })
    await Promise.all([refreshDetail(), refreshList()])
  }
  catch (error: any) {
    toaster.add({ title: 'Not saved', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    triaging.value = false
  }
}

const draft = ref('')
const mode = ref<'reply' | 'note'>('reply')
const sending = ref(false)
async function sendReply() {
  if (!selectedId.value || !draft.value.trim() || sending.value) {
    return
  }
  sending.value = true
  try {
    await $fetch(`/api/admin/tickets/${selectedId.value}/reply`, {
      method: 'POST',
      body: { content: draft.value.trim(), isInternal: mode.value === 'note' },
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

function senderLabel(m: { isAdmin: boolean, senderId?: string | null }) {
  if (!m.isAdmin) {
    return ticket.value ? personName(ticket.value.user, 'Client') : 'Client'
  }
  const agent = staff.value.find((s: any) => s.id === m.senderId)
  return agent ? personName(agent) : 'Apex support'
}

const PILL = 'apex-ring inline-flex h-8 cursor-pointer items-center whitespace-nowrap rounded-full border px-[13px] text-[13px]'
const GRID = 'xl:grid-cols-[96px_minmax(0,1fr)_150px_170px_150px]'
const SELECT = 'apex-ring border-line-rule bg-shell text-fg-heading h-[38px] w-full rounded-[10px] border px-2.5 text-sm'
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="Support" accent="inbox" subtitle="Lateness is measured against the reply promise set in Platform settings. Internal notes never reach the customer." />

    <div class="flex flex-wrap items-center gap-2">
      <div class="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        <button
          v-for="[key, label] in STATUS_FILTERS" :key="key || 'all'" type="button" :aria-pressed="statusFilter === key"
          :class="[PILL, statusFilter === key ? 'bg-accent border-transparent font-semibold text-white' : 'border-line-subtle text-fg-heading hover:bg-hover font-medium']"
          @click="statusFilter = key"
        >
          {{ label }}
        </button>
      </div>
      <span class="hidden flex-1 xl:block" />
      <div class="flex w-full flex-wrap gap-2 xl:w-auto">
        <div class="border-line-subtle flex rounded-full border p-[3px]" role="group" aria-label="Filter by assignee">
          <button
            v-for="[key, label] in ASSIGNEE_FILTERS" :key="key || 'any'" type="button" :aria-pressed="assigneeFilter === key"
            class="apex-ring h-[26px] rounded-full px-3 text-[12.5px]"
            :class="assigneeFilter === key ? 'bg-accent font-semibold text-white' : 'text-fg-heading font-medium'"
            @click="assigneeFilter = key"
          >
            {{ label }}
          </button>
        </div>
        <input v-model="search" type="search" placeholder="Search subject or client" aria-label="Search requests" :class="ADMIN_INPUT" class="h-9! min-w-0 flex-1 xl:w-[240px]! xl:flex-none">
      </div>
    </div>

    <section class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
      <div :class="[GRID, ADMIN_TH]" class="hidden gap-3.5 px-[22px] py-3.5 xl:grid">
        <span>Priority</span><span>Request</span><span>Assignee</span><span>Waiting / target</span><span>Status</span>
      </div>
      <div v-if="listError" role="alert" class="border-line-soft text-fg-body flex flex-wrap items-center gap-3 border-t px-[22px] py-6 text-sm">
        The inbox could not load. <AdminButton size="sm" @click="refreshList()">
          Try again
        </AdminButton>
      </div>
      <div v-else-if="listPending" aria-hidden="true">
        <div v-for="i in 5" :key="i" class="border-line-soft h-[62px] animate-pulse border-t" />
      </div>
      <ul v-else-if="rows.length">
        <li v-for="t in rows" :key="t.id">
          <button
            type="button"
            :class="GRID"
            class="apex-ring border-line-soft hover:bg-raised grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-1.5 border-t px-[18px] py-[13px] text-start sm:px-[22px]"
            @click="selectedId = t.id"
          >
            <AdminStatusChip :tone="PRIORITY[t.pk].tone" :label="PRIORITY[t.pk].label" />
            <span class="min-w-0">
              <span class="text-fg-heading block truncate text-sm font-semibold">{{ t.subject }}</span>
              <span class="text-fg-muted mt-0.5 block truncate text-[12.5px]">{{ personName(t.user, 'Client') }} · {{ ticketRef(t.id) }}</span>
            </span>
            <span class="col-span-2 truncate text-[13px] xl:col-span-1" :class="t.assignee ? 'text-fg-body' : 'text-st-warning-fg font-semibold'">
              <span class="text-fg-muted font-normal xl:hidden">Assignee: </span>{{ t.assignee ? personName(t.assignee) : 'Unassigned' }}
            </span>
            <span class="text-[13px] tabular-nums" :class="t.late ? 'text-st-danger-fg font-semibold' : 'text-fg-body'"><ClientOnly>{{ t.waitLabel }}</ClientOnly></span>
            <AdminStatusChip :tone="t.status.tone" :label="t.status.label" dot class="justify-self-end xl:justify-self-start" />
          </button>
        </li>
      </ul>
      <div v-else class="border-line-soft text-fg-body border-t px-6 py-11 text-center text-sm">
        {{ debouncedSearch ? `Nothing matches “${debouncedSearch}”.` : 'No requests here. New ones appear as clients open them in Support.' }}
      </div>
    </section>

    <AdminPager
      v-if="listData && listData.pageCount > 1" :page="listData.page" :page-count="listData.pageCount" :total="listData.total" noun="requests"
      @update:page="page = $event"
    />

    <AdminDrawer
      v-model:open="drawerOpen"
      :title="ticket?.subject ?? 'Support request'"
      :eyebrow="ticket ? `${personName(ticket.user, 'Client')} · ${PRIORITY[priorityKey(ticket.priority)].label} priority · ${ticketRef(ticket.id)}` : 'Loading'"
      :status="ticket ? statusOf(ticket.status).label : undefined"
      :tone="ticket ? statusOf(ticket.status).tone : undefined"
    >
      <div v-if="detailPending && !ticket" class="flex flex-col gap-3" aria-hidden="true">
        <div v-for="i in 3" :key="i" class="bg-raised h-16 animate-pulse rounded-xl" />
      </div>
      <template v-else-if="ticket">
        <div class="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-sm">
          <label for="tk-assignee" class="text-fg-muted text-[13px]">Assignee</label>
          <select id="tk-assignee" :class="SELECT" :value="ticket.assigneeId ?? ''" :disabled="triaging" @change="patchTicket({ assigneeId: ($event.target as HTMLSelectElement).value || null }, 'Assignee updated')">
            <option value="">
              Unassigned
            </option>
            <option v-for="s in staff" :key="s.id" :value="s.id">
              {{ personName(s) }}{{ s.id === me?.id ? ' (you)' : '' }}
            </option>
          </select>
          <label for="tk-priority" class="text-fg-muted text-[13px]">Priority</label>
          <select id="tk-priority" :class="SELECT" :value="priorityKey(ticket.priority).toUpperCase()" :disabled="triaging" @change="patchTicket({ priority: ($event.target as HTMLSelectElement).value }, 'Priority updated')">
            <option v-for="(v, k) in PRIORITY" :key="k" :value="k.toUpperCase()">
              {{ v.label }}
            </option>
          </select>
          <label for="tk-status" class="text-fg-muted text-[13px]">Status</label>
          <select id="tk-status" :class="SELECT" :value="ticket.status" :disabled="triaging" @change="patchTicket({ status: ($event.target as HTMLSelectElement).value }, 'Status updated')">
            <option v-for="(v, k) in STATUS" :key="k" :value="k">
              {{ v.label }}
            </option>
          </select>
          <span class="text-fg-muted text-[13px]">Topic</span>
          <span class="text-fg-body">{{ ticket.category || 'General' }}</span>
          <span class="text-fg-muted text-[13px]">Client</span>
          <NuxtLink :to="`/admin/users/${ticket.user.id}`" class="apex-ring text-accent-ink truncate rounded font-semibold">
            {{ personName(ticket.user, 'Client') }} →
          </NuxtLink>
        </div>

        <div v-if="ticket.callSlot" class="bg-accent-tint text-fg-heading flex gap-2.5 rounded-xl px-3.5 py-3 text-[13.5px] leading-normal">
          <Icon name="lucide:phone" class="text-accent-ink mt-0.5 size-4 shrink-0" />
          <span>Call requested for {{ callLabel(ticket.callSlot) }}. Confirm it by replying; nothing is booked automatically.</span>
        </div>
        <div v-if="ticket.rating" class="bg-raised text-fg-heading rounded-xl px-3.5 py-3 text-[13.5px]">
          Rated {{ ticket.rating }} of 5<span v-if="ticket.ratingNote" class="text-fg-body"> · “{{ ticket.ratingNote }}”</span>
        </div>

        <ol class="flex flex-col gap-2.5" aria-label="Conversation">
          <li
            v-for="m in ticket.messages" :key="m.id"
            class="rounded-xl px-3.5 py-3"
            :class="m.isInternal ? 'bg-st-warning-bg border border-dashed border-[#D9A521]' : m.isAdmin ? 'bg-accent-tint ms-8' : 'bg-raised me-8'"
          >
            <div class="text-fg-muted flex flex-wrap items-center gap-2 text-xs">
              <span class="text-fg-heading font-semibold">{{ senderLabel(m) }}</span>
              <ClientOnly>{{ ukDateTime(m.createdAt) }}</ClientOnly>
              <AdminStatusChip v-if="m.isInternal" tone="warning" label="Staff only" class="h-5!" />
            </div>
            <p class="text-fg-heading mt-1.5 whitespace-pre-line text-sm leading-[1.55]">
              {{ m.content }}
            </p>
          </li>
          <li v-if="!ticket.messages.length" class="text-fg-body text-sm">
            No messages yet.
          </li>
        </ol>
      </template>

      <template v-if="ticket" #footer>
        <div class="flex gap-1.5" role="group" aria-label="Message type">
          <button
            v-for="[k, l] in ([['reply', 'Reply to client'], ['note', 'Internal note']] as const)" :key="k" type="button" :aria-pressed="mode === k"
            class="h-[30px]" :class="[PILL, mode === k ? 'bg-accent border-transparent font-semibold text-white' : 'border-line-subtle text-fg-heading font-medium']"
            @click="mode = k"
          >
            {{ l }}
          </button>
        </div>
        <label for="tk-draft" class="sr-only">{{ mode === 'note' ? 'Internal note' : 'Reply to the client' }}</label>
        <textarea
          id="tk-draft"
          v-model="draft"
          rows="3"
          :placeholder="mode === 'note' ? 'Only staff can see this note' : 'Write a reply. The client sees this in Support.'"
          class="apex-ring text-fg-heading resize-y rounded-xl px-3 py-2.5 text-base leading-normal sm:text-sm"
          :class="mode === 'note' ? 'bg-st-warning-bg border border-dashed border-[#D9A521]' : 'border-line-rule bg-shell border'"
        />
        <div class="flex items-center gap-2.5">
          <span class="text-fg-muted flex-1 text-xs">{{ mode === 'note' ? 'Staff only. Never shown to the client.' : 'Sent to the client in the portal, and by email if they keep notification emails on.' }}</span>
          <AdminButton variant="primary" :disabled="!draft.trim() || sending" @click="sendReply">
            {{ mode === 'note' ? 'Add note' : 'Send reply' }}
          </AdminButton>
        </div>
      </template>
    </AdminDrawer>
  </AdminPage>
</template>
