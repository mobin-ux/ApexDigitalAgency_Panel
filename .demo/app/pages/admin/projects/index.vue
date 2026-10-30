<script setup lang="ts">
/**
 * Admin — Orders (V2 Phase 9 — Overview & work, badges 4 and 5).
 *
 * The projects directory, rebuilt as the design's queue:
 *
 * - **Filters and a total, not a pager** (badge 4). Stage tabs carry live
 *   counts of the whole directory, search covers name, reference and
 *   client, and the footer states how many of how many are on screen. The
 *   pager only appears if the directory ever outgrows a page, because a
 *   "1–10 of 62 · Next" control at this scale is three clicks to find a
 *   project and a query for nothing.
 * - **Enums are mapped and blanks are words** (badge 5). `IN_PROGRESS`
 *   reads "In progress"; a project nobody owns reads "Unassigned" in
 *   amber rather than an empty cell, which is indistinguishable from a
 *   loading failure.
 * - **Bulk assign.** Selecting rows and assigning one owner is the action
 *   the queue exists to make quick. Each project is PATCHed through the
 *   endpoint that already audits the change, so the trail records who
 *   moved what — no second, unaudited path for the same edit.
 */
import { isStaffRole, ROLES } from '~~/shared/permissions'
import { orderRef } from '~~/shared/refs'
import { ADMIN_INPUT, ADMIN_LABEL, ADMIN_TH } from '~/utils/adminUi'

definePageMeta({
  title: 'Projects',
  layout: 'admin',
  middleware: 'admin',
})

const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()
const route = useRoute()
const { can } = useStaffAccess()

// --- Filters ---
const search = ref('')
const debouncedSearch = ref('')
const status = ref<string>(typeof route.query.status === 'string' ? route.query.status : '')
const category = ref<string>('')
const userId = ref<string>(typeof route.query.userId === 'string' ? route.query.userId : '')
const page = ref(1)

watchDebounced(search, (value) => {
  debouncedSearch.value = value.trim()
}, { debounce: 300 })

watch([debouncedSearch, status, category], () => {
  page.value = 1
})

/*
 * 100 is the endpoint's ceiling and comfortably past the scale the design
 * is drawn for (~62 projects), so in practice this is the whole directory
 * on one screen — which is the point of badge 4. The pager below stays,
 * because "in practice" is not "always".
 */
const query = computed(() => ({
  page: page.value,
  pageSize: 100,
  ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
  ...(status.value ? { status: status.value } : {}),
  ...(category.value ? { category: category.value } : {}),
  ...(userId.value ? { userId: userId.value } : {}),
}))

const { data, pending, refresh } = await useFetch('/api/admin/projects', { query })

const projects = computed(() => data.value?.items ?? [])
const categories = computed(() => data.value?.categories ?? [])
const canMoney = computed(() => Boolean(data.value?.canMoney))

/** Badge 5: the enum, in words, once — the chip and the filter read the same map. */
const STAGES = [
  { key: 'PENDING', label: 'Awaiting kickoff', tone: 'warning' },
  { key: 'IN_PROGRESS', label: 'In progress', tone: 'success' },
  // Panel v2: the client is reviewing work (approvals, a direction to choose).
  { key: 'IN_REVIEW', label: 'In review', tone: 'info' },
  { key: 'COMPLETED', label: 'Delivered', tone: 'violet' },
  { key: 'CANCELLED', label: 'Cancelled', tone: 'danger' },
] as const

function stageOf(key: string) {
  return STAGES.find(s => s.key === key) ?? { key, label: key, tone: 'neutral' as const }
}

const tabs = computed(() => {
  const counts = data.value?.statusCounts ?? {}
  return [
    { key: '', label: 'All', count: data.value?.allCount ?? 0 },
    ...STAGES.map(s => ({ key: s.key, label: s.label, count: counts[s.key] ?? 0 })),
  ]
})

const headline = computed(() => {
  const d = data.value
  if (!d) {
    return 'Every project on the platform.'
  }
  const active = d.statusCounts?.IN_PROGRESS ?? 0
  return `${d.allCount} on the books · ${active} active · ${d.unassigned} unassigned`
})

const footer = computed(() => {
  const d = data.value
  if (!d) {
    return ''
  }
  const scope = d.total === d.allCount ? '' : ` of ${d.allCount}`
  const matching = debouncedSearch.value ? ` matching “${debouncedSearch.value}”` : ''
  return `Showing ${projects.value.length} project${projects.value.length === 1 ? '' : 's'}${scope}${matching}.`
})

