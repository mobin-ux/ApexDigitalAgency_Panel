<script setup lang="ts">
/**
 * New Order — Apex Design redesign (5-step order + financing wizard).
 * Service → Plan → Payment (0% / 12-mo vs 1%·24-mo) → Details → Review & sign.
 * Live order-summary rail with the financing breakdown. "Sign & start" creates a
 * real PENDING order via /api/orders.
 *
 * Below `lg` the same five steps are a task rather than a page (V2 Phase 3
 * mobile): the shell's hamburger becomes a close button that asks before
 * discarding, the labelled stepper collapses to a name plus five segments, the
 * selection grids become rows, selects open bottom sheets instead of an OS menu,
 * and the sticky rail becomes a footer strip that opens the summary as a sheet.
 * Pricing, validation, the contract and the submitted payload are unchanged.
 */
definePageMeta({
  title: 'New Order',
  layout: 'sidenav',
  middleware: 'auth',
})

const route = useRoute()
const router = useRouter()
const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()

/**
 * Below `lg` a handful of controls change container rather than styling: a
 * select becomes a sheet, the rail becomes a sheet. `useIsCompact()` resolves in
 * `onMounted`, so the server and the hydration render agree on `false` and only
 * closed overlays can be affected by the swap.
 */
const isCompact = useIsCompact()

// ---- catalogue (served by /api/config — admin-editable Setting rows) ----
interface Plan { id: string, name: string, base: number, tier: 0 | 1 | 2, popular?: boolean, desc: string, features: string[] }

const { data: appConfig } = await useFetch('/api/config', { lazy: false })

const services = computed(() => (appConfig.value as any)?.catalog?.services ?? [])
const plansByService = computed<Record<string, Plan[]>>(() => (appConfig.value as any)?.catalog?.plans ?? {})
const enable24mo = computed(() => (appConfig.value as any)?.finance?.enable24moPlans !== false)
const firstDueDays = computed(() => (appConfig.value as any)?.finance?.firstInstallmentDays ?? 30)

const tierIcon = ['lucide:zap', 'lucide:trending-up', 'lucide:award']

// Service-specific detail forms (data-driven so it stays DRY + reusable).
// `required` drives both the red marker and validation. The asterisk used to be
// baked into the label string, so it rendered in the same muted grey as the
// label and read as decoration rather than a requirement.
interface Field { key: string, label: string, type: 'text' | 'url' | 'date' | 'select' | 'textarea' | 'checkboxes', placeholder?: string, options?: string[], boxes?: { key: string, label: string }[], full?: boolean, required?: boolean }
const formSchemas: Record<string, Field[]> = {
  web: [
    { key: 'title', label: 'Project name', type: 'text', placeholder: 'e.g. Gold Store storefront', full: true, required: true },
    { key: 'url', label: 'Current website', type: 'url', placeholder: 'https:// (optional)' },
    { key: 'pages', label: 'Pages needed', type: 'select', options: ['1–3 pages', '4–8 pages', '9+ pages'] },
    { key: 'tech', label: 'Tech preference', type: 'select', options: ['No preference', 'WordPress', 'React / Next.js'] },
    { key: 'launch', label: 'Target launch', type: 'date' },
    { key: 'notes', label: 'Anything else we should know?', type: 'textarea', placeholder: 'Goals, references, must-have features…', full: true },
  ],
  mkt: [
    { key: 'title', label: 'Business name', type: 'text', placeholder: 'e.g. Nitro LLC', required: true },
    { key: 'url', label: 'Landing / site URL', type: 'url', placeholder: 'https://' },
    { key: 'budget', label: 'Monthly ad budget', type: 'select', options: ['Under £1,000', '£1,000 – £5,000', '£5,000+'] },
    { key: 'channel', label: 'Primary channel', type: 'select', options: ['Google Ads', 'Meta (FB/IG)', 'TikTok', 'LinkedIn'] },
    { key: 'goal', label: 'Main goal', type: 'select', options: ['More leads', 'More sales', 'Brand awareness'] },
    { key: 'audience', label: 'Target audience', type: 'text', placeholder: 'Who are we reaching?' },
  ],
  uiux: [
    { key: 'title', label: 'Product name', type: 'text', placeholder: 'e.g. Apex Vision app', required: true },
    { key: 'platform', label: 'Platform', type: 'select', options: ['Web app', 'iOS', 'Android', 'Web + mobile'] },
    { key: 'screens', label: 'Approx. screens', type: 'select', options: ['Up to 6', '7–20', '20+'] },
    { key: 'files', label: 'Existing design files?', type: 'select', options: ['No, starting fresh', 'Yes, in Figma', 'Yes, other format'] },
    { key: 'research', label: 'UX research needed?', type: 'select', options: ['Yes, please', 'No, we have insights'] },
    { key: 'url', label: 'Reference / inspo link', type: 'url', placeholder: 'https:// (optional)' },
  ],
  brand: [
    { key: 'title', label: 'Company name', type: 'text', placeholder: 'e.g. Okano', required: true },
    { key: 'industry', label: 'Industry', type: 'text', placeholder: 'e.g. Fintech, retail…' },
    { key: 'logo', label: 'Have a logo already?', type: 'select', options: ['No, starting fresh', 'Yes, needs a refresh'] },
    { key: 'adjectives', label: 'Brand in 3 words', type: 'text', placeholder: 'e.g. bold, warm, premium' },
    { key: 'deliverables', label: 'Deliverables needed', type: 'checkboxes', full: true, boxes: [{ key: 'd_logo', label: 'Logo suite' }, { key: 'd_guide', label: 'Brand guidelines' }, { key: 'd_cards', label: 'Business cards' }, { key: 'd_social', label: 'Social-media kit' }] },
  ],
}

// ---- state --------------------------------------------------------------
const STEP_LABELS = ['Service', 'Plan', 'Payment', 'Details', 'Contract']
const step = ref(1)
const maxStep = ref(1)
const serviceId = ref<string | null>(null)
const planId = ref<string | null>(null)
const term = ref<'12' | '24'>('24')
// If the admin disables 24-month plans (Setting finance.enable-24mo-plans),
// the option disappears and any selection falls back to 12 months.
watch(enable24mo, (on) => {
  if (!on && term.value === '24')
    term.value = '12'
}, { immediate: true })
const form = reactive<Record<string, any>>({})
const agreed = ref(false)
// Electronic-signature consent (Electronic Communications Act 2000) — a
// distinct, explicit act from agreeing to the service terms.
const esignConsent = ref(false)
const signName = ref('')
// Printed full legal name — always captured as part of the signing evidence,
// even when the customer draws their signature.
const legalName = ref('')
const hasDrawn = ref(false)
// Draw and type used to be live at the same time, so it was unclear which one
// would be submitted. One method is active at a time, and it is the one signed.
const sigMode = ref<'draw' | 'type'>('draw')
const touched = reactive<Record<string, boolean>>({})
const placing = ref(false)
const orderId = ref('')
const statusStarted = ref(false)

const { user } = useUser()

// Preselect service from ?service= (links from the home page).
const QUERY_MAP: Record<string, string> = { web: 'web', development: 'web', dev: 'web', marketing: 'mkt', mkt: 'mkt', seo: 'mkt', uiux: 'uiux', design: 'uiux', branding: 'brand', brand: 'brand' }
onMounted(() => {
  const q = String(route.query.service || '').toLowerCase()
  if (QUERY_MAP[q])
    serviceId.value = QUERY_MAP[q]
  // Pre-fill the printed legal name from the account (editable).
  const accountName = [user.value?.firstName, user.value?.lastName].filter(Boolean).join(' ').trim()
  if (accountName && !legalName.value)
    legalName.value = accountName
})

// ---- pricing ------------------------------------------------------------
function amort(b: number) {
  const r = 0.01
  const n = 24
  return b * r / (1 - (1 + r) ** -n)
}

const service = computed(() => services.value.find((s: any) => s.id === serviceId.value) || null)
const serviceName = computed(() => service.value?.name ?? '')
const plans = computed(() => plansByService.value[serviceId.value ?? ''] ?? [])
const plan = computed(() => plans.value.find(p => p.id === planId.value) || null)
const base = computed(() => plan.value?.base ?? 0)
const m12 = computed(() => base.value / 12)
const m24 = computed(() => amort(base.value))
const total24 = computed(() => m24.value * 24)
const interest24 = computed(() => total24.value - base.value)
const monthly = computed(() => (term.value === '12' ? m12.value : m24.value))
const total = computed(() => (term.value === '12' ? base.value : total24.value))
const termLabel = computed(() => (term.value === '12' ? '12 months · 0%' : '24 months · 1%/mo'))
const monthsText = computed(() => (term.value === '12' ? '12 monthly payments' : '24 monthly payments'))
const money = (n: number) => formatCurrency(n)

