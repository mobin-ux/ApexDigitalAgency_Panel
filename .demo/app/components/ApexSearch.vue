<script setup lang="ts">
/**
 * Search for the Apex panel — full screen below `lg`, centred dialog above
 * (V2 Phase 1 mobile, §2).
 *
 * ## Why this exists rather than a restyle of `DemoAppSearch`
 *
 * The button in the toolbar used to open Tairo's demo search, which indexes two
 * things: the `docs` content collection and every router route carrying
 * `meta.preview`. No customer page sets `preview`, so MiniSearch had nothing to
 * index for them — a customer typing "orders" got Tairo demo layouts and
 * Shuriken UI documentation, and their own orders were the one thing the search
 * could not find. In production the docs routes 404, so half of the results led
 * nowhere at all. That is a control that looks like a feature and is not one.
 *
 * This searches what the customer actually has: the panel's own destinations,
 * their projects and their support tickets. No new endpoint — `/api/orders` and
 * `/api/support/tickets` are the same two the Orders and Support pages call,
 * fetched lazily on first open so the shell costs nothing on a normal page load.
 *
 * ## Why not MiniSearch
 *
 * The corpus is a few dozen rows, not a documentation site. A scored match is
 * ~20 lines, ranks deterministically (prefix beats word-start beats substring),
 * and needs no index to rebuild when a ticket changes.
 */
const isOpen = useSearchOpen()
const router = useRouter()
const { user } = useUser()

type Kind = 'page' | 'project' | 'ticket'

interface Entry {
  id: string
  kind: Kind
  title: string
  meta: string
  icon: string
  to: string
}

/** Destinations. Curated, because a route list is not a menu — `/legal/terms` is a real route and not something to search for. */
const PAGES: Entry[] = [
  { id: 'p-dash', kind: 'page', title: 'Dashboard', meta: 'Balance, active work and expenses', icon: 'solar:widget-2-linear', to: '/dashboards/balance' },
  { id: 'p-new', kind: 'page', title: 'New order', meta: 'Start a project with 0% finance', icon: 'lucide:plus', to: '/dashboards/services' },
  { id: 'p-orders', kind: 'page', title: 'My orders', meta: 'Projects, milestones and payment plans', icon: 'solar:suitcase-linear', to: '/dashboards/orders' },
  { id: 'p-wallet', kind: 'page', title: 'Wallet & credit', meta: 'Balance, transactions, installments, receipts', icon: 'solar:wallet-2-linear', to: '/dashboards/wallet' },
  { id: 'p-support', kind: 'page', title: 'Support', meta: 'Tickets and help', icon: 'solar:headphones-round-linear', to: '/dashboards/support' },
  { id: 'p-settings', kind: 'page', title: 'Settings', meta: 'Profile, company, billing and password', icon: 'solar:settings-linear', to: '/dashboards/settings' },
]

const loaded = ref(false)
const loading = ref(false)
const records = ref<Entry[]>([])

