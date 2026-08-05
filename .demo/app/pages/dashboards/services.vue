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
interface Field { key: string, label: string, type: 'text' | 'url' | 'date' | 'select' | 'textarea' | 'checkboxes', placeholder?: string, options?: string[], boxes?: { key: string, label: string }[], full?: boolean }
const formSchemas: Record<string, Field[]> = {
  web: [
    { key: 'title', label: 'Project name *', type: 'text', placeholder: 'e.g. Gold Store storefront', full: true },
    { key: 'url', label: 'Current website', type: 'url', placeholder: 'https:// (optional)' },
    { key: 'pages', label: 'Pages needed', type: 'select', options: ['1–3 pages', '4–8 pages', '9+ pages'] },
    { key: 'tech', label: 'Tech preference', type: 'select', options: ['No preference', 'WordPress', 'React / Next.js'] },
    { key: 'launch', label: 'Target launch', type: 'date' },
    { key: 'notes', label: 'Anything else we should know?', type: 'textarea', placeholder: 'Goals, references, must-have features…', full: true },
  ],
  mkt: [
    { key: 'title', label: 'Business name *', type: 'text', placeholder: 'e.g. Nitro LLC' },
    { key: 'url', label: 'Landing / site URL', type: 'url', placeholder: 'https://' },
    { key: 'budget', label: 'Monthly ad budget', type: 'select', options: ['Under £1,000', '£1,000 – £5,000', '£5,000+'] },
    { key: 'channel', label: 'Primary channel', type: 'select', options: ['Google Ads', 'Meta (FB/IG)', 'TikTok', 'LinkedIn'] },
    { key: 'goal', label: 'Main goal', type: 'select', options: ['More leads', 'More sales', 'Brand awareness'] },
    { key: 'audience', label: 'Target audience', type: 'text', placeholder: 'Who are we reaching?' },
  ],
  uiux: [
    { key: 'title', label: 'Product name *', type: 'text', placeholder: 'e.g. Apex Vision app' },
    { key: 'platform', label: 'Platform', type: 'select', options: ['Web app', 'iOS', 'Android', 'Web + mobile'] },
    { key: 'screens', label: 'Approx. screens', type: 'select', options: ['Up to 6', '7–20', '20+'] },
    { key: 'files', label: 'Existing design files?', type: 'select', options: ['No, starting fresh', 'Yes, in Figma', 'Yes, other format'] },
    { key: 'research', label: 'UX research needed?', type: 'select', options: ['Yes, please', 'No, we have insights'] },
    { key: 'url', label: 'Reference / inspo link', type: 'url', placeholder: 'https:// (optional)' },
  ],
  brand: [
    { key: 'title', label: 'Company name *', type: 'text', placeholder: 'e.g. Okano' },
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
const showErr = ref(false)
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

const fields = computed(() => formSchemas[serviceId.value ?? ''] ?? [])

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
  if (step.value === 4 && !String(form.title || '').trim()) {
    showErr.value = true
    return
  }
  showErr.value = false
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
    const label = f.label.replace(/\s*\*$/, '')
    if (f.type === 'checkboxes') {
      const picked = (f.boxes ?? []).filter(b => form[b.key]).map(b => b.label)
      if (picked.length)
        out.push({ label, value: picked.join(', ') })
      continue
    }
    // A select shows its first option by default even before interaction.
    const raw = f.type === 'select' ? (form[f.key] ?? f.options?.[0]) : form[f.key]
    const value = raw == null ? '' : String(raw).trim()
    if (value)
      out.push({ label, value })
  }
  return out
}

const canSign = computed(() =>
  agreed.value
  && esignConsent.value
  && legalName.value.trim().length > 1
  && (hasDrawn.value || signName.value.trim().length > 1))