/**
 * "From" pricing — the lowest monthly the customer can actually be offered.
 *
 * The plan cards used to price every plan with `amort(base)`, the 24-month
 * monthly, regardless of configuration. With `finance.enable-24mo-plans` off,
 * `term` is forced to 12, so the Launch card advertised £113/mo while the rail
 * beside it and the contract two steps later both said £200/mo — two prices for
 * the same plan, on screen at once, before anything had been chosen.
 *
 * Cards now lead with total project value (which no term can change) and quote
 * the monthly as a floor derived from the cheapest term on offer, so the card
 * and the rail agree in either configuration.
 */
const cheapestTerm = computed(() => (enable24mo.value ? 24 : 12))
function fromMonthly(b: number) {
  return cheapestTerm.value === 24 ? amort(b) : b / 12
}

// Until a term is chosen (step 3) the rail quotes the same floor as the cards.
const termChosen = computed(() => step.value >= 3)
const railLabel = computed(() => (termChosen.value ? 'Your monthly' : 'From'))
const railAmount = computed(() => (termChosen.value ? monthly.value : fromMonthly(base.value)))

const fields = computed(() => formSchemas[serviceId.value ?? ''] ?? [])

// ---- details validation -------------------------------------------------
/**
 * `next()` used to validate only `form.title`, only on the way out of step 4.
 * Everything else — including fields typed as `url` — went through unchecked.
 *
 * Errors are computed per field and surfaced once the field has been blurred
 * (or once Continue has been pressed), and they clear the moment the value
 * becomes valid.
 */
const submitted = ref(false)

const UK_DATE_RE = /^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/
function isValidUkDate(value: string) {
  const match = UK_DATE_RE.exec(value)
  if (!match)
    return false
  const [, dd, mm, yyyy] = match
  const day = Number(dd)
  const month = Number(mm)
  const year = Number(yyyy)
  if (month < 1 || month > 12 || day < 1 || year < 2000 || year > 2100)
    return false
  // Rejects 31/02 and friends by round-tripping through Date.
  const probe = new Date(year, month - 1, day)
  return probe.getMonth() === month - 1 && probe.getDate() === day
}

function fieldError(field: Field): string | null {
  const value = String(form[field.key] ?? '').trim()
  if (field.required && !value)
    return `${field.label} is required.`
  if (!value)
    return null
  if (field.type === 'url' && !/^https?:\/\/\S+\.\S+/i.test(value))
    return 'Enter a full address, starting with http:// or https://'
  if (field.type === 'date' && !isValidUkDate(value))
    return 'Use the format dd/mm/yyyy.'
  return null
}

function visibleError(field: Field) {
  return (touched[field.key] || submitted.value) ? fieldError(field) : null
}

const detailErrors = computed(() => fields.value.map(fieldError).filter(Boolean) as string[])

// ---- step flow ----------------------------------------------------------
const canContinue = computed(() => {
  if (step.value === 1)
    return !!serviceId.value
  if (step.value === 2)
    return !!planId.value
  return true
})
const continueLabel = computed(() => (step.value === 4 ? 'Review contract' : 'Continue'))

function selectService(id: string) {
  if (serviceId.value !== id)
    planId.value = null
  serviceId.value = id
}
function goStep(n: number) {
  if (n <= maxStep.value)
    step.value = n
}
function next() {
  if (step.value === 1 && !serviceId.value)
    return
  if (step.value === 2 && !planId.value)
    return
  if (step.value === 4 && detailErrors.value.length) {
    submitted.value = true
    return
  }
  submitted.value = false
  step.value = Math.min(step.value + 1, 5)
  maxStep.value = Math.max(maxStep.value, step.value)
}
function back() {
  step.value = Math.max(1, step.value - 1)
}

// ---- mobile sheets ------------------------------------------------------
/**
 * One sheet serves every select on step 4: the field whose key is held here is
 * the one being answered. Rendering a sheet per field would mount four dialogs
 * to show one.
 */
const openSelectKey = ref<string | null>(null)
const openSelectField = computed(() => fields.value.find(f => f.key === openSelectKey.value) ?? null)
const selectSheetOpen = computed({
  get: () => openSelectKey.value !== null,
  set: (value: boolean) => {
    if (!value) {
      openSelectKey.value = null
    }
  },
})
const openSelectValue = computed(() => (openSelectKey.value ? form[openSelectKey.value] : null))
function pickOption(option: string) {
  const field = openSelectField.value
  if (!field) {
    return
  }
  form[field.key] = option
  touched[field.key] = true
  openSelectKey.value = null
}

const summaryOpen = ref(false)

/**
 * The exit guard (§1). It only asks when there is something to lose — a
 * confirmation on an untouched step 1 is a dialog that teaches people to dismiss
 * dialogs.
 *
 * The copy says the choices are cleared, not that a draft is kept: nothing here
 * is persisted anywhere, and the order only exists once `/api/orders` has
 * accepted it. Promising a 30-day draft would be the "attaches a file and throws
 * it away" defect from Phase 6, told in advance.
 */
const exitOpen = ref(false)
const hasProgress = computed(() =>
  step.value > 1
  || !!serviceId.value
  || Object.values(form).some(v => (typeof v === 'string' ? v.trim() !== '' : !!v)))

function requestExit() {
  if (!hasProgress.value) {
    leaveOrder()
    return
  }
  summaryOpen.value = false
  openSelectKey.value = null
  exitOpen.value = true
}
function leaveOrder() {
  exitOpen.value = false
  router.push('/dashboards/balance')
}

// The shell's close button asks the page, because only the page knows whether
// there is a half-filled order behind it.
const { closeRequests } = useApexTaskBar()
watch(closeRequests, () => {
  // Past step 5 the order exists; there is nothing left to lose and nothing to ask.
  if (step.value > 5) {
    router.push('/dashboards/balance')
    return
  }
  requestExit()
})

/** Contract text is capped so the consent controls stay reachable; this opens it out. */
const contractExpanded = ref(false)

// ---- signature ----------------------------------------------------------
const sigCanvas = ref<HTMLCanvasElement | null>(null)
let drawing = false
let lastPt: [number, number] | null = null
/**
 * Per-axis scaling. Both axes used to be scaled by the *width* ratio, which is
 * only correct while the element and the backing store share an aspect ratio —
 * and the element's width is fluid while the store is a fixed 640, so a stroke
 * drifted vertically as the column narrowed. The canvas is taller on a phone
 * (150px against 130px) than the store, which would have made it worse.
 */
function sigPos(e: PointerEvent): [number, number] {
  const c = sigCanvas.value!
  const r = c.getBoundingClientRect()
  return [(e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)]
}
function sigDown(e: PointerEvent) {
  const c = sigCanvas.value
  if (!c)
    return
  c.setPointerCapture?.(e.pointerId)
  drawing = true
  lastPt = sigPos(e)
  hasDrawn.value = true
}
function sigMove(e: PointerEvent) {
  if (!drawing || !sigCanvas.value || !lastPt)
    return
  const ctx = sigCanvas.value.getContext('2d')!
  const p = sigPos(e)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2.6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(lastPt[0], lastPt[1])
  ctx.lineTo(p[0], p[1])
  ctx.stroke()
  lastPt = p
}
function sigUp() {
  drawing = false
}
function clearSig() {
  const c = sigCanvas.value
  if (c)
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
  hasDrawn.value = false
}

/**
 * Flatten the drawn signature to dark-ink-on-white PNG. The on-screen canvas
 * draws white strokes on a transparent/dark background (for contrast in the
 * dark wizard); exported as-is it is invisible on the light admin contract
 * card. Here we recolour the strokes to ink and composite onto white "paper".
 */
function exportSignature(): string | undefined {
  const c = sigCanvas.value
  if (!c)
    return undefined
  const src = c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
  const d = src.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 0) {
      d[i] = 20
      d[i + 1] = 24
      d[i + 2] = 33 // ink ≈ #141821
    }
  }
  const ink = document.createElement('canvas')
  ink.width = c.width
  ink.height = c.height
  ink.getContext('2d')!.putImageData(src, 0, 0)
  const out = document.createElement('canvas')
  out.width = c.width
  out.height = c.height
  const octx = out.getContext('2d')!
  octx.fillStyle = '#ffffff'
  octx.fillRect(0, 0, out.width, out.height)
  octx.drawImage(ink, 0, 0)
  return out.toDataURL('image/png')
}

