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

definePageMeta({
  title: 'Orders',
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

/** Badge 5: the enum, in words, once — the chip and the tab read the same map. */
const STAGES = [
  { key: 'PENDING', label: 'Awaiting kickoff', chip: 'bg-[#D9A521]/16 text-[#F2C14E]' },
  { key: 'IN_PROGRESS', label: 'In progress', chip: 'bg-primary-500/14 text-primary-400' },
  { key: 'COMPLETED', label: 'Completed', chip: 'bg-[#22B07D]/14 text-[#22B07D]' },
  { key: 'CANCELLED', label: 'Cancelled', chip: 'bg-[#EC6453]/16 text-[#EC6453]' },
] as const

function stageOf(key: string) {
  return STAGES.find(s => s.key === key) ?? { key, label: key, chip: 'bg-muted-200 text-muted-600 dark:bg-white/5 dark:text-muted-400' }
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

/** APX order reference — same convention as the customer My Orders page. */
function shortRef(id: string) {
  return `APX-${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`
}

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

const CATEGORY_ICON: Record<string, string> = {
  'Web Development': 'lucide:code-2',
  'Graphic Design': 'lucide:paintbrush',
  'Digital Marketing': 'lucide:megaphone',
  'UI/UX Design': 'lucide:layout-dashboard',
  'Branding': 'lucide:sparkles',
}
function categoryIcon(c: string) {
  return CATEGORY_ICON[c] ?? 'lucide:folder'
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

const inputClass = 'w-full rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-3 text-sm text-muted-900 outline-none placeholder:text-muted-400 focus:border-primary-400 sm:py-2.5 dark:border-white/8 dark:bg-muted-700 dark:text-white dark:placeholder:text-muted-500'
const labelClass = 'mb-2 block text-[12.5px] font-semibold text-muted-900 dark:text-white'
const TAB_BASE = 'apex-focus inline-flex min-h-[38px] cursor-pointer items-center rounded-full border px-3.5 text-[13.5px] transition'
const TAB_ON = 'border-primary-500 bg-primary-500 font-bold text-white'
const TAB_OFF = 'border-muted-200 bg-white font-semibold text-muted-600 hover:bg-muted-100 dark:border-white/10 dark:bg-muted-800 dark:text-muted-300 dark:hover:bg-white/6'
const CELL = 'shrink-0 truncate text-[13px]'
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-5 pb-8 font-sans">
    <AdminPageHeader dense title="Orders" :subtitle="headline">
      <BaseButton v-if="can('work.assign')" rounded="full" variant="primary" @click="openCreate">
        <Icon name="lucide:plus" class="size-4" />
        <span>New order for a client</span>
      </BaseButton>
    </AdminPageHeader>

    <!-- owner filter notice (arrived via ?userId= deep link) -->
    <div v-if="userId" class="border-primary-500/30 bg-primary-500/10 text-primary-700 dark:text-primary-200 flex items-center gap-3 rounded-xl border px-4 py-3 text-[13px]">
      <Icon name="lucide:filter" class="size-4 shrink-0" />
      Showing projects for one client only.
      <button type="button" class="apex-focus ms-auto inline-flex items-center gap-1.5 font-semibold text-muted-900 hover:underline dark:text-white" @click="userId = ''">
        Clear <Icon name="lucide:x" class="size-3.5" />
      </button>
    </div>

    <!-- ========== SEARCH + STAGE TABS (badge 4) ========== -->
    <div class="flex flex-col gap-3">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-[1.8fr_1fr]">
        <label class="focus-within:border-primary-400 flex items-center gap-2.5 rounded-xl border border-muted-200 bg-white px-3.5 py-2.5 dark:border-white/10 dark:bg-muted-800">
          <Icon name="lucide:search" class="size-4 shrink-0 text-muted-400 dark:text-muted-500" />
          <input v-model="search" placeholder="Search projects, clients, refs…" aria-label="Search projects" class="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-muted-900 outline-none placeholder:text-muted-400 dark:text-white dark:placeholder:text-muted-500">
        </label>
        <!--
          "All services" is the placeholder, not an item. reka reserves the
          empty string for "no selection" and throws on a `SelectItem` whose
          value is empty — the same trap Phase 7 documented. Clearing the
          filter therefore means setting the model back to '', which is what
          the reset row below does.
        -->
        <BaseSelect v-model="category" rounded="lg" aria-label="Filter by service" placeholder="All services">
          <BaseSelectItem v-for="c in categories" :key="c" :value="c">
            {{ c }}
          </BaseSelectItem>
        </BaseSelect>
      </div>

      <div v-if="category" class="flex items-center gap-2 text-[12.5px] text-muted-500">
        <span>Filtered to <strong class="font-semibold text-muted-900 dark:text-white">{{ category }}</strong>.</span>
        <button type="button" class="apex-focus inline-flex items-center gap-1 rounded font-semibold text-primary-500 hover:underline dark:text-primary-400" @click="category = ''">
          Show all services
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="t in tabs" :key="t.key || 'all'"
          type="button"
          :aria-pressed="status === t.key"
          :class="[TAB_BASE, status === t.key ? TAB_ON : TAB_OFF]"
          @click="status = t.key"
        >
          {{ t.label }}
          <span
            class="ms-2 rounded-full px-[7px] py-px text-[11px] font-bold tabular-nums"
            :class="status === t.key ? 'bg-white/20 text-white' : 'bg-muted-100 text-muted-500 dark:bg-white/6'"
          >{{ t.count }}</span>
        </button>

        <span class="grow" />

        <!-- Selection actions replace nothing; they appear beside the tabs. -->
        <template v-if="selectedCount && can('work.assign')">
          <span class="text-[13px] text-muted-600 dark:text-muted-300">{{ selectedCount }} selected</span>
          <BaseButton size="sm" rounded="lg" @click="showAssign = true">
            <Icon name="lucide:user-plus" class="size-4" />Assign
          </BaseButton>
          <BaseButton size="sm" rounded="lg" variant="ghost" @click="clearSelection">
            Clear
          </BaseButton>
        </template>
      </div>
    </div>

    <!-- ========== TABLE ========== -->
    <div v-if="pending" class="flex flex-col gap-2" aria-hidden="true">
      <div v-for="i in 6" :key="i" class="h-[62px] animate-pulse rounded-2xl border border-muted-200 bg-muted-100 dark:border-white/5 dark:bg-muted-800/60" />
    </div>

    <div v-else-if="projects.length" class="overflow-hidden rounded-2xl border border-muted-200 bg-white dark:border-white/10 dark:bg-muted-800">
      <!-- Column headings only where the columns themselves survive. -->
      <div class="hidden items-center gap-3.5 border-b border-muted-200 bg-muted-50 px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-500 xl:flex dark:border-white/10 dark:bg-white/2">
        <span v-if="can('work.assign')" class="w-[18px] shrink-0" />
        <span class="min-w-0 flex-1">Project</span>
        <span class="w-[140px] shrink-0">Client</span>
        <span class="w-[130px] shrink-0">Service</span>
        <span class="w-[132px] shrink-0">Stage</span>
        <span class="w-[110px] shrink-0">Owner</span>
        <span class="w-[100px] shrink-0 text-end">Value</span>
        <span class="w-[84px] shrink-0 text-end">Updated</span>
      </div>

      <div
        v-for="(p, index) in projects" :key="p.id"
        class="flex flex-wrap items-center gap-3.5 px-4 py-3 transition xl:min-h-[62px] xl:flex-nowrap"
        :class="[
          index < projects.length - 1 ? 'border-b border-muted-200 dark:border-white/5' : '',
          selected.has(p.id) ? 'bg-primary-500/6' : 'hover:bg-muted-50 dark:hover:bg-white/2',
        ]"
      >
        <button
          v-if="can('work.assign')"
          type="button"
          role="checkbox"
          :aria-checked="selected.has(p.id)"
          :aria-label="`Select ${p.name}`"
          class="apex-focus flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border transition"
          :class="selected.has(p.id) ? 'border-primary-500 bg-primary-500 text-white' : 'border-muted-300 dark:border-white/20'"
          @click="toggleSelect(p.id)"
        >
          <Icon v-if="selected.has(p.id)" name="lucide:check" class="size-3" />
        </button>

        <NuxtLink :to="`/admin/projects/${p.id}`" class="apex-focus flex min-w-0 flex-1 basis-[220px] items-center gap-3 rounded-lg">
          <span class="bg-primary-500/14 text-primary-400 flex size-8 shrink-0 items-center justify-center rounded-[9px]">
            <Icon :name="categoryIcon(p.category)" class="size-[17px]" />
          </span>
          <span class="min-w-0">
            <span class="block truncate text-[14.5px] font-semibold text-muted-900 dark:text-white">{{ p.name }}</span>
            <span class="mt-[3px] block truncate font-mono text-[11.5px] text-muted-500">{{ shortRef(p.id) }}</span>
          </span>
        </NuxtLink>

        <span :class="CELL" class="w-[140px] text-muted-600 dark:text-muted-300">{{ personName(p.user) ?? '—' }}</span>
        <span :class="CELL" class="w-[130px] text-muted-500">{{ p.category }}</span>
        <span class="w-[132px] shrink-0">
          <span
            class="inline-flex items-center rounded-full px-2.5 py-[5px] text-[10.5px] font-extrabold uppercase tracking-[0.04em]"
            :class="stageOf(p.status).chip"
          >{{ stageOf(p.status).label }}</span>
        </span>
        <!-- Badge 5: unowned is a word, in amber, never an empty cell. -->
        <span
          class="w-[110px] shrink-0 truncate text-[13px]"
          :class="p.manager ? 'text-muted-600 dark:text-muted-300' : 'font-semibold text-muted-900 dark:text-[#F2C14E]'"
        >{{ personName(p.manager) ?? 'Unassigned' }}</span>
        <span class="font-heading w-[100px] shrink-0 text-end text-sm font-bold tabular-nums text-muted-900 dark:text-white">
          <template v-if="canMoney">{{ formatCurrency(p.amount ?? 0) }}</template>
          <span v-else class="font-sans font-normal text-muted-500">—</span>
        </span>
        <span class="w-[84px] shrink-0 text-end text-[12.5px] text-muted-500">{{ relTime(p.updatedAt) }}</span>
      </div>
    </div>

    <div v-else class="rounded-2xl border border-muted-200 bg-white px-6 py-11 text-center dark:border-white/10 dark:bg-muted-800">
      <div class="font-heading text-[17px] font-bold text-muted-900 dark:text-white">
        {{ status ? 'Nothing in this stage' : 'No projects match' }}
      </div>
      <p class="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-[1.55] text-muted-500">
        {{ debouncedSearch
          ? `Nothing matches “${debouncedSearch}”. Clear the search or pick another stage.`
          : 'Projects move here as their stage changes.' }}
      </p>
    </div>

    <div v-if="footer" class="flex flex-wrap items-center gap-3">
      <span class="text-[12.5px] text-muted-500">{{ footer }}</span>
    </div>

    <!--
      Badge 4 removes the pager at this scale, not the concept: 100 rows
      is the endpoint's ceiling, and if the directory ever passes it the
      control has to exist rather than silently truncating the list.
    -->
    <AdminPager
      v-if="data && data.pageCount > 1" :page="data.page" :page-count="data.pageCount" :total="data.total" noun="projects"
      @update:page="page = $event"
    />

    <!-- ========== ASSIGN MODAL ========== -->
    <div v-if="showAssign" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Assign an owner">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showAssign = false" />
      <div class="apex-pop relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-muted-200 bg-white shadow-[0_30px_60px_rgba(0,0,0,.5)] dark:border-white/10 dark:bg-muted-800">
        <div class="border-b border-muted-200 px-[22px] pb-3.5 pt-5 dark:border-white/10">
          <div class="font-heading text-[18px] font-extrabold tracking-[-0.01em] text-muted-900 dark:text-white">
            Assign {{ selectedCount }} project{{ selectedCount === 1 ? '' : 's' }}
          </div>
          <p class="mt-1.5 text-[12.5px] text-muted-500">
            Only staff whose role can own project work are listed.
          </p>
        </div>
        <div class="flex flex-col gap-0.5 overflow-y-auto p-3">
          <button
            v-for="s in assignable" :key="s.id"
            type="button"
            :disabled="assigning"
            class="apex-focus flex min-h-14 items-center gap-3 rounded-xl px-3 text-start transition hover:bg-muted-100 disabled:opacity-60 dark:hover:bg-white/6"
            @click="assignTo(s.id)"
          >
            <span aria-hidden="true" class="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#9B79F6] to-[#6C40E8] text-xs font-bold text-white">
              {{ (personName(s) ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('') }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[14.5px] font-semibold text-muted-900 dark:text-white">{{ personName(s) }}</span>
              <span class="mt-0.5 block truncate text-[12.5px] text-muted-500">
                {{ staffLabel(s) }} · {{ s.load }} project{{ s.load === 1 ? '' : 's' }}
              </span>
            </span>
          </button>
          <p v-if="!assignable.length" class="px-3 py-6 text-center text-[13px] text-muted-500">
            No staff account currently holds the permission to own project work.
          </p>
        </div>
        <div class="flex items-center gap-2.5 border-t border-muted-200 px-[22px] py-3.5 dark:border-white/10">
          <BaseButton size="sm" rounded="lg" variant="ghost" :disabled="assigning" @click="assignTo(null)">
            Clear owner
          </BaseButton>
          <span class="grow" />
          <BaseButton rounded="lg" :disabled="assigning" @click="showAssign = false">
            Done
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- ========== CREATE PROJECT MODAL ========== -->
    <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="New order for a client">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showCreate = false" />
      <div class="apex-pop relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[520px] flex-col overflow-y-auto rounded-2xl border border-muted-200 bg-white p-6 shadow-[0_30px_60px_rgba(0,0,0,.5)] dark:border-white/10 dark:bg-muted-800">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <div class="font-heading text-[20px] font-extrabold tracking-[-0.01em] text-muted-900 dark:text-white">
              New order for a client
            </div>
            <p class="mt-1 text-[13px] text-muted-500">
              Created on their behalf, with the standard milestone timeline.
            </p>
          </div>
          <button type="button" aria-label="Close" class="apex-focus flex size-8 items-center justify-center rounded-[9px] border border-muted-200 bg-muted-50 text-muted-500 transition hover:text-muted-900 dark:border-white/10 dark:bg-white/5 dark:hover:text-white" @click="showCreate = false">
            <Icon name="lucide:x" class="size-4" />
          </button>
        </div>

        <form class="flex flex-col gap-3.5" @submit.prevent="createProject">
          <!-- owner picker -->
          <div>
            <label for="np-owner" :class="labelClass">Client</label>
            <div v-if="selectedOwner" class="border-primary-500/40 bg-primary-500/10 flex items-center gap-3 rounded-xl border px-3.5 py-2.5">
              <div class="min-w-0 flex-1">
                <AdminUserCell :user="selectedOwner" />
              </div>
              <button type="button" aria-label="Change client" class="text-primary-600 dark:text-primary-200 apex-focus text-[12.5px] font-semibold hover:underline" @click="selectedOwner = null">
                Change
              </button>
            </div>
            <template v-else>
              <label class="focus-within:border-primary-400 flex items-center gap-2.5 rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-2.5 dark:border-white/8 dark:bg-muted-700">
                <Icon name="lucide:search" class="size-4 shrink-0 text-muted-400 dark:text-muted-500" />
                <input id="np-owner" v-model="ownerSearch" placeholder="Search by name or email…" class="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-muted-900 outline-none placeholder:text-muted-400 dark:text-white dark:placeholder:text-muted-500">
              </label>
              <div v-if="ownerSearch.trim() && ownerOptions.length" class="mt-2 overflow-hidden rounded-xl border border-muted-200 dark:border-white/8">
                <template v-for="(u, idx) in ownerOptions" :key="u.id">
                  <div v-if="idx > 0" class="h-px bg-muted-200 dark:bg-white/8" />
                  <button type="button" class="apex-focus flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-muted-100 dark:hover:bg-white/4" @click="selectedOwner = u">
                    <div class="min-w-0 flex-1">
                      <AdminUserCell :user="u" />
                    </div>
                    <Icon name="lucide:plus" class="size-4 shrink-0 text-muted-500" />
                  </button>
                </template>
              </div>
            </template>
          </div>

          <div>
            <label for="np-name" :class="labelClass">Project name</label>
            <input id="np-name" v-model="form.name" required :class="inputClass">
          </div>
          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label for="np-category" :class="labelClass">Service</label>
              <input id="np-category" v-model="form.category" required list="np-category-options" :class="inputClass">
              <datalist id="np-category-options">
                <option v-for="c in categories" :key="c" :value="c" />
              </datalist>
            </div>
            <div>
              <label for="np-amount" :class="labelClass">Contract value (GBP)</label>
              <input id="np-amount" v-model.number="form.amount" type="number" min="0" step="0.01" placeholder="0.00" :class="inputClass">
            </div>
            <div>
              <span :class="labelClass">Stage</span>
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
              <label for="np-deadline" :class="labelClass">Deadline <span class="font-normal text-muted-500">(optional)</span></label>
              <input id="np-deadline" v-model="form.deadline" type="date" :class="inputClass">
            </div>
          </div>

          <div class="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <BaseButton rounded="full" @click="showCreate = false">
              Cancel
            </BaseButton>
            <BaseButton type="submit" rounded="full" variant="primary" :loading="creating" :disabled="creating || !selectedOwner || !form.name.trim()">
              <Icon name="lucide:plus" class="size-4" />
              Create order
            </BaseButton>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes apex-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes apex-pop {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.apex-fade {
  animation: apex-fade 0.2s ease-out both;
}
.apex-pop {
  animation: apex-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  .apex-fade,
  .apex-pop {
    animation: none;
  }
}
</style>