/** First 8 hex of the UUID, uppercased — the reference format Support already shows customers. */
function ticketRef(id: string) {
  return `#${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

/**
 * Both endpoints are the customer's own, already `requireAuth`-scoped. A failure
 * leaves `records` empty rather than throwing: search still finds destinations,
 * which is strictly better than an error screen over the whole shell.
 */
async function loadIndex() {
  if (loaded.value || loading.value) {
    return
  }
  loading.value = true

  const [orders, tickets] = await Promise.allSettled([
    $fetch<{ data?: any[] }>('/api/orders'),
    $fetch<{ tickets?: any[] }>('/api/support/tickets'),
  ])

  const next: Entry[] = []

  if (orders.status === 'fulfilled') {
    for (const project of orders.value?.data ?? []) {
      next.push({
        id: `o-${project.id}`,
        kind: 'project',
        title: project.name,
        meta: [project.category, project.status].filter(Boolean).join(' · '),
        icon: 'lucide:package',
        to: `/dashboards/orders?project=${project.id}`,
      })
    }
  }

  if (tickets.status === 'fulfilled') {
    for (const ticket of tickets.value?.tickets ?? []) {
      next.push({
        id: `t-${ticket.id}`,
        kind: 'ticket',
        title: ticket.subject,
        meta: `Ticket ${ticketRef(ticket.id)}${ticket.status ? ` · ${ticket.status}` : ''}`,
        icon: 'lucide:life-buoy',
        to: `/dashboards/support?ticket=${ticket.id}`,
      })
    }
  }

  records.value = next
  loaded.value = true
  loading.value = false
}

/**
 * A computed, not a one-off `PAGES.push()`: `user` is hydrated by the auth
 * plugin at boot, so a push evaluated during setup can run before the role is
 * known and leave an admin without their own panel in search.
 */
const pages = computed<Entry[]>(() => (
  user.value?.role === 'ADMIN'
    ? [...PAGES, { id: 'p-admin', kind: 'page', title: 'Admin panel', meta: 'Staff tools', icon: 'lucide:shield-check', to: '/admin' }]
    : PAGES
))

const query = ref('')

/**
 * Title beats metadata, and within each, prefix beats word-start beats
 * substring. Zero means "not a match" and drops the row entirely — a search
 * that always returns something teaches customers to distrust it.
 */
function score(entry: Entry, needle: string) {
  const title = entry.title.toLowerCase()
  const meta = entry.meta.toLowerCase()

  if (title.startsWith(needle)) {
    return 6
  }
  if (new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(title)) {
    return 5
  }
  if (title.includes(needle)) {
    return 4
  }
  if (meta.startsWith(needle)) {
    return 3
  }
  if (meta.includes(needle)) {
    return 1
  }
  return 0
}

const GROUPS: { kind: Kind, label: string }[] = [
  { kind: 'page', label: 'Pages' },
  { kind: 'project', label: 'Projects' },
  { kind: 'ticket', label: 'Support' },
]

const results = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) {
    return []
  }

  return [...pages.value, ...records.value]
    .map(entry => ({ entry, rank: score(entry, needle) }))
    .filter(row => row.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.entry.title.localeCompare(b.entry.title))
    .map(row => row.entry)
    .slice(0, 12)
})

const grouped = computed(() =>
  GROUPS
    .map(group => ({ ...group, items: results.value.filter(entry => entry.kind === group.kind) }))
    .filter(group => group.items.length > 0),
)

/** Recents survive a reload; they are the customer's own navigation, not ours to invent. */
const recent = useLocalStorage<Entry[]>('apex:search:recent', [])

/** Flat, in render order, so the arrow keys walk exactly what the eye sees. */
const navigable = computed(() => (query.value.trim() ? grouped.value.flatMap(group => group.items) : recent.value))
const cursor = ref(0)

watch([query, isOpen], () => {
  cursor.value = 0
})

function select(entry: Entry) {
  recent.value = [entry, ...recent.value.filter(item => item.id !== entry.id)].slice(0, 5)
  isOpen.value = false
  query.value = ''
  router.push(entry.to)
}

function onArrow(delta: number) {
  const total = navigable.value.length
  if (total === 0) {
    return
  }
  cursor.value = (cursor.value + delta + total) % total
}

function onEnter() {
  const entry = navigable.value[cursor.value]
  if (entry) {
    select(entry)
  }
}

/**
 * reka focuses the first focusable child on open, which is the Back button.
 * The point of opening search is to type, so the focus goes to the field —
 * and on a phone that is also what raises the keyboard.
 */
const field = ref<HTMLInputElement | null>(null)
function focusField(event: Event) {
  event.preventDefault()
  nextTick(() => field.value?.focus())
}

watch(isOpen, (open) => {
  if (open) {
    loadIndex()
  }
  else {
    query.value = ''
  }
})

const ROW = 'apex-focus flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-start transition-colors'
const ROW_ACTIVE = 'bg-muted-100 dark:bg-muted-800'
</script>

<template>
  <DialogRoot v-model:open="isOpen">
    <DialogPortal>
      <!--
        No scrim below `lg`: the search *is* the screen there, so a translucent
        layer over a page nobody can reach only makes the text harder to read.
      -->
      <DialogOverlay class="apex-scrim-in fixed inset-0 z-[70] hidden bg-[rgba(3,10,12,.62)] lg:block" />

      <DialogContent
        class="dark:bg-muted-950 fixed inset-0 z-[71] flex flex-col bg-white focus:outline-none lg:inset-x-auto lg:inset-y-auto lg:start-1/2 lg:top-[10%] lg:h-auto lg:max-h-[80vh] lg:w-[90vw] lg:max-w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-muted-200 lg:shadow-2xl dark:lg:border-muted-800"
        @open-auto-focus="focusField"
      >
        <VisuallyHidden>
          <DialogTitle>Search Apex</DialogTitle>
          <DialogDescription>Find pages, projects and support tickets</DialogDescription>
        </VisuallyHidden>

        <!-- Field row. Safe-area inset on mobile only; the dialog never touches the notch. -->
        <div class="border-muted-200 dark:border-muted-800 flex shrink-0 items-center gap-2 border-b p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:pt-3">
          <!--
            Back, not a corner "✕": on a phone this reads as a screen, and the
            gesture a customer reaches for is the one that goes back. It is
            `lg:hidden` because the desktop dialog dismisses on the scrim.
          -->
          <DialogClose
            aria-label="Close search"
            class="apex-focus hover:bg-muted-100 dark:hover:bg-muted-800 text-muted-600 dark:text-muted-300 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors lg:hidden"
          >
            <Icon name="lucide:arrow-left" class="size-5" />
          </DialogClose>

          <div class="border-muted-200 dark:border-muted-700 dark:bg-muted-900 focus-within:border-primary-500 flex h-12 min-w-0 grow items-center gap-2.5 rounded-xl border bg-white px-3.5 transition-colors">
            <Icon name="lucide:search" class="text-muted-400 dark:text-muted-500 size-[18px] shrink-0" />
            <!--
              16px type is not a style choice: iOS Safari zooms the viewport when
              a field smaller than 16px takes focus, and the page never zooms
              back out. `text-base` is exactly 16px.
            -->
            <input
              ref="field"
              v-model="query"
              type="search"
              aria-label="Search projects, orders and tickets"
              placeholder="Search projects, orders, tickets"
              class="text-muted-900 placeholder:text-muted-400 dark:placeholder:text-muted-500 min-w-0 grow bg-transparent text-base outline-none dark:text-white"
              @keydown.down.prevent="onArrow(1)"
              @keydown.up.prevent="onArrow(-1)"
              @keydown.enter.prevent="onEnter"
            >
            <button
              v-if="query"
              type="button"
              aria-label="Clear search"
              class="apex-focus text-muted-400 hover:text-muted-700 dark:hover:text-muted-200 shrink-0 cursor-pointer rounded-md transition-colors"
              @click="query = ''; field?.focus()"
            >
              <Icon name="lucide:x" class="size-4" />
            </button>
          </div>
        </div>

        <div class="min-h-0 grow overflow-y-auto overscroll-contain p-3.5 lg:max-h-[60vh]">
          <!-- Nothing typed yet: recents, or an honest statement that there are none. -->
          <template v-if="!query.trim()">
            <div v-if="recent.length" class="flex flex-col gap-0.5">
              <p class="text-muted-500 mb-1.5 px-3 text-xs font-bold uppercase tracking-[0.06em]">
                Recent
              </p>
              <button
                v-for="(entry, index) in recent"
                :key="entry.id"
                type="button"
                class="min-h-[52px] text-[15px]" :class="[ROW, index === cursor ? ROW_ACTIVE : 'hover:bg-muted-100 dark:hover:bg-muted-800/70']"
                @click="select(entry)"
              >
                <Icon name="lucide:clock" class="text-muted-400 dark:text-muted-500 size-[17px] shrink-0" />
                <span class="text-muted-800 min-w-0 grow truncate dark:text-white">{{ entry.title }}</span>
              </button>
            </div>
            <p v-else class="text-muted-500 px-3 py-10 text-center text-[13.5px]">
              Search your projects, tickets and pages.
            </p>
          </template>

          <!-- Typing, index still in flight. A skeleton beats a premature "No results". -->
          <div v-else-if="loading && !loaded" class="flex flex-col gap-2">
            <div v-for="n in 3" :key="n" class="flex min-h-[60px] items-center gap-3 px-3">
              <BasePlaceload class="size-[38px] shrink-0 rounded-xl" />
              <div class="grow space-y-2">
                <BasePlaceload class="h-3 w-1/2 rounded" />
                <BasePlaceload class="h-2.5 w-1/3 rounded" />
              </div>
            </div>
          </div>

          <div v-else-if="grouped.length" class="flex flex-col gap-4">
            <div v-for="group in grouped" :key="group.kind" class="flex flex-col gap-0.5">
              <p class="text-muted-500 mb-1.5 px-3 text-xs font-bold uppercase tracking-[0.06em]">
                {{ group.label }}
              </p>
              <button
                v-for="entry in group.items"
                :key="entry.id"
                type="button"
                class="min-h-[60px] py-2" :class="[ROW, navigable[cursor]?.id === entry.id ? ROW_ACTIVE : 'hover:bg-muted-100 dark:hover:bg-muted-800/70']"
                @click="select(entry)"
              >
                <span class="border-muted-200 dark:border-muted-700 dark:bg-muted-800 text-muted-500 flex size-[38px] shrink-0 items-center justify-center rounded-xl border bg-white">
                  <Icon :name="entry.icon" class="size-[18px]" />
                </span>
                <span class="min-w-0 grow">
                  <span class="text-muted-900 block truncate text-[14.5px] font-semibold dark:text-white">{{ entry.title }}</span>
                  <span class="text-muted-500 mt-0.5 block truncate text-[12.5px]">{{ entry.meta }}</span>
                </span>
                <Icon name="lucide:chevron-right" class="text-muted-400 dark:text-muted-500 size-4 shrink-0" />
              </button>
            </div>
          </div>

          <p v-else class="text-muted-500 px-3 py-10 text-center text-[13.5px]">
            Nothing matches “{{ query.trim() }}”.
          </p>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