// Collect the service-specific detail answers into label/value pairs the admin
// panel can render generically (see /api/orders + admin project detail).
function buildBrief(): { label: string, value: string }[] {
  const out: { label: string, value: string }[] = []
  for (const f of fields.value) {
    if (f.key === 'title')
      continue
    if (f.type === 'checkboxes') {
      const picked = (f.boxes ?? []).filter(b => form[b.key]).map(b => b.label)
      if (picked.length)
        out.push({ label: f.label, value: picked.join(', ') })
      continue
    }
    // No `?? options[0]` fallback: a native <select> showed its first option
    // from the start and that default was written into the brief, so a customer
    // who never touched "Pages needed" still had "1–3 pages" sent to the team.
    // Unanswered fields are simply omitted.
    const raw = form[f.key]
    const value = raw == null ? '' : String(raw).trim()
    if (value)
      out.push({ label: f.label, value })
  }
  return out
}

const canSign = computed(() =>
  agreed.value
  && esignConsent.value
  && legalName.value.trim().length > 1
  && (sigMode.value === 'draw' ? hasDrawn.value : signName.value.trim().length > 1))

/**
 * Why the sign button is disabled, in the customer's words.
 *
 * On a phone the primary action sits in a fixed footer, a screen away from the
 * checkbox it is waiting on, so a greyed-out button with no explanation is the
 * dead end Phase 5 removed from the credit card. Stated once, next to the
 * consent controls, where the answer is.
 */
const signBlocker = computed(() => {
  if (canSign.value) {
    return null
  }
  if (legalName.value.trim().length <= 1) {
    return 'Enter your full legal name to sign.'
  }
  if (!agreed.value || !esignConsent.value) {
    return 'Tick both boxes to confirm you agree.'
  }
  return sigMode.value === 'draw'
    ? 'Draw your signature above to continue.'
    : 'Type your full name above to sign.'
})