async function placeOrder() {
  if (!canSign.value || placing.value)
    return
  placing.value = true
  try {
    // Signature: the drawn canvas flattened to a PNG data-URL, else the typed name.
    const drawn = hasDrawn.value
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
  showErr.value = false
  orderId.value = ''
  statusStarted.value = false
  Object.keys(form).forEach(k => delete form[k])
}

const radioBase = 'flex size-[22px] shrink-0 items-center justify-center rounded-full transition'
</script>

<template>
  <div class="mx-auto flex max-w-[1180px] flex-col gap-6 pb-12 font-sans text-muted-400">
    <!-- secured-checkout strip -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-2 text-[13.5px] text-muted-500">
        <span>Services</span><span class="opacity-50">/</span><span class="font-semibold text-white">New order</span>
      </div>
      <span class="inline-flex items-center gap-1.5 rounded-full bg-[#22B07D]/12 px-3 py-1.5 text-[12.5px] font-semibold text-[#22B07D]"><Icon name="lucide:shield-check" class="size-3.5" />Secured checkout</span>
    </div>

    <!-- title -->
    <div>
      <div class="mb-1.5 text-xs font-bold tracking-[0.06em] text-primary-400">
        NEW ORDER
      </div>
      <h1 class="font-heading text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white">
        Start your <span class="text-primary-400">project</span>
      </h1>
    </div>

    <!-- stepper -->
    <div role="list" aria-label="Progress" class="flex flex-nowrap items-center gap-1 overflow-x-auto py-1.5">
      <template v-for="(label, i) in STEP_LABELS" :key="label">
        <div v-if="i > 0" class="h-0.5 w-[30px] shrink-0 rounded" :class="(i + 1) <= step ? 'bg-primary-500' : 'bg-white/10'" />
        <button
          type="button" role="listitem" :disabled="(i + 1) > maxStep"
          class="inline-flex shrink-0 items-center gap-2.5 rounded-[10px] px-1.5 py-1 enabled:cursor-pointer"
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
    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_344px]">
      <!-- ===================== LEFT: STEP CONTENT ===================== -->
      <div>
        <!-- STEP 1 — SERVICE -->
        <section v-if="step === 1" class="rounded-[28px] border border-white/10 bg-muted-800 p-7">
          <h2 class="font-heading text-[22px] font-bold tracking-[-0.01em] text-white">
            What can we build for you?
          </h2>
          <p class="mb-6 mt-1.5 text-[14.5px] text-muted-400">
            Choose the service you need. You'll pick a plan and a payment schedule next.
          </p>
          <div class="grid gap-4 sm:grid-cols-2">
            <button
              v-for="svc in services" :key="svc.id"
              type="button" :aria-pressed="serviceId === svc.id"
              class="relative flex min-h-[158px] flex-col rounded-[20px] border bg-white/[0.02] p-[22px] text-left transition"
              :class="serviceId === svc.id ? 'border-primary-500 ring-4 ring-primary-500/15' : 'border-white/10 hover:border-white/15'"
              @click="selectService(svc.id)"
            >
              <div class="mb-auto flex items-center justify-between">
                <span class="flex size-12 items-center justify-center rounded-[13px]" :class="svc.tone"><Icon :name="svc.icon" class="size-[23px]" /></span>
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
        <section v-else-if="step === 2" class="rounded-[28px] border border-white/10 bg-muted-800 p-7">
          <div class="mb-1.5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 class="font-heading text-[22px] font-bold tracking-[-0.01em] text-white">
                Choose your plan
              </h2>
              <p class="mt-1.5 text-[14.5px] text-muted-400">
                For <strong class="font-semibold text-primary-400">{{ serviceName }}</strong> · prices shown as the lowest monthly over 24 months.
              </p>
            </div>
            <button type="button" class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:border-white/15" @click="goStep(1)">
              <Icon name="lucide:arrow-left" class="size-3.5" />Change service
            </button>
          </div>
          <div class="mt-5 grid gap-4 md:grid-cols-3">
            <button
              v-for="p in plans" :key="p.id"
              type="button" :aria-pressed="planId === p.id"
              class="relative flex flex-col rounded-[20px] border p-5 text-left transition"
              :class="planId === p.id ? 'border-primary-500 bg-primary-500/[0.06] ring-4 ring-primary-500/15' : p.popular ? 'border-primary-500/30 bg-white/[0.02]' : 'border-white/10 bg-white/[0.02] hover:border-white/15'"
              @click="planId = p.id"
            >
              <span v-if="p.popular" class="absolute -top-[11px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-primary-400 to-primary-600 px-3 py-[5px] text-[10.5px] font-extrabold tracking-[0.05em] text-white shadow-[0_6px_16px_rgba(125,83,242,.4)]">MOST POPULAR</span>
              <div class="flex items-center justify-between">
                <span class="flex size-[42px] items-center justify-center rounded-[11px] bg-primary-500/14 text-primary-400"><Icon :name="tierIcon[p.tier]" class="size-[21px]" /></span>
                <span :class="[radioBase, planId === p.id ? 'bg-primary-500' : 'border-2 border-white/15']"><span v-if="planId === p.id" class="size-2.5 rounded-full bg-white" /></span>
              </div>
              <div class="mt-4 font-heading text-[20px] font-bold tracking-[-0.01em] text-white">
                {{ p.name }}
              </div>
              <div class="mt-1.5 min-h-[54px] text-[13px] leading-[1.5] text-muted-400">
                {{ p.desc }}
              </div>
              <div class="mt-1.5 flex items-baseline gap-1.5">
                <span class="font-heading text-[30px] font-extrabold tracking-[-0.02em] text-white tabular-nums">{{ money(amort(p.base)) }}</span>
                <span class="text-[13px] text-muted-500">/mo</span>
              </div>
              <div class="mt-0.5 text-xs text-muted-500">
                24 monthly payments · {{ money(p.base) }} total project
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
          <div class="relative overflow-hidden rounded-[28px] border border-primary-500/30 p-6" style="background: linear-gradient(135deg, #241846, #16252A 75%);">
            <div class="pointer-events-none absolute -top-12 right-10 size-52 rounded-full opacity-45 blur-[60px]" style="background: radial-gradient(circle at 50% 38%, #9b79f6 0%, #7d53f2 55%, #6c40e8 100%);" />
            <div class="relative flex flex-wrap items-center gap-6">
              <div class="min-w-[240px] flex-1">
                <div class="mb-2 text-xs font-bold tracking-[0.05em] text-primary-200">
                  PAY FROM PROFITS
                </div>
                <h2 class="font-heading text-[26px] font-extrabold leading-[1.12] tracking-[-0.02em] text-white">
                  £0 today. Your project starts immediately.
                </h2>
              </div>
              <div class="flex flex-wrap gap-6">
                <div v-for="b in [{ t: 'No deposit', s: '£0 down payment' }, { t: 'Start now', s: 'Work begins today' }, { t: 'Cancel anytime', s: 'Before work starts' }]" :key="b.t" class="flex items-center gap-2.5">
                  <span class="flex size-[34px] items-center justify-center rounded-full bg-[#22B07D]/18 text-[#22B07D]"><Icon name="lucide:check" class="size-[17px]" /></span>
                  <span class="text-[13.5px] font-medium text-white">{{ b.t }}<br><span class="text-xs text-primary-200">{{ b.s }}</span></span>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-[28px] border border-white/10 bg-muted-800 p-7">
            <h3 class="font-heading text-[20px] font-bold tracking-[-0.01em] text-white">
              Choose how you'd like to pay
            </h3>
            <p class="mb-5 text-sm text-muted-400">
              Spread the cost of your <strong class="font-semibold text-white">{{ plan?.name }}</strong> plan. Switch anytime before signing.
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <!-- 12 months -->
              <button type="button" :aria-pressed="term === '12'" class="relative flex flex-col rounded-[20px] border p-[22px] text-left transition" :class="term === '12' ? 'border-primary-500 bg-primary-500/[0.06] ring-4 ring-primary-500/15' : 'border-white/10 bg-white/[0.02] hover:border-white/15'" @click="term = '12'">
                <div class="flex items-center justify-between">
                  <span class="rounded-full bg-[#22B07D]/16 px-2.5 py-[5px] text-[11px] font-extrabold tracking-[0.05em] text-[#22B07D]">0% INTEREST</span>
                  <span :class="[radioBase, term === '12' ? 'bg-primary-500' : 'border-2 border-white/15']"><span v-if="term === '12'" class="size-2.5 rounded-full bg-white" /></span>
                </div>
                <div class="mt-4 font-heading text-[18px] font-bold text-white">
                  12 monthly payments
                </div>
                <div class="mt-2.5 flex items-baseline gap-1.5">
                  <span class="font-heading text-[36px] font-extrabold tracking-[-0.02em] text-white tabular-nums">{{ money(m12) }}</span><span class="text-sm text-muted-500">/mo</span>
                </div>
                <div class="mt-4 flex flex-col gap-2 text-[13px]">
                  <div class="flex justify-between text-muted-400">
                    <span>Interest</span><span class="font-semibold text-[#22B07D]">£0 · 0%</span>
                  </div>
                  <div class="flex justify-between text-muted-400">
                    <span>Total to pay</span><span class="font-bold text-white">{{ money(base) }}</span>
                  </div>
                </div>
                <div class="mt-3.5 flex items-center gap-1.5 rounded-[10px] border border-primary-500/20 bg-primary-500/10 px-2.5 py-2 text-xs text-primary-200">
                  <Icon name="lucide:info" class="size-3.5" />Pay the least overall
                </div>
              </button>
              <!-- 24 months (hidden when the admin disables the plan) -->
              <button v-if="enable24mo" type="button" :aria-pressed="term === '24'" class="relative flex flex-col rounded-[20px] border p-[22px] text-left transition" :class="term === '24' ? 'border-primary-500 bg-primary-500/[0.06] ring-4 ring-primary-500/15' : 'border-white/10 bg-white/[0.02] hover:border-white/15'" @click="term = '24'">
                <div class="flex items-center justify-between">
                  <span class="rounded-full bg-primary-500/18 px-2.5 py-[5px] text-[11px] font-extrabold tracking-[0.05em] text-primary-200">LOWEST MONTHLY</span>
                  <span :class="[radioBase, term === '24' ? 'bg-primary-500' : 'border-2 border-white/15']"><span v-if="term === '24'" class="size-2.5 rounded-full bg-white" /></span>
                </div>
                <div class="mt-4 font-heading text-[18px] font-bold text-white">
                  24 monthly payments
                </div>
                <div class="mt-2.5 flex items-baseline gap-1.5">
                  <span class="font-heading text-[36px] font-extrabold tracking-[-0.02em] text-white tabular-nums">{{ money(m24) }}</span><span class="text-sm text-muted-500">/mo</span>
                </div>
                <div class="mt-4 flex flex-col gap-2 text-[13px]">
                  <div class="flex justify-between text-muted-400">
                    <span>Interest</span><span class="font-semibold text-white">{{ money(interest24) }} · 1%/mo</span>
                  </div>
                  <div class="flex justify-between text-muted-400">
                    <span>Total to pay</span><span class="font-bold text-white">{{ money(total24) }}</span>
                  </div>
                </div>
                <div class="mt-3.5 flex items-center gap-1.5 rounded-[10px] border border-primary-500/20 bg-primary-500/10 px-2.5 py-2 text-xs text-primary-200">
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
        <section v-else-if="step === 4" class="flex flex-col gap-[18px]">
          <div class="flex flex-wrap items-center gap-[18px] rounded-[20px] border border-white/10 px-6 py-5" style="background: linear-gradient(135deg, #1B2B31, #101D21);">
            <span class="flex size-[46px] items-center justify-center rounded-xl bg-primary-500/16 text-primary-400"><Icon :name="tierIcon[plan?.tier ?? 0]" class="size-[23px]" /></span>
            <div class="min-w-[180px] flex-1">
              <div class="text-xs font-bold tracking-[0.05em] text-primary-200">
                {{ serviceName }}
              </div>
              <div class="mt-0.5 font-heading text-[19px] font-bold text-white">
                {{ plan?.name }} plan
              </div>
            </div>
            <div class="text-right">
              <div class="font-heading text-[24px] font-extrabold tracking-[-0.02em] text-white tabular-nums">
                {{ money(monthly) }}<span class="text-[13px] font-medium text-muted-500">/mo</span>
              </div>
              <div class="text-[12.5px] text-muted-500">
                {{ termLabel }} · {{ money(total) }} total
              </div>
            </div>
          </div>

          <div class="rounded-[28px] border border-white/10 bg-muted-800 p-7">
            <h3 class="font-heading text-[20px] font-bold tracking-[-0.01em] text-white">
              Tell us about your project
            </h3>
            <p class="mb-5 text-sm text-muted-400">
              A few details so the right team is ready the moment you sign. <span class="text-muted-500">Tailored to your {{ serviceName }} order.</span>
            </p>
            <div class="grid gap-[18px] sm:grid-cols-2">
              <div v-for="field in fields" :key="field.key" :class="field.full ? 'sm:col-span-2' : ''">
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">{{ field.label }}</label>
                <input
                  v-if="['text', 'url', 'date'].includes(field.type)"
                  v-model="form[field.key]" :type="field.type === 'url' ? 'url' : field.type" :placeholder="field.placeholder"
                  class="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none transition [color-scheme:dark] focus:border-primary-400"
                >
                <select
                  v-else-if="field.type === 'select'" v-model="form[field.key]"
                  class="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none transition [color-scheme:dark] focus:border-primary-400"
                >
                  <option v-for="o in field.options" :key="o">
                    {{ o }}
                  </option>
                </select>
                <textarea
                  v-else-if="field.type === 'textarea'" v-model="form[field.key]" rows="3" :placeholder="field.placeholder"
                  class="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none transition focus:border-primary-400"
                />
                <div v-else-if="field.type === 'checkboxes'" class="flex flex-wrap gap-2.5">
                  <label v-for="box in field.boxes" :key="box.key" class="inline-flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-white/10 bg-white/5 px-3.5 py-2.5 text-[13.5px] text-white">
                    <input v-model="form[box.key]" type="checkbox" class="size-4 accent-primary-500">{{ box.label }}
                  </label>
                </div>
              </div>
            </div>
            <div v-if="showErr" class="mt-4 flex items-center gap-2 rounded-[10px] border border-[#EC6453]/30 bg-[#EC6453]/10 px-3.5 py-2.5 text-[13px] text-[#EC6453]">
              <Icon name="lucide:alert-circle" class="size-[15px]" />Please add a name so we can set up your project.
            </div>
          </div>
        </section>

        <!-- STEP 5 — CONTRACT -->
        <section v-else-if="step === 5" class="rounded-[28px] border border-white/10 bg-muted-800 p-7">
          <h2 class="font-heading text-[22px] font-bold tracking-[-0.01em] text-white">
            Review &amp; sign
          </h2>
          <p class="mb-5 mt-1.5 text-[14.5px] text-muted-400">
            Your service agreement. Signing moves the project straight to <strong class="font-semibold text-[#22B07D]">Started</strong>.
          </p>

          <div class="max-h-[264px] overflow-y-auto rounded-[14px] border border-white/10 bg-white/[0.02] px-6 py-[22px] text-[13.5px] leading-[1.65] text-muted-400">
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
              Apex will deliver the features listed in the selected plan. Work begins immediately upon signature, with no down payment required.
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

          <div class="mt-5 grid items-end gap-5 sm:grid-cols-[1.3fr_1fr]">
            <div>
              <div class="mb-2 flex items-center justify-between">
                <label class="text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">Draw your signature</label>
                <button type="button" class="cursor-pointer border-none bg-transparent text-xs font-semibold text-primary-400 transition hover:text-white" @click="clearSig">
                  Clear
                </button>
              </div>
              <div class="relative h-[130px] overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.02]">
                <canvas ref="sigCanvas" width="640" height="130" class="absolute inset-0 size-full cursor-crosshair touch-none" @pointerdown="sigDown" @pointermove="sigMove" @pointerup="sigUp" @pointerleave="sigUp" />
                <div class="pointer-events-none absolute inset-x-[18px] bottom-4 border-t border-white/10" />
                <span class="pointer-events-none absolute bottom-5 left-[18px] text-[11px] text-muted-500">✕</span>
              </div>
            </div>
            <div>
              <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">Or type your full name</label>
              <input v-model="signName" placeholder="Your full name" class="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 font-heading text-[15px] font-semibold text-white outline-none transition focus:border-primary-400">
              <div class="mt-2.5 flex items-center gap-1.5 text-xs text-muted-500">
                <Icon name="lucide:lock" class="size-3.5" />Legally binding e-signature
              </div>
            </div>
          </div>

          <!-- Evidence notice — transparency about what is recorded as proof. -->
          <p class="mt-4 flex items-start gap-2 rounded-[10px] border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-[12.5px] leading-[1.55] text-muted-500">
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
        <div v-if="step >= 1 && step <= 5" class="mt-[22px] flex items-center justify-between gap-3.5">
          <BaseButton v-if="step > 1" rounded="full" class="border border-white/10 bg-muted-800 !text-white hover:bg-muted-700" @click="back">
            <Icon name="lucide:arrow-left" class="size-4" />Back
          </BaseButton>
          <div class="flex-1" />
          <BaseButton rounded="full" variant="primary" size="lg" :disabled="!canContinue" @click="next">
            {{ continueLabel }}<Icon name="lucide:arrow-right" class="size-4" />
          </BaseButton>
        </div>
      </div>

      <!-- ===================== RIGHT: ORDER SUMMARY RAIL ===================== -->
      <aside aria-label="Order summary" class="overflow-hidden rounded-[28px] border border-white/10 lg:sticky lg:top-4" style="background: linear-gradient(160deg, #16252A, #101D21);">
        <div class="flex items-center gap-3 border-b border-white/10 px-[22px] py-5">
          <span class="flex size-[34px] items-center justify-center rounded-[9px] bg-primary-500/16 text-primary-400"><Icon name="lucide:file-text" class="size-[17px]" /></span>
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

        <div v-if="plan" class="mx-[22px] rounded-[14px] border border-primary-500/28 px-[18px] py-4" style="background: linear-gradient(135deg, rgba(125,83,242,.22), rgba(125,83,242,.06));">
          <div class="flex items-end justify-between">
            <div>
              <div class="text-[11.5px] font-bold tracking-[0.05em] text-primary-200">
                YOUR MONTHLY
              </div>
              <div class="mt-0.5 font-heading text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white tabular-nums">
                {{ money(monthly) }}<span class="text-[13px] font-medium text-primary-200">/mo</span>
              </div>
            </div>
            <div class="text-right text-[11.5px] text-primary-200">
              {{ monthsText }}<br>total {{ money(total) }}
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2.5 px-[22px] pb-[22px] pt-[18px]">
          <div class="flex items-center justify-between rounded-[11px] border border-[#22B07D]/24 bg-[#22B07D]/10 px-3.5 py-3">
            <span class="text-[13px] font-semibold text-white">Due today</span>
            <span class="font-heading text-[18px] font-extrabold text-[#22B07D]">£0</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-muted-500">
            <Icon name="lucide:zap" class="size-3.5 text-[#22B07D]" />Project starts the moment you sign — no deposit.
          </div>
        </div>
      </aside>
    </div>

    <!-- ===================== SUCCESS OVERLAY ===================== -->
    <Teleport to="body">
      <Transition enter-active-class="transition-opacity duration-300" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
        <div v-if="step === 6" class="fixed inset-0 z-50 flex items-center justify-center p-6" style="background: rgba(9,18,20,.82); backdrop-filter: blur(8px);">
          <div class="apex-pop relative max-h-[calc(100dvh_-_3rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] w-full max-w-[520px] overflow-y-auto rounded-[28px] border border-primary-500/30 p-9 text-center" style="background: linear-gradient(160deg, #1B2B31, #101D21);">
            <div class="pointer-events-none absolute -top-16 left-1/2 size-60 -translate-x-1/2 rounded-full opacity-40 blur-[70px]" style="background: radial-gradient(circle at 50% 38%, #9b79f6 0%, #7d53f2 55%, #6c40e8 100%);" />
            <div class="relative mx-auto flex size-[74px] items-center justify-center rounded-full shadow-[0_16px_40px_rgba(34,176,125,.45)]" style="background: linear-gradient(150deg, #22B07D, #0f6e4d);">
              <Icon name="lucide:check" class="size-9 text-white" />
            </div>
            <h2 class="relative mt-5 font-heading text-[28px] font-extrabold tracking-[-0.02em] text-white">
              You're all set!
            </h2>
            <p class="relative mt-2.5 text-[15px] leading-[1.55] text-muted-400">
              Your <strong class="font-semibold text-white">{{ plan?.name }}</strong> order is confirmed and signed. The team has been notified and work begins today.
            </p>

            <div class="relative my-6 flex items-center justify-center gap-3">
              <span class="inline-flex items-center gap-2 rounded-full bg-[#22B07D]/14 px-3.5 py-2 text-[13px] font-bold text-[#22B07D]"><Icon name="lucide:check" class="size-3.5" />Order placed</span>
              <Icon name="lucide:arrow-right" class="size-[22px] text-muted-500" />
              <span class="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold transition" :class="statusStarted ? 'bg-gradient-to-r from-primary-400 to-primary-600 text-white shadow-[0_8px_20px_rgba(125,83,242,.4)]' : 'border border-white/10 bg-white/5 text-muted-500'">
                <Icon v-if="statusStarted" name="lucide:zap" class="size-3.5" />{{ statusStarted ? 'Started' : 'Starting…' }}
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
