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
import { orderRef } from '~~/shared/refs'
import { ukDateTime } from '~/utils/adminFormat'
import { ADMIN_INPUT, ADMIN_LABEL, ADMIN_TEXTAREA, ADMIN_TH } from '~/utils/adminUi'

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

function toastError(error: any, fallback: string) {
  const fieldErrors = error?.data?.data?.fieldErrors as Record<string, string[]> | undefined
  const firstFieldError = fieldErrors ? Object.values(fieldErrors)[0]?.[0] : undefined
  toaster.add({ title: 'Something went wrong', description: firstFieldError || error?.data?.message || fallback, icon: 'lucide:alert-triangle', progress: true })
}

/** Badge 5's map, shared with the Projects list. */
const STAGES = [
  { key: 'PENDING', label: 'Awaiting kickoff', tone: 'warning' },
  { key: 'IN_PROGRESS', label: 'In progress', tone: 'success' },
  { key: 'IN_REVIEW', label: 'In review', tone: 'info' },
  { key: 'COMPLETED', label: 'Delivered', tone: 'violet' },
  { key: 'CANCELLED', label: 'Cancelled', tone: 'danger' },
] as const
function stageOf(key: string) {
  return STAGES.find(s => s.key === key) ?? { key, label: key, tone: 'neutral' as const }
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

const releaseOpen = ref(false)
const withdrawOpen = ref(false)
const releaseReason = ref('')
const withdrawReason = ref('')
const releasing = ref(false)

const reasonRequired = computed(() => outstanding.value > 0.005)

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
  'admin.project.create': () => 'Created the order for the client',
  'admin.project.kickoff': () => 'Collected the kickoff payment and started the work',
  'admin.project.action-request': meta => (meta?.title ? `Asked the client: “${meta.title}”` : 'Asked the client for something'),
  'admin.project.action-cancel': () => 'Withdrew a request to the client',
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

/* ------------------------------------------- Panel v2: kickoff + asks --- */

const clientActions = computed<any[]>(() => (project.value as any)?.clientActions ?? [])
const clientFiles = computed<any[]>(() => (project.value as any)?.attachments ?? [])
const awaitingKickoff = computed(() => Boolean((project.value as any)?.serviceId) && !(project.value as any)?.kickoffPaidAt)
const KICKOFF_LABEL: Record<string, string> = { 'fixed-monthly': 'Deposit', 'fixed-full': 'Payment in full', 'retainer': 'Set-up and first month', 'scope': 'Discovery fee' }
const kickoffLabel = computed(() => KICKOFF_LABEL[(project.value as any)?.payMode ?? ''] ?? 'Kickoff payment')
const gbp = (n: number) => `£${Number(n ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

const collecting = ref(false)
async function collectKickoff() {
  collecting.value = true
  try {
    const res: any = await $fetch(`/api/admin/projects/${projectId}/kickoff`, { method: 'POST' })
    toaster.add({ title: 'Work started', description: res.charged > 0 ? `${gbp(res.charged)} was taken from the client's wallet.` : 'Nothing was due at kickoff.', icon: 'lucide:check', progress: true })
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The kickoff payment could not be collected.')
  }
  finally {
    collecting.value = false
  }
}

const askTitle = ref('')
const askBody = ref('')
const askCta = ref('Approve')
const askDone = ref('')
const asking = ref(false)
async function sendAsk() {
  if (asking.value || askTitle.value.trim().length < 3) {
    return
  }
  asking.value = true
  try {
    await $fetch(`/api/admin/projects/${projectId}/actions`, {
      method: 'POST',
      body: { title: askTitle.value.trim(), body: askBody.value.trim() || undefined, ctaLabel: askCta.value.trim() || 'Approve', doneLine: askDone.value.trim() || undefined },
    })
    askTitle.value = ''
    askBody.value = ''
    askCta.value = 'Approve'
    askDone.value = ''
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The request could not be sent.')
  }
  finally {
    asking.value = false
  }
}
async function withdrawAsk(id: string) {
  try {
    await $fetch(`/api/admin/projects/${projectId}/actions/${id}`, { method: 'DELETE' })
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The request could not be withdrawn.')
  }
}

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

/* ================================================== Admin console layout === */

const { ask } = useAdminConfirm()
useAdminCrumb(() => (project.value ? `${orderRef(project.value.id)} · ${project.value.name}` : null), '/admin/projects')

/** Every row of the activity feed, newest first (the Overview shows five). */
const activityAll = computed(() => activity.value)

type Tab = 'overview' | 'order' | 'agreement' | 'payments' | 'delivery' | 'activity' | 'settings'
const tab = ref<Tab>('overview')
const tabs = computed(() => [
  { key: 'overview', label: 'Overview' },
  { key: 'order', label: 'Order & brief' },
  { key: 'agreement', label: 'Agreement' },
  ...(canMoney.value ? [{ key: 'payments', label: 'Payments' }] : []),
  { key: 'delivery', label: 'Delivery' },
  { key: 'activity', label: `Activity · ${activityAll.value.length}` },
  ...(canAssign.value ? [{ key: 'settings', label: 'Settings' }] : []),
] as { key: Tab, label: string }[])

const p = computed<any>(() => project.value)
const ownerName = computed(() => personName(p.value?.manager))
const clientName = computed(() => personName(p.value?.user) ?? 'Client')
const signed = computed(() => Boolean(contract.value?.signedAt || signature.value))
const kickoffDone = computed(() => Boolean(p.value?.kickoffPaidAt) || !p.value?.serviceId)
const status = computed<string>(() => p.value?.status ?? 'PENDING')

/**
 * The design's lifecycle rail, cut to the steps this platform records. The
 * prototype draws countersigning, a brief checklist and a booked kickoff
 * call; none of those exist here (orders are signed by the client alone,
 * the brief is the order form, kickoff is the payment staff collect), so
 * the rail shows what is real and dates only what carries a timestamp.
 */