async function placeOrder() {
  if (!canSign.value || placing.value)
    return
  placing.value = true
  try {
    // Signature: whichever method is active — the drawn canvas flattened to a
    // PNG data-URL, or the typed name.
    const drawn = sigMode.value === 'draw'
    const signature = drawn
      ? exportSignature()
      : (signName.value.trim() || undefined)
    const res: any = await $fetch('/api/orders', {
      method: 'POST',
      body: {
        title: String(form.title || serviceName.value),
        category: serviceName.value,
        budget: base.value,
        termMonths: Number(term.value),
        signature,
        signatureType: drawn ? 'drawn' : 'typed',
        signerName: legalName.value.trim(),
        brief: buildBrief(),
      },
    })
    const id = res?.project?.id
    orderId.value = id ? `APX-${String(id).replace(/-/g, '').slice(0, 4).toUpperCase()}` : `APX-${Math.floor(1000 + Math.random() * 9000)}`
    step.value = 6
    setTimeout(() => {
      statusStarted.value = true
    }, 1500)
  }
  catch (e: any) {
    toaster.add({ title: 'Could not place order', description: e?.data?.message || 'Please try again in a moment.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    placing.value = false
  }
}
/**
 * The summary's figures, bound once and rendered twice — the desktop rail and
 * the mobile sheet (§8). Phase 3 §2 spent a fix on making the plan card, the
 * rail and the contract agree; two hand-maintained copies of these bindings is
 * how they would start disagreeing again.
 */
const summaryProps = computed(() => ({
  serviceName: serviceName.value,
  planName: plan.value?.name ?? null,
  base: base.value,
  termChosen: termChosen.value,
  termLabel: termLabel.value,
  showInterest: term.value === '24',
  interest: interest24.value,
  railLabel: railLabel.value,
  railAmount: railAmount.value,
  monthsText: monthsText.value,
  total: total.value,
  firstDueDays: firstDueDays.value,
}))

const radioBase = 'flex size-[22px] shrink-0 items-center justify-center rounded-full transition'
</script>

<template>
  <!-- Location lives in the toolbar breadcrumb; this page no longer prints its own. -->
  <!--
    Below `lg` the step cards are gone, as drawn — so the ink they were
    providing has to come from the page instead. Without this the wizard's
    `text-white` lands on the shell's near-white page in light mode and the
    whole form reads white-on-white; it is the card, not the theme, that was
    holding it up. Desktop already treats this page as ink (every step is a
    `bg-muted-800` card), and the sheets take the same `surface="ink"`, so this
    makes one rule of what was three.

    `-mt-5` cancels the top bar's bottom margin so the ink starts flush under
    it, and `apex-bleed` spans the shared gutter the way the bar does.
  -->
  <div class="apex-bleed -mt-5 mx-auto flex max-w-[1180px] flex-col bg-muted-950 pb-12 font-sans text-muted-400 lg:mt-0 lg:gap-8 lg:bg-transparent gap-[18px]">
    <!--
      Below `lg` the top bar carries the title and the Secured chip, so printing
      a page header underneath it says the same thing twice on the screen that
      has the least room for it. The heading itself stays for assistive tech —
      the step headings below are h2s, and a document that starts at h2 has a
      level missing.
    -->
    <h1 class="sr-only lg:hidden">
      New order
    </h1>
    <ApexPageHeader
      class="hidden lg:flex"
      title="Start your"
      accent="project"
      subtitle="Pick a service and plan, choose how to pay, then sign. Nothing is charged today."
    >
      <template #actions>
        <span class="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#22B07D]/12 px-4 text-[12.5px] font-semibold text-[#22B07D]"><Icon name="lucide:shield-check" class="size-3.5" />Secured checkout</span>
      </template>
    </ApexPageHeader>

    <!--
      Mobile progress (§2). Five labelled nodes with connecting rules need about
      620px, so below `lg` they become the current step's name, a counter and
      five segments. Sticky directly under the 56px bar — `-mt-5` cancels the
      bar's own bottom margin so nothing scrolls through the gap between them —
      and `apex-bleed` cancels the shared page gutter so the divider spans the
      viewport like the bar's does.

      The row is a `group`, not a `progressbar`: a progressbar announces a value
      and its children here are five buttons, so the two would talk over each
      other. The counter beside the step name states the progress in words.
    -->
    <div class="apex-bleed sticky top-[calc(56px+env(safe-area-inset-top))] z-20 border-b border-white/10 bg-muted-950 pb-3.5 pt-3 lg:hidden">
      <div class="flex items-baseline gap-2">
        <span class="font-heading text-[15px] font-bold text-white">{{ STEP_LABELS[Math.min(step, 5) - 1] }}</span>
        <span class="grow" />
        <span class="text-xs font-semibold text-muted-500 tabular-nums">Step {{ Math.min(step, 5) }} of 5</span>
      </div>
      <div role="group" aria-label="Order steps" class="mt-2.5 flex gap-1">
        <button
          v-for="(label, i) in STEP_LABELS" :key="label"
          type="button"
          :disabled="(i + 1) > maxStep"
          :aria-label="`Step ${i + 1}: ${label}`"
          :aria-current="(i + 1) === step ? 'step' : undefined"
          class="apex-focus h-1.5 flex-1 rounded-full transition-colors enabled:cursor-pointer"
          :class="(i + 1) <= step ? 'bg-primary-500' : 'bg-white/10'"
          @click="goStep(i + 1)"
        />
      </div>
    </div>

    <!-- stepper -->
    <div role="list" aria-label="Progress" class="hidden flex-nowrap items-center gap-1 overflow-x-auto py-1.5 lg:flex">
      <template v-for="(label, i) in STEP_LABELS" :key="label">
        <div v-if="i > 0" class="h-0.5 w-[30px] shrink-0 rounded" :class="(i + 1) <= step ? 'bg-primary-500' : 'bg-white/10'" />
        <button
          type="button" role="listitem" :disabled="(i + 1) > maxStep"
          class="inline-flex shrink-0 items-center gap-2.5 rounded-xl px-1.5 py-2.5 enabled:cursor-pointer sm:py-1"
          @click="goStep(i + 1)"
        >
          <span
            class="flex size-[26px] shrink-0 items-center justify-center rounded-full font-heading text-[12.5px] font-bold transition"
            :class="[
              (i + 1) <= step ? 'bg-primary-500 text-white' : 'border border-white/10 bg-white/5 text-muted-500',
              (i + 1) === step ? 'ring-4 ring-primary-500/20' : '',
            ]"
          >
            <Icon v-if="(i + 1) < step" name="lucide:check" class="size-3.5" />
            <span v-else>{{ i + 1 }}</span>
          </span>
          <span class="text-[13.5px]" :class="(i + 1) === step ? 'font-bold text-white' : (i + 1) < step ? 'font-medium text-muted-400' : 'font-medium text-muted-500'">{{ label }}</span>
        </button>
      </template>
    </div>

    <!-- content + rail -->
    <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_344px]">
      <!-- ===================== LEFT: STEP CONTENT ===================== -->
      <div>
        <!-- STEP 1 — SERVICE -->
        <!--
          The card chrome is a `lg:` treatment on every step from here down. At
          393px a bordered panel inset inside the page gutter spends another
          2 x 24px on a column that has 361px to give, so the step content sits
          directly on the page the way the mockup draws it.
        -->
        <section v-if="step === 1" class="lg:rounded-2xl lg:border lg:border-white/10 lg:bg-muted-800 lg:p-7">
          <h2 class="font-heading text-[21px] font-bold tracking-[-0.01em] text-white lg:text-[22px]">
            What can we build for you?
          </h2>
          <p class="mb-[18px] mt-2 text-[14px] text-muted-400 lg:mb-6 lg:mt-1.5 lg:text-[14.5px]">
            Choose the service you need. You'll pick a plan and a payment schedule next.
          </p>
          <!--
            Four 158px tiles stacked is 640px of scrolling to compare four
            names, so below `sm` — the width at which the grid is a single
            column anyway — each becomes a 72px row (§3). `sm:contents`
            dissolves the two mobile wrappers so their children become direct
            children of the tile again and the desktop composition is
            reproduced rather than re-specified.
          -->
          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4">
            <button
              v-for="svc in services" :key="svc.id"
              type="button" :aria-pressed="serviceId === svc.id"
              class="relative flex min-h-[72px] items-center gap-[13px] rounded-2xl border bg-white/[0.02] p-3.5 text-left transition sm:min-h-[158px] sm:flex-col sm:items-stretch sm:gap-0 sm:p-[22px]"
              :class="serviceId === svc.id ? 'border-primary-500 sm:ring-4 sm:ring-primary-500/15' : 'border-white/10 hover:border-white/15'"
              @click="selectService(svc.id)"
            >
              <span class="contents sm:mb-auto sm:flex sm:items-center sm:justify-between">
                <span class="flex size-11 shrink-0 items-center justify-center rounded-xl sm:size-12" :class="svc.tone"><Icon :name="svc.icon" class="size-[21px] sm:size-[23px]" /></span>
                <!--
                  The ring is a mobile affordance: a border tint alone is not a
                  reliable selected state on a phone in daylight. From `sm` the
                  unselected state has no border and no fill, so the tile is
                  exactly as it was — a check appears only once chosen.
                -->
                <span
                  class="order-3 flex size-6 shrink-0 items-center justify-center rounded-full text-white transition sm:order-none sm:size-[26px]"
                  :class="serviceId === svc.id ? 'bg-primary-500' : 'border-2 border-white/15 sm:border-0'"
                >
                  <Icon v-if="serviceId === svc.id" name="lucide:check" class="size-3.5 sm:size-[15px]" />
                </span>
              </span>
              <span class="order-2 min-w-0 flex-1 sm:order-none sm:contents">
                <span class="block font-heading text-base font-bold text-white sm:mt-[18px] sm:text-[19px]">
                  {{ svc.name }}
                </span>
                <span class="mt-[3px] block text-[12.5px] text-muted-500 sm:mt-1 sm:text-[13.5px]">
                  {{ svc.desc }}
                </span>
              </span>
            </button>
          </div>
        </section>

        <!-- STEP 2 — PLAN -->
        <section v-else-if="step === 2" class="lg:rounded-2xl lg:border lg:border-white/10 lg:bg-muted-800 lg:p-7">
          <div class="mb-1.5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 class="font-heading text-[21px] font-bold tracking-[-0.01em] text-white lg:text-[22px]">
                Choose your plan
              </h2>
              <p class="mt-2 text-[14px] text-muted-400 lg:mt-1.5 lg:text-[14.5px]">
                For <strong class="font-semibold text-primary-400">{{ serviceName }}</strong> · you'll choose how to spread the cost next.
              </p>
            </div>
            <button type="button" class="apex-focus inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:border-white/15 lg:min-h-0" @click="goStep(1)">
              <Icon name="lucide:arrow-left" class="size-3.5" />Change service
            </button>
          </div>
          <div class="mt-4 grid grid-cols-1 gap-3 md:mt-5 md:grid-cols-3 md:gap-4">
            <button
              v-for="p in plans" :key="p.id"
              type="button" :aria-pressed="planId === p.id"
              class="relative flex flex-col rounded-2xl border p-4 text-left transition md:p-5"
              :class="planId === p.id ? 'border-primary-500 bg-primary-500/[0.06] md:ring-4 md:ring-primary-500/15' : p.popular ? 'border-primary-500/30 bg-white/[0.02]' : 'border-white/10 bg-white/[0.02] hover:border-white/15'"
              @click="planId = p.id"
            >
              <!--
                Below `md` the card is a header row (icon, name, badge, radio)
                over the price and the features, as drawn. `md:block` on the two
                wrappers hands their children back to the card's own column, and
                the radio and the badge take the absolute positions the tile
                gives them — so the desktop card is reproduced, not restated.
              -->
              <div class="flex items-center gap-3 md:block">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/14 text-primary-400 md:size-[42px]"><Icon :name="tierIcon[p.tier]" class="size-[21px]" /></span>
                <span class="order-2 min-w-0 flex-1 md:block">
                  <span class="flex items-center gap-2 md:mt-4 md:block">
                    <span class="font-heading text-[17px] font-bold tracking-[-0.01em] text-white md:text-[20px]">{{ p.name }}</span>
                    <span v-if="p.popular" class="shrink-0 whitespace-nowrap rounded-full bg-gradient-to-r from-primary-400 to-primary-600 px-2 py-[3px] text-[9.5px] font-extrabold tracking-[0.04em] text-white md:absolute md:-top-[11px] md:left-1/2 md:-translate-x-1/2 md:px-3 md:py-[5px] md:text-[10.5px] md:tracking-[0.05em] md:shadow-[0_6px_16px_rgba(125,83,242,.4)]">MOST POPULAR</span>
                  </span>
                  <span class="mt-[3px] block text-[12.5px] leading-[1.45] text-muted-400 md:mt-1.5 md:min-h-[54px] md:text-[13px] md:leading-[1.5]">
                    {{ p.desc }}
                  </span>
                </span>
                <span class="order-3 md:absolute md:right-5 md:top-[30px]" :class="[radioBase, planId === p.id ? 'bg-primary-500' : 'border-2 border-white/15']"><span v-if="planId === p.id" class="size-2.5 rounded-full bg-white" /></span>
              </div>
              <!--
                Total project value leads: it is the one figure no payment term
                can change, so it cannot contradict the rail or the contract.
              -->
              <div class="mt-3.5 flex flex-wrap items-baseline gap-x-2 md:mt-1.5 md:block">
                <span class="font-heading text-[26px] font-extrabold tracking-[-0.02em] text-white tabular-nums md:block md:text-[28px]">
                  {{ money(p.base) }}
                </span>
                <span class="text-xs text-muted-500 md:mt-1 md:block">
                  total project · from {{ money(fromMonthly(p.base)) }}/mo
                </span>
              </div>
              <div class="my-3.5 h-px bg-white/10 md:my-4" />
              <div class="flex flex-col gap-2.5">
                <div v-for="f in p.features" :key="f" class="flex items-start gap-2.5 text-[13px] text-muted-400">
                  <Icon name="lucide:check" class="mt-0.5 size-[15px] shrink-0 text-[#22B07D]" />{{ f }}
                </div>
              </div>
            </button>
          </div>
        </section>

        <!-- STEP 3 — PAYMENT -->
        <section v-else-if="step === 3" class="flex flex-col gap-[18px]">
          <!--
            Below `lg` this is the promises band and nothing else (§5): the
            headline and its glow are the argument for financing, and the
            customer has already accepted it by reaching step 3. `order-2` puts
            it under the step heading, which the payment card hands over via
            `contents` below.
          -->
          <div class="relative order-2 overflow-hidden rounded-2xl border border-primary-500/30 p-4 lg:order-none lg:p-6" style="background: linear-gradient(135deg, #241846, #16252A 75%);">
            <div class="pointer-events-none absolute -top-12 right-10 hidden size-52 rounded-full opacity-45 blur-[60px] lg:block" style="background: radial-gradient(circle at 50% 38%, #9b79f6 0%, #7d53f2 55%, #6c40e8 100%);" />
            <div class="relative flex flex-wrap items-center gap-6">
              <div class="hidden min-w-[240px] flex-1 lg:block">
                <div class="mb-2 text-xs font-bold tracking-[0.05em] text-primary-200">
                  PAY FROM PROFITS
                </div>
                <!--
                  Copy matches reality: placeOrder() creates the project as
                  PENDING and My Orders shows "Awaiting kickoff", so promising a
                  same-day start contradicted the very next screen.
                -->
                <h2 class="font-heading text-[26px] font-extrabold leading-[1.12] tracking-[-0.02em] text-white">
                  £0 today. Your project is scheduled the moment you sign.
                </h2>
              </div>
              <div class="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:flex-wrap lg:gap-6">
                <div v-for="b in [{ t: 'No deposit', s: '£0 down payment' }, { t: 'Fast kickoff', s: 'Scheduled on signature' }, { t: 'Cancel anytime', s: 'Before work starts' }]" :key="b.t" class="flex items-center gap-2.5">
                  <span class="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#22B07D]/18 text-[#22B07D] lg:size-[34px]"><Icon name="lucide:check" class="size-[17px]" /></span>
                  <span class="text-[13.5px] font-medium text-white">{{ b.t }}<br><span class="text-xs text-primary-200">{{ b.s }}</span></span>
                </div>
              </div>
            </div>
          </div>

          <!--
            `contents` below `lg` dissolves the card so its children become
            children of the step's own column, which is the only way the
            heading can lead while the promises band sits between it and the
            terms — as drawn — without either duplicating the heading or moving
            the desktop layout. From `lg` the card is a card again and the
            orders below become inert.
          -->
          <div class="contents lg:block lg:rounded-2xl lg:border lg:border-white/10 lg:bg-muted-800 lg:p-7">
            <div class="order-1">
              <h3 class="font-heading text-[21px] font-bold tracking-[-0.01em] text-white lg:text-[20px]">
                Choose how you'd like to pay
              </h3>
              <p class="mb-0 mt-2 text-sm text-muted-400 lg:mb-5 lg:mt-0">
                Spread the cost of your <strong class="font-semibold text-white">{{ plan?.name }}</strong> plan. Switch anytime before signing.
              </p>
            </div>
            <div class="order-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <!-- 12 months -->
              <button type="button" :aria-pressed="term === '12'" class="relative flex flex-col rounded-2xl border p-[18px] text-left transition sm:p-[22px]" :class="term === '12' ? 'border-primary-500 bg-primary-500/[0.06] ring-4 ring-primary-500/15' : 'border-white/10 bg-white/[0.02] hover:border-white/15'" @click="term = '12'">
                <div class="flex items-center justify-between">
                  <span class="rounded-full bg-[#22B07D]/16 px-2.5 py-[5px] text-[11px] font-extrabold tracking-[0.05em] text-[#22B07D]">0% INTEREST</span>
                  <span :class="[radioBase, term === '12' ? 'bg-primary-500' : 'border-2 border-white/15']"><span v-if="term === '12'" class="size-2.5 rounded-full bg-white" /></span>
                </div>
                <div class="mt-4 font-heading text-[18px] font-bold text-white">
                  12 monthly payments
                </div>
                <div class="mt-2.5 flex items-baseline gap-1.5">
                  <span class="font-heading text-[28px] font-extrabold tracking-[-0.02em] text-white tabular-nums sm:text-[36px]">{{ money(m12) }}</span><span class="text-sm text-muted-500">/mo</span>
                </div>
                <div class="mt-4 flex flex-col gap-2 text-[13px]">
                  <div class="flex justify-between text-muted-400">
                    <span>Interest</span><span class="font-semibold text-[#22B07D]">£0 · 0%</span>
                  </div>
                  <div class="flex justify-between text-muted-400">
                    <span>Total to pay</span><span class="font-bold text-white">{{ money(base) }}</span>
                  </div>
                </div>
                <div class="mt-3.5 flex items-center gap-1.5 rounded-xl border border-primary-500/20 bg-primary-500/10 px-2.5 py-2 text-xs text-primary-200">
                  <Icon name="lucide:info" class="size-3.5" />Pay the least overall
                </div>
              </button>
              <!-- 24 months (hidden when the admin disables the plan) -->
              <button v-if="enable24mo" type="button" :aria-pressed="term === '24'" class="relative flex flex-col rounded-2xl border p-[18px] text-left transition sm:p-[22px]" :class="term === '24' ? 'border-primary-500 bg-primary-500/[0.06] ring-4 ring-primary-500/15' : 'border-white/10 bg-white/[0.02] hover:border-white/15'" @click="term = '24'">
                <div class="flex items-center justify-between">
                  <span class="rounded-full bg-primary-500/18 px-2.5 py-[5px] text-[11px] font-extrabold tracking-[0.05em] text-primary-200">LOWEST MONTHLY</span>
                  <span :class="[radioBase, term === '24' ? 'bg-primary-500' : 'border-2 border-white/15']"><span v-if="term === '24'" class="size-2.5 rounded-full bg-white" /></span>
                </div>
                <div class="mt-4 font-heading text-[18px] font-bold text-white">
                  24 monthly payments
                </div>
                <div class="mt-2.5 flex items-baseline gap-1.5">
                  <span class="font-heading text-[28px] font-extrabold tracking-[-0.02em] text-white tabular-nums sm:text-[36px]">{{ money(m24) }}</span><span class="text-sm text-muted-500">/mo</span>
                </div>
                <div class="mt-4 flex flex-col gap-2 text-[13px]">
                  <div class="flex justify-between text-muted-400">
                    <span>Interest</span><span class="font-semibold text-white">{{ money(interest24) }} · 1%/mo</span>
                  </div>
                  <div class="flex justify-between text-muted-400">
                    <span>Total to pay</span><span class="font-bold text-white">{{ money(total24) }}</span>
                  </div>
                </div>
                <div class="mt-3.5 flex items-center gap-1.5 rounded-xl border border-primary-500/20 bg-primary-500/10 px-2.5 py-2 text-xs text-primary-200">
                  <Icon name="lucide:sprout" class="size-3.5" />Keep cash free to grow
                </div>
              </button>
            </div>
            <div class="order-4 flex items-start gap-2 text-[12.5px] text-muted-500 lg:mt-[18px] lg:items-center">
              <Icon name="lucide:lock" class="mt-0.5 size-3.5 shrink-0 lg:mt-0" />The 24-month plan adds 1% monthly interest (≈12% per year) on the reducing balance. No early-repayment fees.
            </div>
          </div>
        </section>

        <!-- STEP 4 — DETAILS -->
        <!--
          No plan-recap banner: service, plan, monthly and total are all in the
          sticky rail immediately to the right and have not changed since step 3,
          so the fold showed a restatement instead of the fields.
        -->
        <section v-else-if="step === 4" class="flex flex-col gap-[18px]">
          <div class="lg:rounded-2xl lg:border lg:border-white/10 lg:bg-muted-800 lg:p-7">
            <h3 class="font-heading text-[21px] font-bold tracking-[-0.01em] text-white lg:text-[20px]">
              Tell us about your project
            </h3>
            <p class="mb-[18px] mt-2 text-sm text-muted-400 lg:mb-5 lg:mt-0">
              A few details so the right team is ready the moment you sign. <span class="text-muted-500">Tailored to your {{ serviceName }} order.</span>
            </p>
            <div class="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
              <div v-for="field in fields" :key="field.key" :class="field.full ? 'sm:col-span-2' : ''">
                <label :for="`f-${field.key}`" class="mb-2 block text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">
                  {{ field.label }}<span v-if="field.required" class="ms-0.5 text-[#EC6453]" aria-hidden="true">*</span>
                  <span v-if="field.type === 'date'" class="ms-1 font-normal normal-case tracking-normal text-muted-600">(optional)</span>
                </label>

                <!--
                  The date field is a plain text input, not `type="date"`: the
                  native control renders in the *browser's* locale, which showed
                  mm/dd/yyyy for a UK product invoicing in GBP, and no attribute
                  can override that. The value is validated as dd/mm/yyyy.
                -->
                <!--
                  `text-base` below `lg` is not a size preference: iOS zooms the
                  whole page in when a focused input's type is under 16px, and
                  the customer then has to pinch back out to see the field they
                  are filling. 16px with the existing padding is also the 48px
                  control the spec asks for.
                -->
                <div v-if="['text', 'url', 'date'].includes(field.type)" class="relative">
                  <input
                    :id="`f-${field.key}`"
                    v-model="form[field.key]"
                    :type="field.type === 'url' ? 'url' : 'text'"
                    :inputmode="field.type === 'date' ? 'numeric' : undefined"
                    :placeholder="field.type === 'date' ? 'dd / mm / yyyy' : field.placeholder"
                    :aria-invalid="visibleError(field) ? 'true' : undefined"
                    :aria-describedby="visibleError(field) ? `e-${field.key}` : undefined"
                    class="w-full rounded-xl border bg-white/5 px-3.5 py-3 text-base text-white outline-none transition focus:border-primary-400 lg:text-sm"
                    :class="[
                      visibleError(field) ? 'border-[#EC6453]/60' : 'border-white/10',
                      field.type === 'date' ? 'pe-11' : '',
                    ]"
                    @blur="touched[field.key] = true"
                  >
                  <Icon v-if="field.type === 'date'" name="lucide:calendar" aria-hidden="true" class="pointer-events-none absolute end-3.5 top-1/2 size-[17px] -translate-y-1/2 text-muted-500" />
                </div>

                <!--
                  Never a native <select>: its popup is an OS menu — white with
                  black text on this dark form — and CSS cannot reach it.
                  A themed listbox from `lg`, and below it a bottom sheet (§6),
                  because a listbox anchored near the bottom of a 393px viewport
                  opens over the field it belongs to.

                  Only one of the two is ever mounted (`isCompact` resolves
                  after hydration), so the `for` on the label always points at
                  exactly one control.
                -->
                <template v-else-if="field.type === 'select'">
                  <button
                    v-if="isCompact"
                    :id="`f-${field.key}`"
                    type="button"
                    aria-haspopup="dialog"
                    :aria-expanded="openSelectKey === field.key"
                    :aria-invalid="visibleError(field) ? 'true' : undefined"
                    :aria-describedby="visibleError(field) ? `e-${field.key}` : undefined"
                    class="apex-focus flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-xl border bg-white/5 px-3.5 text-base transition"
                    :class="[
                      visibleError(field) ? 'border-[#EC6453]/60' : 'border-white/10',
                      form[field.key] ? 'text-white' : 'text-muted-500',
                    ]"
                    @click="openSelectKey = field.key"
                  >
                    <span class="grow truncate text-start">{{ form[field.key] || 'Select an option' }}</span>
                    <Icon name="lucide:chevron-down" class="size-[18px] shrink-0 text-muted-500" />
                  </button>
                  <BaseSelect
                    v-else
                    :id="`f-${field.key}`"
                    v-model="form[field.key]"
                    placeholder="Select an option"
                    rounded="lg"
                    size="lg"
                    :aria-invalid="visibleError(field) ? 'true' : undefined"
                    class="bg-white/5! text-white! py-3! h-auto! rounded-xl! border-white/10!"
                    :classes="{ text: 'text-sm', content: 'z-[60]' }"
                    @update:model-value="touched[field.key] = true"
                  >
                    <BaseSelectItem v-for="o in field.options" :key="o" :value="o">
                      {{ o }}
                    </BaseSelectItem>
                  </BaseSelect>
                </template>

                <textarea
                  v-else-if="field.type === 'textarea'" :id="`f-${field.key}`" v-model="form[field.key]" rows="3" :placeholder="field.placeholder"
                  class="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-base text-white outline-none transition focus:border-primary-400 lg:text-sm"
                />
                <div v-else-if="field.type === 'checkboxes'" class="flex flex-wrap gap-2.5">
                  <label v-for="box in field.boxes" :key="box.key" class="inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-[13.5px] text-white lg:min-h-0">
                    <input v-model="form[box.key]" type="checkbox" class="size-[22px] accent-primary-500 lg:size-4">{{ box.label }}
                  </label>
                </div>

                <p v-if="visibleError(field)" :id="`e-${field.key}`" class="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[#EC6453]">
                  <Icon name="lucide:alert-circle" class="size-3.5 shrink-0" />{{ visibleError(field) }}
                </p>
              </div>
            </div>
            <!--
              The mockup offers to take a brief here. `Project` has a files
              relation but no customer-facing upload endpoint, so a picker on
              this form would collect a file and drop it — the defect Phase 6
              removed from the support composer. It says what actually works
              instead.
            -->
            <div class="mt-[18px] flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <Icon name="lucide:paperclip" class="mt-0.5 size-[17px] shrink-0 text-primary-400" />
              <p class="text-[13px] leading-[1.5] text-muted-400">
                Have a brief or brand assets? There is no upload on this form yet — once your project exists, ask <NuxtLink to="/dashboards/support" class="font-semibold text-primary-400">
                  Support
                </NuxtLink> for a secure upload link and we will attach them to it.
              </p>
            </div>
            <div v-if="submitted && detailErrors.length" class="mt-4 flex items-center gap-2 rounded-xl border border-[#EC6453]/30 bg-[#EC6453]/10 px-3.5 py-2.5 text-[13px] text-[#EC6453]">
              <Icon name="lucide:alert-circle" class="size-[15px] shrink-0" />Please fix the highlighted {{ detailErrors.length === 1 ? 'field' : 'fields' }} to continue.
            </div>
          </div>
        </section>

        <!-- STEP 5 — CONTRACT -->
        <section v-else-if="step === 5" class="lg:rounded-2xl lg:border lg:border-white/10 lg:bg-muted-800 lg:p-7">
          <h2 class="font-heading text-[21px] font-bold tracking-[-0.01em] text-white lg:text-[22px]">
            Review &amp; sign
          </h2>
          <p class="mb-4 mt-2 text-[14px] text-muted-400 lg:mb-5 lg:mt-1.5 lg:text-[14.5px]">
            Your service agreement. Signing confirms the order and schedules your <strong class="font-semibold text-[#22B07D]">kickoff</strong>.
          </p>

          <!--
            Capped so the consent controls stay within reach of the fold; the
            toggle below opens it out in place. There is no separate document to
            link to — this text *is* the agreement — so a button promising to
            open one would lead nowhere.
          -->
          <div
            class="overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4 text-[13.5px] leading-[1.65] text-muted-400 [-webkit-overflow-scrolling:touch] lg:max-h-[264px] lg:px-6 lg:py-[22px]"
            :class="contractExpanded ? 'max-h-none' : 'max-h-[240px]'"
          >
            <div class="mb-3 font-heading text-base font-bold text-white">
              Service agreement — Apex Digital Agency
            </div>
            <p class="mb-3.5">
              This agreement is between <strong class="font-semibold text-white">Apex Digital Agency</strong> ("Apex") and the Client for the supply of <strong class="font-semibold text-white">{{ serviceName }}</strong> services under the <strong class="font-semibold text-white">{{ plan?.name }}</strong> plan.
            </p>
            <p class="mb-2 font-semibold text-white">
              1. Scope &amp; deliverables
            </p>
            <p class="mb-3.5">
              Apex will deliver the features listed in the selected plan. Work is scheduled on signature and begins at kickoff, with no down payment required.
            </p>
            <p class="mb-2 font-semibold text-white">
              2. Fees &amp; payment schedule
            </p>
            <p class="mb-3.5">
              Project value of <strong class="font-semibold text-white">{{ money(base) }}</strong>, payable as <strong class="font-semibold text-white">{{ monthsText }}</strong> of <strong class="font-semibold text-white">{{ money(monthly) }}</strong>. Total payable <strong class="font-semibold text-white">{{ money(total) }}</strong> ({{ term === '12' ? '0% interest' : `includes ${money(interest24)} interest` }}). The first instalment is collected {{ firstDueDays }} days after the project start date.
            </p>
            <p class="mb-2 font-semibold text-white">
              3. Revisions &amp; support
            </p>
            <p class="mb-3.5">
              Revisions and support are provided as specified in the plan. Additional scope may be quoted separately.
            </p>
            <p class="mb-2 font-semibold text-white">
              4. Cancellation
            </p>
            <p>The Client may cancel at no cost before work begins. Once started, completed milestones are payable. There are no early-repayment fees on instalments.</p>
          </div>
          <button
            type="button"
            class="apex-focus mt-2.5 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 text-[13.5px] font-semibold text-muted-400 transition hover:text-white lg:hidden"
            :aria-expanded="contractExpanded"
            @click="contractExpanded = !contractExpanded"
          >
            <Icon name="lucide:file-text" class="size-4" />{{ contractExpanded ? 'Collapse agreement' : 'Read the full agreement' }}
          </button>

          <!-- Printed legal name — part of the signing evidence. -->
          <div class="mt-5">
            <label for="legal-name" class="mb-2 block text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">Full legal name *</label>
            <input
              id="legal-name" v-model="legalName" autocomplete="name" placeholder="Your full legal name"
              class="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-base text-white outline-none transition focus:border-primary-400 lg:text-sm"
            >
          </div>

          <!--
            The terms link was `href="#"` — a control that looked like a
            document and went nowhere. It resolves now, and opens in a new tab:
            navigating away mid-wizard discards a half-filled order, so reading
            the terms must not cost the customer their answers.
          -->
          <label class="mt-4 flex min-h-11 cursor-pointer items-start gap-3 lg:min-h-0">
            <input v-model="agreed" type="checkbox" class="mt-0.5 size-[22px] shrink-0 accent-primary-500 lg:size-[18px]">
            <span class="text-sm leading-[1.5] text-muted-400">I have read and agree to the service agreement, the payment schedule, and Apex's <a href="/legal/terms" target="_blank" rel="noopener" class="text-primary-400 no-underline">terms of service</a>.</span>
          </label>
          <label class="mt-3 flex min-h-11 cursor-pointer items-start gap-3 lg:min-h-0">
            <input v-model="esignConsent" type="checkbox" class="mt-0.5 size-[22px] shrink-0 accent-primary-500 lg:size-[18px]">
            <span class="text-sm leading-[1.5] text-muted-400">I consent to signing this agreement electronically and agree that my electronic signature is legally binding and has the same effect as a handwritten signature (Electronic Communications Act 2000).</span>
          </label>

          <!--
            One method at a time. Draw and type used to be live simultaneously
            and `canSign` accepted either, so which one would be submitted as
            the signature was ambiguous to the person signing.
          -->
          <div class="mt-5">
            <div class="mb-2.5 flex flex-wrap items-center gap-3">
              <span class="text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">Signature</span>
              <div role="radiogroup" aria-label="Signature method" class="inline-flex gap-[3px] rounded-full border border-white/10 bg-white/5 p-[3px]">
                <button
                  v-for="mode in ([{ key: 'draw', label: 'Draw' }, { key: 'type', label: 'Type' }] as const)" :key="mode.key"
                  type="button" role="radio" :aria-checked="sigMode === mode.key"
                  class="apex-focus min-h-[34px] cursor-pointer rounded-full px-4 py-1.5 text-[12.5px] transition lg:min-h-0 lg:px-3.5"
                  :class="sigMode === mode.key ? 'bg-primary-500 font-bold text-white' : 'font-semibold text-muted-400 hover:text-white'"
                  @click="sigMode = mode.key"
                >
                  {{ mode.label }}
                </button>
              </div>
              <div class="flex-1" />
              <button v-if="sigMode === 'draw'" type="button" class="apex-focus cursor-pointer rounded-md border-none bg-transparent text-xs font-semibold text-primary-400 transition hover:text-white" @click="clearSig">
                Clear
              </button>
            </div>

            <!-- 150px on a phone: enough box to sign in with a thumb, without pushing the action bar off the screen. -->
            <div v-show="sigMode === 'draw'" class="relative h-[150px] overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.02] lg:h-[130px]">
              <canvas ref="sigCanvas" width="640" height="130" class="absolute inset-0 size-full cursor-crosshair touch-none" @pointerdown="sigDown" @pointermove="sigMove" @pointerup="sigUp" @pointerleave="sigUp" />
              <!-- A signing rule and its caption, in place of the stray ✕ glyph that read as a broken character. -->
              <div class="pointer-events-none absolute inset-x-5 bottom-[26px] border-t border-white/10" />
              <span class="pointer-events-none absolute bottom-2 left-5 text-[11.5px] text-muted-500">Sign above this line<span class="lg:hidden"> with your finger</span></span>
            </div>

            <div v-show="sigMode === 'type'">
              <input v-model="signName" placeholder="Type your full name" class="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 font-heading text-lg font-semibold text-white outline-none transition focus:border-primary-400 lg:text-base">
              <div class="mt-2.5 flex items-center gap-1.5 text-xs text-muted-500">
                <Icon name="lucide:lock" class="size-3.5" />Legally binding e-signature
              </div>
            </div>
          </div>

          <!-- Evidence notice — transparency about what is recorded as proof. -->
          <p class="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-[12.5px] leading-[1.55] text-muted-500">
            <Icon name="lucide:shield-check" class="mt-0.5 size-4 shrink-0 text-[#22B07D]" />
            For your protection and ours, we record your name, the date and time, your IP address and device as tamper-evident proof that you signed this agreement.
          </p>

          <!--
            A disabled button must say why. On a phone the primary action is in
            a fixed footer, a screen away from the checkbox it is waiting on, so
            the reason is stated here — beside the controls that answer it.
          -->
          <p v-if="signBlocker" class="mt-4 flex items-center gap-2 rounded-xl border border-[#F2C14E]/25 bg-[#F2C14E]/10 px-3.5 py-2.5 text-[13px] text-[#F2C14E]">
            <Icon name="lucide:info" class="size-[15px] shrink-0" />{{ signBlocker }}
          </p>

          <div class="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-2 text-[13px] text-muted-500">
              <Icon name="lucide:check" class="size-4 shrink-0 text-[#22B07D]" />£0 charged today · cancel free before work begins
            </div>
            <!--
              Below `lg` this action lives in the sticky footer with Back, per
              §8. The wrapper carries the visibility rather than the button:
              `BaseButton` sets its own `display`, which beats a `hidden`
              utility of the same specificity declared earlier in the layer.
            -->
            <div class="hidden lg:block">
              <BaseButton rounded="full" variant="primary" size="lg" :disabled="!canSign || placing" :loading="placing" @click="placeOrder">
                <Icon name="lucide:box" class="size-[17px]" />Sign &amp; start project
              </BaseButton>
            </div>
          </div>
        </section>

        <!-- FOOTER NAV -->
        <div v-if="step <= 5" class="mt-[22px] hidden items-center justify-between gap-3.5 lg:flex">
          <BaseButton v-if="step > 1" rounded="full" class="border border-white/10 bg-muted-800 !text-white hover:bg-muted-700" @click="back">
            <Icon name="lucide:arrow-left" class="size-4" />Back
          </BaseButton>
          <div class="flex-1" />
          <!--
            Continue is hidden on step 5. It used to render there beside
            "Sign & start project" as a primary-styled button, but next() caps
            at 5 so pressing it did nothing at all.
          -->
          <BaseButton v-if="step <= 4" rounded="full" variant="primary" size="lg" :disabled="!canContinue" @click="next">
            {{ continueLabel }}<Icon name="lucide:arrow-right" class="size-4" />
          </BaseButton>
        </div>
      </div>

      <!-- ===================== RIGHT: ORDER SUMMARY RAIL ===================== -->
      <aside aria-label="Order summary" class="hidden overflow-hidden rounded-2xl border border-white/10 lg:sticky lg:top-4 lg:block" style="background: linear-gradient(160deg, #16252A, #101D21);">
        <div class="flex items-center gap-3 border-b border-white/10 px-[22px] py-5">
          <span class="flex size-[34px] items-center justify-center rounded-xl bg-primary-500/16 text-primary-400"><Icon name="lucide:file-text" class="size-[17px]" /></span>
          <div class="flex-1">
            <div class="font-heading text-[15px] font-bold tracking-[0.02em] text-white">
              Order summary
            </div>
            <div class="text-[11.5px] text-muted-500">
              Step {{ Math.min(step, 5) }} of 5
            </div>
          </div>
        </div>

        <ApexOrderSummary v-bind="summaryProps" />
      </aside>
    </div>

    <!-- ===================== MOBILE: FOOTER STRIP + ACTIONS ===================== -->
    <!--
      The 340px sticky rail cannot exist at 393px, and putting it above the form
      buries the fields, so it becomes a 52px strip carrying the one thing the
      customer is deciding about — the monthly — with the full summary a tap
      away (§8). Fixed rather than sticky, so it never has to be threaded
      through the page's own flow; the spacer below keeps content from ending
      underneath it, the same arrangement `ApexBottomNav` uses.
    -->
    <div v-if="step <= 5" aria-hidden="true" class="h-[calc(130px+env(safe-area-inset-bottom))] lg:hidden" />
    <div
      v-if="step <= 5"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-muted-950/94 backdrop-blur-md lg:hidden"
    >
      <button
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="summaryOpen"
        class="apex-focus flex min-h-[52px] w-full cursor-pointer items-center gap-2.5 border-b border-white/10 px-4 text-start"
        @click="summaryOpen = true"
      >
        <Icon name="lucide:receipt-text" class="size-[18px] shrink-0 text-primary-400" />
        <span class="min-w-0 grow">
          <span class="block text-[11px] font-bold uppercase tracking-[0.05em] text-muted-500">{{ plan ? railLabel : 'Order summary' }}</span>
          <span v-if="plan" class="mt-px block truncate text-sm font-bold text-white tabular-nums">
            {{ money(railAmount) }}/mo <span class="font-medium text-muted-500">· {{ termChosen ? `${term} months · total ${money(total)}` : 'choose a payment plan in step 3' }}</span>
          </span>
          <!-- No plan, no monthly: `base` is 0 until one is chosen, and "£0/mo" is not a price. -->
          <span v-else class="mt-px block truncate text-sm font-semibold text-muted-500">Pick a plan to see your monthly</span>
        </span>
        <Icon name="lucide:chevron-up" class="size-[18px] shrink-0 text-muted-500" />
      </button>

      <div class="flex items-center gap-2.5 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <button
          v-if="step > 1"
          type="button"
          aria-label="Back"
          class="apex-focus flex size-[52px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/5"
          @click="back"
        >
          <Icon name="lucide:arrow-left" class="size-[18px]" />
        </button>
        <BaseButton v-if="step <= 4" rounded="full" variant="primary" size="lg" class="h-[52px]! grow" :disabled="!canContinue" @click="next">
          {{ continueLabel }}<Icon name="lucide:arrow-right" class="size-4" />
        </BaseButton>
        <BaseButton v-else rounded="full" variant="primary" size="lg" class="h-[52px]! grow" :disabled="!canSign || placing" :loading="placing" @click="placeOrder">
          <Icon name="lucide:pen-line" class="size-[17px]" />Sign &amp; start
        </BaseButton>
      </div>
    </div>

    <!--
      The wizard's sheets take the `ink` surface: this page is navy in both
      themes (its light treatment is Phase 9's), and a white sheet rising over
      it would be the only light surface on the screen.
    -->
    <ApexBottomSheet
      v-model:open="summaryOpen"
      surface="ink"
      scrollable
      title="Order summary"
      description="Your service, plan, payment terms and what is due today."
    >
      <template #header>
        <div class="flex shrink-0 items-center gap-2.5 border-b border-white/10 px-[22px] pb-3 pt-1.5">
          <span class="flex size-[30px] shrink-0 items-center justify-center rounded-xl bg-primary-500/16 text-primary-400"><Icon name="lucide:file-text" class="size-4" /></span>
          <span class="font-heading grow text-[15px] font-bold text-white">Order summary</span>
          <span class="text-[11.5px] text-muted-500">Step {{ Math.min(step, 5) }} of 5</span>
        </div>
      </template>
      <ApexOrderSummary v-bind="summaryProps" />
    </ApexBottomSheet>

    <!--
      One sheet for every select on step 4 (§6). Options are 52px, nothing is
      preselected, and closing without choosing leaves the field unanswered —
      which `buildBrief()` then omits entirely.
    -->
    <ApexBottomSheet
      v-model:open="selectSheetOpen"
      surface="ink"
      scrollable
      :title="openSelectField?.label ?? 'Choose an option'"
      description="Choose one option for this field."
    >
      <template #header>
        <div class="font-heading shrink-0 border-b border-white/10 px-[18px] pb-3 pt-1.5 text-base font-bold text-white">
          {{ openSelectField?.label }}
        </div>
      </template>
      <div class="flex flex-col gap-0.5 p-2.5">
        <button
          v-for="o in openSelectField?.options ?? []" :key="o"
          type="button"
          :aria-pressed="openSelectValue === o"
          class="apex-focus flex min-h-[52px] w-full cursor-pointer items-center gap-2.5 rounded-xl px-3.5 text-[15px] transition-colors"
          :class="openSelectValue === o ? 'bg-primary-500/12 font-semibold text-white' : 'text-muted-300 hover:bg-white/5'"
          @click="pickOption(o)"
        >
          <span class="grow text-start">{{ o }}</span>
          <Icon v-if="openSelectValue === o" name="lucide:check" class="size-[18px] shrink-0 text-primary-400" />
        </button>
      </div>
    </ApexBottomSheet>

    <!--
      The exit guard (§1). The mockup offers to keep the order as a draft for 30
      days; nothing here is persisted anywhere — the order does not exist until
      `/api/orders` has accepted it — so the sheet says what actually happens.
      Promising a draft we do not store is the "takes your file and discards it"
      defect from Phase 6, told in advance.
    -->
    <ApexBottomSheet
      v-model:open="exitOpen"
      surface="ink"
      title="Leave this order?"
      description="Confirm whether to leave this order or carry on filling it in."
    >
      <div class="flex flex-col gap-2.5 px-4 pb-4 pt-2.5">
        <div class="font-heading text-[18px] font-bold text-white">
          Leave this order?
        </div>
        <p class="mb-2 text-sm leading-[1.55] text-muted-400">
          Nothing has been saved yet, so your service, plan and details are cleared when you leave. Nothing is charged either way.
        </p>
        <BaseButton rounded="full" variant="primary" size="lg" class="h-12! w-full" @click="exitOpen = false">
          Keep going
        </BaseButton>
        <button
          type="button"
          class="apex-focus min-h-12 w-full cursor-pointer rounded-full border border-white/15 text-[14.5px] font-semibold text-[#EC6453] transition-colors hover:bg-[#EC6453]/10"
          @click="leaveOrder"
        >
          Leave without saving
        </button>
      </div>
    </ApexBottomSheet>

    <!-- ===================== SUCCESS OVERLAY ===================== -->
    <Teleport to="body">
      <Transition enter-active-class="transition-opacity duration-300" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
        <!--
          A dialog with a scrim is a desktop shape. At 393px the card fills the
          screen anyway, so below `lg` it *is* the screen (§9): no scrim to peer
          through, no rounded card floating on a 12px margin, and the two
          actions pinned to the bottom where a thumb is.
        -->
        <div v-if="step === 6" class="fixed inset-0 z-50 flex items-center justify-center lg:p-6" style="background: rgba(9,18,20,.82); backdrop-filter: blur(8px);">
          <div class="apex-pop relative flex h-full w-full flex-col overflow-y-auto border-primary-500/30 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[calc(1.75rem+env(safe-area-inset-top))] text-center lg:block lg:h-auto lg:max-h-[calc(100dvh_-_3rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] lg:max-w-[520px] lg:rounded-2xl lg:border lg:p-9" style="background: linear-gradient(160deg, #1B2B31, #101D21);">
            <div class="pointer-events-none absolute -top-16 left-1/2 size-60 -translate-x-1/2 rounded-full opacity-40 blur-[70px]" style="background: radial-gradient(circle at 50% 38%, #9b79f6 0%, #7d53f2 55%, #6c40e8 100%);" />
            <div class="relative mx-auto flex size-[74px] items-center justify-center rounded-full shadow-[0_16px_40px_rgba(34,176,125,.45)]" style="background: linear-gradient(150deg, #22B07D, #0f6e4d);">
              <Icon name="lucide:check" class="size-9 text-white" />
            </div>
            <h2 class="relative mt-5 font-heading text-[25px] font-extrabold tracking-[-0.02em] text-white lg:text-[28px]">
              You're all set!
            </h2>
            <p class="relative mt-2.5 text-[14.5px] leading-[1.55] text-muted-400 lg:text-[15px]">
              Your <strong class="font-semibold text-white">{{ plan?.name }}</strong> order is confirmed and signed. The team has been notified and will schedule your kickoff.
            </p>

            <div class="relative my-6 flex items-center justify-center gap-3">
              <span class="inline-flex items-center gap-2 rounded-full bg-[#22B07D]/14 px-3.5 py-2 text-[13px] font-bold text-[#22B07D]"><Icon name="lucide:check" class="size-3.5" />Order placed</span>
              <Icon name="lucide:arrow-right" class="size-[22px] text-muted-500" />
              <span class="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold transition" :class="statusStarted ? 'bg-gradient-to-r from-primary-400 to-primary-600 text-white shadow-[0_8px_20px_rgba(125,83,242,.4)]' : 'border border-white/10 bg-white/5 text-muted-500'">
                <!-- "Awaiting kickoff" is the state My Orders will show; the order is created PENDING. -->
                <Icon v-if="statusStarted" name="lucide:calendar-clock" class="size-3.5" />{{ statusStarted ? 'Awaiting kickoff' : 'Confirming…' }}
              </span>
            </div>

            <div class="relative mb-6 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-[18px] py-3.5">
              <div class="text-left">
                <div class="text-[11.5px] text-muted-500">
                  Order reference
                </div><div class="font-heading text-[15px] font-bold tracking-[0.04em] text-white">
                  {{ orderId }}
                </div>
              </div>
              <div class="text-right">
                <div class="text-[11.5px] text-muted-500">
                  First payment
                </div><div class="text-sm font-semibold text-white">
                  {{ money(monthly) }} · in {{ firstDueDays }} days
                </div>
              </div>
            </div>

            <!--
              Pinned to the bottom below `lg`. The second action is "Back to
              dashboard", not "New order": the customer has just committed to a
              project, and offering to start another one as the equal-weight
              alternative to seeing it is not the choice they are making.
            -->
            <div class="relative mt-auto flex flex-col gap-3 pt-4 sm:flex-row lg:mt-0 lg:pt-0">
              <BaseButton rounded="full" variant="primary" size="lg" class="h-[50px]! w-full sm:flex-1 lg:h-12!" @click="router.push('/dashboards/orders')">
                View project<Icon name="lucide:arrow-right" class="size-4" />
              </BaseButton>
              <BaseButton rounded="full" class="h-12! w-full border border-white/10 bg-muted-800 !text-white hover:bg-muted-700 sm:w-auto" @click="router.push('/dashboards/balance')">
                Back to dashboard
              </BaseButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
@keyframes apex-pop {
  0% {
    transform: scale(0.94);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.apex-pop {
  animation: apex-pop 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  .apex-pop {
    animation: none;
  }
}
</style>