function personName(u: { firstName?: string | null, lastName?: string | null, email?: string | null } | null | undefined) {
  if (!u) {
    return null
  }
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || null
}

/** The staff role's own label, or Employee for the assignment-only enum. */
function staffLabel(s: { staffRole?: string | null }) {
  return isStaffRole(s.staffRole) ? ROLES[s.staffRole].label : 'Employee'
}

function relTime(iso: string | Date) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 60) {
    return mins <= 1 ? 'just now' : `${mins}m ago`
  }
  const hours = Math.round(mins / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }
  const days = Math.round(hours / 24)
  if (days < 14) {
    return `${days}d ago`
  }
  return `${Math.round(days / 7)}w ago`
}

// --- Selection & bulk assign -------------------------------------------
const selected = ref<Set<string>>(new Set())
const selectedCount = computed(() => selected.value.size)

function toggleSelect(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) {
    next.delete(id)
  }
  else {
    next.add(id)
  }
  selected.value = next
}
function clearSelection() {
  selected.value = new Set()
}
// A selection that survives a filter change would assign projects the
// operator can no longer see.
watch([debouncedSearch, status, category], clearSelection)

const showAssign = ref(false)
const assigning = ref(false)
const assignable = computed(() => data.value?.assignable ?? [])

async function assignTo(staffId: string | null) {
  if (assigning.value || selected.value.size === 0) {
    return
  }
  assigning.value = true
  const ids = [...selected.value]
  try {
    const results = await Promise.allSettled(
      ids.map(id => $fetch(`/api/admin/projects/${id}`, { method: 'PATCH', body: { managerId: staffId } })),
    )
    const failed = results.filter(r => r.status === 'rejected').length
    const done = ids.length - failed
    const who = staffId ? (personName(assignable.value.find(s => s.id === staffId)) ?? 'the selected member') : 'nobody'
    if (done > 0) {
      toaster.add({
        title: `${done} project${done === 1 ? '' : 's'} assigned`,
        description: staffId ? `Now owned by ${who}.` : 'Owner cleared.',
        icon: 'lucide:check',
        progress: true,
      })
    }
    // Report the failures rather than a clean success over a partial write.
    if (failed > 0) {
      toaster.add({
        title: `${failed} could not be assigned`,
        description: 'They were left unchanged. Try again, or open them individually.',
        icon: 'lucide:alert-triangle',
        progress: true,
      })
    }
    showAssign.value = false
    clearSelection()
    await refresh()
  }
  finally {
    assigning.value = false
  }
}

// --- Create project modal ---
const showCreate = ref(false)
const creating = ref(false)
const form = reactive({ name: '', category: 'Web Development', amount: null as number | null, status: 'PENDING', deadline: '' })

// Owner picker: search customers by email/name.
const ownerSearch = ref('')
const selectedOwner = ref<{ id: string, email: string, firstName?: string | null, lastName?: string | null, avatar?: string | null } | null>(null)
const ownerQuery = computed(() => ({ page: 1, pageSize: 6, ...(ownerSearch.value.trim() ? { search: ownerSearch.value.trim() } : {}) }))
const { data: ownerResults } = await useFetch('/api/admin/users', {
  query: ownerQuery,
  immediate: false,
  watch: [ownerQuery],
})
const ownerOptions = computed(() => (ownerResults.value?.items ?? []).filter(u => u.id !== selectedOwner.value?.id))

function openCreate() {
  Object.assign(form, { name: '', category: categories.value[0] ?? 'Web Development', amount: null, status: 'PENDING', deadline: '' })
  ownerSearch.value = ''
  selectedOwner.value = null
  showCreate.value = true
}