const rail = computed(() => {
  const s = status.value
  const after = (k: string) => ['IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'].includes(s) && (k !== 'IN_REVIEW' || ['IN_REVIEW', 'COMPLETED'].includes(s)) && (k !== 'COMPLETED' || s === 'COMPLETED')
  const steps = [
    { label: 'Order placed', ok: true, at: p.value?.createdAt, to: 'order' },
    { label: 'Client signed', ok: signed.value, at: contract.value?.signedAt, to: 'agreement' },
    { label: 'Owner assigned', ok: Boolean(p.value?.managerId), at: null, to: 'overview' },
    { label: 'Kickoff collected', ok: kickoffDone.value && s !== 'PENDING' ? true : Boolean(p.value?.kickoffPaidAt), at: p.value?.kickoffPaidAt, to: 'payments' },
    { label: 'In progress', ok: after('IN_PROGRESS'), at: null, to: 'delivery' },
    { label: 'Client review', ok: after('IN_REVIEW'), at: null, to: 'delivery' },
    { label: 'Delivered', ok: after('COMPLETED'), at: null, to: 'delivery' },
  ] as { label: string, ok: boolean, at: string | null | undefined, to: Tab }[]
  const cur = s === 'CANCELLED' ? -1 : steps.findIndex(x => !x.ok)
  return steps.map((x, i) => ({ ...x, cur: i === cur, last: i === steps.length - 1, when: x.ok ? (x.at ? ukDateTime(x.at) : 'Done') : i === cur ? 'Now' : '—' }))
})

/** "Next step · <who>": the one thing that moves this project on. */
const next = computed(() => {
  const s = status.value
  if (s === 'CANCELLED') {
    return { who: '—', title: 'Cancelled', body: 'This order was cancelled. Nothing further is collected.' }
  }
  if (s === 'PENDING' && !p.value?.managerId) {
    return { who: 'Owner or Admin', title: 'Assign a project owner', body: 'Choose who runs this project in the checklist below. They are named to the client on their order.' }
  }
  if (s === 'PENDING' && !kickoffDone.value) {
    return { who: 'Project owner', title: `Collect the ${kickoffLabel.value.toLowerCase()}`, body: `${canMoney.value ? `${gbp(p.value?.kickoffAmount ?? 0)} is` : 'The kickoff payment is'} taken from the client’s wallet after the kickoff call, as the agreement states. Collecting it starts the work.` }
  }
  if (s === 'PENDING') {
    return { who: 'Project owner', title: 'Start the project', body: 'Everything is in place. Starting shows “In progress” to the client and opens the milestone plan.' }
  }
  if (s === 'IN_PROGRESS') {
    return nextStage.value
      ? { who: ownerName.value ?? 'Owner', title: `Deliver “${nextStage.value.title}”`, body: `Milestone ${currentIndex.value + 1} of ${milestones.value.length}. Completing it moves the client’s timeline on and recomputes progress.` }
      : { who: ownerName.value ?? 'Owner', title: 'All milestones complete', body: 'Send it to the client for review, or mark it as delivered in Settings.' }
  }
  if (s === 'IN_REVIEW') {
    return { who: 'Client', title: `Waiting for ${clientName.value}’s approval`, body: `The client is reviewing the work in My orders. Deliverables are ${deliverables.value?.released ? 'released.' : 'held until paid unless you release them.'}` }
  }
  return { who: '—', title: 'Delivered', body: plan.value ? `${plan.value.monthsPaid} of ${plan.value.monthsTotal} instalments paid. ${plan.value.monthsPaid >= plan.value.monthsTotal ? 'The plan is complete.' : 'The plan continues on schedule.'}` : 'The work is complete.' }
})

/** The checks this platform can actually make before work starts. */
const gates = computed(() => [
  { key: 'signed', label: 'Client signed the agreement', ok: signed.value, detail: signed.value ? `${contract.value?.signerName || clientName.value}${contract.value?.signedAt ? ` · ${ukDateTime(contract.value.signedAt)}` : ''}${contract.value?.signedIp ? ` · IP ${contract.value.signedIp}` : ''}` : 'No signed agreement is attached to this order.' },
  { key: 'owner', label: 'Project owner assigned', ok: Boolean(p.value?.managerId), detail: ownerName.value ?? 'Unassigned' },
  { key: 'kickoff', label: 'Kickoff payment collected', ok: Boolean(p.value?.kickoffPaidAt), detail: p.value?.kickoffPaidAt ? `${canMoney.value ? `${gbp(p.value.kickoffAmount ?? 0)} · ` : ''}${ukDateTime(p.value.kickoffPaidAt)}` : p.value?.serviceId ? 'Collected by staff after the kickoff call; it starts the work.' : 'This order has no kickoff payment.' },
])
const gatesDone = computed(() => gates.value.filter(g => g.ok).length)

const facts = computed(() => {
  const pl = plan.value
  const rows = [
    { k: 'Service', v: p.value?.category ?? '—' },
    { k: 'Plan', v: pl ? (canMoney.value ? `${pl.monthsTotal} × ${formatCurrency(pl.monthlyAmount || pl.amountDue)} = ${formatCurrency(pl.total)}` : `${pl.monthsTotal} monthly payments`) : (canMoney.value ? formatCurrency(p.value?.amount ?? 0) : 'One payment') },
    { k: 'Paid so far', v: pl ? (canMoney.value ? `${formatCurrency(pl.paid)} (${pl.monthsPaid} of ${pl.monthsTotal})` : `${pl.monthsPaid} of ${pl.monthsTotal} instalments`) : '—' },
    { k: 'Next instalment', v: pl ? (pl.monthsPaid >= pl.monthsTotal ? 'None, plan complete' : `${canMoney.value ? `${formatCurrency(pl.amountDue)} · ` : ''}${p.value?.kickoffPaidAt ? ukDate(pl.nextDue) : 'After kickoff'}`) : '—' },
    { k: 'Target launch', v: p.value?.deadline ? ukDate(p.value.deadline) : 'Not provided' },
    { k: 'Agreement', v: contract.value ? `${contract.value.reference} · ${contract.value.status.toLowerCase()}` : 'None attached' },
    { k: 'Ordered', v: ukDateTime(p.value?.createdAt) },
    { k: 'Progress', v: `${p.value?.progress ?? 0}%` },
    { k: 'Last updated', v: ukDateTime(p.value?.updatedAt) },
  ]
  return rows
})

