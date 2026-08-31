<script setup lang="ts">
/**
 * Admin — project detail (V2 Phase 9 — Overview & work, badges 6–8).
 *
 * The management screen the previous version already was, with the
 * design's three additions and one rewrite:
 *
 * - **The payment gate is stated, not silent** (badge 6). Releasing
 *   deliverables hands over source files, so the panel shows exactly what
 *   has been paid, the dialog restates it, an early release requires a
 *   typed reason, and the button is never quietly disabled — staff are
 *   never left guessing why they cannot do something. Access can be
 *   withdrawn again from the same panel.
 * - **Actions write audit entries** (badge 7). Release, withdrawal and
 *   stage changes go through endpoints that call `recordAudit`, and the
 *   Activity feed renders those same rows plus the instalment
 *   collections the ledger holds — one trail, read twice, rather than a
 *   second feed written alongside it.
 * - **Internal and client-visible text are separate** (badge 8). Notes
 *   live in their own model with a Staff-only chip; anything the client
 *   should read goes through Support.
 * - **Stage is the milestone timeline.** There is no stage enum in this
 *   codebase; what the customer already sees on their own project page is
 *   the milestone list, so that is what the stepper renders and what
 *   "advance" moves — and progress is recomputed from it, so the bar and
 *   the timeline cannot disagree.
 */
import { isStaffRole, ROLES } from '~~/shared/permissions'