async function createProject() {
  if (creating.value || !selectedOwner.value)
    return
  creating.value = true
  try {
    const created = await $fetch('/api/admin/projects', {
      method: 'POST',
      body: {
        userId: selectedOwner.value.id,
        name: form.name,
        category: form.category,
        amount: form.amount ?? 0,
        status: form.status,
        deadline: form.deadline || null,
      },
    })
    toaster.add({ title: 'Project created', description: `${created.name} for ${selectedOwner.value.email}.`, icon: 'lucide:check', progress: true })
    showCreate.value = false
    await refresh()
  }
  catch (error: any) {
    const fieldErrors = error?.data?.data?.fieldErrors as Record<string, string[]> | undefined
    const firstFieldError = fieldErrors ? Object.values(fieldErrors)[0]?.[0] : undefined
    toaster.add({ title: 'Could not create the project', description: firstFieldError || error?.data?.message || 'Please check the details and try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    creating.value = false
  }
}

/** Ref · Project · Service · Stage · Owner · Updated · Plan value, as the design lays the table out (literal strings so Tailwind sees them). */
const GRID = computed(() => {
  const select = can('work.assign')
  if (canMoney.value) {
    return select ? 'xl:grid-cols-[18px_96px_minmax(0,1fr)_140px_150px_130px_72px_100px]' : 'xl:grid-cols-[96px_minmax(0,1fr)_140px_150px_130px_72px_100px]'
  }
  return select ? 'xl:grid-cols-[18px_96px_minmax(0,1fr)_140px_150px_130px_72px]' : 'xl:grid-cols-[96px_minmax(0,1fr)_140px_150px_130px_72px]'
})
const PILL = 'apex-ring inline-flex h-8 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-full border px-[13px] text-[13px]'
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="Client" accent="projects" :subtitle="`Every order placed through the portal. Stage names match what the client sees in My orders. ${headline}`">
      <AdminButton v-if="can('work.assign')" variant="primary" @click="openCreate">
        <Icon name="lucide:plus" class="size-[15px]" />New order for a client
      </AdminButton>
    </AdminPageHeader>

    <!-- Owner filter notice (arrived via ?userId= from a client record). -->
    <div v-if="userId" class="bg-accent-tint text-fg-heading flex items-center gap-3 rounded-xl px-4 py-3 text-[13.5px]">
      <Icon name="lucide:filter" class="text-accent-ink size-4 shrink-0" />
      Showing projects for one client only.
      <button type="button" class="apex-ring text-accent-ink ms-auto inline-flex items-center gap-1.5 rounded font-semibold" @click="userId = ''">
        Clear <Icon name="lucide:x" class="size-3.5" />
      </button>
    </div>

    <!-- Stage filters with live counts, then search and the service filter. -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex flex-wrap gap-2" role="group" aria-label="Filter by stage">
        <button
          v-for="t in tabs" :key="t.key || 'all'" type="button" :aria-pressed="status === t.key"
          :class="[PILL, status === t.key ? 'bg-accent border-transparent font-semibold text-white' : 'border-line-subtle text-fg-heading hover:bg-hover font-medium']"
          @click="status = t.key"
        >
          {{ t.label }} <span class="tabular-nums opacity-70">{{ t.count }}</span>
        </button>
      </div>
      <span class="hidden flex-1 xl:block" />
      <div class="flex w-full flex-wrap gap-2 xl:w-auto">
        <input v-model="search" type="search" placeholder="Search project, client or ref" aria-label="Search projects" :class="ADMIN_INPUT" class="h-9! min-w-0 flex-1 xl:w-[260px]! xl:flex-none">
        <div class="w-full sm:w-[200px]">
          <!-- "All services" is the placeholder, not an item: reka throws on a SelectItem whose value is empty. -->
          <BaseSelect v-model="category" rounded="lg" size="sm" aria-label="Filter by service" placeholder="All services">
            <BaseSelectItem v-for="c in categories" :key="c" :value="c">
              {{ c }}
            </BaseSelectItem>
          </BaseSelect>
        </div>
      </div>
    </div>
    <div v-if="category || (selectedCount && can('work.assign'))" class="text-fg-muted -mt-2 flex flex-wrap items-center gap-2.5 text-[13px]">
      <template v-if="category">
        <span>Service: <strong class="text-fg-heading font-semibold">{{ category }}</strong></span>
        <button type="button" class="apex-ring text-accent-ink rounded font-semibold" @click="category = ''">
          Show all services
        </button>
      </template>
      <template v-if="selectedCount && can('work.assign')">
        <span class="text-fg-heading font-semibold">{{ selectedCount }} selected</span>
        <AdminButton size="sm" @click="showAssign = true">
          <Icon name="lucide:user-plus" class="size-3.5" />Assign owner
        </AdminButton>
        <button type="button" class="apex-ring text-accent-ink rounded font-semibold" @click="clearSelection">
          Clear selection
        </button>
      </template>
    </div>

    <section class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
      <div :class="[GRID, ADMIN_TH]" class="hidden px-[22px] py-3.5 xl:grid">
        <span v-if="can('work.assign')" /><span>Ref</span><span>Project</span><span>Service</span><span>Stage</span><span>Owner</span><span class="text-end">Updated</span><span v-if="canMoney" class="text-end">Plan value</span>
      </div>

      <div v-if="pending" aria-hidden="true">
        <div v-for="i in 6" :key="i" class="border-line-soft h-[62px] animate-pulse border-t" />
      </div>

      <ul v-else-if="projects.length">
        <li
          v-for="p in projects" :key="p.id"
          class="border-line-soft relative flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t px-[18px] py-3 sm:px-[22px] xl:grid"
          :class="[GRID, selected.has(p.id) ? 'bg-accent-tint' : 'hover:bg-raised']"
        >
          <button
            v-if="can('work.assign')"
            type="button"
            role="checkbox"
            :aria-checked="selected.has(p.id)"
            :aria-label="`Select ${p.name}`"
            class="apex-ring apex-tap relative z-10 flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border"
            :class="selected.has(p.id) ? 'bg-accent border-transparent text-white' : 'border-line-strong'"
            @click="toggleSelect(p.id)"
          >
            <Icon v-if="selected.has(p.id)" name="lucide:check" class="size-3" />
          </button>
          <span class="text-fg-muted hidden font-mono text-[12.5px] xl:block">{{ orderRef(p.id) }}</span>
          <NuxtLink :to="`/admin/projects/${p.id}`" class="apex-ring min-w-0 flex-1 basis-[180px] rounded-lg after:absolute after:inset-0">
            <span class="text-fg-heading block truncate text-sm font-semibold">{{ p.name }}</span>
            <span class="text-fg-muted mt-0.5 block truncate text-[12.5px]">{{ personName(p.user) ?? 'No client' }}<span class="xl:hidden"> · {{ orderRef(p.id) }}</span></span>
          </NuxtLink>
          <span class="text-fg-body hidden truncate text-[13px] xl:block">{{ p.category }}</span>
          <AdminStatusChip :tone="stageOf(p.status).tone" :label="stageOf(p.status).label" />
          <span class="min-w-0 basis-full truncate text-[13px] xl:basis-auto" :class="p.manager ? 'text-fg-body' : 'text-st-warning-fg font-semibold'">
            <span class="text-fg-muted font-normal xl:hidden">Owner: </span>{{ personName(p.manager) ?? 'Unassigned' }}
          </span>
          <span class="text-fg-muted hidden text-end text-[12.5px] tabular-nums xl:block"><ClientOnly>{{ relTime(p.updatedAt) }}</ClientOnly></span>
          <span v-if="canMoney" class="text-fg-heading hidden text-end text-[13.5px] tabular-nums xl:block">{{ formatCurrency(p.amount ?? 0) }}</span>
        </li>
      </ul>

      <div v-else class="border-line-soft border-t px-6 py-11 text-center">
        <div class="font-heading text-fg-heading text-[17px] font-bold">
          {{ status ? 'Nothing in this stage' : 'No projects match' }}
        </div>
        <p class="text-fg-body mx-auto mt-2 max-w-[420px] text-[13.5px] leading-[1.55]">
          {{ debouncedSearch ? `Nothing matches “${debouncedSearch}”. Clear the search or pick another stage.` : 'Projects move here as their stage changes.' }}
        </p>
      </div>

      <div v-if="footer" class="border-line-soft text-fg-muted border-t px-[22px] py-[13px] text-[12.5px]">
        {{ footer }}
      </div>
    </section>

    <!-- 100 rows is the endpoint's ceiling; past it the pager has to exist rather than truncate. -->
    <AdminPager
      v-if="data && data.pageCount > 1" :page="data.page" :page-count="data.pageCount" :total="data.total" noun="projects"
      @update:page="page = $event"
    />

    <AdminDialog v-model:open="showAssign" :title="`Assign ${selectedCount} project${selectedCount === 1 ? '' : 's'}`" description="Only staff whose role can own project work are listed. Each change is recorded in the audit log.">
      <div class="flex flex-col gap-0.5 pb-2">
        <button
          v-for="s in assignable" :key="s.id" type="button" :disabled="assigning"
          class="apex-ring hover:bg-raised flex min-h-14 items-center gap-3 rounded-xl px-3 text-start disabled:opacity-60"
          @click="assignTo(s.id)"
        >
          <ApexPanelAvatar :person="s" :size="34" />
          <span class="min-w-0 flex-1">
            <span class="text-fg-heading block truncate text-sm font-semibold">{{ personName(s) }}</span>
            <span class="text-fg-muted mt-0.5 block truncate text-[12.5px]">{{ staffLabel(s) }} · {{ s.load }} project{{ s.load === 1 ? '' : 's' }}</span>
          </span>
        </button>
        <p v-if="!assignable.length" class="text-fg-body px-3 py-6 text-center text-[13.5px]">
          No staff account currently holds the permission to own project work.
        </p>
      </div>
      <template #actions>
        <AdminButton :disabled="assigning" @click="assignTo(null)">
          Clear owner
        </AdminButton>
        <AdminButton variant="primary" @click="showAssign = false">
          Done
        </AdminButton>
      </template>
    </AdminDialog>

    <AdminDialog v-model:open="showCreate" title="New order for a client" description="Created on their behalf, with the standard milestone timeline. Nothing is charged.">
      <form id="new-order" class="flex flex-col gap-3.5 pb-1" @submit.prevent="createProject">
        <div>
          <label for="np-owner" :class="ADMIN_LABEL">Client</label>
          <div v-if="selectedOwner" class="bg-accent-tint flex items-center gap-3 rounded-xl px-3.5 py-2.5">
            <div class="min-w-0 flex-1">
              <AdminUserCell :user="selectedOwner" />
            </div>
            <button type="button" class="apex-ring text-accent-ink rounded text-[12.5px] font-semibold" @click="selectedOwner = null">
              Change
            </button>
          </div>
          <template v-else>
            <input id="np-owner" v-model="ownerSearch" type="search" placeholder="Search by name or email" :class="ADMIN_INPUT">
            <ul v-if="ownerSearch.trim() && ownerOptions.length" class="border-line-subtle mt-2 overflow-hidden rounded-xl border">
              <li v-for="u in ownerOptions" :key="u.id" class="border-line-soft border-t first:border-t-0">
                <button type="button" class="apex-ring hover:bg-raised flex w-full items-center gap-3 px-3.5 py-2.5 text-start" @click="selectedOwner = u">
                  <span class="min-w-0 flex-1"><AdminUserCell :user="u" /></span>
                  <Icon name="lucide:plus" class="text-fg-muted size-4 shrink-0" />
                </button>
              </li>
            </ul>
          </template>
        </div>
        <div>
          <label for="np-name" :class="ADMIN_LABEL">Project name</label>
          <input id="np-name" v-model="form.name" required :class="ADMIN_INPUT">
        </div>
        <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label for="np-category" :class="ADMIN_LABEL">Service</label>
            <input id="np-category" v-model="form.category" required list="np-category-options" :class="ADMIN_INPUT">
            <datalist id="np-category-options">
              <option v-for="c in categories" :key="c" :value="c" />
            </datalist>
          </div>
          <div>
            <label for="np-amount" :class="ADMIN_LABEL">Contract value (GBP)</label>
            <input id="np-amount" v-model.number="form.amount" type="number" min="0" step="0.01" placeholder="0.00" :class="ADMIN_INPUT">
          </div>
          <div>
            <span :class="ADMIN_LABEL">Stage</span>
            <BaseSelect v-model="form.status" rounded="lg" aria-label="Stage">
              <BaseSelectItem value="PENDING">
                Awaiting kickoff
              </BaseSelectItem>
              <BaseSelectItem value="IN_PROGRESS">
                In progress
              </BaseSelectItem>
            </BaseSelect>
          </div>
          <div>
            <label for="np-deadline" :class="ADMIN_LABEL">Deadline <span class="text-fg-muted font-normal">(optional)</span></label>
            <input id="np-deadline" v-model="form.deadline" type="date" :class="ADMIN_INPUT">
          </div>
        </div>
      </form>
      <template #actions>
        <AdminButton @click="showCreate = false">
          Cancel
        </AdminButton>
        <AdminButton type="submit" form="new-order" variant="primary" :disabled="creating || !selectedOwner || !form.name.trim()">
          <Icon name="lucide:plus" class="size-[15px]" />Create order
        </AdminButton>
      </template>
    </AdminDialog>
  </AdminPage>
</template>