/** The instalment schedule: paid rows from the ledger count, the rest from `nextDue`. */
const schedule = computed(() => {
  const pl = plan.value
  if (!pl) {
    return []
  }
  return Array.from({ length: pl.monthsTotal }, (_, k) => {
    const paid = k < pl.monthsPaid
    const isNext = k === pl.monthsPaid && Boolean(p.value?.kickoffPaidAt)
    let due = 'After kickoff'
    if (p.value?.kickoffPaidAt && !paid) {
      const d = new Date(pl.nextDue)
      d.setMonth(d.getMonth() + (k - pl.monthsPaid))
      due = ukDate(d)
    }
    else if (paid) {
      due = 'Collected'
    }
    return { n: `${k + 1} / ${pl.monthsTotal}`, due, amount: formatCurrency(pl.monthlyAmount || pl.amountDue), status: paid ? 'Paid' : isNext ? 'Next' : p.value?.kickoffPaidAt ? 'Scheduled' : 'Not yet due', tone: paid ? 'success' : isNext ? 'info' : 'neutral' } as const
  })
})

async function confirmKickoff() {
  const reason = await ask({
    title: `Collect the ${kickoffLabel.value.toLowerCase()}?`,
    body: `This confirms the kickoff call was held and starts the work. ${clientName.value} sees “In progress” in My orders.`,
    points: [{ tone: 'accent', text: `${canMoney.value ? gbp(p.value?.kickoffAmount ?? 0) : 'The kickoff payment'} is taken from the client’s wallet now. If the wallet is short, nothing is charged and the reason is shown.` }],
    confirmLabel: 'Collect and start',
  })
  if (reason !== null) {
    await collectKickoff()
  }
}

async function startProject() {
  const reason = await ask({
    title: `Start ${p.value?.name}?`,
    body: `The client’s order moves to “In progress” in My orders and the milestone plan opens.${ownerName.value ? ` ${ownerName.value} is the owner.` : ''}`,
    confirmLabel: 'Start project',
  })
  if (reason === null) {
    return
  }
  try {
    await $fetch(`/api/admin/projects/${projectId}`, { method: 'PATCH', body: { status: 'IN_PROGRESS' } })
    toaster.add({ title: `${p.value?.name} has started`, icon: 'lucide:check', progress: true })
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The project could not be started.')
  }
}

async function setStatus(next: string, label: string) {
  try {
    await $fetch(`/api/admin/projects/${projectId}`, { method: 'PATCH', body: { status: next } })
    toaster.add({ title: label, icon: 'lucide:check', progress: true })
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The stage could not be changed.')
  }
}

async function askRelease() {
  const owed = reasonRequired.value
  const reason = await ask({
    title: `Release deliverables to ${clientName.value}?`,
    body: `${fileCount.value} file${fileCount.value === 1 ? '' : 's'} become downloadable in the client’s My orders.`,
    points: owed && plan.value ? [{ tone: 'warning', text: `${plan.value.monthsPaid} of ${plan.value.monthsTotal} instalments paid (${formatCurrency(paidSoFar.value)} of ${formatCurrency(planTotal.value)}). Releasing hands over the files before the balance is settled.` }] : [],
    reason: owed ? { required: true, label: 'Why release before payment?', placeholder: 'e.g. Balance continues on the agreed schedule', hint: 'Stored with the audit entry.' } : undefined,
    confirmLabel: 'Release files',
  })
  if (reason === null) {
    return
  }
  releaseReason.value = reason
  await confirmRelease()
}

async function askWithdraw() {
  const reason = await ask({
    title: 'Withdraw download access?',
    body: 'The client keeps seeing the file names but can no longer download them. You can release them again later.',
    reason: { required: false, label: 'Reason (optional)', placeholder: 'e.g. Released to the wrong client', hint: 'Stored with the audit entry.' },
    confirmLabel: 'Withdraw access',
    danger: true,
  })
  if (reason === null) {
    return
  }
  withdrawReason.value = reason
  await confirmWithdraw()
}

async function askDelete() {
  const reason = await ask({
    title: `Delete ${p.value?.name}?`,
    body: 'The project, its milestones and its files are removed for good. Payments already taken stay in the ledger.',
    points: [{ tone: 'danger', text: 'This cannot be undone.' }],
    confirmLabel: 'Delete project',
    danger: true,
  })
  if (reason !== null) {
    await deleteProject()
  }
}

async function askWithdrawAction(id: string, title: string) {
  const reason = await ask({ title: `Withdraw “${title}”?`, body: 'The request disappears from the client’s list. It is kept on record as withdrawn.', confirmLabel: 'Withdraw request' })
  if (reason !== null) {
    await withdrawAsk(id)
  }
}

const TAB_CLS = 'apex-ring -mb-px inline-flex h-10 shrink-0 cursor-pointer items-center gap-[7px] border-b-2 text-sm'
</script>

