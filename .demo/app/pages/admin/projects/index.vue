<script setup lang="ts">
/**
 * Admin — Projects directory. Paginated list of every project with
 * search / status / category / owner filters (status & userId are
 * deep-linkable from Overview and the user detail page) and a create
 * modal that assigns the project to a customer.
 */
definePageMeta({
  title: 'Projects',
  layout: 'admin',
  middleware: 'admin',
})

const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()
const route = useRoute()

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

const query = computed(() => ({
  page: page.value,
  pageSize: 20,
  ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
  ...(status.value ? { status: status.value } : {}),
  ...(category.value ? { category: category.value } : {}),
  ...(userId.value ? { userId: userId.value } : {}),
}))

const { data, pending, refresh } = await useFetch('/api/admin/projects', { query })

const projects = computed(() => data.value?.items ?? [])
const categories = computed(() => data.value?.categories ?? [])

/** APX order reference — same convention as the customer My Orders page. */
function shortRef(id: string) {
  return `APX-${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`
}

function fmtDate(iso: string | Date | null) {
  if (!iso)
    return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function progressBarClass(p: { status: string }) {
  if (p.status === 'COMPLETED')
    return 'bg-[#6EA8FE]'
  if (p.status === 'CANCELLED')
    return 'bg-[#EC6453]'
  if (p.status === 'PENDING')
    return 'bg-[#F2C14E]'
  return 'bg-[#22B07D]'
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

const inputClass = 'w-full rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-muted-500 focus:border-primary-400'
const labelClass = 'mb-2 block text-[12.5px] font-semibold text-white'
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-6 pb-8 font-sans text-muted-400">
    <AdminPageHeader
      eyebrow="ADMIN · PROJECTS"
      title="Projects"
      subtitle="Every project on the platform — cash and installment, across all customers."
    >
      <BaseButton rounded="full" variant="primary" @click="openCreate">
        <Icon name="lucide:folder-plus" class="size-4" />
        <span>New project</span>
      </BaseButton>
    </AdminPageHeader>

    <!-- owner filter notice (arrived via ?userId= deep link) -->
    <div v-if="userId" class="flex items-center gap-3 rounded-[14px] border border-primary-500/30 bg-primary-500/10 px-4 py-3 text-[13px] text-primary-200">
      <Icon name="lucide:filter" class="size-4 shrink-0" />
      Showing projects for one customer only.
      <button type="button" class="ms-auto inline-flex items-center gap-1.5 font-semibold text-white hover:text-primary-200" @click="userId = ''">
        Clear <Icon name="lucide:x" class="size-3.5" />
      </button>
    </div>

    <!-- ========== FILTER BAR ========== -->
    <div class="grid gap-3 rounded-[20px] border border-white/10 bg-muted-800 p-4 sm:grid-cols-2 xl:grid-cols-[1.8fr_1fr_1fr]">
      <label class="flex items-center gap-2.5 rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 focus-within:border-primary-400">
        <Icon name="lucide:search" class="size-4 shrink-0 text-muted-500" />
        <input v-model="search" placeholder="Search project, reference or customer email…" class="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-white outline-none placeholder:text-muted-500">
      </label>
      <select v-model="status" aria-label="Filter by status" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-primary-400">
        <option value="">
          All statuses
        </option>
        <option value="PENDING">
          Pending
        </option>
        <option value="IN_PROGRESS">
          In progress
        </option>
        <option value="COMPLETED">
          Completed
        </option>
        <option value="CANCELLED">
          Cancelled
        </option>
      </select>
      <select v-model="category" aria-label="Filter by category" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-primary-400">
        <option value="">
          All categories
        </option>
        <option v-for="c in categories" :key="c" :value="c">
          {{ c }}
        </option>
      </select>
    </div>

    <!-- ========== LIST ========== -->
    <div v-if="pending" class="flex flex-col gap-2" aria-hidden="true">
      <div v-for="i in 6" :key="i" class="h-[76px] animate-pulse rounded-[16px] border border-white/5 bg-muted-800/60" />
    </div>

    <div v-else-if="projects.length" class="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.02]" role="list">
      <template v-for="(p, idx) in projects" :key="p.id">
        <div v-if="idx > 0" class="h-px bg-white/10" />
        <NuxtLink :to="`/admin/projects/${p.id}`" role="listitem" class="flex items-center gap-4 px-[22px] py-4 transition hover:bg-white/[0.03]">
          <div class="min-w-0 flex-1">
            <div class="truncate text-[14.5px] font-semibold text-white">
              {{ p.name }}
            </div>
            <div class="mt-0.5 flex items-center gap-2 truncate text-[12.5px] text-muted-500">
              <span class="font-mono text-[11.5px]">{{ shortRef(p.id) }}</span>
              <span aria-hidden="true">·</span>
              <span class="truncate">{{ p.category }}</span>
            </div>
          </div>

          <div class="hidden w-48 shrink-0 lg:block">
            <AdminUserCell :user="p.user" compact />
          </div>

          <span class="hidden w-24 shrink-0 text-right text-[13px] font-semibold text-white tabular-nums md:block">
            {{ formatCurrency(p.amount) }}
          </span>

          <div class="hidden w-[130px] shrink-0 items-center gap-2 xl:flex">
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
              <div class="h-full rounded-full" :class="progressBarClass(p)" :style="{ width: `${p.progress}%` }" />
            </div>
            <span class="w-8 text-right text-xs font-bold text-white tabular-nums">{{ p.progress }}%</span>
          </div>

          <span class="hidden w-24 shrink-0 text-[12.5px] text-muted-500 xl:block">
            {{ fmtDate(p.deadline) }}
          </span>

          <AdminStatusChip :status="p.status" />
          <Icon name="lucide:chevron-right" class="size-4 shrink-0 text-muted-500" />
        </NuxtLink>
      </template>
    </div>

    <AdminEmptyState
      v-else icon="lucide:folder-search" title="No projects match"
      subtitle="Try a different search or clear the filters."
    />

    <AdminPager
      v-if="data" :page="data.page" :page-count="data.pageCount" :total="data.total" noun="projects"
      @update:page="page = $event"
    />

    <!-- ========== CREATE PROJECT MODAL ========== -->
    <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="New project">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showCreate = false" />
      <div class="apex-pop relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[520px] flex-col overflow-y-auto rounded-[20px] border border-white/10 bg-muted-800 p-6 shadow-[0_30px_60px_rgba(0,0,0,.5)]">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <div class="font-heading text-[20px] font-extrabold tracking-[-0.01em] text-white">
              New project
            </div>
            <p class="mt-1 text-[13px] text-muted-400">
              Created on behalf of a customer, with the standard milestone timeline.
            </p>
          </div>
          <button type="button" aria-label="Close" class="flex size-8 items-center justify-center rounded-[9px] border border-white/10 bg-white/5 text-muted-400 transition hover:bg-white/10 hover:text-white" @click="showCreate = false">
            <Icon name="lucide:x" class="size-4" />
          </button>
        </div>

        <form class="flex flex-col gap-3.5" @submit.prevent="createProject">
          <!-- owner picker -->
          <div>
            <label for="np-owner" :class="labelClass">Customer</label>
            <div v-if="selectedOwner" class="flex items-center gap-3 rounded-[11px] border border-primary-500/40 bg-primary-500/10 px-3.5 py-2.5">
              <div class="min-w-0 flex-1">
                <AdminUserCell :user="selectedOwner" />
              </div>
              <button type="button" aria-label="Change customer" class="text-[12.5px] font-semibold text-primary-200 hover:text-white" @click="selectedOwner = null">
                Change
              </button>
            </div>
            <template v-else>
              <label class="flex items-center gap-2.5 rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 focus-within:border-primary-400">
                <Icon name="lucide:search" class="size-4 shrink-0 text-muted-500" />
                <input id="np-owner" v-model="ownerSearch" placeholder="Search by name or email…" class="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-white outline-none placeholder:text-muted-500">
              </label>
              <div v-if="ownerSearch.trim() && ownerOptions.length" class="mt-2 overflow-hidden rounded-[11px] border border-white/8">
                <template v-for="(u, idx) in ownerOptions" :key="u.id">
                  <div v-if="idx > 0" class="h-px bg-white/8" />
                  <button type="button" class="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-white/[0.04]" @click="selectedOwner = u">
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
              <label for="np-category" :class="labelClass">Category</label>
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
              <label for="np-status" :class="labelClass">Status</label>
              <select id="np-status" v-model="form.status" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary-400">
                <option value="PENDING">
                  Pending
                </option>
                <option value="IN_PROGRESS">
                  In progress
                </option>
              </select>
            </div>
            <div>
              <label for="np-deadline" :class="labelClass">Deadline <span class="font-normal text-muted-500">(optional)</span></label>
              <input id="np-deadline" v-model="form.deadline" type="date" :class="inputClass">
            </div>
          </div>

          <div class="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <BaseButton rounded="full" class="border border-white/10 bg-muted-700 !text-white hover:bg-muted-600" @click="showCreate = false">
              Cancel
            </BaseButton>
            <BaseButton type="submit" rounded="full" variant="primary" :loading="creating" :disabled="creating || !selectedOwner || !form.name.trim()">
              <Icon name="lucide:folder-plus" class="size-4" />
              Create project
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
