<script setup lang="ts">
/**
 * New Order — Apex Design redesign (5-step order + financing wizard).
 * Service → Plan → Payment (0% / 12-mo vs 1%·24-mo) → Details → Review & sign.
 * Live order-summary rail with the financing breakdown. "Sign & start" creates a
 * real PENDING order via /api/orders.
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

// ---- signature ----------------------------------------------------------
const sigCanvas = ref<HTMLCanvasElement | null>(null)
let drawing = false
let lastPt: [number, number] | null = null
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
function resetFlow() {
  step.value = 1
  maxStep.value = 1
  serviceId.value = null
  planId.value = null
  term.value = enable24mo.value ? '24' : '12'
  agreed.value = false
  esignConsent.value = false
  signName.value = ''
  hasDrawn.value = false
  sigMode.value = 'draw'
  submitted.value = false
  orderId.value = ''
  statusStarted.value = false
  Object.keys(form).forEach(k => delete form[k])
  Object.keys(touched).forEach(k => delete touched[k])
}

const radioBase = 'flex size-[22px] shrink-0 items-center justify-center rounded-full transition'
</script>

<template>
  <!-- Location lives in the toolbar breadcrumb; this page no longer prints its own. -->
  <div class="mx-auto flex max-w-[1180px] flex-col gap-8 pb-12 font-sans text-muted-400">
    <!-- title -->
    <ApexPageHeader
      title="Start your"
      accent="project"
      subtitle="Pick a service and plan, choose how to pay, then sign. Nothing is charged today."
    >
      <template #actions>
        <span class="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#22B07D]/12 px-4 text-[12.5px] font-semibold text-[#22B07D]"><Icon name="lucide:shield-check" class="size-3.5" />Secured checkout</span>
      </template>
    </ApexPageHeader>

    <!-- stepper -->
    <div role="list" aria-label="Progress" class="flex flex-nowrap items-center gap-1 overflow-x-auto py-1.5">
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
        <section v-if="step === 1" class="rounded-2xl border border-white/10 bg-muted-800 p-7">
          <h2 class="font-heading text-[22px] font-bold tracking-[-0.01em] text-white">
            What can we build for you?
          </h2>
          <p class="mb-6 mt-1.5 text-[14.5px] text-muted-400">
            Choose the service you need. You'll pick a plan and a payment schedule next.
          </p>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              v-for="svc in services" :key="svc.id"
              type="button" :aria-pressed="serviceId === svc.id"
              class="relative flex min-h-[158px] flex-col rounded-2xl border bg-white/[0.02] p-[22px] text-left transition"
              :class="serviceId === svc.id ? 'border-primary-500 ring-4 ring-primary-500/15' : 'border-white/10 hover:border-white/15'"
              @click="selectService(svc.id)"
            >
              <div class="mb-auto flex items-center justify-between">
                <span class="flex size-12 items-center justify-center rounded-xl" :class="svc.tone"><Icon :name="svc.icon" class="size-[23px]" /></span>
                <span v-if="serviceId === svc.id" class="flex size-[26px] items-center justify-center rounded-full bg-primary-500 text-white"><Icon name="lucide:check" class="size-[15px]" /></span>
              </div>
              <div class="mt-[18px] font-heading text-[19px] font-bold text-white">
                {{ svc.name }}
              </div>
              <div class="mt-1 text-[13.5px] text-muted-500">
                {{ svc.desc }}
              </div>
            </button>
          </div>
        </section>

        <!-- STEP 2 — PLAN -->
        <section v-else-if="step === 2" class="rounded-2xl border border-white/10 bg-muted-800 p-7">
          <div class="mb-1.5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 class="font-heading text-[22px] font-bold tracking-[-0.01em] text-white">
                Choose your plan
              </h2>
              <p class="mt-1.5 text-[14.5px] text-muted-400">
                For <strong class="font-semibold text-primary-400">{{ serviceName }}</strong> · you'll choose how to spread the cost next.
              </p>
            </div>
            <button type="button" class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:border-white/15" @click="goStep(1)">
              <Icon name="lucide:arrow-left" class="size-3.5" />Change service
            </button>
          </div>
          <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <button
              v-for="p in plans" :key="p.id"
              type="button" :aria-pressed="planId === p.id"
              class="relative flex flex-col rounded-2xl border p-5 text-left transition"
              :class="planId === p.id ? 'border-primary-500 bg-primary-500/[0.06] ring-4 ring-primary-500/15' : p.popular ? 'border-primary-500/30 bg-white/[0.02]' : 'border-white/10 bg-white/[0.02] hover:border-white/15'"
              @click="planId = p.id"
            >
              <span v-if="p.popular" class="absolute -top-[11px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-primary-400 to-primary-600 px-3 py-[5px] text-[10.5px] font-extrabold tracking-[0.05em] text-white shadow-[0_6px_16px_rgba(125,83,242,.4)]">MOST POPULAR</span>
              <div class="flex items-center justify-between">
                <span class="flex size-[42px] items-center justify-center rounded-xl bg-primary-500/14 text-primary-400"><Icon :name="tierIcon[p.tier]" class="size-[21px]" /></span>
                <span :class="[radioBase, planId === p.id ? 'bg-primary-500' : 'border-2 border-white/15']"><span v-if="planId === p.id" class="size-2.5 rounded-full bg-white" /></span>
              </div>
              <div class="mt-4 font-heading text-[20px] font-bold tracking-[-0.01em] text-white">
                {{ p.name }}
              </div>
              <div class="mt-1.5 min-h-[54px] text-[13px] leading-[1.5] text-muted-400">
                {{ p.desc }}
              </div>
              <!--
                Total project value leads: it is the one figure no payment term
                can change, so it cannot contradict the rail or the contract.
              -->
              <div class="mt-1.5 font-heading text-[28px] font-extrabold tracking-[-0.02em] text-white tabular-nums">
                {{ money(p.base) }}
              </div>
              <div class="mt-1 text-xs text-muted-500">
                total project · from {{ money(fromMonthly(p.base)) }}/mo
              </div>
              <div class="my-4 h-px bg-white/10" />
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
          <div class="relative overflow-hidden rounded-2xl border border-primary-500/30 p-6" style="background: linear-gradient(135deg, #241846, #16252A 75%);">
            <div class="pointer-events-none absolute -top-12 right-10 size-52 rounded-full opacity-45 blur-[60px]" style="background: radial-gradient(circle at 50% 38%, #9b79f6 0%, #7d53f2 55%, #6c40e8 100%);" />
            <div class="relative flex flex-wrap items-center gap-6">
              <div class="min-w-[240px] flex-1">
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
              <div class="flex flex-wrap gap-6">
                <div v-for="b in [{ t: 'No deposit', s: '£0 down payment' }, { t: 'Fast kickoff', s: 'Scheduled on signature' }, { t: 'Cancel anytime', s: 'Before work starts' }]" :key="b.t" class="flex items-center gap-2.5">
                  <span class="flex size-[34px] items-center justify-center rounded-full bg-[#22B07D]/18 text-[#22B07D]"><Icon name="lucide:check" class="size-[17px]" /></span>
                  <span class="text-[13.5px] font-medium text-white">{{ b.t }}<br><span class="text-xs text-primary-200">{{ b.s }}</span></span>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-white/10 bg-muted-800 p-7">
            <h3 class="font-heading text-[20px] font-bold tracking-[-0.01em] text-white">
              Choose how you'd like to pay
            </h3>
            <p class="mb-5 text-sm text-muted-400">
              Spread the cost of your <strong class="font-semibold text-white">{{ plan?.name }}</strong> plan. Switch anytime before signing.
            </p>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <!-- 12 months -->
              <button type="button" :aria-pressed="term === '12'" class="relative flex flex-col rounded-2xl border p-[22px] text-left transition" :class="term === '12' ? 'border-primary-500 bg-primary-500/[0.06] ring-4 ring-primary-500/15' : 'border-white/10 bg-white/[0.02] hover:border-white/15'" @click="term = '12'">
                <div class="flex items-center justify-between">
                  <span class="rounded-full bg-[#22B07D]/16 px-2.5 py-[5px] text-[11px] font-extrabold tracking-[0.05em] text-[#22B07D]">0% INTEREST</span>
                  <span :class="[radioBase, term === '12' ? 'bg-primary-500' : 'border-2 border-white/15']"><span v-if="term === '12'" class="size-2.5 rounded-full bg-white" /></span>
                </div>
                <div class="mt-4 font-heading text-[18px] font-bold text-white">
                  12 monthly payments
                </div>
                <div class="mt-2.5 flex items-baseline gap-1.5">
                  <span class="font-heading text-[30px] font-extrabold tracking-[-0.02em] text-white tabular-nums sm:text-[36px]">{{ money(m12) }}</span><span class="text-sm text-muted-500">/mo</span>
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
              <button v-if="enable24mo" type="button" :aria-pressed="term === '24'" class="relative flex flex-col rounded-2xl border p-[22px] text-left transition" :class="term === '24' ? 'border-primary-500 bg-primary-500/[0.06] ring-4 ring-primary-500/15' : 'border-white/10 bg-white/[0.02] hover:border-white/15'" @click="term = '24'">
                <div class="flex items-center justify-between">
                  <span class="rounded-full bg-primary-500/18 px-2.5 py-[5px] text-[11px] font-extrabold tracking-[0.05em] text-primary-200">LOWEST MONTHLY</span>
                  <span :class="[radioBase, term === '24' ? 'bg-primary-500' : 'border-2 border-white/15']"><span v-if="term === '24'" class="size-2.5 rounded-full bg-white" /></span>
                </div>
                <div class="mt-4 font-heading text-[18px] font-bold text-white">
                  24 monthly payments
                </div>
                <div class="mt-2.5 flex items-baseline gap-1.5">
                  <span class="font-heading text-[30px] font-extrabold tracking-[-0.02em] text-white tabular-nums sm:text-[36px]">{{ money(m24) }}</span><span class="text-sm text-muted-500">/mo</span>
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
            <div class="mt-[18px] flex items-center gap-2 text-[12.5px] text-muted-500">
              <Icon name="lucide:lock" class="size-3.5" />The 24-month plan adds 1% monthly interest (≈12% per year) on the reducing balance. No early-repayment fees.
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
          <div class="rounded-2xl border border-white/10 bg-muted-800 p-7">
            <h3 class="font-heading text-[20px] font-bold tracking-[-0.01em] text-white">
              Tell us about your project
            </h3>
            <p class="mb-5 text-sm text-muted-400">
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
                <input
                  v-if="['text', 'url', 'date'].includes(field.type)"
                  :id="`f-${field.key}`"
                  v-model="form[field.key]"
                  :type="field.type === 'url' ? 'url' : 'text'"
                  :inputmode="field.type === 'date' ? 'numeric' : undefined"
                  :placeholder="field.type === 'date' ? 'dd / mm / yyyy' : field.placeholder"
                  :aria-invalid="visibleError(field) ? 'true' : undefined"
                  :aria-describedby="visibleError(field) ? `e-${field.key}` : undefined"
                  class="w-full rounded-xl border bg-white/5 px-3.5 py-3 text-sm text-white outline-none transition focus:border-primary-400"
                  :class="visibleError(field) ? 'border-[#EC6453]/60' : 'border-white/10'"
                  @blur="touched[field.key] = true"
                >

                <!--
                  Themed listbox instead of a native <select>, whose popup is an
                  OS menu — white with black text on this dark form, and
                  unstyleable from CSS.
                -->
                <BaseSelect
                  v-else-if="field.type === 'select'"
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

                <textarea
                  v-else-if="field.type === 'textarea'" :id="`f-${field.key}`" v-model="form[field.key]" rows="3" :placeholder="field.placeholder"
                  class="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none transition focus:border-primary-400"
                />
                <div v-else-if="field.type === 'checkboxes'" class="flex flex-wrap gap-2.5">
                  <label v-for="box in field.boxes" :key="box.key" class="inline-flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-[13.5px] text-white">
                    <input v-model="form[box.key]" type="checkbox" class="size-4 accent-primary-500">{{ box.label }}
                  </label>
                </div>

                <p v-if="visibleError(field)" :id="`e-${field.key}`" class="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[#EC6453]">
                  <Icon name="lucide:alert-circle" class="size-3.5 shrink-0" />{{ visibleError(field) }}
                </p>
              </div>
            </div>
            <div v-if="submitted && detailErrors.length" class="mt-4 flex items-center gap-2 rounded-xl border border-[#EC6453]/30 bg-[#EC6453]/10 px-3.5 py-2.5 text-[13px] text-[#EC6453]">
              <Icon name="lucide:alert-circle" class="size-[15px] shrink-0" />Please fix the highlighted {{ detailErrors.length === 1 ? 'field' : 'fields' }} to continue.
            </div>
          </div>
        </section>

        <!-- STEP 5 — CONTRACT -->
        <section v-else-if="step === 5" class="rounded-2xl border border-white/10 bg-muted-800 p-7">
          <h2 class="font-heading text-[22px] font-bold tracking-[-0.01em] text-white">
            Review &amp; sign
          </h2>
          <p class="mb-5 mt-1.5 text-[14.5px] text-muted-400">
            Your service agreement. Signing confirms the order and schedules your <strong class="font-semibold text-[#22B07D]">kickoff</strong>.
          </p>

          <div class="max-h-[264px] overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] px-6 py-[22px] text-[13.5px] leading-[1.65] text-muted-400">
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

          <!-- Printed legal name — part of the signing evidence. -->
          <div class="mt-5">
            <label for="legal-name" class="mb-2 block text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">Full legal name *</label>
            <input
              id="legal-name" v-model="legalName" autocomplete="name" placeholder="Your full legal name"
              class="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none transition focus:border-primary-400"
            >
          </div>

          <label class="mt-4 flex cursor-pointer items-start gap-3">
            <input v-model="agreed" type="checkbox" class="mt-0.5 size-[18px] shrink-0 accent-primary-500">
            <span class="text-sm leading-[1.5] text-muted-400">I have read and agree to the service agreement, the payment schedule, and Apex's <a href="#" class="text-primary-400 no-underline">terms of service</a>.</span>
          </label>
          <label class="mt-3 flex cursor-pointer items-start gap-3">
            <input v-model="esignConsent" type="checkbox" class="mt-0.5 size-[18px] shrink-0 accent-primary-500">
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
                  class="apex-focus cursor-pointer rounded-full px-3.5 py-1.5 text-[12.5px] transition"
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

            <div v-show="sigMode === 'draw'" class="relative h-[130px] overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.02]">
              <canvas ref="sigCanvas" width="640" height="130" class="absolute inset-0 size-full cursor-crosshair touch-none" @pointerdown="sigDown" @pointermove="sigMove" @pointerup="sigUp" @pointerleave="sigUp" />
              <!-- A signing rule and its caption, in place of the stray ✕ glyph that read as a broken character. -->
              <div class="pointer-events-none absolute inset-x-5 bottom-[26px] border-t border-white/10" />
              <span class="pointer-events-none absolute bottom-2 left-5 text-[11.5px] text-muted-500">Sign above this line</span>
            </div>

            <div v-show="sigMode === 'type'">
              <input v-model="signName" placeholder="Type your full name" class="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 font-heading text-base font-semibold text-white outline-none transition focus:border-primary-400">
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

          <div class="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-2 text-[13px] text-muted-500">
              <Icon name="lucide:check" class="size-4 text-[#22B07D]" />£0 charged today · cancel free before work begins
            </div>
            <BaseButton rounded="full" variant="primary" size="lg" :disabled="!canSign || placing" :loading="placing" @click="placeOrder">
              <Icon name="lucide:box" class="size-[17px]" />Sign &amp; start project
            </BaseButton>
          </div>
        </section>

        <!-- FOOTER NAV -->
        <div v-if="step <= 5" class="mt-[22px] flex items-center justify-between gap-3.5">
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
      <aside aria-label="Order summary" class="overflow-hidden rounded-2xl border border-white/10 lg:sticky lg:top-4" style="background: linear-gradient(160deg, #16252A, #101D21);">
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

        <div class="px-[22px] py-5">
          <div class="flex items-center justify-between gap-3 border-b border-white/10 py-2.5">
            <span class="text-[13px] text-muted-500">Service</span>
            <span v-if="service" class="text-right text-[13.5px] font-semibold text-white">{{ serviceName }}</span>
            <span v-else class="text-[13px] text-muted-500/60">Not selected</span>
          </div>
          <div class="flex items-center justify-between gap-3 border-b border-white/10 py-2.5">
            <span class="text-[13px] text-muted-500">Plan</span>
            <span v-if="plan" class="text-right text-[13.5px] font-semibold text-white">{{ plan.name }}</span>
            <span v-else class="text-[13px] text-muted-500/60">—</span>
          </div>
          <div v-if="plan" class="flex items-center justify-between gap-3 border-b border-white/10 py-2.5">
            <span class="text-[13px] text-muted-500">Project value</span>
            <span class="text-[13.5px] font-semibold text-white">{{ money(base) }}</span>
          </div>
          <template v-if="step >= 3 && plan">
            <div class="flex items-center justify-between gap-3 border-b border-white/10 py-2.5">
              <span class="text-[13px] text-muted-500">Payment plan</span>
              <span class="text-[13.5px] font-semibold text-white">{{ termLabel }}</span>
            </div>
            <div v-if="term === '24'" class="flex items-center justify-between gap-3 border-b border-white/10 py-2.5">
              <span class="text-[13px] text-muted-500">Interest (1%/mo)</span>
              <span class="text-[13.5px] font-semibold text-white">{{ money(interest24) }}</span>
            </div>
          </template>
        </div>

        <!--
          Before a term is chosen this reads FROM and quotes exactly the same
          floor as the plan cards. It used to say YOUR MONTHLY from step 1 while
          quoting a term-specific figure off the default `term`, so the rail and
          the card could show two different monthlies for the same plan.
        -->
        <div v-if="plan" class="mx-[22px] rounded-xl border border-primary-500/28 px-[18px] py-4" style="background: linear-gradient(135deg, rgba(125,83,242,.22), rgba(125,83,242,.06));">
          <div class="flex items-end justify-between gap-3">
            <div>
              <div class="text-[11.5px] font-bold uppercase tracking-[0.05em] text-primary-200">
                {{ railLabel }}
              </div>
              <div class="mt-0.5 font-heading text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white tabular-nums">
                {{ money(railAmount) }}<span class="text-[13px] font-medium text-primary-200">/mo</span>
              </div>
            </div>
            <div v-if="termChosen" class="text-right text-[11.5px] leading-[1.5] text-primary-200">
              {{ monthsText }}<br>total {{ money(total) }}
            </div>
            <div v-else class="max-w-[130px] text-right text-[11.5px] leading-[1.5] text-primary-200">
              Choose a payment plan in step 3
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2.5 px-[22px] pb-[22px] pt-[18px]">
          <div class="flex items-center justify-between rounded-xl border border-[#22B07D]/24 bg-[#22B07D]/10 px-3.5 py-3">
            <span class="text-[13px] font-semibold text-white">Due today</span>
            <span class="font-heading text-[18px] font-extrabold text-[#22B07D]">£0</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-muted-500">
            <Icon name="lucide:zap" class="size-3.5 shrink-0 text-[#22B07D]" />No deposit — first payment {{ firstDueDays }} days after kickoff.
          </div>
        </div>
      </aside>
    </div>

    <!-- ===================== SUCCESS OVERLAY ===================== -->
    <Teleport to="body">
      <Transition enter-active-class="transition-opacity duration-300" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
        <div v-if="step === 6" class="fixed inset-0 z-50 flex items-center justify-center p-6" style="background: rgba(9,18,20,.82); backdrop-filter: blur(8px);">
          <div class="apex-pop relative max-h-[calc(100dvh_-_3rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] w-full max-w-[520px] overflow-y-auto rounded-2xl border border-primary-500/30 p-9 text-center" style="background: linear-gradient(160deg, #1B2B31, #101D21);">
            <div class="pointer-events-none absolute -top-16 left-1/2 size-60 -translate-x-1/2 rounded-full opacity-40 blur-[70px]" style="background: radial-gradient(circle at 50% 38%, #9b79f6 0%, #7d53f2 55%, #6c40e8 100%);" />
            <div class="relative mx-auto flex size-[74px] items-center justify-center rounded-full shadow-[0_16px_40px_rgba(34,176,125,.45)]" style="background: linear-gradient(150deg, #22B07D, #0f6e4d);">
              <Icon name="lucide:check" class="size-9 text-white" />
            </div>
            <h2 class="relative mt-5 font-heading text-[28px] font-extrabold tracking-[-0.02em] text-white">
              You're all set!
            </h2>
            <p class="relative mt-2.5 text-[15px] leading-[1.55] text-muted-400">
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

            <div class="relative flex flex-col gap-3 sm:flex-row">
              <BaseButton rounded="full" variant="primary" size="lg" class="w-full sm:flex-1" @click="router.push('/dashboards/orders')">
                View project<Icon name="lucide:arrow-right" class="size-4" />
              </BaseButton>
              <BaseButton rounded="full" class="w-full border border-white/10 bg-muted-800 !text-white hover:bg-muted-700 sm:w-auto" @click="resetFlow">
                New order
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