definePageMeta({
  title: 'Project detail',
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const projectId = route.params.id as string

const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()
const { user } = useUser()
const { can, roleDef } = useStaffAccess()

const { data, refresh } = await useFetch(`/api/admin/projects/${projectId}`)

const project = computed(() => data.value?.project ?? null)
const staff = computed(() => data.value?.staff ?? [])
const assignable = computed(() => data.value?.assignable ?? [])
const deliverables = computed(() => data.value?.deliverables ?? null)
const notes = computed(() => data.value?.notes ?? [])
const contract = computed<any>(() => project.value?.contract ?? null)
const plan = computed<any>(() => project.value?.installmentPlan ?? null)

const canMoney = computed(() => can('money.view'))
const canAssign = computed(() => can('work.assign'))
const canRelease = computed(() => can('work.release'))

// Client brief captured by the New Order wizard — stored as a JSON array of
// { label, value } pairs (see /api/orders). Parse defensively.
const brief = computed<{ label: string, value: string }[]>(() => {
  const raw = project.value?.brief
  if (!raw)
    return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed.filter((x: any) => x?.label && x?.value) : []
  }
  catch {
    return []
  }
})

const signature = computed<string | null>(() => contract.value?.signature ?? project.value?.signature ?? null)
const signatureIsImage = computed(() => typeof signature.value === 'string' && signature.value.startsWith('data:image'))

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

function personName(u: { firstName?: string | null, lastName?: string | null, email?: string | null } | null | undefined) {
  if (!u)
    return null
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || null
}

function staffLabel(s: { staffRole?: string | null, role?: string | null }) {
  return isStaffRole(s.staffRole) ? ROLES[s.staffRole].label : 'Employee'
}

function initialsOf(name: string | null) {
  return (name ?? '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function toastError(error: any, fallback: string) {
  const fieldErrors = error?.data?.data?.fieldErrors as Record<string, string[]> | undefined
  const firstFieldError = fieldErrors ? Object.values(fieldErrors)[0]?.[0] : undefined
  toaster.add({ title: 'Something went wrong', description: firstFieldError || error?.data?.message || fallback, icon: 'lucide:alert-triangle', progress: true })
}

/** Badge 5's map, shared with the Orders list. */
const STAGE_CHIP: Record<string, { label: string, chip: string }> = {
  PENDING: { label: 'Awaiting kickoff', chip: 'bg-[#D9A521]/16 text-[#F2C14E]' },
  IN_PROGRESS: { label: 'In progress', chip: 'bg-primary-500/14 text-primary-400' },
  COMPLETED: { label: 'Completed', chip: 'bg-[#22B07D]/14 text-[#22B07D]' },
  CANCELLED: { label: 'Cancelled', chip: 'bg-[#EC6453]/16 text-[#EC6453]' },
}
function stageOf(key: string) {
  return STAGE_CHIP[key] ?? { label: key, chip: 'bg-muted-200 text-muted-600 dark:bg-white/5 dark:text-muted-400' }
}

/* ------------------------------------------------ the deliverable gate --- */

const fileCount = computed(() => project.value?.files.length ?? 0)
const paidSoFar = computed(() => (plan.value ? plan.value.paid : 0))
const planTotal = computed(() => (plan.value ? plan.value.total : project.value?.amount ?? 0))
const outstanding = computed(() => deliverables.value?.outstanding ?? 0)

/**
 * Four states, and each one says what it is. A single boolean would have
 * collapsed "held" and "there was never anything to hold" into the same
 * screen — the empty-state defect Phase 5 removed from the credit card.
 */
const gate = computed(() => {
  const d = deliverables.value
  if (!fileCount.value) {
    return {
      key: 'empty' as const,
      title: 'No deliverables uploaded yet',
      body: 'Files appear here once the team adds them to the project. There is nothing to release.',
      tone: 'border-muted-200 bg-muted-50 dark:border-white/10 dark:bg-white/2',
      icon: 'lucide:folder',
      iconTone: 'bg-muted-200 text-muted-500 dark:bg-white/5 dark:text-muted-400',
    }
  }
  if (d?.released) {
    return {
      key: 'released' as const,
      title: 'Deliverables released to the client',
      body: 'The client can download every file from their project page. Withdrawing access removes the links immediately.',
      tone: 'border-[#22B07D]/30 bg-[#22B07D]/6',
      icon: 'lucide:unlock',
      iconTone: 'bg-[#22B07D]/16 text-[#22B07D]',
    }
  }
  if (d?.held) {
    return {
      key: 'held' as const,
      title: 'Deliverables held — balance outstanding',
      body: 'The client sees the file names and sizes but cannot download them. Releasing hands over the source files.',
      tone: 'border-[#D9A521]/30 bg-[#D9A521]/6',
      icon: 'lucide:lock',
      iconTone: 'bg-[#D9A521]/16 text-[#F2C14E]',
    }
  }
  return {
    key: 'open' as const,
    title: 'Deliverables are available to the client',
    // Two different reasons nothing is being withheld; the panel says which.
    body: d?.holdEnabled
      ? 'The balance on this project is settled, so the payment gate does not apply.'
      : 'Holding deliverables until paid is switched off platform-wide, so files are available as soon as they are uploaded.',
    tone: 'border-muted-200 bg-muted-50 dark:border-white/10 dark:bg-white/2',
    icon: 'lucide:unlock',
    iconTone: 'bg-[#22B07D]/16 text-[#22B07D]',
  }
})

/** Per-instalment segments up to 24, a single bar beyond (Phase 5's rule). */
const segments = computed(() => {
  if (!plan.value || plan.value.monthsTotal > 24) {
    return null
  }
  return Array.from({ length: plan.value.monthsTotal }, (_, i) => i < plan.value.monthsPaid)
})

const releaseOpen = ref(false)
const withdrawOpen = ref(false)
const releaseReason = ref('')
const withdrawReason = ref('')
const releasing = ref(false)

const reasonRequired = computed(() => outstanding.value > 0.005)

function openRelease() {
  releaseReason.value = ''
  releaseOpen.value = true
}

async function confirmRelease() {
  if (releasing.value || (reasonRequired.value && !releaseReason.value.trim())) {
    return
  }
  releasing.value = true
  try {
    await $fetch(`/api/admin/projects/${projectId}/deliverables/release`, {
      method: 'POST',
      body: releaseReason.value.trim() ? { reason: releaseReason.value.trim() } : {},
    })
    toaster.add({
      title: `${fileCount.value} file${fileCount.value === 1 ? '' : 's'} released`,
      description: 'They are downloadable from the client\'s project page now.',
      icon: 'lucide:unlock',
      progress: true,
    })
    releaseOpen.value = false
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The files could not be released.')
  }
  finally {
    releasing.value = false
  }
}

async function confirmWithdraw() {
  if (releasing.value) {
    return
  }
  releasing.value = true
  try {
    await $fetch(`/api/admin/projects/${projectId}/deliverables/withdraw`, {
      method: 'POST',
      body: withdrawReason.value.trim() ? { reason: withdrawReason.value.trim() } : {},
    })
    toaster.add({ title: 'Client access withdrawn', icon: 'lucide:lock', progress: true })
    withdrawOpen.value = false
    withdrawReason.value = ''
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'Access could not be withdrawn.')
  }
  finally {
    releasing.value = false
  }
}

/* ------------------------------------------------------------- stage --- */

const milestones = computed(() => project.value?.milestones ?? [])
const currentIndex = computed(() => {
  const list = milestones.value
  const current = list.findIndex(m => m.status === 'CURRENT')
  if (current >= 0) {
    return current
  }
  const firstOpen = list.findIndex(m => m.status !== 'COMPLETED')
  return firstOpen >= 0 ? firstOpen : list.length
})
const nextStage = computed(() => milestones.value[currentIndex.value] ?? null)
const advancing = ref(false)

async function advanceStage() {
  if (advancing.value || !nextStage.value) {
    return
  }
  advancing.value = true
  try {
    const result = await $fetch<{ completed: string, next: string | null }>(`/api/admin/projects/${projectId}/advance`, { method: 'POST' })
    toaster.add({
      title: `“${result.completed}” marked complete`,
      description: result.next ? `Now on “${result.next}”.` : 'Every stage on this project is done.',
      icon: 'lucide:check',
      progress: true,
    })
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The stage could not be advanced.')
  }
  finally {
    advancing.value = false
  }
}

/* ----------------------------------------------------------- activity --- */

interface FeedItem { text: string, who: string, when: string, tone: string }

const ACTIVITY_TEXT: Record<string, (meta: any) => string> = {
  'admin.project.deliverables.release': meta => `Released ${meta?.fileCount ?? ''} deliverable${meta?.fileCount === 1 ? '' : 's'} to the client`.replace('  ', ' '),
  'admin.project.deliverables.withdraw': () => 'Withdrew client access to deliverables',
  'admin.project.stage-advance': meta => (meta?.completed ? `Completed stage “${meta.completed}”` : 'Advanced the stage'),
  'admin.project.update': () => 'Updated the project record',
  'admin.milestone.update': () => 'Updated a milestone',
  'admin.milestone.delete': () => 'Removed a milestone',
  'admin.milestone.create': () => 'Added a milestone',
}

const activity = computed<FeedItem[]>(() => {
  const p = project.value
  if (!p) {
    return []
  }
  const rows: (FeedItem & { at: number })[] = []

  for (const entry of data.value?.activity ?? []) {
    let meta: any = null
    try {
      meta = entry.metadata ? JSON.parse(entry.metadata) : null
    }
    catch {
      meta = null
    }
    const describe = ACTIVITY_TEXT[entry.action]
    rows.push({
      text: describe ? describe(meta) : entry.action.replace(/^admin\./, '').replaceAll('.', ' '),
      // The role held at the time, never the one they hold now (badge 30).
      who: [entry.actorEmail, entry.roleAtTime && isStaffRole(entry.roleAtTime) ? ROLES[entry.roleAtTime].label : null]
        .filter(Boolean)
        .join(' · '),
      when: fmtDate(entry.createdAt),
      tone: entry.action.includes('withdraw') ? 'bg-[#EC6453]' : 'bg-primary-500',
      at: new Date(entry.createdAt).getTime(),
    })
  }

  if (canMoney.value) {
    for (const charge of data.value?.charges ?? []) {
      rows.push({
        text: `${charge.description || 'Instalment collected'} · ${formatCurrency(Math.abs(charge.amount))}`,
        who: 'System',
        when: fmtDate(charge.createdAt),
        tone: 'bg-[#22B07D]',
        at: new Date(charge.createdAt).getTime(),
      })
    }
  }

  rows.push({
    text: 'Order created',
    who: `${personName(p.user) ?? 'Client'} · Client`,
    when: fmtDate(p.createdAt),
    tone: 'bg-muted-400 dark:bg-white/20',
    at: new Date(p.createdAt).getTime(),
  })

  return rows.sort((a, b) => b.at - a.at).slice(0, 12)
})

/* -------------------------------------------------------------- notes --- */

const noteDraft = ref('')
const savingNote = ref(false)

async function addNote() {
  if (savingNote.value || !noteDraft.value.trim()) {
    return
  }
  savingNote.value = true
  try {
    await $fetch(`/api/admin/projects/${projectId}/notes`, { method: 'POST', body: { body: noteDraft.value.trim() } })
    noteDraft.value = ''
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The note could not be saved.')
  }
  finally {
    savingNote.value = false
  }
}

/* ------------------------------------------------------------- assign --- */

const showAssign = ref(false)
const savingAssign = ref(false)

async function assignTo(staffId: string | null) {
  if (savingAssign.value) {
    return
  }
  savingAssign.value = true
  try {
    await $fetch(`/api/admin/projects/${projectId}`, { method: 'PATCH', body: { managerId: staffId } })
    showAssign.value = false
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The owner could not be changed.')
  }
  finally {
    savingAssign.value = false
  }
}

/* ------------------------------------------------------ details form --- */

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
        // The contract value is money; a role without it never sends one.
        ...(canMoney.value ? { amount: form.amount } : {}),
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

const inputClass = 'w-full rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-3 text-sm text-muted-900 outline-none placeholder:text-muted-400 focus:border-primary-400 sm:py-2.5 dark:border-white/8 dark:bg-muted-700 dark:text-white dark:placeholder:text-muted-500'
const labelClass = 'mb-2 block text-[12.5px] font-semibold text-muted-900 dark:text-white'
const CARD = 'rounded-2xl border border-muted-200 bg-white p-[18px] dark:border-white/10 dark:bg-muted-800'
const CARD_TITLE = 'font-heading text-[15.5px] font-bold text-muted-900 dark:text-white'
const MODAL_SHELL = 'apex-pop relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-muted-200 bg-white shadow-[0_30px_60px_rgba(0,0,0,.5)] dark:border-white/10 dark:bg-muted-800'
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-5 pb-8 font-sans">
    <NuxtLink to="/admin/projects" class="apex-focus -my-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg py-2 text-[13.5px] font-semibold text-primary-500 transition hover:underline sm:my-0 sm:min-h-0 sm:py-0 dark:text-primary-400">
      <Icon name="lucide:arrow-left" class="size-3.5" />Orders
    </NuxtLink>

    <div v-if="project" class="flex flex-col gap-5">
      <!-- ========== HEADER ========== -->
      <div class="flex flex-wrap items-start gap-4">
        <span class="bg-primary-500/14 text-primary-400 flex size-[52px] shrink-0 items-center justify-center rounded-[14px]">
          <Icon name="lucide:code-2" class="size-6" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2.5">
            <h1 class="font-heading text-2xl font-extrabold leading-[1.15] tracking-[-0.02em] text-muted-900 dark:text-white">
              {{ project.name }}
            </h1>
            <span
              class="inline-flex items-center rounded-full px-2.5 py-[5px] text-[10.5px] font-extrabold uppercase tracking-[0.04em]"
              :class="stageOf(project.status).chip"
            >{{ stageOf(project.status).label }}</span>
          </div>
          <div class="mt-[7px] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13.5px] text-muted-500">
            <NuxtLink :to="`/admin/users/${project.user.id}`" class="text-primary-500 dark:text-primary-400 font-semibold hover:underline">
              {{ personName(project.user) }}
            </NuxtLink>
            <span aria-hidden="true" class="size-1 rounded-full bg-muted-400" />
            <span>{{ project.category }}</span>
            <span aria-hidden="true" class="size-1 rounded-full bg-muted-400" />
            <span class="font-mono text-[12.5px]">{{ shortRef(project.id) }}</span>
            <span aria-hidden="true" class="size-1 rounded-full bg-muted-400" />
            <span>Started {{ fmtDate(project.startDate) }}</span>
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2.5">
          <BaseButton v-if="canAssign" rounded="lg" @click="showAssign = true">
            <Icon name="lucide:user-plus" class="size-4" />Assign
          </BaseButton>
          <BaseButton
            v-if="canRelease && gate.key === 'held'" rounded="lg" variant="primary"
            @click="openRelease"
          >
            <Icon name="lucide:unlock" class="size-4" />Release deliverables
          </BaseButton>
        </div>
      </div>

      <div class="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[1fr_380px]">
        <!-- ========== LEFT COLUMN ========== -->
        <div class="flex flex-col gap-[18px]">
          <!-- ---------- DELIVERABLES GATE (badge 6) ---------- -->
          <section class="rounded-2xl border p-5" :class="gate.tone" aria-label="Deliverables">
            <div class="flex items-start gap-3">
              <span class="flex size-[38px] shrink-0 items-center justify-center rounded-[11px]" :class="gate.iconTone">
                <Icon :name="gate.icon" class="size-[19px]" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="font-heading text-[17px] font-bold tracking-[-0.01em] text-muted-900 dark:text-white">
                  {{ gate.title }}
                </div>
                <p class="mt-1 text-[13px] leading-[1.5] text-muted-600 dark:text-muted-300">
                  {{ gate.body }}
                </p>
              </div>
            </div>

            <!-- What has actually been paid — the figure the decision rests on. -->
            <div
              v-if="canMoney && plan"
              class="mt-[18px] flex flex-wrap items-center gap-4 rounded-xl border border-muted-200 bg-white px-4 py-3.5 dark:border-white/10 dark:bg-white/3"
            >
              <span class="min-w-0 flex-1">
                <span class="block text-[11px] font-bold uppercase tracking-[0.05em] text-muted-500">Paid so far</span>
                <span class="font-heading mt-1 block text-[20px] font-extrabold tabular-nums text-muted-900 dark:text-white">
                  {{ formatCurrency(paidSoFar) }}
                  <span class="text-[13.5px] font-semibold text-muted-500">of {{ formatCurrency(planTotal) }}</span>
                </span>
              </span>
              <span class="w-[200px] shrink-0">
                <span v-if="segments" class="flex gap-0.5" aria-hidden="true">
                  <span
                    v-for="(paid, i) in segments" :key="i"
                    class="h-1.5 min-w-0 flex-1 rounded-[2px]"
                    :class="paid ? 'bg-primary-500' : 'bg-muted-200 dark:bg-white/8'"
                  />
                </span>
                <span v-else class="block h-1.5 overflow-hidden rounded-full bg-muted-200 dark:bg-white/8" aria-hidden="true">
                  <span class="block h-full rounded-full bg-primary-500" :style="{ width: `${planTotal ? Math.round((paidSoFar / planTotal) * 100) : 0}%` }" />
                </span>
                <span class="mt-[7px] block text-[12px] text-muted-500">
                  {{ plan.monthsPaid }} of {{ plan.monthsTotal }} instalments · next {{ fmtDate(plan.nextDue) }}
                </span>
              </span>
              <NuxtLink to="/admin/payments?tab=installments" class="text-primary-500 dark:text-primary-400 shrink-0 text-[13px] font-semibold hover:underline">
                Plan
              </NuxtLink>
            </div>

            <div class="mt-[18px] flex items-center gap-2.5">
              <span class="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-500">Deliverables</span>
              <span class="h-px flex-1 bg-muted-200 dark:bg-white/10" />
              <span class="text-[12.5px] text-muted-500">
                {{ deliverables?.released ? `${fileCount} of ${fileCount} released` : `0 of ${fileCount} released` }}
              </span>
            </div>

            <div v-if="fileCount" class="mt-3 rounded-xl border border-muted-200 bg-white px-4 dark:border-white/10 dark:bg-muted-800" role="list">
              <div
                v-for="(f, index) in project.files" :key="f.id"
                role="listitem"
                class="flex items-center gap-3 py-3"
                :class="index < project.files.length - 1 ? 'border-b border-muted-200 dark:border-white/5' : ''"
              >
                <span class="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-muted-100 text-muted-500 dark:bg-white/5 dark:text-muted-400">
                  <Icon :name="f.type === 'zip' ? 'lucide:folder-archive' : 'lucide:file-text'" class="size-[17px]" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-muted-900 dark:text-white">{{ f.name }}</span>
                  <span class="mt-[3px] block text-[12px] text-muted-500">{{ f.type }} · {{ f.size }}</span>
                </span>
                <span
                  class="inline-flex shrink-0 items-center rounded-full px-2.5 py-[5px] text-[10.5px] font-extrabold uppercase tracking-[0.04em]"
                  :class="deliverables?.held ? 'bg-[#D9A521]/16 text-[#F2C14E]' : 'bg-[#22B07D]/14 text-[#22B07D]'"
                >{{ deliverables?.held ? 'Held' : 'Available' }}</span>
              </div>
            </div>
            <p v-else class="mt-3 text-[13px] text-muted-500">
              <!-- TODO(api): no upload endpoint yet — files arrive through seeds or direct records. -->
              No files attached to this project.
            </p>

            <div v-if="canRelease && fileCount" class="mt-4 flex flex-wrap items-center gap-2.5">
              <BaseButton v-if="gate.key === 'held'" rounded="lg" variant="primary" @click="openRelease">
                <Icon name="lucide:unlock" class="size-4" />Release {{ fileCount }} file{{ fileCount === 1 ? '' : 's' }}
              </BaseButton>
              <BaseButton
                v-if="deliverables?.released" rounded="lg"
                class="!text-[#EC6453] border border-[#EC6453]/35"
                @click="withdrawOpen = true"
              >
                Withdraw access
              </BaseButton>
              <p v-if="deliverables?.released && deliverables.releasedBy" class="text-[12.5px] text-muted-500">
                Released by {{ deliverables.releasedBy }} on {{ fmtDate(deliverables.releasedAt) }}.
              </p>
            </div>
            <!-- Badge 6 again: never a disabled button with no explanation. -->
            <p v-else-if="!canRelease && fileCount" class="mt-4 text-[13px] leading-[1.6] text-muted-500">
              Releasing files is limited to the Owner, Admin and Project manager roles.
              <template v-if="roleDef">
                Your role, {{ roleDef.label }}, covers {{ roleDef.covers }}.
              </template>
            </p>
          </section>

          <!-- ---------- STAGE ---------- -->
          <section aria-label="Stage">
            <ApexSectionLabel class="mb-3" label="Stage" />
            <div :class="CARD">
              <div v-if="milestones.length" class="flex items-start">
                <div
                  v-for="(m, index) in milestones" :key="m.id"
                  class="relative flex min-w-0 flex-1 flex-col items-center"
                >
                  <span
                    class="z-10 flex size-[26px] items-center justify-center rounded-full"
                    :class="m.status === 'COMPLETED'
                      ? 'bg-primary-500 text-white'
                      : m.status === 'CURRENT'
                        ? 'border-2 border-primary-500 bg-primary-500/20'
                        : 'border border-muted-300 bg-muted-100 dark:border-white/15 dark:bg-white/5'"
                  >
                    <Icon v-if="m.status === 'COMPLETED'" name="lucide:check" class="size-3.5" />
                  </span>
                  <span
                    class="mt-2.5 px-1 text-center text-[12.5px] font-semibold"
                    :class="m.status === 'PENDING' ? 'text-muted-500' : 'text-muted-900 dark:text-white'"
                  >{{ m.title }}</span>
                  <span
                    v-if="index < milestones.length - 1"
                    aria-hidden="true"
                    class="absolute left-1/2 top-[13px] h-0.5 w-full"
                    :class="m.status === 'COMPLETED' ? 'bg-primary-500' : 'bg-muted-200 dark:bg-white/10'"
                  />
                </div>
              </div>
              <p v-else class="text-[13px] text-muted-500">
                No stages yet. Add the first milestone below and the timeline appears here and on the client's project page.
              </p>

              <div v-if="canAssign && milestones.length" class="mt-5 flex flex-wrap items-center gap-2.5 border-t border-muted-200 pt-4 dark:border-white/10">
                <span class="min-w-0 flex-1 text-[13.5px] text-muted-600 dark:text-muted-300">
                  Moving the stage updates the timeline on the client's project page and recalculates progress.
                </span>
                <BaseButton
                  size="sm" rounded="lg" class="shrink-0"
                  :loading="advancing" :disabled="advancing || !nextStage"
                  @click="advanceStage"
                >
                  {{ nextStage ? `Complete “${nextStage.title}”` : 'Every stage complete' }}
                </BaseButton>
              </div>
            </div>
          </section>

          <!-- ---------- BRIEF ---------- -->
          <section aria-label="Client brief">
            <ApexSectionLabel class="mb-3" label="Brief" />
            <div :class="CARD">
              <dl v-if="brief.length" class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <div v-for="item in brief" :key="item.label" class="min-w-0">
                  <dt class="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-500">
                    {{ item.label }}
                  </dt>
                  <dd class="mt-1 break-words text-sm leading-[1.5] text-muted-900 dark:text-white">
                    {{ item.value }}
                  </dd>
                </div>
              </dl>
              <p v-else class="text-[13px] text-muted-500">
                No brief was captured for this project. Orders placed through the New Order wizard include the client's requirements here.
              </p>
            </div>
          </section>

          <!-- ---------- DETAILS FORM ---------- -->
          <section aria-label="Project details">
            <ApexSectionLabel class="mb-3" label="Details" />
            <div :class="CARD">
              <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="saveDetails">
                <div class="sm:col-span-2">
                  <label for="pj-name" :class="labelClass">Project name</label>
                  <input id="pj-name" v-model="form.name" required :class="inputClass">
                </div>
                <div>
                  <label for="pj-category" :class="labelClass">Service</label>
                  <input id="pj-category" v-model="form.category" required :class="inputClass">
                </div>
                <div v-if="canMoney">
                  <label for="pj-amount" :class="labelClass">Contract value (GBP)</label>
                  <input id="pj-amount" v-model.number="form.amount" type="number" min="0" step="0.01" :class="inputClass">
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
                    <BaseSelectItem value="COMPLETED">
                      Completed
                    </BaseSelectItem>
                    <BaseSelectItem value="CANCELLED">
                      Cancelled
                    </BaseSelectItem>
                  </BaseSelect>
                </div>
                <div>
                  <label for="pj-deadline" :class="labelClass">Deadline</label>
                  <input id="pj-deadline" v-model="form.deadline" type="date" :class="inputClass">
                </div>
                <div>
                  <span :class="labelClass">Owner</span>
                  <BaseSelect v-model="form.managerId" rounded="lg" aria-label="Project owner" placeholder="Unassigned">
                    <BaseSelectItem v-for="s in staff" :key="s.id" :value="s.id">
                      {{ personName(s) }} · {{ staffLabel(s) }}
                    </BaseSelectItem>
                  </BaseSelect>
                </div>
                <div>
                  <label for="pj-progress" :class="labelClass">Progress — <span class="text-primary-400 tabular-nums">{{ form.progress }}%</span></label>
                  <input
                    id="pj-progress" v-model.number="form.progress" type="range" min="0" max="100" step="5"
                    class="accent-primary-500 w-full"
                  >
                  <p class="mt-1.5 text-xs text-muted-500">
                    Advancing a stage recalculates this from the timeline.
                  </p>
                </div>
                <div class="flex items-end justify-end sm:col-span-2">
                  <BaseButton type="submit" rounded="full" variant="primary" :loading="saving" :disabled="saving">
                    <Icon name="lucide:check" class="size-4" />Save changes
                  </BaseButton>
                </div>
              </form>
            </div>
          </section>

          <!-- ---------- MILESTONE EDITING ---------- -->
          <section v-if="canAssign" aria-label="Milestones">
            <ApexSectionLabel class="mb-3" label="Milestones" />
            <div :class="CARD">
              <div v-if="milestones.length" class="mb-4 overflow-hidden rounded-xl border border-muted-200 dark:border-white/8" role="list">
                <template v-for="(m, idx) in milestones" :key="m.id">
                  <div v-if="idx > 0" class="h-px bg-muted-200 dark:bg-white/8" />
                  <div role="listitem" class="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      :aria-label="`Milestone ${m.title}: ${milestoneMeta(m.status).label}. Activate to advance.`"
                      class="apex-focus -my-2 flex size-11 shrink-0 items-center justify-center rounded-lg transition hover:scale-110 sm:my-0 sm:size-6"
                      @click="cycleMilestone(m)"
                    >
                      <Icon :name="milestoneMeta(m.status).icon" class="size-5" :class="milestoneMeta(m.status).class" />
                    </button>
                    <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold" :class="m.status === 'COMPLETED' ? 'text-muted-500 line-through' : 'text-muted-900 dark:text-white'">
                      {{ m.title }}
                    </span>
                    <span class="hidden text-[12px] text-muted-500 sm:block">{{ milestoneMeta(m.status).label }}</span>
                    <button type="button" :aria-label="`Remove milestone ${m.title}`" class="apex-focus -my-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-500 transition hover:bg-[#EC6453]/14 hover:text-[#EC6453] sm:my-0 sm:size-8" @click="deleteMilestone(m.id)">
                      <Icon name="lucide:trash-2" class="size-3.5" />
                    </button>
                  </div>
                </template>
              </div>
              <p v-else class="mb-4 text-[13px] text-muted-500">
                No milestones yet — add the first one below.
              </p>

              <form class="flex items-center gap-2.5" @submit.prevent="addMilestone">
                <label for="pj-new-milestone" class="sr-only">New milestone title</label>
                <input id="pj-new-milestone" v-model="newMilestone" placeholder="New milestone title…" :class="inputClass" class="flex-1">
                <BaseButton type="submit" rounded="full" class="shrink-0" :disabled="!newMilestone.trim() || addingMilestone">
                  <Icon name="lucide:plus" class="size-4" />Add
                </BaseButton>
              </form>
            </div>
          </section>
        </div>

        <!-- ========== RIGHT RAIL ========== -->
        <div class="flex flex-col gap-[18px]">
          <!-- client -->
          <section :class="CARD" aria-label="Client">
            <div :class="CARD_TITLE">
              Client
            </div>
            <NuxtLink :to="`/admin/users/${project.user.id}`" class="apex-focus group mt-3 flex items-center gap-3 rounded-xl border border-muted-200 bg-muted-50 p-3.5 transition hover:border-primary-500/40 dark:border-white/8 dark:bg-muted-700/60">
              <div class="min-w-0 flex-1">
                <AdminUserCell :user="project.user" />
              </div>
              <Icon name="lucide:arrow-right" class="size-4 shrink-0 text-muted-500 transition-transform group-hover:translate-x-0.5" />
            </NuxtLink>
            <dl class="mt-4 flex flex-col gap-2.5 text-[13px]">
              <div v-if="project.user.company" class="flex items-center justify-between gap-3">
                <dt class="text-muted-500">
                  Company
                </dt>
                <dd class="inline-flex items-center gap-1.5 font-semibold text-muted-900 dark:text-white">
                  <Icon name="lucide:building-2" class="text-primary-400 size-3.5" />{{ project.user.company.name }}
                </dd>
              </div>
              <div v-if="canMoney" class="flex items-center justify-between gap-3">
                <dt class="text-muted-500">
                  Wallet balance
                </dt>
                <dd class="font-semibold tabular-nums text-muted-900 dark:text-white">
                  {{ formatCurrency(project.user.walletBalance) }}
                </dd>
              </div>
              <div v-if="project.user.phone" class="flex items-center justify-between gap-3">
                <dt class="text-muted-500">
                  Phone
                </dt>
                <dd class="text-muted-900 dark:text-white">
                  {{ project.user.phone }}
                </dd>
              </div>
            </dl>
          </section>

          <!-- team -->
          <section :class="CARD" aria-label="Team">
            <div class="flex items-center gap-2.5">
              <span :class="CARD_TITLE">Team</span>
              <span class="grow" />
              <button v-if="canAssign" type="button" class="apex-focus text-primary-500 dark:text-primary-400 rounded text-[12.5px] font-semibold hover:underline" @click="showAssign = true">
                Change
              </button>
            </div>
            <div v-if="project.manager" class="mt-3 flex items-center gap-3">
              <span aria-hidden="true" class="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#9B79F6] to-[#6C40E8] text-[11.5px] font-bold text-white">
                {{ initialsOf(personName(project.manager)) }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13.5px] font-semibold text-muted-900 dark:text-white">{{ personName(project.manager) }}</span>
                <span class="mt-0.5 block text-[12px] text-muted-500">{{ staffLabel(project.manager) }}</span>
              </span>
            </div>
            <!-- Badge 5's amber, again: this is why the project is in the queue. -->
            <p v-else class="mt-3 text-[13px] leading-[1.55] text-muted-900 dark:text-[#F2C14E]">
              Nobody assigned yet — this is why the project shows in the waiting queue.
            </p>
          </section>

          <!-- activity (badge 7) -->
          <section :class="CARD" aria-label="Activity">
            <div class="flex items-center gap-2.5">
              <span :class="CARD_TITLE">Activity</span>
              <span class="grow" />
              <NuxtLink v-if="can('team.manage')" to="/admin/audit" class="text-primary-500 dark:text-primary-400 text-[12.5px] font-semibold hover:underline">
                Audit log
              </NuxtLink>
            </div>
            <div v-if="activity.length" class="mt-3.5 flex flex-col">
              <div v-for="(a, index) in activity" :key="`${a.when}-${a.text}-${index}`" class="flex gap-3">
                <span class="flex shrink-0 flex-col items-center">
                  <span class="mt-[5px] size-[9px] shrink-0 rounded-full" :class="a.tone" />
                  <span v-if="index < activity.length - 1" class="w-px flex-1 bg-muted-200 dark:bg-white/10" />
                </span>
                <span class="min-w-0 flex-1 pb-4">
                  <span class="block text-[13.5px] leading-[1.45] text-muted-900 dark:text-white">{{ a.text }}</span>
                  <span class="mt-[3px] block text-[12px] text-muted-500">{{ a.who }} · {{ a.when }}</span>
                </span>
              </div>
            </div>
            <p v-else class="mt-3 text-[13px] text-muted-500">
              Nothing recorded yet.
            </p>
          </section>

          <!-- internal notes (badge 8) -->
          <section :class="CARD" aria-label="Internal notes">
            <div class="flex flex-wrap items-center gap-2.5">
              <span :class="CARD_TITLE">Internal notes</span>
              <span class="shrink-0 rounded-full bg-muted-100 px-2.5 py-[5px] text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-muted-600 dark:bg-white/5 dark:text-muted-400">
                Staff only
              </span>
            </div>
            <p class="mb-3 mt-2 text-[12.5px] leading-[1.55] text-muted-500">
              Never shown to the client. Client-facing messages go through Support.
            </p>

            <div v-if="notes.length" class="mb-3 flex flex-col gap-2.5">
              <div v-for="n in notes" :key="n.id" class="rounded-xl border border-muted-200 bg-muted-50 p-3 dark:border-white/8 dark:bg-white/3">
                <p class="whitespace-pre-wrap text-[13px] leading-[1.55] text-muted-900 dark:text-white">
                  {{ n.body }}
                </p>
                <p class="mt-2 text-[11.5px] text-muted-500">
                  {{ n.authorEmail }} · {{ fmtDate(n.createdAt) }}
                </p>
              </div>
            </div>

            <form v-if="canAssign" @submit.prevent="addNote">
              <label for="pj-note" class="sr-only">Add an internal note</label>
              <textarea
                id="pj-note" v-model="noteDraft" rows="3" placeholder="Add a note for the team…"
                class="focus:border-primary-400 w-full resize-y rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-3 text-sm leading-[1.55] text-muted-900 outline-none placeholder:text-muted-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500"
              />
              <div class="mt-2.5 flex justify-end">
                <BaseButton type="submit" size="sm" rounded="lg" :loading="savingNote" :disabled="savingNote || !noteDraft.trim()">
                  Add note
                </BaseButton>
              </div>
            </form>
            <p v-else-if="!notes.length" class="text-[13px] text-muted-500">
              No notes yet.
            </p>
          </section>

          <!-- contract & signature -->
          <section v-if="canMoney" :class="CARD" aria-label="Contract and signature">
            <div :class="CARD_TITLE">
              Contract &amp; signature
            </div>
            <template v-if="contract">
              <div class="mb-3 mt-3 flex items-center gap-2.5">
                <span class="text-primary-500 dark:text-primary-300 font-mono text-[13px] font-bold">{{ contract.reference }}</span>
                <AdminStatusChip :status="contract.status" />
              </div>
            </template>

            <div v-if="signature" class="mt-3 rounded-xl border border-muted-200 bg-white p-3.5 dark:border-white/10">
              <img v-if="signatureIsImage" :src="signature" alt="Client signature" class="mx-auto max-h-24 w-auto">
              <div v-else class="py-3 text-center font-[cursive] text-[22px] text-muted-950">
                {{ signature }}
              </div>
            </div>
            <div v-else class="mt-3 rounded-xl border border-dashed border-muted-300 p-5 text-center text-[13px] text-muted-500 dark:border-white/15">
              No signature captured
            </div>

            <div class="mt-3 flex flex-col gap-1.5 text-[12.5px] text-muted-500">
              <div v-if="contract?.signerName" class="flex items-center gap-2">
                <Icon name="lucide:pen-line" class="size-3.5" />Signed by <span class="font-semibold text-muted-900 dark:text-white">{{ contract.signerName }}</span>
              </div>
              <div v-if="contract?.signedAt" class="flex items-center gap-2">
                <Icon name="lucide:calendar-check" class="size-3.5" />{{ fmtDate(contract.signedAt) }}
              </div>
            </div>

            <NuxtLink
              v-if="contract"
              :to="`/admin/contracts/${contract.id}`"
              class="text-primary-500 dark:text-primary-300 mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold hover:underline"
            >
              View full contract &amp; legal record <Icon name="lucide:arrow-right" class="size-3.5" />
            </NuxtLink>
            <p v-else class="mt-1 text-[12.5px] text-muted-500">
              No financing contract — this project was created without a financed amount.
            </p>
          </section>

          <!-- danger zone -->
          <section v-if="canAssign" class="rounded-2xl border border-[#EC6453]/25 bg-[#EC6453]/4 p-[18px]" aria-label="Danger zone">
            <div class="font-heading text-[15.5px] font-bold text-muted-900 dark:text-[#EC6453]">
              Danger zone
            </div>
            <p class="mb-4 mt-2 text-[13px] leading-[1.55] text-muted-600 dark:text-muted-300">
              Deleting removes the project, its milestones and file records permanently. For a project that fell through, set the stage to <strong class="text-muted-900 dark:text-white">Cancelled</strong> instead.
            </p>
            <BaseButton rounded="lg" class="!text-[#EC6453] border border-[#EC6453]/30" @click="showDelete = true">
              <Icon name="lucide:trash-2" class="size-4" />Delete project
            </BaseButton>
          </section>
        </div>
      </div>
    </div>

    <AdminEmptyState v-else icon="lucide:folder-x" title="Project not found" subtitle="It may have been deleted.">
      <BaseButton rounded="full" variant="primary" to="/admin/projects">
        Back to orders
      </BaseButton>
    </AdminEmptyState>

    <!-- ========== RELEASE MODAL (badge 6) ========== -->
    <div v-if="releaseOpen && project" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Release deliverables">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="releaseOpen = false" />
      <div :class="MODAL_SHELL" class="max-w-[640px]">
        <div class="shrink-0 border-b border-muted-200 px-6 pb-4 pt-5 dark:border-white/10">
          <div class="font-heading text-xl font-extrabold tracking-[-0.01em] text-muted-900 dark:text-white">
            Release deliverables to the client
          </div>
          <div class="mt-1.5 text-[13.5px] text-muted-500">
            {{ project.name }} · {{ personName(project.user) }} · {{ fileCount }} file{{ fileCount === 1 ? '' : 's' }}
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <!-- The unpaid balance, restated where the decision is taken. -->
          <div v-if="reasonRequired" class="flex items-start gap-3 rounded-xl border border-[#D9A521]/30 bg-[#D9A521]/8 px-4 py-3.5">
            <Icon name="lucide:alert-triangle" class="mt-px size-[19px] shrink-0 text-[#F2C14E]" />
            <p class="flex-1 text-[13.5px] leading-[1.6] text-muted-700 dark:text-muted-300">
              <template v-if="canMoney && plan">
                This plan has <strong class="font-semibold text-muted-900 dark:text-white">{{ plan.monthsPaid }} of {{ plan.monthsTotal }} instalments paid ({{ formatCurrency(paidSoFar) }} of {{ formatCurrency(planTotal) }})</strong>.
              </template>
              <template v-else>
                This project still has a balance outstanding.
              </template>
              Releasing now hands over the files before the balance is settled.
            </p>
          </div>
          <div v-else class="flex items-start gap-3 rounded-xl border border-[#22B07D]/30 bg-[#22B07D]/8 px-4 py-3.5">
            <Icon name="lucide:check-circle-2" class="mt-px size-[19px] shrink-0 text-[#22B07D]" />
            <p class="flex-1 text-[13.5px] leading-[1.6] text-muted-700 dark:text-muted-300">
              The balance on this project is settled. This is a routine hand-over.
            </p>
          </div>

          <div class="mt-[22px] text-[11px] font-bold uppercase tracking-[0.05em] text-muted-500">
            What the client gets
          </div>
          <div class="mt-2.5 rounded-xl border border-muted-200 bg-muted-50 px-4 dark:border-white/10 dark:bg-white/3" role="list">
            <div
              v-for="(f, index) in project.files" :key="f.id"
              role="listitem"
              class="flex items-center gap-3 py-3"
              :class="index < project.files.length - 1 ? 'border-b border-muted-200 dark:border-white/5' : ''"
            >
              <Icon :name="f.type === 'zip' ? 'lucide:folder-archive' : 'lucide:file-text'" class="size-[17px] shrink-0 text-muted-500" />
              <span class="min-w-0 flex-1 truncate text-sm text-muted-900 dark:text-white">{{ f.name }}</span>
              <span class="shrink-0 text-[12.5px] tabular-nums text-muted-500">{{ f.size }}</span>
            </div>
          </div>

          <label for="rel-reason" class="mb-2 mt-[22px] block text-[13px] font-semibold text-muted-900 dark:text-white">
            {{ reasonRequired ? 'Reason for early release' : 'Reason (optional)' }}
            <span v-if="reasonRequired" class="text-[#EC6453]">*</span>
          </label>
          <textarea
            id="rel-reason" v-model="releaseReason" rows="3"
            placeholder="Recorded in the audit log against your name."
            class="focus:border-primary-400 w-full resize-y rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-3 text-sm leading-[1.55] text-muted-900 outline-none placeholder:text-muted-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500"
          />
          <!--
            The mockup promises the client is emailed a download link. There
            is no mail provider in this stack, so the copy says what actually
            happens: the files become downloadable on their project page.
          -->
          <p class="mt-2.5 text-[12.5px] leading-[1.55] text-muted-500">
            The files become downloadable on the client's project page immediately. Access can be withdrawn again from this panel.
          </p>
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-2.5 border-t border-muted-200 px-6 py-4 dark:border-white/10">
          <span class="min-w-0 flex-1 text-[12.5px] text-muted-500">
            Logged as {{ personName(user) ?? user?.email }}<template v-if="roleDef"> · {{ roleDef.label }}</template>
          </span>
          <BaseButton rounded="lg" :disabled="releasing" @click="releaseOpen = false">
            Cancel
          </BaseButton>
          <BaseButton
            rounded="lg" variant="primary" :loading="releasing"
            :disabled="releasing || (reasonRequired && !releaseReason.trim())"
            @click="confirmRelease"
          >
            Release {{ fileCount }} file{{ fileCount === 1 ? '' : 's' }}
          </BaseButton>
        </div>
        <p v-if="reasonRequired && !releaseReason.trim()" class="border-t border-muted-200 px-6 py-2.5 text-[12.5px] text-muted-500 dark:border-white/10">
          A reason is required while a balance is outstanding.
        </p>
      </div>
    </div>

    <!-- ========== WITHDRAW MODAL ========== -->
    <div v-if="withdrawOpen && project" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Withdraw access">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="withdrawOpen = false" />
      <div :class="MODAL_SHELL" class="max-w-[460px] p-6">
        <span class="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#EC6453]/14 text-[#EC6453]">
          <Icon name="lucide:lock" class="size-5" />
        </span>
        <div class="font-heading text-[19px] font-extrabold tracking-[-0.01em] text-muted-900 dark:text-white">
          Withdraw client access?
        </div>
        <p class="mt-2 text-[13.5px] leading-[1.55] text-muted-600 dark:text-muted-300">
          The download links disappear from {{ personName(project.user) }}'s project page immediately. They keep seeing the file names and sizes.
        </p>
        <label for="wd-reason" class="mb-2 mt-4 block text-[13px] font-semibold text-muted-900 dark:text-white">Reason (optional)</label>
        <textarea
          id="wd-reason" v-model="withdrawReason" rows="2"
          placeholder="Recorded in the audit log against your name."
          class="focus:border-primary-400 w-full resize-y rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-3 text-sm leading-[1.55] text-muted-900 outline-none placeholder:text-muted-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500"
        />
        <div class="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <BaseButton rounded="lg" :disabled="releasing" @click="withdrawOpen = false">
            Cancel
          </BaseButton>
          <BaseButton rounded="lg" class="!bg-[#EC6453] !text-white" :loading="releasing" :disabled="releasing" @click="confirmWithdraw">
            Withdraw access
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- ========== ASSIGN MODAL ========== -->
    <div v-if="showAssign && project" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Assign to project">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showAssign = false" />
      <div :class="MODAL_SHELL" class="max-w-[520px]">
        <div class="border-b border-muted-200 px-[22px] pb-3.5 pt-5 dark:border-white/10">
          <div class="font-heading text-[18px] font-extrabold tracking-[-0.01em] text-muted-900 dark:text-white">
            Assign to project
          </div>
          <p class="mt-1.5 text-[12.5px] text-muted-500">
            Only staff whose role can own project work are listed.
          </p>
        </div>
        <!--
          `Project.managerId` holds one owner, so this is a single choice,
          not the mockup's multi-select. A many-to-many join table would be
          a schema change with no product behind it — nothing else in the
          app reads a second assignee.
        -->
        <div class="flex flex-col gap-0.5 overflow-y-auto p-3" role="radiogroup" aria-label="Project owner">
          <button
            v-for="s in assignable" :key="s.id"
            type="button"
            role="radio"
            :aria-checked="project.managerId === s.id"
            :disabled="savingAssign"
            class="apex-focus flex min-h-14 items-center gap-3 rounded-xl px-3 text-start transition disabled:opacity-60"
            :class="project.managerId === s.id ? 'bg-primary-500/12' : 'hover:bg-muted-100 dark:hover:bg-white/6'"
            @click="assignTo(s.id)"
          >
            <span aria-hidden="true" class="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#9B79F6] to-[#6C40E8] text-xs font-bold text-white">
              {{ initialsOf(personName(s)) }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[14.5px] font-semibold text-muted-900 dark:text-white">{{ personName(s) }}</span>
              <span class="mt-0.5 block truncate text-[12.5px] text-muted-500">{{ staffLabel(s) }} · {{ s.load }} project{{ s.load === 1 ? '' : 's' }}</span>
            </span>
            <Icon v-if="project.managerId === s.id" name="lucide:check" class="text-primary-400 size-[17px] shrink-0" />
          </button>
          <p v-if="!assignable.length" class="px-3 py-6 text-center text-[13px] text-muted-500">
            No staff account currently holds the permission to own project work.
          </p>
        </div>
        <div class="flex items-center gap-2.5 border-t border-muted-200 px-[22px] py-3.5 dark:border-white/10">
          <BaseButton v-if="project.managerId" size="sm" rounded="lg" variant="ghost" :disabled="savingAssign" @click="assignTo(null)">
            Unassign
          </BaseButton>
          <span class="grow" />
          <BaseButton rounded="lg" :disabled="savingAssign" @click="showAssign = false">
            Done
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- ========== DELETE CONFIRM MODAL ========== -->
    <div v-if="showDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Confirm deletion">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showDelete = false" />
      <div :class="MODAL_SHELL" class="max-w-[420px] p-6">
        <span class="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#EC6453]/14 text-[#EC6453]">
          <Icon name="lucide:trash-2" class="size-5" />
        </span>
        <div class="font-heading text-[19px] font-extrabold tracking-[-0.01em] text-muted-900 dark:text-white">
          Delete this project?
        </div>
        <p class="mt-2 text-[13.5px] leading-[1.55] text-muted-600 dark:text-muted-300">
          <strong class="text-muted-900 dark:text-white">{{ project?.name }}</strong> and all of its milestones and file records will be permanently removed. This can't be undone.
        </p>
        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <BaseButton rounded="lg" @click="showDelete = false">
            Cancel
          </BaseButton>
          <BaseButton rounded="lg" class="!bg-[#EC6453] !text-white" :loading="deleting" :disabled="deleting" @click="deleteProject">
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