<template>
  <AdminPage gap="md">
    <div v-if="!project" class="py-16 text-center">
      <AdminEmptyState icon="lucide:folder-x" title="Project not found" subtitle="It may have been deleted, or the link is wrong.">
        <AdminButton to="/admin/projects">
          Back to projects
        </AdminButton>
      </AdminEmptyState>
    </div>

    <template v-else>
      <!-- Identity -->
      <div class="flex flex-wrap items-start gap-3.5">
        <div class="flex min-w-0 flex-1 basis-[320px] flex-col gap-1.5">
          <div class="text-fg-muted flex flex-wrap items-center gap-2.5 text-[13px]">
            <span class="bg-chip border-line-subtle text-fg-heading rounded-[7px] border px-2 py-[3px] font-mono text-xs">{{ orderRef(project.id) }}</span>
            <span>{{ project.category }}<template v-if="plan"> · {{ plan.monthsTotal }} payments</template></span>
          </div>
          <h1 class="font-heading text-fg-heading text-[23px] font-extrabold leading-[1.1] tracking-[-0.025em] sm:text-[30px]">
            {{ project.name }}
          </h1>
          <p class="text-fg-body text-sm">
            {{ clientName }}<template v-if="project.user?.company?.name">
              · {{ project.user.company.name }}
            </template> · ordered {{ ukDateTime(project.createdAt) }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2.5 pt-1">
          <AdminStatusChip :tone="stageOf(project.status).tone" :label="stageOf(project.status).label" dot />
          <AdminButton v-if="contract" :to="`/admin/contracts/${contract.id}`">
            Agreement <Icon name="lucide:arrow-up-right" class="size-3.5" />
          </AdminButton>
          <AdminButton v-if="canAssign && project.status === 'IN_PROGRESS'" @click="setStatus('IN_REVIEW', 'Sent to the client for review')">
            Send for review
          </AdminButton>
        </div>
      </div>

      <!-- Lifecycle rail -->
      <section class="bg-card border-line-subtle overflow-x-auto rounded-2xl border px-[18px] pb-[18px] pt-5 sm:px-[22px]" aria-label="Project lifecycle">
        <ol class="grid min-w-[640px] grid-cols-7">
          <li v-for="r in rail" :key="r.label">
            <button type="button" class="apex-ring flex w-full min-w-0 cursor-pointer flex-col gap-2 rounded-lg pe-2 text-start" @click="tab = r.to">
              <span class="flex items-center">
                <span
                  class="inline-flex size-7 shrink-0 items-center justify-center rounded-full"
                  :class="r.ok ? 'bg-[#22B07D] text-white' : r.cur ? 'bg-accent shadow-[0_0_0_4px_var(--accent-tint)] text-white' : 'border-line-strong text-fg-muted border-2'"
                >
                  <Icon :name="r.ok ? 'lucide:check' : r.cur ? 'lucide:circle-dot' : 'lucide:circle'" class="size-3.5" />
                </span>
                <span v-if="!r.last" class="mx-1.5 h-0.5 flex-1 rounded" :class="r.ok ? 'bg-[#22B07D]' : 'bg-line-subtle'" />
              </span>
              <span class="text-[13px] font-semibold leading-[1.3]" :class="r.ok || r.cur ? 'text-fg-heading' : 'text-fg-muted'">{{ r.label }}</span>
              <span class="text-fg-muted text-[11.5px] leading-[1.35]"><ClientOnly>{{ r.when }}</ClientOnly></span>
            </button>
          </li>
        </ol>
      </section>

      <div v-if="project.status === 'CANCELLED'" class="bg-st-danger-bg text-fg-heading flex gap-2.5 rounded-xl px-4 py-3 text-[13.5px] leading-normal">
        <Icon name="lucide:circle-x" class="mt-0.5 size-4 shrink-0 text-[#EC6453]" />This order is cancelled.
      </div>

      <!-- Tabs -->
      <div class="border-line-subtle flex gap-6 overflow-x-auto border-b" role="tablist" aria-label="Project sections">
        <button
          v-for="t in tabs" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key" :aria-controls="`pj-${t.key}`"
          :class="[TAB_CLS, tab === t.key ? 'border-accent text-fg-heading font-semibold' : 'text-fg-muted border-transparent font-medium']"
          @click="tab = t.key"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- ===================================================== Overview -->
      <div v-if="tab === 'overview'" id="pj-overview" role="tabpanel" class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div class="flex min-w-0 flex-col gap-5">
          <section class="border-accent/40 bg-accent-tint flex flex-col gap-2.5 rounded-2xl border px-[22px] py-5">
            <span class="text-accent-ink text-[11.5px] font-bold uppercase tracking-[0.07em]">Next step · {{ next.who }}</span>
            <span class="font-heading text-fg-heading text-[21px] font-bold tracking-[-0.02em]">{{ next.title }}</span>
            <span class="text-fg-heading text-sm leading-[1.6] opacity-85">{{ next.body }}</span>
            <div class="mt-1 flex flex-wrap items-center gap-2.5">
              <template v-if="canAssign">
                <AdminButton v-if="project.status === 'PENDING' && !kickoffDone && project.managerId" variant="primary" :disabled="collecting" @click="confirmKickoff">
                  Collect {{ kickoffLabel.toLowerCase() }}
                </AdminButton>
                <AdminButton v-else-if="project.status === 'PENDING' && kickoffDone && project.managerId" variant="primary" @click="startProject">
                  <Icon name="lucide:play" class="size-3.5" />Start project
                </AdminButton>
                <AdminButton v-if="project.status === 'IN_PROGRESS' && nextStage" variant="primary" :disabled="advancing" @click="advanceStage">
                  Complete “{{ nextStage.title }}”
                </AdminButton>
                <AdminButton v-if="project.status === 'IN_REVIEW'" variant="primary" @click="setStatus('COMPLETED', 'Marked as delivered')">
                  Mark as delivered
                </AdminButton>
              </template>
              <AdminButton v-if="canRelease && fileCount && !deliverables?.released && ['IN_REVIEW', 'COMPLETED'].includes(project.status)" @click="askRelease">
                Release deliverables
              </AdminButton>
              <span v-if="!canAssign && project.status !== 'COMPLETED' && project.status !== 'CANCELLED'" class="text-fg-muted text-[12.5px]">Moving a project on needs Owner, Admin or Project manager.</span>
            </div>
          </section>

          <AdminCard label="Ready to start" :meta="`${gatesDone} of ${gates.length} done`">
            <ul>
              <li v-for="g in gates" :key="g.key" class="border-line-soft grid grid-cols-[28px_minmax(0,1fr)] items-center gap-3 border-t px-[18px] py-3 sm:grid-cols-[28px_minmax(0,1fr)_auto] sm:px-[22px]">
                <span class="inline-flex size-[26px] items-center justify-center rounded-full" :class="g.ok ? 'bg-[#22B07D] text-white' : 'border-line-strong text-fg-muted border-2 border-dashed'">
                  <Icon :name="g.ok ? 'lucide:check' : 'lucide:minus'" class="size-3.5" />
                </span>
                <span class="min-w-0">
                  <span class="text-fg-heading block text-sm font-semibold">{{ g.label }}</span>
                  <span class="mt-0.5 block text-[12.5px] leading-[1.45]" :class="g.ok ? 'text-fg-muted' : 'text-fg-body'"><ClientOnly>{{ g.detail }}</ClientOnly></span>
                </span>
                <span v-if="g.key === 'owner' && canAssign && project.status !== 'COMPLETED'" class="col-span-2 sm:col-span-1">
                  <AdminButton size="sm" @click="showAssign = true">{{ project.managerId ? 'Change' : 'Assign owner' }}</AdminButton>
                </span>
              </li>
            </ul>
            <div class="border-line-subtle flex flex-wrap items-center gap-3 border-t px-[18px] pb-[18px] pt-3.5 sm:px-[22px]">
              <span class="text-fg-muted min-w-[200px] flex-1 text-[13px] leading-normal">
                {{ project.status !== 'PENDING' ? 'This project has started.' : gatesDone === gates.length ? 'Everything is in place. Starting shows “In progress” to the client.' : `${gates.length - gatesDone} check${gates.length - gatesDone === 1 ? '' : 's'} outstanding.` }}
              </span>
              <AdminButton v-if="project.status === 'PENDING' && canAssign" variant="primary" :disabled="!kickoffDone || !project.managerId" @click="startProject">
                <Icon name="lucide:play" class="size-3.5" />Start project
              </AdminButton>
            </div>
          </AdminCard>

          <AdminCard label="At a glance" padded>
            <dl class="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
              <div v-for="f in facts" :key="f.k" class="flex min-w-0 flex-col gap-[3px]">
                <dt class="text-fg-muted text-xs">
                  {{ f.k }}
                </dt>
                <dd class="text-fg-heading break-words text-sm tabular-nums">
                  <ClientOnly>{{ f.v }}</ClientOnly>
                </dd>
              </div>
            </dl>
          </AdminCard>
        </div>

        <div class="flex min-w-0 flex-col gap-5">
          <AdminCard label="People" padded>
            <div class="flex items-start gap-3">
              <ApexPanelAvatar :person="project.user" :size="38" />
              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="text-fg-heading text-sm font-semibold">{{ clientName }}</span>
                <span class="text-fg-muted text-[12.5px]">Client contact<template v-if="project.user?.company?.name"> · {{ project.user.company.name }}</template></span>
                <span class="text-fg-body truncate text-[12.5px]">{{ [project.user?.email, project.user?.phone].filter(Boolean).join(' · ') }}</span>
              </span>
            </div>
            <div class="flex items-start gap-3">
              <ApexPanelAvatar v-if="project.manager" :person="project.manager" :size="38" />
              <span v-else class="inline-flex size-[38px] shrink-0 items-center justify-center rounded-full bg-[#D9A521] text-[12.5px] font-bold text-white">?</span>
              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="text-fg-heading text-sm font-semibold">{{ ownerName ?? 'Unassigned' }}</span>
                <span class="text-fg-muted text-[12.5px]">Project owner<template v-if="project.manager"> · {{ staffLabel(project.manager) }}</template></span>
                <span class="text-fg-body truncate text-[12.5px]">{{ project.manager?.email ?? 'Assign one in Ready to start' }}</span>
              </span>
            </div>
          </AdminCard>

          <AdminCard padded>
            <div class="flex items-center gap-2.5">
              <ApexSectionLabel>Staff notes</ApexSectionLabel>
              <AdminStatusChip tone="warning" label="Staff only" class="h-[22px]!" />
            </div>
            <div v-for="n in notes" :key="n.id" class="bg-st-warning-bg text-fg-heading rounded-[10px] border border-dashed border-[#D9A521] px-3 py-2.5 text-[13.5px] leading-normal">
              <span class="text-fg-muted mb-[3px] block text-xs">{{ n.authorEmail ?? 'Staff' }} · <ClientOnly>{{ ukDateTime(n.createdAt) }}</ClientOnly></span>
              {{ n.body }}
            </div>
            <span v-if="!notes.length" class="text-fg-muted text-[13px]">No notes yet. Clients never see these.</span>
            <form v-if="canAssign" class="flex gap-2" @submit.prevent="addNote">
              <label class="sr-only" for="pj-note">Add a note for the team</label>
              <input id="pj-note" v-model="noteDraft" placeholder="Add a note for the team" :class="ADMIN_INPUT" class="border-dashed border-[#D9A521]">
              <AdminButton type="submit" :disabled="savingNote || !noteDraft.trim()">
                Add
              </AdminButton>
            </form>
          </AdminCard>

          <AdminCard label="Latest activity">
            <template #aside>
              <button type="button" class="apex-ring text-accent-ink rounded text-[13px] font-semibold" @click="tab = 'activity'">
                All {{ activityAll.length }} →
              </button>
            </template>
            <ul>
              <li v-for="(e, i) in activityAll.slice(0, 5)" :key="i" class="border-line-soft flex gap-2.5 border-t px-5 py-2.5">
                <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="e.tone" aria-hidden="true" />
                <span class="min-w-0 flex-1">
                  <span class="text-fg-heading block text-[13.5px]">{{ e.text }}</span>
                  <span class="text-fg-muted mt-0.5 block text-xs">{{ e.who }} · {{ e.when }}</span>
                </span>
              </li>
            </ul>
          </AdminCard>
        </div>
      </div>

      <!-- ================================================ Order & brief -->
      <div v-else-if="tab === 'order'" id="pj-order" role="tabpanel" class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <AdminCard label="Client’s request" padded>
          <dl v-if="brief.length" class="bg-raised grid grid-cols-1 gap-x-3 gap-y-2 rounded-xl px-4 py-3.5 sm:grid-cols-[150px_minmax(0,1fr)]">
            <template v-for="b in brief" :key="b.label">
              <dt class="text-fg-muted text-[12.5px]">
                {{ b.label }}
              </dt>
              <dd class="text-fg-heading text-[13.5px] leading-normal">
                {{ b.value }}
              </dd>
            </template>
          </dl>
          <p v-else class="text-fg-body text-[13.5px]">
            This order was created without a brief.
          </p>
          <span class="text-fg-muted text-xs">In the client’s words, from the order form. Read-only here.</span>
          <div class="flex flex-col gap-1.5">
            <span class="text-fg-muted text-xs font-bold uppercase tracking-[0.05em]">Files from the client</span>
            <a v-for="f in clientFiles" :key="f.id" :href="`/api/attachments/${f.id}`" target="_blank" class="apex-ring border-line-subtle hover:bg-raised flex items-center gap-2.5 rounded-[10px] border px-3 py-[9px]">
              <Icon name="lucide:paperclip" class="text-fg-muted size-3.5" />
              <span class="text-fg-heading min-w-0 flex-1 truncate text-[13.5px]">{{ f.name }}</span>
              <span class="text-fg-muted text-xs">{{ Math.max(1, Math.round(f.size / 1024)) }} KB</span>
            </a>
            <span v-if="!clientFiles.length" class="text-fg-body text-[13px]">None attached.</span>
          </div>
        </AdminCard>

        <AdminCard label="Waiting on the client" padded>
          <p class="text-fg-body text-[13px] leading-normal">
            Things you have asked the client to do. They answer in My orders; anything open shows on their dashboard.
          </p>
          <ul v-if="clientActions.length">
            <li v-for="a in clientActions" :key="a.id" class="border-line-soft flex flex-col gap-1 border-t py-2.5">
              <span class="text-fg-heading text-[13.5px] font-semibold">{{ a.title }}</span>
              <span v-if="a.body" class="text-fg-body text-[13px]">{{ a.body }}</span>
              <span class="flex flex-wrap items-center gap-2">
                <AdminStatusChip :tone="a.status === 'DONE' ? 'success' : a.status === 'CANCELLED' ? 'neutral' : 'warning'" :label="a.status === 'DONE' ? 'Done' : a.status === 'CANCELLED' ? 'Withdrawn' : 'Waiting'" class="h-[22px]!" />
                <span class="text-fg-muted text-xs"><ClientOnly>{{ ukDateTime(a.resolvedAt ?? a.createdAt) }}</ClientOnly></span>
                <button v-if="canAssign && a.status === 'OPEN'" type="button" class="apex-ring text-st-danger-fg ms-auto rounded text-[12.5px] font-semibold" @click="askWithdrawAction(a.id, a.title)">Withdraw</button>
              </span>
            </li>
          </ul>
          <span v-else class="text-fg-body text-[13px]">Nothing asked since the order was placed.</span>
          <form v-if="canAssign" class="border-line-soft flex flex-col gap-2.5 border-t pt-3" @submit.prevent="sendAsk">
            <div>
              <label for="ask-title" :class="ADMIN_LABEL">Ask the client to…</label>
              <input id="ask-title" v-model="askTitle" placeholder="e.g. Approve the homepage design" :class="ADMIN_INPUT">
            </div>
            <div>
              <label for="ask-body" :class="ADMIN_LABEL">Details <span class="text-fg-muted font-normal">(optional)</span></label>
              <textarea id="ask-body" v-model="askBody" rows="2" :class="ADMIN_TEXTAREA" />
            </div>
            <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label for="ask-cta" :class="ADMIN_LABEL">Button</label>
                <input id="ask-cta" v-model="askCta" :class="ADMIN_INPUT">
              </div>
              <div>
                <label for="ask-done" :class="ADMIN_LABEL">Shown when done <span class="text-fg-muted font-normal">(optional)</span></label>
                <input id="ask-done" v-model="askDone" :class="ADMIN_INPUT">
              </div>
            </div>
            <div class="flex justify-end">
              <AdminButton type="submit" variant="primary" :disabled="asking || askTitle.trim().length < 3">
                Send request
              </AdminButton>
            </div>
          </form>
        </AdminCard>
      </div>

      <!-- ==================================================== Agreement -->
      <div v-else-if="tab === 'agreement'" id="pj-agreement" role="tabpanel" class="flex flex-col gap-5">
        <AdminCard v-if="contract" padded>
          <div class="flex flex-wrap items-center gap-3">
            <Icon name="solar:document-text-linear" class="text-accent-ink size-[22px]" />
            <span class="font-heading text-fg-heading text-[19px] font-bold tracking-[-0.015em]">{{ contract.reference }}</span>
            <AdminStatusChip :status="contract.status" dot />
            <span class="flex-1" />
            <AdminButton :to="`/admin/contracts/${contract.id}`">
              Open the full agreement
            </AdminButton>
          </div>
          <dl class="border-line-soft grid grid-cols-2 gap-x-5 gap-y-3.5 border-t pt-3.5 md:grid-cols-4">
            <div
              v-for="m in [
                { k: 'Signed by', v: contract.signerName || clientName },
                { k: 'Signed', v: ukDateTime(contract.signedAt) },
                { k: 'Method', v: contract.signatureType === 'drawn' ? 'Drawn signature' : 'Typed signature' },
                { k: 'IP address', v: contract.signedIp || 'Not recorded' },
                { k: 'Document version', v: contract.documentVersion || '—' },
                { k: 'Device', v: contract.signedUserAgent || 'Not recorded' },
              ]" :key="m.k" class="flex min-w-0 flex-col gap-[3px]"
            >
              <dt class="text-fg-muted text-xs">
                {{ m.k }}
              </dt>
              <dd class="text-fg-heading truncate text-[13.5px]">
                <ClientOnly>{{ m.v }}</ClientOnly>
              </dd>
            </div>
          </dl>
          <div v-if="signature" class="bg-raised rounded-xl px-4 py-3">
            <span class="text-fg-muted block text-xs">Signature</span>
            <img v-if="signatureIsImage" :src="signature" alt="The client’s drawn signature" class="mt-1 h-16 w-auto dark:invert">
            <span v-else class="font-heading text-fg-heading mt-1 block text-[26px] font-semibold italic tracking-[-0.02em]">{{ signature }}</span>
          </div>
          <p class="text-fg-muted text-[12.5px] leading-normal">
            Orders are signed by the client alone; Apex does not countersign in the panel. The agreement record, its hash and the evidence above are kept unchanged.
          </p>
        </AdminCard>
        <AdminEmptyState v-else icon="solar:document-text-linear" title="No agreement attached" subtitle="Orders placed in the portal carry the signed agreement. This one was created by staff, so it has none." />
      </div>

      <!-- ===================================================== Payments -->
      <div v-else-if="tab === 'payments' && canMoney" id="pj-payments" role="tabpanel" class="flex flex-col gap-5">
        <template v-if="plan">
          <div class="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            <AdminStatTile label="Plan total" :value="formatCurrency(plan.total)" />
            <AdminStatTile label="Paid so far" :value="formatCurrency(plan.paid)" :hint="`${plan.monthsPaid} of ${plan.monthsTotal} instalments`" />
            <AdminStatTile label="Monthly" :value="formatCurrency(plan.monthlyAmount || plan.amountDue)" />
            <AdminStatTile label="Kickoff" :value="project.kickoffPaidAt ? 'Collected' : 'Not yet'" :hint="project.kickoffPaidAt ? ukDate(project.kickoffPaidAt) : kickoffLabel" />
          </div>
          <AdminCard label="Schedule" :meta="`${plan.monthsPaid} of ${plan.monthsTotal} paid`">
            <div class="flex flex-wrap gap-1.5 px-[22px] pb-3.5" aria-hidden="true">
              <span v-for="(r, k) in schedule" :key="k" class="size-4 rounded-full" :class="r.status === 'Paid' ? 'bg-accent' : r.status === 'Next' ? 'border-accent border-2' : 'bg-dot-unpaid'" />
            </div>
            <div class="hidden grid-cols-[90px_minmax(0,1fr)_110px_120px] gap-3.5 px-[22px] pb-2 sm:grid" :class="ADMIN_TH">
              <span>Payment</span><span>Due</span><span class="text-end">Amount</span><span>Status</span>
            </div>
            <ul>
              <li v-for="r in schedule" :key="r.n" class="border-line-soft grid grid-cols-[70px_minmax(0,1fr)_auto] items-center gap-3.5 border-t px-[18px] py-2.5 text-[13.5px] sm:grid-cols-[90px_minmax(0,1fr)_110px_120px] sm:px-[22px]">
                <span class="text-fg-muted tabular-nums">{{ r.n }}</span>
                <span class="text-fg-body"><ClientOnly>{{ r.due }}</ClientOnly></span>
                <span class="text-fg-heading hidden text-end tabular-nums sm:block">{{ r.amount }}</span>
                <AdminStatusChip :tone="r.tone" :label="r.status" />
              </li>
            </ul>
          </AdminCard>
        </template>
        <AdminEmptyState v-else icon="lucide:wallet" title="No instalment plan" subtitle="This order is paid in one payment or was created by staff without a plan." />
        <AdminCard v-if="(data?.charges ?? []).length" label="Collected">
          <ul>
            <li v-for="c in data?.charges ?? []" :key="c.id" class="border-line-soft flex items-center gap-3 border-t px-[22px] py-2.5 text-[13.5px]">
              <span class="text-fg-heading min-w-0 flex-1 truncate">{{ c.description || 'Instalment collected' }}</span>
              <span class="text-fg-muted text-xs"><ClientOnly>{{ ukDateTime(c.createdAt) }}</ClientOnly></span>
              <span class="text-fg-heading tabular-nums">{{ formatCurrency(Math.abs(c.amount)) }}</span>
            </li>
          </ul>
        </AdminCard>
      </div>

      <!-- ===================================================== Delivery -->
      <div v-else-if="tab === 'delivery'" id="pj-delivery" role="tabpanel" class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <AdminCard label="Milestones" :meta="`${milestones.filter(m => m.status === 'COMPLETED').length} of ${milestones.length} done`" padded>
          <ol>
            <li v-for="(m, i) in milestones" :key="m.id" class="grid grid-cols-[30px_minmax(0,1fr)_auto] gap-3.5">
              <span class="flex flex-col items-center">
                <span
                  class="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold"
                  :class="m.status === 'COMPLETED' ? 'bg-[#22B07D] text-white' : m.status === 'CURRENT' ? 'bg-accent text-white' : 'border-line-strong text-fg-muted border-2'"
                >{{ m.status === 'COMPLETED' ? '✓' : i + 1 }}</span>
                <span v-if="i < milestones.length - 1" class="my-1 min-h-3 w-0.5 flex-1" :class="m.status === 'COMPLETED' ? 'bg-[#22B07D]' : 'bg-line-subtle'" />
              </span>
              <span class="min-w-0 pb-4">
                <span class="text-fg-heading block text-sm font-semibold">{{ m.title }}</span>
                <span class="text-fg-muted mt-0.5 block text-[12.5px]"><ClientOnly>{{ m.status === 'COMPLETED' ? `Completed ${m.date ? ukDate(m.date) : ''}` : m.status === 'CURRENT' ? 'In progress' : 'Planned' }}</ClientOnly></span>
              </span>
              <span v-if="canAssign" class="flex items-start gap-1.5">
                <button type="button" class="apex-ring text-accent-ink rounded text-[12.5px] font-semibold" :aria-label="`Change the status of ${m.title}`" @click="cycleMilestone(m)">
                  {{ m.status === 'PENDING' ? 'Start' : m.status === 'CURRENT' ? 'Complete' : 'Reopen' }}
                </button>
                <button type="button" class="apex-ring text-fg-muted hover:text-st-danger-fg rounded p-0.5" :aria-label="`Remove ${m.title}`" @click="deleteMilestone(m.id)">
                  <Icon name="lucide:trash-2" class="size-3.5" />
                </button>
              </span>
            </li>
          </ol>
          <p v-if="!milestones.length" class="text-fg-body text-[13.5px]">
            No milestones yet.
          </p>
          <form v-if="canAssign" class="flex gap-2" @submit.prevent="addMilestone">
            <label class="sr-only" for="ms-new">New milestone</label>
            <input id="ms-new" v-model="newMilestone" placeholder="Add a milestone" :class="ADMIN_INPUT">
            <AdminButton type="submit" :disabled="addingMilestone || !newMilestone.trim()">
              Add
            </AdminButton>
          </form>
        </AdminCard>

        <AdminCard label="Deliverables" :meta="`${fileCount} file${fileCount === 1 ? '' : 's'}`" padded>
          <div
            class="flex gap-3 rounded-xl px-4 py-3.5"
            :class="gate.key === 'held' ? 'bg-st-warning-bg' : gate.key === 'released' ? 'bg-st-success-bg' : 'bg-raised'"
          >
            <Icon :name="gate.icon" class="text-fg-heading mt-0.5 size-[18px] shrink-0" />
            <span class="min-w-0">
              <span class="text-fg-heading block text-sm font-semibold">{{ gate.title }}</span>
              <span class="text-fg-body mt-0.5 block text-[13px] leading-normal">{{ gate.body }}</span>
              <span v-if="gate.key === 'held' && canMoney && plan" class="text-fg-heading mt-1.5 block text-[13px]">{{ formatCurrency(paidSoFar) }} of {{ formatCurrency(planTotal) }} paid · {{ formatCurrency(outstanding) }} outstanding</span>
            </span>
          </div>
          <ul v-if="project.files.length">
            <li v-for="f in project.files" :key="f.id" class="border-line-soft flex items-center gap-2.5 border-t py-2.5">
              <Icon name="lucide:file" class="text-fg-muted size-4 shrink-0" />
              <span class="text-fg-heading min-w-0 flex-1 truncate text-[13.5px]">{{ f.name }}</span>
              <span class="text-fg-muted text-xs">{{ f.size }}</span>
            </li>
          </ul>
          <div class="flex flex-wrap items-center gap-2.5">
            <span class="text-fg-muted min-w-[180px] flex-1 text-[12.5px] leading-[1.45]">
              {{ canRelease ? (deliverables?.released ? 'The client can download these files.' : 'Files stay hidden until released.') : 'Releasing needs Owner, Admin or Project manager.' }}
            </span>
            <AdminButton v-if="canRelease && fileCount && !deliverables?.released" variant="primary" :disabled="releasing" @click="askRelease">
              Release to client
            </AdminButton>
            <AdminButton v-if="canRelease && deliverables?.released" :disabled="releasing" @click="askWithdraw">
              Withdraw access
            </AdminButton>
          </div>
        </AdminCard>
      </div>

      <!-- ===================================================== Activity -->
      <AdminCard v-else-if="tab === 'activity'" id="pj-activity" role="tabpanel" label="Activity" meta="Newest first. Audited actions, collections and the order itself.">
        <ul>
          <li v-for="(e, i) in activityAll" :key="i" class="border-line-soft flex gap-3 border-t px-[22px] py-3">
            <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="e.tone" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="text-fg-heading block text-[13.5px]">{{ e.text }}</span>
              <span class="text-fg-muted mt-0.5 block text-xs">{{ e.who }} · {{ e.when }}</span>
            </span>
          </li>
        </ul>
      </AdminCard>

      <!-- ===================================================== Settings -->
      <div v-else-if="tab === 'settings' && canAssign" id="pj-settings" role="tabpanel" class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <AdminCard label="Project details" padded>
          <form id="pj-details" class="grid grid-cols-1 gap-3.5 sm:grid-cols-2" @submit.prevent="saveDetails">
            <div class="sm:col-span-2">
              <label for="pd-name" :class="ADMIN_LABEL">Project name</label>
              <input id="pd-name" v-model="form.name" required :class="ADMIN_INPUT">
            </div>
            <div>
              <label for="pd-cat" :class="ADMIN_LABEL">Service</label>
              <input id="pd-cat" v-model="form.category" required :class="ADMIN_INPUT">
            </div>
            <div v-if="canMoney">
              <label for="pd-amount" :class="ADMIN_LABEL">Contract value (GBP)</label>
              <input id="pd-amount" v-model.number="form.amount" type="number" min="0" step="0.01" :class="ADMIN_INPUT">
            </div>
            <div>
              <span :class="ADMIN_LABEL">Stage</span>
              <BaseSelect v-model="form.status" rounded="lg" aria-label="Stage">
                <BaseSelectItem v-for="s in STAGES" :key="s.key" :value="s.key">
                  {{ s.label }}
                </BaseSelectItem>
              </BaseSelect>
            </div>
            <div>
              <label for="pd-deadline" :class="ADMIN_LABEL">Target launch</label>
              <input id="pd-deadline" v-model="form.deadline" type="date" :class="ADMIN_INPUT">
            </div>
            <div>
              <label for="pd-progress" :class="ADMIN_LABEL">Progress (%)</label>
              <input id="pd-progress" v-model.number="form.progress" type="number" min="0" max="100" :class="ADMIN_INPUT">
            </div>
          </form>
          <div class="flex justify-end">
            <AdminButton type="submit" form="pj-details" variant="primary" :disabled="saving">
              Save changes
            </AdminButton>
          </div>
        </AdminCard>
        <AdminCard label="Delete" padded>
          <p class="text-fg-body text-[13.5px] leading-normal">
            Removes the project, its milestones and files. Payments already taken stay in the ledger.
          </p>
          <div>
            <AdminButton variant="danger" :disabled="deleting" @click="askDelete">
              Delete project
            </AdminButton>
          </div>
        </AdminCard>
      </div>
    </template>

    <AdminDialog v-model:open="showAssign" title="Assign a project owner" description="Only staff whose role can own project work are listed. The change is recorded in the audit log.">
      <div class="flex flex-col gap-0.5 pb-2">
        <button
          v-for="s in assignable" :key="s.id" type="button" :disabled="savingAssign"
          class="apex-ring hover:bg-raised flex min-h-14 items-center gap-3 rounded-xl px-3 text-start disabled:opacity-60"
          :class="s.id === project?.managerId && 'bg-accent-tint'"
          @click="assignTo(s.id)"
        >
          <ApexPanelAvatar :person="s" :size="34" />
          <span class="min-w-0 flex-1">
            <span class="text-fg-heading block truncate text-sm font-semibold">{{ personName(s) }}</span>
            <span class="text-fg-muted mt-0.5 block truncate text-[12.5px]">{{ staffLabel(s) }}<template v-if="s.load !== undefined"> · {{ s.load }} project{{ s.load === 1 ? '' : 's' }}</template></span>
          </span>
          <Icon v-if="s.id === project?.managerId" name="lucide:check" class="text-accent-ink size-4" />
        </button>
      </div>
      <template #actions>
        <AdminButton :disabled="savingAssign || !project?.managerId" @click="assignTo(null)">
          Clear owner
        </AdminButton>
        <AdminButton variant="primary" @click="showAssign = false">
          Done
        </AdminButton>
      </template>
    </AdminDialog>
  </AdminPage>
</template>
