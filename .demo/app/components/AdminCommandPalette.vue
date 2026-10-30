<script setup lang="ts">
import { orderRef } from '~~/shared/refs'
import { ADMIN_NAV_ITEMS } from '~/utils/adminNav'

/**
 * The console's ⌘K search (`Admin Console.dc.html`): one field over the
 * console's destinations and the records behind them — clients, projects
 * and website documents. Each record kind is searched only when the role
 * can read it, through the list endpoints the screens already use, so the
 * palette can never show a row whose screen would 403. A destination the
 * role cannot open is still listed, with a padlock, because the access
 * wall it leads to says who can.
 */
const { open, hide } = useAdminPalette()
const { can } = useStaffAccess()
const router = useRouter()

const query = ref('')
const active = ref(0)
const records = ref<Row[]>([])
const loading = ref(false)

interface Row {
  id: string
  label: string
  kind: string
  icon: string
  to: string
  locked: boolean
}

const destinations = computed<Row[]>(() => ADMIN_NAV_ITEMS.map(item => ({
  id: `nav-${item.key}`,
  label: item.label,
  kind: 'Go to',
  icon: item.icon,
  to: item.to,
  locked: Boolean(item.needs) && !can(item.needs!),
})))

const results = computed<Row[]>(() => {
  const q = query.value.trim().toLowerCase()
  const nav = q ? destinations.value.filter(r => r.label.toLowerCase().includes(q)) : destinations.value.slice(0, 8)
  return [...nav, ...records.value].slice(0, 14)
})

function name(u: { firstName?: string | null, lastName?: string | null, email?: string | null } | null | undefined) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.email || 'Client'
}

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
watch(query, (q) => {
  active.value = 0
  clearTimeout(timer)
  const term = q.trim()
  if (term.length < 2) {
    records.value = []
    return
  }
  timer = setTimeout(() => search(term), 180)
})

async function search(term: string) {
  const mine = ++seq
  loading.value = true
  const jobs: Promise<Row[]>[] = []
  if (can('work.view')) {
    jobs.push($fetch<{ items: any[] }>('/api/admin/users', { query: { search: term, pageSize: 5 } }).then(r => r.items.map(u => ({
      id: `u-${u.id}`,
      label: [name(u), u.company?.name].filter(Boolean).join(' · '),
      kind: 'Client',
      icon: 'solar:user-linear',
      to: `/admin/users/${u.id}`,
      locked: false,
    }))))
    jobs.push($fetch<{ items: any[] }>('/api/admin/projects', { query: { search: term, pageSize: 5 } }).then(r => r.items.map(p => ({
      id: `p-${p.id}`,
      label: `${orderRef(p.id)} · ${p.name} · ${name(p.user)}`,
      kind: 'Project',
      icon: 'solar:suitcase-linear',
      to: `/admin/projects/${p.id}`,
      locked: false,
    }))))
  }
  if (can('website.view')) {
    jobs.push($fetch<{ items: any[] }>('/api/admin/website/documents', { query: { q: term, pageSize: 5 } }).then(r => r.items.map(d => ({
      id: `d-${d.id}`,
      label: `${d.title}  ${d.path ?? d.key}`,
      kind: d.template === 'article' ? 'Article' : d.template === 'case-study' ? 'Case study' : 'Page',
      icon: 'solar:document-text-linear',
      to: `/admin/website/pages/${d.id}`,
      locked: false,
    }))))
  }
  const settled = await Promise.allSettled(jobs)
  if (mine !== seq) {
    return
  }
  records.value = settled.flatMap(s => (s.status === 'fulfilled' ? s.value : []))
  loading.value = false
}

function go(row: Row | undefined) {
  if (!row) {
    return
  }
  hide()
  router.push(row.to)
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    active.value = Math.min(results.value.length - 1, active.value + 1)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    active.value = Math.max(0, active.value - 1)
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    go(results.value[active.value])
  }
}

watch(open, (value) => {
  if (value) {
    query.value = ''
    records.value = []
  }
})

if (import.meta.client) {
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      open.value = !open.value
    }
  })
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="apex-scrim-in fixed inset-0 z-[90] bg-[rgba(3,10,12,.5)]" />
      <DialogContent
        class="apex-rise-in border-line-strong bg-card fixed left-1/2 top-4 z-[91] w-[calc(100%-2rem)] max-w-[620px] -translate-x-1/2 overflow-hidden rounded-2xl border shadow-[0_40px_90px_rgba(17,31,34,.4)] focus:outline-none md:top-24"
        @keydown="onKey"
      >
        <DialogTitle class="sr-only">
          Search the admin console
        </DialogTitle>
        <DialogDescription class="sr-only">
          Clients, projects, website pages and every screen in the console.
        </DialogDescription>
        <div class="border-line-subtle flex h-[54px] items-center gap-2.5 border-b px-4">
          <Icon name="lucide:search" class="text-fg-muted size-[17px] shrink-0" />
          <input
            v-model="query"
            type="search"
            aria-label="Search"
            placeholder="Search clients, projects, pages…"
            class="text-fg-heading h-full min-w-0 flex-1 border-0 bg-transparent text-base outline-0 placeholder:text-fg-muted md:text-[15px]"
          >
          <span class="border-line-subtle text-fg-muted rounded-md border px-1.5 py-0.5 text-[11px] font-semibold">Esc</span>
        </div>
        <div role="listbox" aria-label="Results" class="max-h-[min(400px,60dvh)] overflow-y-auto p-2">
          <button
            v-for="(row, i) in results"
            :key="row.id"
            type="button"
            role="option"
            :aria-selected="i === active"
            class="flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-start"
            :class="i === active ? 'bg-raised' : 'hover:bg-raised'"
            @mouseenter="active = i"
            @click="go(row)"
          >
            <Icon :name="row.icon" class="text-fg-muted size-[17px] shrink-0" />
            <span class="text-fg-heading min-w-0 flex-1 truncate text-sm">{{ row.label }}</span>
            <span class="text-fg-muted shrink-0 text-xs">{{ row.kind }}</span>
            <Icon v-if="row.locked" name="lucide:lock" class="text-fg-muted size-[13px] shrink-0" aria-label="Locked for your role" />
          </button>
          <p v-if="!results.length && !loading" class="text-fg-muted px-3 py-[22px] text-sm">
            No matches. Try a client name, a page path such as /about, or a project reference.
          </p>
          <p v-if="loading" class="text-fg-muted px-3 py-2 text-xs" aria-live="polite">
            Searching records…
          </p>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
