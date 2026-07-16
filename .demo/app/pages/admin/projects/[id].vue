<script setup lang="ts">
/**
 * Admin — project detail. Full management: contract fields, status,
 * progress, manager assignment, milestone timeline CRUD, files (read-
 * only until an upload endpoint exists) and a delete danger zone.
 */
definePageMeta({
  title: 'Project detail',
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const projectId = route.params.id as string

const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()

const { data, refresh } = await useFetch(`/api/admin/projects/${projectId}`)

const project = computed(() => data.value?.project ?? null)
const staff = computed(() => data.value?.staff ?? [])

function shortRef(id: string) {
  return `APX-${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`
}

function fmtDate(iso: string | Date | null | undefined) {
  if (!iso)
    return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toDateInput(iso: string | Date | null | undefined) {
  if (!iso)
    return ''
  return new Date(iso).toISOString().slice(0, 10)
}

function toastError(error: any, fallback: string) {
  const fieldErrors = error?.data?.data?.fieldErrors as Record<string, string[]> | undefined
  const firstFieldError = fieldErrors ? Object.values(fieldErrors)[0]?.[0] : undefined
  toaster.add({ title: 'Something went wrong', description: firstFieldError || error?.data?.message || fallback, icon: 'lucide:alert-triangle', progress: true })
}

// --- Details form ---
const form = reactive({ name: '', category: '', amount: 0, progress: 0, status: 'PENDING', deadline: '', managerId: '' })
const saving = ref(false)

watch(project, (p) => {
  if (p) {
    Object.assign(form, {
      name: p.name,
      category: p.category,
      amount: p.amount,
      progress: p.progress,
      status: p.status,
      deadline: toDateInput(p.deadline),
      managerId: p.managerId ?? '',
    })
  }
}, { immediate: true })

async function saveDetails() {
  if (saving.value)
    return
  saving.value = true
  try {
    await $fetch(`/api/admin/projects/${projectId}`, {
      method: 'PATCH',
      body: {
        name: form.name,
        category: form.category,
        amount: form.amount,
        progress: form.progress,
        status: form.status,
        deadline: form.deadline || null,
        managerId: form.managerId || null,
      },
    })
    toaster.add({ title: 'Project saved', icon: 'lucide:check', progress: true })
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The project could not be saved.')
  }
  finally {
    saving.value = false
  }
}

// --- Milestones ---
const newMilestone = ref('')
const addingMilestone = ref(false)

const milestoneCycle: Record<string, string> = {
  PENDING: 'CURRENT',
  CURRENT: 'COMPLETED',
  COMPLETED: 'PENDING',
}

async function addMilestone() {
  if (!newMilestone.value.trim() || addingMilestone.value)
    return
  addingMilestone.value = true
  try {
    await $fetch(`/api/admin/projects/${projectId}/milestones`, {
      method: 'POST',
      body: { title: newMilestone.value.trim() },
    })
    newMilestone.value = ''
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The milestone could not be added.')
  }
  finally {
    addingMilestone.value = false
  }
}

async function cycleMilestone(m: { id: string, status: string }) {
  try {
    await $fetch(`/api/admin/milestones/${m.id}`, {
      method: 'PATCH',
      body: { status: milestoneCycle[m.status] ?? 'PENDING' },
    })
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The milestone could not be updated.')
  }
}

async function deleteMilestone(id: string) {
  try {
    await $fetch(`/api/admin/milestones/${id}`, { method: 'DELETE' })
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The milestone could not be removed.')
  }
}

function milestoneMeta(status: string) {
  if (status === 'COMPLETED')
    return { icon: 'lucide:check-circle-2', class: 'text-[#22B07D]', label: 'Completed' }
  if (status === 'CURRENT')
    return { icon: 'lucide:loader-circle', class: 'text-primary-400', label: 'In progress' }
  return { icon: 'lucide:circle-dashed', class: 'text-muted-500', label: 'Pending' }
}

// --- Delete project ---
const showDelete = ref(false)
const deleting = ref(false)

async function deleteProject() {
  if (deleting.value)
    return
  deleting.value = true
  try {
    await $fetch(`/api/admin/projects/${projectId}`, { method: 'DELETE' })
    toaster.add({ title: 'Project deleted', icon: 'lucide:check', progress: true })
    await navigateTo('/admin/projects')
  }
  catch (error: any) {
    toastError(error, 'The project could not be deleted.')
    deleting.value = false
    showDelete.value = false
  }
}

const inputClass = 'w-full rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-muted-500 focus:border-primary-400'
const labelClass = 'mb-2 block text-[12.5px] font-semibold text-white'
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-6 pb-8 font-sans text-muted-400">
    <NuxtLink to="/admin/projects" class="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-primary-400 transition hover:text-white">
      <Icon name="lucide:arrow-left" class="size-3.5" />All projects
    </NuxtLink>

    <div v-if="project" class="flex flex-col gap-6">
      <!-- ========== HEADER ========== -->
      <div class="flex flex-wrap items-center gap-5 rounded-[20px] border border-white/10 bg-muted-800 p-6">
        <span class="flex size-[52px] shrink-0 items-center justify-center rounded-[14px] bg-primary-500/14 text-primary-400">
          <Icon name="lucide:briefcase" class="size-6" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2.5">
            <h1 class="font-heading text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-white">
              {{ project.name }}
            </h1>
            <AdminStatusChip :status="project.status" />
          </div>
          <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-500">
            <span class="font-mono text-[12px]">{{ shortRef(project.id) }}</span>
            <span>{{ project.category }}</span>
            <span class="inline-flex items-center gap-1.5"><Icon name="lucide:calendar" class="size-3.5" />Started {{ fmtDate(project.startDate) }}</span>
          </div>
        </div>
        <div class="text-right">
          <div class="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted-500">
            Contract value
          </div>
          <div class="mt-1 font-heading text-[26px] font-extrabold leading-none tracking-[-0.02em] text-white tabular-nums">
            {{ formatCurrency(project.amount) }}
          </div>
        </div>
      </div>

      <div class="grid items-start gap-6 xl:grid-cols-[1.55fr_1fr]">
        <!-- ========== LEFT COLUMN ========== -->
        <div class="flex flex-col gap-6">
          <!-- details form -->
          <section class="rounded-[20px] border border-white/10 bg-muted-800 p-6" aria-label="Project details">
            <h2 class="mb-5 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
              <span class="h-[18px] w-1.5 rounded-full bg-primary-500" />Details
            </h2>
            <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="saveDetails">
              <div class="sm:col-span-2">
                <label for="pj-name" :class="labelClass">Project name</label>
                <input id="pj-name" v-model="form.name" required :class="inputClass">
              </div>
              <div>
                <label for="pj-category" :class="labelClass">Category</label>
                <input id="pj-category" v-model="form.category" required :class="inputClass">
              </div>
              <div>
                <label for="pj-amount" :class="labelClass">Contract value (GBP)</label>
                <input id="pj-amount" v-model.number="form.amount" type="number" min="0" step="0.01" :class="inputClass">
              </div>
              <div>
                <label for="pj-status" :class="labelClass">Status</label>
                <select id="pj-status" v-model="form.status" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary-400">
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
              </div>
              <div>
                <label for="pj-deadline" :class="labelClass">Deadline</label>
                <input id="pj-deadline" v-model="form.deadline" type="date" :class="inputClass">
              </div>
              <div>
                <label for="pj-manager" :class="labelClass">Project manager</label>
                <select id="pj-manager" v-model="form.managerId" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary-400">
                  <option value="">
                    Unassigned
                  </option>
                  <option v-for="s in staff" :key="s.id" :value="s.id">
                    {{ [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email }} ({{ s.role.toLowerCase() }})
                  </option>
                </select>
              </div>
              <div>
                <label for="pj-progress" :class="labelClass">Progress — <span class="text-primary-400 tabular-nums">{{ form.progress }}%</span></label>
                <input
                  id="pj-progress" v-model.number="form.progress" type="range" min="0" max="100" step="5"
                  class="w-full accent-primary-500"
                >
              </div>
              <div class="flex items-end justify-end sm:col-span-2">
                <BaseButton type="submit" rounded="full" variant="primary" :loading="saving" :disabled="saving">
                  <Icon name="lucide:check" class="size-4" />Save changes
                </BaseButton>
              </div>
            </form>
          </section>

          <!-- milestones -->
          <section class="rounded-[20px] border border-white/10 bg-muted-800 p-6" aria-label="Milestones">
            <h2 class="mb-5 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
              <span class="h-[18px] w-1.5 rounded-full bg-[#22B07D]" />Milestones
            </h2>

            <div v-if="project.milestones.length" class="mb-4 overflow-hidden rounded-[14px] border border-white/8" role="list">
              <template v-for="(m, idx) in project.milestones" :key="m.id">
                <div v-if="idx > 0" class="h-px bg-white/8" />
                <div role="listitem" class="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    :aria-label="`Milestone ${m.title}: ${milestoneMeta(m.status).label}. Click to advance.`"
                    class="shrink-0 transition hover:scale-110"
                    @click="cycleMilestone(m)"
                  >
                    <Icon :name="milestoneMeta(m.status).icon" class="size-5" :class="milestoneMeta(m.status).class" />
                  </button>
                  <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold" :class="m.status === 'COMPLETED' ? 'text-muted-500 line-through' : 'text-white'">
                    {{ m.title }}
                  </span>
                  <span class="hidden text-[12px] text-muted-500 sm:block">{{ milestoneMeta(m.status).label }}</span>
                  <button type="button" :aria-label="`Remove milestone ${m.title}`" class="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-muted-500 transition hover:bg-[#EC6453]/14 hover:text-[#EC6453]" @click="deleteMilestone(m.id)">
                    <Icon name="lucide:trash-2" class="size-3.5" />
                  </button>
                </div>
              </template>
            </div>
            <p v-else class="mb-4 text-[13px] text-muted-500">
              No milestones yet — add the first one below.
            </p>

            <form class="flex items-center gap-2.5" @submit.prevent="addMilestone">
              <input v-model="newMilestone" placeholder="New milestone title…" :class="inputClass" class="flex-1">
              <BaseButton type="submit" rounded="full" class="shrink-0 border border-white/10 bg-muted-700 !text-white hover:bg-muted-600" :disabled="!newMilestone.trim() || addingMilestone">
                <Icon name="lucide:plus" class="size-4" />Add
              </BaseButton>
            </form>
            <p class="mt-3 text-xs text-muted-500">
              Tip: click a milestone's icon to advance it (pending → in progress → completed).
            </p>
          </section>

          <!-- files -->
          <section class="rounded-[20px] border border-white/10 bg-muted-800 p-6" aria-label="Files">
            <h2 class="mb-5 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
              <span class="h-[18px] w-1.5 rounded-full bg-[#6EA8FE]" />Files
            </h2>
            <div v-if="project.files.length" class="overflow-hidden rounded-[14px] border border-white/8" role="list">
              <template v-for="(f, idx) in project.files" :key="f.id">
                <div v-if="idx > 0" class="h-px bg-white/8" />
                <div role="listitem" class="flex items-center gap-3 px-4 py-3">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-primary-500/14 text-primary-400">
                    <Icon name="lucide:file-text" class="size-4" />
                  </span>
                  <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-white">{{ f.name }}</span>
                  <span class="text-[12px] text-muted-500">{{ f.size }}</span>
                </div>
              </template>
            </div>
            <p v-else class="text-[13px] text-muted-500">
              No files attached. <!-- TODO(api): no upload endpoint/model yet — add one before building an uploader here. -->
            </p>
          </section>
        </div>

        <!-- ========== RIGHT RAIL ========== -->
        <div class="flex flex-col gap-6">
          <!-- customer -->
          <section class="rounded-[20px] border border-white/10 bg-muted-800 p-6" aria-label="Customer">
            <h2 class="mb-4 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
              <span class="h-[18px] w-1.5 rounded-full bg-primary-400" />Customer
            </h2>
            <NuxtLink :to="`/admin/users/${project.user.id}`" class="group flex items-center gap-3 rounded-[14px] border border-white/8 bg-muted-700/60 p-3.5 transition hover:border-primary-500/40">
              <div class="min-w-0 flex-1">
                <AdminUserCell :user="project.user" />
              </div>
              <Icon name="lucide:arrow-right" class="size-4 shrink-0 text-muted-500 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-400" />
            </NuxtLink>
            <dl class="mt-4 flex flex-col gap-2.5 text-[13px]">
              <div v-if="project.user.company" class="flex items-center justify-between gap-3">
                <dt class="text-muted-500">
                  Company
                </dt>
                <dd class="inline-flex items-center gap-1.5 font-semibold text-white">
                  <Icon name="lucide:building-2" class="size-3.5 text-primary-400" />{{ project.user.company.name }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-500">
                  Wallet balance
                </dt>
                <dd class="font-semibold text-white tabular-nums">
                  {{ formatCurrency(project.user.walletBalance) }}
                </dd>
              </div>
              <div v-if="project.user.phone" class="flex items-center justify-between gap-3">
                <dt class="text-muted-500">
                  Phone
                </dt>
                <dd class="text-white">
                  {{ project.user.phone }}
                </dd>
              </div>
            </dl>
          </section>

          <!-- manager -->
          <section class="rounded-[20px] border border-white/10 bg-muted-800 p-6" aria-label="Manager">
            <h2 class="mb-4 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
              <span class="h-[18px] w-1.5 rounded-full bg-[#F2C14E]" />Manager
            </h2>
            <div v-if="project.manager" class="flex items-center gap-3">
              <AdminUserCell :user="project.manager" />
            </div>
            <p v-else class="text-[13px] text-muted-500">
              Unassigned — pick a manager in the details form.
            </p>
          </section>

          <!-- danger zone -->
          <section class="rounded-[20px] border border-[#EC6453]/25 bg-[#EC6453]/[0.04] p-6" aria-label="Danger zone">
            <h2 class="mb-3 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-[#EC6453]">
              <span class="h-[18px] w-1.5 rounded-full bg-[#EC6453]" />Danger zone
            </h2>
            <p class="mb-4 text-[13px] leading-[1.55] text-muted-400">
              Deleting removes the project, its milestones and file records permanently. For a project that fell through, set the status to <strong class="text-white">Cancelled</strong> instead.
            </p>
            <BaseButton rounded="full" class="border border-[#EC6453]/30 bg-[#EC6453]/14 !text-[#EC6453] hover:bg-[#EC6453]/20" @click="showDelete = true">
              <Icon name="lucide:trash-2" class="size-4" />Delete project
            </BaseButton>
          </section>
        </div>
      </div>
    </div>

    <AdminEmptyState v-else icon="lucide:folder-x" title="Project not found" subtitle="It may have been deleted.">
      <BaseButton rounded="full" variant="primary" to="/admin/projects">
        Back to projects
      </BaseButton>
    </AdminEmptyState>

    <!-- ========== DELETE CONFIRM MODAL ========== -->
    <div v-if="showDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Confirm deletion">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showDelete = false" />
      <div class="apex-pop relative w-full max-w-[420px] rounded-[20px] border border-white/10 bg-muted-800 p-6 shadow-[0_30px_60px_rgba(0,0,0,.5)]">
        <span class="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#EC6453]/14 text-[#EC6453]">
          <Icon name="lucide:trash-2" class="size-5" />
        </span>
        <div class="font-heading text-[19px] font-extrabold tracking-[-0.01em] text-white">
          Delete this project?
        </div>
        <p class="mt-2 text-[13.5px] leading-[1.55] text-muted-400">
          <strong class="text-white">{{ project?.name }}</strong> and all of its milestones and file records will be permanently removed. This can't be undone.
        </p>
        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <BaseButton rounded="full" class="border border-white/10 bg-muted-700 !text-white hover:bg-muted-600" @click="showDelete = false">
            Cancel
          </BaseButton>
          <BaseButton rounded="full" class="!bg-[#EC6453] !text-white hover:!bg-[#EC6453]/85" :loading="deleting" :disabled="deleting" @click="deleteProject">
            Delete permanently
          </BaseButton>
        </div>
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
