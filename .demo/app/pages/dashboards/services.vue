<script setup lang="ts">
import type { Catalog, CatalogPlan, CatalogService, PayMode, ServiceId } from '~~/shared/catalog'
import { DEFAULT_CATALOG, featuredPlan, findService, firstPaymentDate, fromMonthly, orderTerms, paymentCount, SERVICE_ORDER } from '~~/shared/catalog'
import { orderRef } from '~~/shared/refs'

/**
 * New order — Panel v2 (`New Order.dc.html`).
 *
 * Three steps instead of five: Plan (service, then its plans on a screen of
 * their own with "Change service"), Brief, Pay and sign. Fixed plans take no
 * deposit: payment 1 of n is the kickoff payment.
 * The plans are the website's v2 plans, read from `/api/config`'s catalogue,
 * and every figure on this page — card, schedule, summary rail, phone footer
 * and the signed agreement — comes from the shared `orderTerms()` that
 * `POST /api/orders` prices with (ADR-019). Nothing is charged here: the
 * kickoff payment is taken after the kickoff call.
 *
 * Deliberate differences from the mockup, each because the mockup promises
 * something the product does not do:
 *  - "Pay from" shows the wallet only. Payments are taken from the wallet
 *    balance (`chargeInstallment`, `collectKickoff`); offering a saved card as
 *    a payment source would be a choice nothing reads.
 *  - Nothing says a copy was emailed: there is no mail provider. The signed
 *    agreement is kept with the order, and the page says that.
 *  - The terms checkbox and its link are siblings, so a click on the link
 *    opens the terms instead of toggling consent (V2 Phase 8).
 */
definePageMeta({
  title: 'New order',
  layout: 'sidenav',
  middleware: 'auth',
  bottomNav: false,
})

const route = useRoute()
const router = useRouter()
const toaster = useNuiToasts()
const { user } = useUser()
const { formatCurrency } = useCurrency()
const { data: config, refresh: refreshConfig } = useApexConfig({ lazy: false })
const { data: overview } = useFetch<{ walletBalance: number }>('/api/dashboard/overview', { key: 'dashboard-overview', lazy: true, server: false })

const catalog = computed<Catalog>(() => ((config.value as any)?.catalog as Catalog | undefined) ?? DEFAULT_CATALOG)
const services = computed(() => SERVICE_ORDER.map(id => catalog.value.services.find(s => s.id === id)).filter((s): s is CatalogService => Boolean(s)))

/* ------------------------------------------------------------------ state */
const step = ref<1 | 2 | 3>(1)
// Step 1 is two screens (New Order.dc.html, 2026-10-25): the service grid,
// then that service's plans with "Change service" above them.
const planView = ref(false)
const svcId = ref<ServiceId | null>(null)
const planId = ref<string | null>(null)
const pay = ref<PayMode>('monthly')
const showAll = ref(false)
const sumOpen = ref(false)
const pages = ref('')

const service = computed(() => (svcId.value ? catalog.value.services.find(s => s.id === svcId.value) : undefined))
const plan = computed<CatalogPlan | undefined>(() => service.value?.plans.find(p => p.id === planId.value))
const kind = computed(() => service.value?.kind ?? null)
const terms = computed(() => (service.value && plan.value ? orderTerms(service.value, plan.value, pay.value) : null))
const scopeCall = computed(() => kind.value === 'scope' && planId.value === 'call')

function pickService(id: ServiceId) {
  const s = catalog.value.services.find(x => x.id === id)
  if (!s) {
    return
  }
  if (svcId.value !== id) {
    planId.value = featuredPlan(s).id
  }
  svcId.value = id
  pay.value = 'monthly'
  pages.value = ''
  planView.value = true
  window.scrollTo({ top: 0 })
}
function changeService() {
  planView.value = false
  window.scrollTo({ top: 0 })
}

// `?service=website-design&plan=growth` from the website or the dashboard.
onMounted(() => {
  const s = findService(catalog.value, String(route.query.service ?? ''))
  if (s) {
    svcId.value = s.id
    planId.value = (s.plans.find(p => p.id === route.query.plan) ?? featuredPlan(s)).id
    planView.value = true
  }
})

/* ------------------------------------------------------------------ brief */
const fName = ref('')
const fGoal = ref('')
const fSite = ref('')
const fDate = ref('')
const moreOpen = ref(false)
const touched = reactive({ name: false, goal: false, date: false })
const PAGE_OPTIONS = ['1 to 5 pages', '6 to 12 pages', '13 to 25 pages', 'Not sure yet']

function validDate(v: string) {
  if (!v) {
    return true
  }
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v)
  if (!m) {
    return false
  }
  const d = new Date(+m[3]!, +m[2]! - 1, +m[1]!)
  return d.getDate() === +m[1]! && d.getMonth() === +m[2]! - 1
}
const errName = computed(() => (touched.name && !fName.value.trim() ? 'Add a project name' : ''))
const errGoal = computed(() => (touched.goal && !fGoal.value.trim() ? 'Tell us what success looks like, in a sentence or two' : ''))
const errDate = computed(() => (touched.date && !validDate(fDate.value.trim()) ? 'Use dd/mm/yyyy, for example 15/01/2027' : ''))
const briefOk = computed(() => Boolean(fName.value.trim() && fGoal.value.trim() && validDate(fDate.value.trim())))

const uploads = useApexUploads()
function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  uploads.add(input.files)
  input.value = ''
}

/* ------------------------------------------------------------ pay & sign */
const sigMode = ref<'type' | 'draw'>('type')
const sigName = ref('')
const sigDrawn = ref(false)
const agreeTerms = ref(false)
const agreeSchedule = ref(false)
const accountName = computed(() => [(user.value as any)?.firstName, (user.value as any)?.lastName].filter(Boolean).join(' ').trim())
const sigOk = computed(() => (sigMode.value === 'type' ? sigName.value.trim().length > 2 : sigDrawn.value) && agreeTerms.value && agreeSchedule.value)

const canvas = ref<HTMLCanvasElement | null>(null)
let drawing = false
let last: [number, number] | null = null
function sizeCanvas() {
  const el = canvas.value
  if (!el) {
    return
  }
  const dpr = window.devicePixelRatio || 1
  const r = el.getBoundingClientRect()
  el.width = r.width * dpr
  el.height = r.height * dpr
  const ctx = el.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}
watch(canvas, el => el && nextTick(sizeCanvas))
function pos(e: PointerEvent): [number, number] {
  const r = canvas.value!.getBoundingClientRect()
  return [e.clientX - r.left, e.clientY - r.top]
}
function sigDown(e: PointerEvent) {
  drawing = true
  last = pos(e)
  canvas.value?.setPointerCapture(e.pointerId)
}
function sigMove(e: PointerEvent) {
  if (!drawing || !canvas.value || !last) {
    return
  }
  const ctx = canvas.value.getContext('2d')!
  ctx.strokeStyle = getComputedStyle(canvas.value).color
  const p = pos(e)
  ctx.beginPath()
  ctx.moveTo(last[0], last[1])
  ctx.lineTo(p[0], p[1])
  ctx.stroke()
  last = p
  sigDrawn.value = true
}
function sigUp() {
  drawing = false
}
function clearSig() {
  const el = canvas.value
  el?.getContext('2d')?.clearRect(0, 0, el.width, el.height)
  sigDrawn.value = false
}

/* -------------------------------------------------------------- derived */
function monthDate(from: Date, i: number) {
  const first = firstPaymentDate(from)
  return ukDate(new Date(first.getFullYear(), first.getMonth() + i, 1))
}

const schedule = computed(() => {
  const s = service.value
  const p = plan.value
  const t = terms.value
  if (!s || !p || !t) {
    return [] as { label: string, date: string, amt: string, dot: string }[]
  }
  // Instalment dates are worked out from a kickoff today; the real ones are
  // fixed when the kickoff payment is taken, and My orders shows them then.
  const now = new Date()
  const rows: { label: string, date: string, amt: string, dot: string }[] = []
  if (t.kind === 'fixed' && pay.value === 'full') {
    rows.push({ label: 'Full payment', date: 'At kickoff', amt: formatCurrency(t.total), dot: 'bg-accent' })
  }
  else if (t.kind === 'fixed' && t.firstPaymentAtKickoff) {
    rows.push({ label: `Payment 1 of ${t.payments}`, date: 'At kickoff', amt: formatCurrency(t.monthly), dot: 'bg-accent' })
    for (let i = 1; i < t.payments; i++) {
      rows.push({ label: `Payment ${i + 1} of ${t.payments}`, date: monthDate(now, i - 1), amt: formatCurrency(t.monthly), dot: 'bg-dot-unpaid' })
    }
  }
  else if (t.kind === 'fixed') {
    rows.push({ label: 'Deposit', date: 'At kickoff', amt: formatCurrency(t.deposit), dot: 'bg-accent' })
    for (let i = 0; i < t.payments; i++) {
      rows.push({ label: `Payment ${i + 1} of ${t.payments}`, date: monthDate(now, i), amt: formatCurrency(t.monthly), dot: 'bg-dot-unpaid' })
    }
  }
  else if (t.kind === 'retainer') {
    if (t.setup) {
      rows.push({ label: 'Set-up fee', date: 'At kickoff', amt: formatCurrency(t.setup), dot: 'bg-accent' })
    }
    rows.push({ label: 'First month', date: 'At kickoff', amt: formatCurrency(t.monthly), dot: 'bg-accent' })
    for (let i = 1; i < t.minimumMonths; i++) {
      rows.push({ label: `Month ${i + 1} of ${t.minimumMonths} minimum`, date: monthDate(now, i - 1), amt: formatCurrency(t.monthly), dot: 'bg-dot-unpaid' })
    }
    rows.push({ label: 'Then rolling monthly', date: '30 days’ notice', amt: formatCurrency(t.monthly), dot: 'bg-line-rule' })
  }
  else {
    rows.push(scopeCall.value
      ? { label: 'Scoping call', date: 'Booked after you sign', amt: 'Free', dot: 'bg-accent' }
      : { label: 'Discovery, fixed price', date: 'When discovery starts', amt: formatCurrency(t.total), dot: 'bg-accent' })
  }
  return rows
})
const visibleSchedule = computed(() => (showAll.value ? schedule.value : schedule.value.slice(0, 4)))
const totalRow = computed(() => {
  const t = terms.value
  if (!t) {
    return { label: 'Total', amt: '' }
  }
  if (t.kind === 'fixed') {
    return { label: 'Total, all in', amt: formatCurrency(t.total) }
  }
  if (t.kind === 'retainer') {
    return { label: 'Minimum term total', amt: formatCurrency(t.total) }
  }
  return { label: 'Total today', amt: scopeCall.value ? '£0' : `£0 · ${formatCurrency(t.total)} at start` }
})

function planPrice(s: CatalogService, p: CatalogPlan) {
  if (s.kind === 'scope') {
    return { price: p.price ? formatCurrency(p.price) : 'Free', unit: '', note: p.note ?? '' }
  }
  if (s.kind === 'fixed') {
    const n = paymentCount(s, p)
    return { price: formatCurrency(p.monthly ?? 0), unit: ' /mo', note: p.deposit ? `${formatCurrency(p.deposit)} deposit, then ${n} × ${formatCurrency(p.monthly ?? 0)}` : `No deposit · ${n} × ${formatCurrency(p.monthly ?? 0)}` }
  }
  return { price: formatCurrency(p.monthly ?? 0), unit: ' /mo', note: `${p.setup ? `${formatCurrency(p.setup)} set-up` : 'No set-up fee'} · ${s.minimumMonths}-month minimum` }
}

function serviceFrom(s: CatalogService) {
  const m = fromMonthly(s)
  return m ? `From ${formatCurrency(m)}/mo` : 'Scoped on a call'
}

const summary = computed(() => {
  const s = service.value
  const p = plan.value
  const t = terms.value
  if (!s || !p || !t) {
    return null
  }
  if (t.kind === 'fixed') {
    const full = pay.value === 'full'
    return {
      big: full ? formatCurrency(t.total) : formatCurrency(t.monthly),
      unit: full ? '' : ' /mo',
      dots: full ? 0 : t.payments,
      caption: full ? 'One payment at kickoff · no interest' : t.firstPaymentAtKickoff ? `${t.payments} payments · no deposit · no interest` : `${t.payments} payments after the deposit · no interest`,
      bar: full ? formatCurrency(t.total) : `${formatCurrency(t.monthly)} /mo`,
      rows: [
        t.deposit > 0 && !full ? { k: 'Deposit at kickoff', v: formatCurrency(t.deposit) } : { k: 'Deposit', v: 'None' },
        { k: 'Monthly payments', v: full ? '—' : `${t.payments} × ${formatCurrency(t.monthly)}` },
        { k: 'Total, all in', v: formatCurrency(t.total) },
        { k: 'Interest', v: 'None', green: true },
      ],
    }
  }
  if (t.kind === 'retainer') {
    return {
      big: formatCurrency(t.monthly),
      unit: ' /mo',
      dots: 0,
      caption: `${t.minimumMonths}-month minimum, then rolling monthly`,
      bar: `${formatCurrency(t.monthly)} /mo`,
      rows: [
        { k: 'Set-up fee', v: t.setup ? formatCurrency(t.setup) : 'None' },
        { k: 'Minimum term', v: `${t.minimumMonths} months` },
        { k: 'Notice after that', v: '30 days' },
        { k: 'Interest', v: 'None', green: true },
      ],
    }
  }
  const big = scopeCall.value ? 'Free' : formatCurrency(t.total)
  return {
    big,
    unit: '',
    dots: 0,
    caption: scopeCall.value ? 'A 45-minute call with a developer' : 'Fixed price · two weeks',
    bar: big,
    rows: [{ k: 'Due today', v: '£0' }, { k: 'Build', v: 'Quoted after discovery' }],
  }
})

const payLine = computed(() => {
  const t = terms.value
  if (!t) {
    return ''
  }
  if (t.kind === 'fixed') {
    if (pay.value === 'full') {
      return `${formatCurrency(t.total)} at kickoff`
    }
    return t.firstPaymentAtKickoff ? `${t.payments} × ${formatCurrency(t.monthly)}, no deposit` : `${formatCurrency(t.deposit)} deposit, then ${t.payments} × ${formatCurrency(t.monthly)}`
  }
  if (t.kind === 'retainer') {
    return `${formatCurrency(t.monthly)}/mo · ${t.minimumMonths}-month minimum`
  }
  return scopeCall.value ? 'Free' : `${formatCurrency(t.total)} when discovery starts`
})

/* ----------------------------------------------------------- navigation */
const STEP_LABELS = ['Plan', 'Brief', 'Pay and sign'] as const
const NEXT = ['Continue to brief', 'Continue to payment', 'Sign and place order']
const NEXT_SHORT = ['Continue', 'Continue', 'Sign and order']
const canNext = computed(() => (step.value === 1 ? planView.value && Boolean(plan.value) : step.value === 2 ? true : sigOk.value))
const nextReason = computed(() => {
  if (step.value === 1 && !planView.value) {
    return 'Choose a service to see its plans.'
  }
  if (step.value === 1 && !plan.value) {
    return 'Choose a plan to continue.'
  }
  if (step.value === 3 && !sigOk.value) {
    return 'Sign and tick both boxes to place the order.'
  }
  return ''
})

function go(n: 1 | 2 | 3) {
  step.value = n
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
// Back walks out of the plans to the service grid before it leaves step 1.
const canBack = computed(() => step.value > 1 || planView.value)
function back() {
  if (step.value === 1) {
    changeService()
    return
  }
  go((step.value - 1) as 1 | 2)
}

const submitting = ref(false)
const placed = ref<{ id: string, ref: string, signedAt: string } | null>(null)
async function next() {
  if (step.value === 2 && !briefOk.value) {
    touched.name = true
    touched.goal = true
    touched.date = true
    return
  }
  if (step.value < 3) {
    if (canNext.value) {
      go((step.value + 1) as 2 | 3)
    }
    return
  }
  if (!sigOk.value || submitting.value || !service.value || !plan.value || !terms.value) {
    return
  }
  submitting.value = true
  try {
    const brief = [
      { label: 'What should this project achieve?', value: fGoal.value.trim() },
      { label: 'Current website', value: fSite.value.trim() },
      { label: 'Number of pages', value: pages.value },
      { label: 'Target launch date', value: fDate.value.trim() },
    ].filter(b => b.value)
    const signature = sigMode.value === 'type' ? sigName.value.trim() : canvas.value!.toDataURL('image/png')
    const res = await $fetch<{ project: { id: string } }>('/api/orders', {
      method: 'POST',
      body: {
        title: fName.value.trim(),
        serviceId: service.value.id,
        planId: plan.value.id,
        pay: pay.value,
        quotedTotal: terms.value.total,
        signature,
        signatureType: sigMode.value === 'type' ? 'typed' : 'drawn',
        signerName: sigMode.value === 'type' ? sigName.value.trim() : (accountName.value || undefined),
        brief,
        attachmentIds: uploads.ids.value,
      },
    })
    placed.value = { id: res.project.id, ref: orderRef(res.project.id), signedAt: ukDate(new Date()) }
    window.scrollTo({ top: 0 })
  }
  catch (e: any) {
    // A moved price is a 409 and a withdrawn plan a 400: reload the catalogue
    // so the page shows the figures the server will actually sign.
    if (e?.statusCode === 409 || e?.statusCode === 400) {
      await refreshConfig()
    }
    toaster.add({ title: 'Your order was not placed', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    submitting.value = false
  }
}

function restart() {
  placed.value = null
  step.value = 1
  planView.value = false
  svcId.value = null
  planId.value = null
  pay.value = 'monthly'
  fName.value = ''
  fGoal.value = ''
  fSite.value = ''
  fDate.value = ''
  pages.value = ''
  Object.assign(touched, { name: false, goal: false, date: false })
  sigName.value = ''
  sigDrawn.value = false
  agreeTerms.value = false
  agreeSchedule.value = false
  uploads.reset()
  router.replace({ query: {} })
}

const doneKick = computed(() => (kind.value === 'scope'
  ? `Choose a time for your ${scopeCall.value ? 'scoping call' : 'first discovery workshop'}. Forty-five minutes on video.`
  : 'Thirty minutes on video to agree scope, dates and who does what. The kickoff payment is taken after this call.'))

const ringed = (on: boolean) => on ? 'border-accent shadow-[0_0_0_3px_var(--accent-tint)]' : 'border-line-subtle shadow-panel'
const H2 = 'font-heading text-fg-heading m-0 text-[22px] font-bold tracking-[-0.02em]'
const SUB = 'text-fg-body m-0 max-w-[60ch] text-[15px] leading-relaxed'
const CARD = 'bg-card border-line-subtle shadow-panel rounded-[20px] border'
</script>

<template>
  <div class="@container/page mx-auto flex max-w-[1260px] flex-col gap-[clamp(22px,2.4vw,32px)] px-[clamp(16px,3vw,40px)] pb-[clamp(28px,4vw,56px)] pt-[clamp(20px,3vw,40px)]">
    <template v-if="!placed">
      <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3.5">
        <div class="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
          <h1 class="font-heading text-fg-heading m-0 text-[clamp(28px,1.3vw+18px,38px)] font-extrabold leading-[1.06] tracking-[-0.03em]">
            New <span class="text-fg-accent">order</span>
          </h1>
          <p class="text-fg-body m-0 max-w-[56ch] text-pretty text-[clamp(15px,.3vw+14px,17px)] leading-relaxed">
            Choose a service and plan, check every payment date, then sign. Nothing is charged until kickoff.
          </p>
        </div>
        <span class="bg-card border-line-subtle text-fg-body inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border px-[13px] py-[7px] text-[12.5px] font-semibold">
          <Icon name="lucide:lock" class="size-3.5 text-[#22B07D]" />Secured checkout
        </span>
      </div>

      <!-- Stepper: three labelled steps from 640px of content, a name and three bars below -->
      <ol aria-label="Order steps" class="bg-card border-line-subtle shadow-panel m-0 hidden list-none items-center gap-1.5 rounded-[18px] border p-1.5 @min-[640px]:flex">
        <li v-for="(label, i) in STEP_LABELS" :key="label" class="flex min-w-0 flex-1">
          <button
            type="button"
            :disabled="step <= i + 1"
            :aria-current="step === i + 1 ? 'step' : undefined"
            class="apex-ring flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-[13px] px-3 text-left disabled:cursor-default"
            :class="step === i + 1 ? 'bg-accent-tint' : 'bg-transparent'"
            @click="go((i + 1) as 1 | 2 | 3)"
          >
            <span
              class="font-heading inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
              :class="step > i + 1 ? 'bg-[#22B07D] text-white' : step === i + 1 ? 'bg-accent text-white' : 'border-line-rule text-fg-muted border-2'"
            >{{ step > i + 1 ? '✓' : i + 1 }}</span>
            <span class="truncate text-sm" :class="step === i + 1 ? 'text-accent-ink font-bold' : step > i + 1 ? 'text-fg-heading font-semibold' : 'text-fg-muted font-semibold'">{{ label }}</span>
          </button>
        </li>
      </ol>
      <div class="flex flex-col gap-2.5 @min-[640px]:hidden">
        <div class="flex items-baseline justify-between gap-3">
          <span class="font-heading text-fg-heading text-lg font-bold tracking-[-0.02em]">{{ STEP_LABELS[step - 1] }}</span>
          <span class="text-fg-muted text-[13px] font-semibold">Step {{ step }} of 3</span>
        </div>
        <div aria-hidden="true" class="flex gap-1">
          <span v-for="i in 3" :key="i" class="block h-1 flex-1 rounded-full" :class="i <= step ? 'bg-accent' : 'bg-track'" />
        </div>
      </div>

      <div class="grid items-start gap-[clamp(20px,2vw,28px)] @min-[860px]:grid-cols-[minmax(0,1fr)_300px] @min-[1060px]:grid-cols-[minmax(0,1fr)_340px]">
        <div class="@container flex min-w-0 flex-col gap-5">
          <!-- Step 1: service, then plan -->
          <template v-if="step === 1">
            <section v-if="!planView" aria-labelledby="h-s1" class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <h2 id="h-s1" :class="H2">
                  Choose a service
                </h2>
                <p :class="SUB">
                  Start with what is costing you money today. You will pick a plan next.
                </p>
              </div>
              <div role="radiogroup" aria-label="Service" class="grid gap-3.5 @min-[480px]:grid-cols-2 @min-[700px]:grid-cols-3">
                <button
                  v-for="s in services"
                  :key="s.id"
                  type="button"
                  role="radio"
                  :aria-checked="svcId === s.id"
                  class="apex-ring bg-card relative flex min-w-0 cursor-pointer flex-col items-start gap-2.5 rounded-[20px] border p-5 text-left transition-[box-shadow,border-color] duration-200"
                  :class="ringed(svcId === s.id)"
                  @click="pickService(s.id)"
                >
                  <span class="flex h-[30px] items-center"><ApexGlyph :kind="s.id" :size="28" /></span>
                  <span class="font-heading text-fg-heading text-lg font-semibold leading-[1.2] tracking-[-0.02em]">{{ s.name }}</span>
                  <span class="text-fg-body text-[13.5px] leading-normal">{{ s.line }}</span>
                  <span class="text-fg-heading mt-auto pt-2.5 text-[13px] font-semibold">{{ serviceFrom(s) }}</span>
                  <span aria-hidden="true" class="absolute right-4 top-4 inline-flex size-[22px] items-center justify-center rounded-full border-2 text-[11px] text-white" :class="svcId === s.id ? 'bg-accent border-accent' : 'border-line-rule'">{{ svcId === s.id ? '✓' : '' }}</span>
                </button>
              </div>
            </section>

            <section v-else-if="service" aria-labelledby="h-s2" class="flex flex-col gap-4">
              <div class="flex flex-col items-start gap-1.5">
                <button type="button" class="apex-ring text-accent-ink mb-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md text-sm font-semibold" @click="changeService">
                  <Icon name="lucide:arrow-left" class="size-4" />Change service
                </button>
                <h2 id="h-s2" :class="H2">
                  {{ service.heading }}
                </h2>
                <p :class="SUB">
                  {{ service.sub }}
                </p>
              </div>
              <div role="radiogroup" aria-label="Plan" class="grid gap-3.5" :class="service.plans.length === 2 ? '@min-[480px]:grid-cols-2' : '@min-[700px]:grid-cols-3'">
                <button
                  v-for="p in service.plans"
                  :key="p.id"
                  type="button"
                  role="radio"
                  :aria-checked="planId === p.id"
                  class="apex-ring bg-card relative flex min-w-0 cursor-pointer flex-col items-stretch gap-3.5 rounded-[22px] border p-[22px] text-left"
                  :class="ringed(planId === p.id)"
                  @click="planId = p.id"
                >
                  <span class="flex min-h-6 items-center justify-between gap-2.5">
                    <span class="font-heading text-fg-heading text-[19px] font-bold tracking-[-0.02em]">{{ p.name }}</span>
                    <span v-if="p.featured" class="bg-accent-tint text-accent-ink whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold">{{ p.flag ?? 'Most chosen' }}</span>
                  </span>
                  <span class="text-fg-body min-h-10 text-[13.5px] leading-normal">{{ p.summary }}</span>
                  <span class="border-line-soft flex flex-col gap-1.5 border-y py-3.5">
                    <span class="font-heading text-fg-heading text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{{ planPrice(service, p).price }}<span class="text-fg-muted text-sm font-semibold">{{ planPrice(service, p).unit }}</span></span>
                    <span class="text-fg-muted text-[12.5px]">{{ planPrice(service, p).note }}</span>
                  </span>
                  <span class="flex flex-col gap-[9px]">
                    <span v-for="f in p.features" :key="f" class="text-fg-body flex items-start gap-[9px] text-[13.5px] leading-[1.45]">
                      <span aria-hidden="true" class="mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#22B07D] text-[9.5px] text-white">✓</span>{{ f }}
                    </span>
                  </span>
                  <span class="mt-auto flex min-h-[42px] items-center justify-center gap-2 rounded-xl text-sm font-semibold" :class="planId === p.id ? 'bg-accent text-white' : 'bg-raised text-fg-heading'">
                    {{ planId === p.id ? 'Selected' : `Choose ${p.name}` }}
                  </span>
                </button>
              </div>
              <p class="text-fg-muted m-0 max-w-[72ch] text-[13px] leading-relaxed">
                {{ service.foot }}
              </p>
            </section>
          </template>

          <!-- Step 2: brief -->
          <section v-if="step === 2" aria-labelledby="h-s4" class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <h2 id="h-s4" :class="H2">
                Tell us about the project
              </h2>
              <p :class="SUB">
                Two fields are required. Everything else helps the kickoff call go faster.
              </p>
            </div>
            <div :class="CARD" class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-5 p-[clamp(18px,2vw,26px)]">
              <div class="col-span-full">
                <ApexField v-model="fName" label="Project name" required placeholder="e.g. Business website" hint="Shown in My orders and on your receipts" :error="errName" @blur="touched.name = true" />
              </div>
              <div class="col-span-full">
                <ApexField v-model="fGoal" label="What should this project achieve?" required multiline :rows="4" placeholder="e.g. More quote requests from homeowners in Maidstone and Tonbridge" hint="A sentence or two is enough" :error="errGoal" @blur="touched.goal = true" />
              </div>
              <button type="button" :aria-expanded="moreOpen" class="apex-ring text-accent-ink col-span-full inline-flex min-h-10 cursor-pointer items-center gap-2 justify-self-start rounded-lg px-1 text-sm font-semibold" @click="moreOpen = !moreOpen">
                <Icon :name="moreOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="size-4" />{{ moreOpen ? 'Hide optional details' : 'Add more detail (optional)' }}
              </button>
              <template v-if="moreOpen">
                <ApexField v-model="fSite" label="Current website" placeholder="yourbusiness.co.uk" hint="Optional" inputmode="url" />
                <div v-if="svcId === 'web'" class="flex flex-col gap-2">
                  <span id="lbl-pages" class="text-fg-heading text-sm font-semibold">Number of pages</span>
                  <div role="radiogroup" aria-labelledby="lbl-pages" class="grid grid-cols-2 gap-2">
                    <button
                      v-for="o in PAGE_OPTIONS"
                      :key="o"
                      type="button"
                      role="radio"
                      :aria-checked="pages === o"
                      class="apex-ring min-h-12 cursor-pointer rounded-xl border px-3 text-left text-sm font-medium"
                      :class="pages === o ? 'border-accent bg-accent-tint text-accent-ink' : 'border-line-rule bg-card text-fg-heading'"
                      @click="pages = pages === o ? '' : o"
                    >
                      {{ o }}
                    </button>
                  </div>
                  <span class="text-fg-muted text-[12.5px]">Optional · Leave blank if you are not sure</span>
                </div>
                <ApexField v-model="fDate" label="Target launch date" placeholder="dd/mm/yyyy" hint="Optional" inputmode="numeric" :error="errDate" @blur="touched.date = true" />
                <div class="col-span-full flex flex-col gap-2.5">
                  <label class="apex-ring border-line-rule bg-raised relative flex cursor-pointer flex-wrap items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed p-[18px] focus-within:outline-2 focus-within:outline-[var(--accent)]">
                    <span class="bg-card border-line-subtle text-accent-ink inline-flex size-[42px] shrink-0 items-center justify-center rounded-xl border">
                      <Icon :name="uploads.uploading.value ? 'lucide:loader-circle' : 'solar:upload-linear'" class="size-5" :class="uploads.uploading.value ? 'motion-safe:animate-spin' : ''" />
                    </span>
                    <span class="flex flex-[1_1_200px] flex-col gap-0.5">
                      <span class="text-fg-heading text-sm font-semibold">Add files</span>
                      <span class="text-fg-muted text-[12.5px]">Logos, copy, photos or an existing brief. Up to 20 MB each.</span>
                    </span>
                    <span class="text-accent-ink text-[13.5px] font-semibold">Browse</span>
                    <input type="file" multiple class="absolute size-px opacity-0" @change="onFiles">
                  </label>
                  <p v-if="uploads.error.value" role="alert" class="text-st-danger-fg m-0 text-[13px]">
                    {{ uploads.error.value }}
                  </p>
                  <ul v-if="uploads.files.value.length" class="m-0 flex list-none flex-col gap-2 p-0">
                    <li v-for="f in uploads.files.value" :key="f.id" class="bg-card border-line-subtle flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm">
                      <Icon name="solar:file-check-linear" class="size-[18px] shrink-0 text-[#22B07D]" />
                      <span class="text-fg-heading min-w-0 grow truncate font-medium">{{ f.name }}</span>
                      <span class="text-fg-muted text-[12.5px]">{{ fileSize(f.size) }}</span>
                      <button type="button" :aria-label="`Remove ${f.name}`" class="apex-ring text-fg-muted hover:text-fg-heading inline-flex size-9 cursor-pointer items-center justify-center rounded-lg" @click="uploads.remove(f.id)">
                        <Icon name="lucide:x" class="size-4" />
                      </button>
                    </li>
                  </ul>
                </div>
              </template>
            </div>
          </section>

          <!-- Step 3: how you will pay, then check and sign -->
          <template v-if="step === 3">
            <section aria-labelledby="h-s3" class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <h2 id="h-s3" :class="H2">
                  How you will pay
                </h2>
                <p :class="SUB">
                  Every date and amount is shown here before you sign. Figures include VAT.
                </p>
              </div>
              <div v-if="kind === 'fixed' && plan && terms" role="radiogroup" aria-label="Payment option" class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3.5">
                <button
                  v-for="o in (['monthly', 'full'] as const)"
                  :key="o"
                  type="button"
                  role="radio"
                  :aria-checked="pay === o"
                  class="apex-ring bg-card flex cursor-pointer items-start gap-3.5 rounded-[20px] border p-5 text-left"
                  :class="ringed(pay === o)"
                  @click="pay = o"
                >
                  <span aria-hidden="true" class="mt-0.5 inline-flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 text-[11px] text-white" :class="pay === o ? 'bg-accent border-accent' : 'border-line-rule'">{{ pay === o ? '✓' : '' }}</span>
                  <span class="flex min-w-0 flex-col gap-[5px]">
                    <span class="text-fg-heading text-[15px] font-semibold">{{ o === 'monthly' ? 'Monthly instalments' : 'Pay in full' }}</span>
                    <span class="font-heading text-fg-heading text-[26px] font-extrabold tracking-[-0.025em] tabular-nums">
                      {{ o === 'monthly' ? formatCurrency(plan.monthly ?? 0) : formatCurrency(orderTerms(service!, plan).total) }}<span v-if="o === 'monthly'" class="text-fg-muted text-[13px] font-semibold"> /mo</span>
                    </span>
                    <span class="text-fg-muted text-[13px] leading-normal">{{ o === 'monthly' ? (plan.deposit ? `${formatCurrency(plan.deposit)} deposit at kickoff, then ${paymentCount(service!, plan)} monthly payments` : `No deposit. ${paymentCount(service!, plan)} equal monthly payments, the first at kickoff`) : 'One payment at kickoff. Same total, nothing later.' }}</span>
                  </span>
                </button>
              </div>

              <div :class="CARD" class="overflow-hidden">
                <div class="border-line-soft flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                  <span class="text-fg-heading text-sm font-semibold">Payment schedule</span>
                  <ApexStatusChip tone="success">
                    No interest
                  </ApexStatusChip>
                </div>
                <div v-for="r in visibleSchedule" :key="r.label" class="border-line-soft flex items-center gap-3.5 border-b px-5 py-[13px] text-sm">
                  <span class="block size-[9px] shrink-0 rounded-full" :class="r.dot" />
                  <span class="text-fg-heading min-w-0 grow font-medium">{{ r.label }}</span>
                  <span class="text-fg-muted whitespace-nowrap tabular-nums">{{ r.date }}</span>
                  <span class="text-fg-heading min-w-16 text-right font-semibold tabular-nums">{{ r.amt }}</span>
                </div>
                <button v-if="schedule.length > 4" type="button" class="apex-ring text-accent-ink hover:bg-hover min-h-[46px] w-full cursor-pointer text-sm font-semibold" @click="showAll = !showAll">
                  {{ showAll ? 'Show fewer' : `Show all ${schedule.length} payments` }}
                </button>
                <div class="bg-raised flex items-center justify-between gap-3 px-5 py-4 text-sm">
                  <span class="text-fg-heading font-semibold">{{ totalRow.label }}</span>
                  <span class="font-heading text-fg-heading text-xl font-extrabold tabular-nums">{{ totalRow.amt }}</span>
                </div>
              </div>
              <p class="text-fg-muted m-0 text-[13px]">
                Instalment dates are shown from a kickoff today. The real dates are set when your kickoff payment is taken.
              </p>

              <div class="flex flex-col gap-2.5">
                <span class="text-fg-heading text-sm font-semibold">Pay from</span>
                <div class="bg-card border-accent flex min-h-[60px] items-center gap-3 rounded-2xl border px-4 py-3 shadow-[0_0_0_3px_var(--accent-tint)]">
                  <span class="bg-raised text-fg-heading inline-flex size-[38px] shrink-0 items-center justify-center rounded-[11px]"><Icon name="solar:wallet-2-linear" class="size-[19px]" /></span>
                  <span class="flex min-w-0 grow flex-col gap-0.5">
                    <span class="text-fg-heading text-sm font-semibold">Wallet balance</span>
                    <span class="text-fg-muted text-[12.5px]">{{ overview ? `${formatCurrency(overview.walletBalance)} available` : 'Payments are taken from your wallet' }}</span>
                  </span>
                  <NuxtLink to="/dashboards/wallet?add=1" target="_blank" class="apex-ring text-accent-ink shrink-0 rounded-md text-[13px] font-semibold hover:underline">
                    Add funds
                  </NuxtLink>
                </div>
                <p class="text-fg-muted m-0 text-[12.5px] leading-normal">
                  Top up by card or bank transfer at any time. The kickoff payment and every instalment are taken from the wallet.
                </p>
              </div>
              <p class="text-fg-muted m-0 max-w-[72ch] text-[13px] leading-relaxed">
                Instalment plans are payment schedules for our own services, agreed directly with Apex. They are not credit agreements, no interest is charged and no credit check is carried out.
              </p>
            </section>

            <section aria-labelledby="h-s5" class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <h2 id="h-s5" :class="H2">
                  Check and sign
                </h2>
                <p :class="SUB">
                  Check the details, then sign the agreement. The signed copy is kept with the order in My orders.
                </p>
              </div>
              <div :class="CARD" class="overflow-hidden">
                <div v-for="rv in [{ k: 'Service and plan', v: `${service?.name ?? ''}${plan ? ` · ${plan.name}` : ''}`, to: 1 }, { k: 'Project', v: fName, to: 2 }, { k: 'Payments', v: payLine, to: 3 }]" :key="rv.k" class="border-line-soft flex flex-wrap items-center gap-3.5 border-b px-5 py-3.5 last:border-b-0">
                  <span class="text-fg-muted flex-[0_0_150px] text-[13.5px]">{{ rv.k }}</span>
                  <span class="text-fg-heading min-w-0 flex-[1_1_180px] text-[14.5px] font-semibold">{{ rv.v }}</span>
                  <button v-if="rv.to < 3" type="button" class="apex-ring text-accent-ink hover:bg-accent-tint min-h-9 cursor-pointer rounded-[9px] px-2.5 text-[13.5px] font-semibold" @click="go(rv.to as 1 | 2)">
                    Edit
                  </button>
                </div>
              </div>

              <div :class="CARD" class="flex flex-col gap-4 p-[clamp(18px,2vw,24px)]">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <span class="text-fg-heading text-[15px] font-semibold">Your signature</span>
                  <span role="group" aria-label="Signature method" class="bg-raised border-line-subtle inline-flex rounded-[11px] border p-[3px]">
                    <button
                      v-for="m in (['type', 'draw'] as const)"
                      :key="m"
                      type="button"
                      :aria-pressed="sigMode === m"
                      class="apex-ring h-[34px] cursor-pointer rounded-lg px-3.5 text-[13px] font-semibold capitalize"
                      :class="sigMode === m ? 'bg-card text-fg-heading shadow-[0_1px_3px_rgba(17,31,34,.12)]' : 'text-fg-body'"
                      @click="sigMode = m; sigDrawn = false"
                    >
                      {{ m }}
                    </button>
                  </span>
                </div>
                <template v-if="sigMode === 'type'">
                  <ApexField v-model="sigName" label="Type your full name" placeholder="Full legal name" autocomplete="name" />
                  <button v-if="!sigName && accountName" type="button" class="apex-ring border-line-subtle bg-card text-fg-heading -mt-1.5 min-h-9 cursor-pointer self-start rounded-full border px-2.5 text-[13px] font-semibold" @click="sigName = accountName">
                    Use “{{ accountName }}”
                  </button>
                  <div aria-hidden="true" class="bg-raised relative flex h-[110px] items-end rounded-[14px] px-[22px] pb-[30px]">
                    <span class="font-heading text-fg-heading truncate text-[30px] font-semibold italic tracking-[-0.02em]">{{ sigName }}</span>
                    <span class="bg-line-strong absolute inset-x-[22px] bottom-6 block h-px" />
                    <span class="text-fg-muted absolute bottom-1.5 left-[22px] text-[11.5px]">Sign above this line</span>
                  </div>
                </template>
                <div v-else class="bg-raised relative h-40 overflow-hidden rounded-[14px]">
                  <canvas
                    ref="canvas"
                    aria-label="Signature pad"
                    class="text-fg-heading absolute inset-0 size-full cursor-crosshair touch-none"
                    @pointerdown="sigDown"
                    @pointermove="sigMove"
                    @pointerup="sigUp"
                    @pointercancel="sigUp"
                  />
                  <span class="bg-line-strong pointer-events-none absolute inset-x-[22px] bottom-[30px] block h-px" />
                  <span class="text-fg-muted pointer-events-none absolute bottom-2.5 left-[22px] text-[11.5px]">Sign above this line</span>
                  <button type="button" class="apex-ring border-line-subtle bg-card text-fg-heading absolute right-2.5 top-2.5 min-h-[34px] cursor-pointer rounded-[9px] border px-3 text-[12.5px] font-semibold" @click="clearSig">
                    Clear
                  </button>
                </div>
                <div class="flex flex-col gap-3 pt-1">
                  <div class="text-fg-body flex items-start gap-3 text-sm leading-[1.55]">
                    <button type="button" role="checkbox" :aria-checked="agreeTerms" aria-labelledby="c1-text" class="apex-ring inline-flex size-[22px] shrink-0 cursor-pointer items-center justify-center rounded-[7px] border-2 text-[11px] text-white" :class="agreeTerms ? 'bg-accent border-accent' : 'border-line-rule'" @click="agreeTerms = !agreeTerms">
                      {{ agreeTerms ? '✓' : '' }}
                    </button>
                    <span id="c1-text">I agree to the <NuxtLink to="/legal/terms" target="_blank" class="text-accent-ink font-semibold hover:underline">terms of service</NuxtLink> and the payment schedule above.</span>
                  </div>
                  <div class="text-fg-body flex items-start gap-3 text-sm leading-[1.55]">
                    <button type="button" role="checkbox" :aria-checked="agreeSchedule" aria-labelledby="c2-text" class="apex-ring inline-flex size-[22px] shrink-0 cursor-pointer items-center justify-center rounded-[7px] border-2 text-[11px] text-white" :class="agreeSchedule ? 'bg-accent border-accent' : 'border-line-rule'" @click="agreeSchedule = !agreeSchedule">
                      {{ agreeSchedule ? '✓' : '' }}
                    </button>
                    <span id="c2-text">I understand this is a payment schedule for Apex services, not a credit agreement.</span>
                  </div>
                </div>
                <p class="bg-raised text-fg-muted m-0 rounded-xl px-3.5 py-3 text-[12.5px] leading-relaxed">
                  When you sign we record your name, the time and your IP address with the agreement as evidence of signature.
                </p>
              </div>
            </section>
          </template>

          <!-- Footer, inline from 860px of content. Named container: this sits
               inside the left column's own container, which is never 860px wide
               beside the rail, so an unnamed query hid it on every desktop. -->
          <div class="hidden flex-col gap-2 pt-1 @min-[860px]/page:flex">
            <div class="flex items-center justify-between gap-3">
              <button v-if="canBack" type="button" class="apex-ring bg-card border-line-rule text-fg-heading inline-flex h-[46px] cursor-pointer items-center gap-2 rounded-[14px] border px-[18px] text-[15px] font-semibold" @click="back">
                <Icon name="lucide:arrow-left" class="size-[17px]" />Back
              </button>
              <NuxtLink v-else to="/dashboards/balance" class="apex-ring text-fg-body rounded-md text-[14.5px] font-semibold">
                Cancel
              </NuxtLink>
              <ApexButton :disabled="!canNext || submitting" @click="next">
                {{ submitting ? 'Placing your order…' : NEXT[step - 1] }}
              </ApexButton>
            </div>
            <p v-if="nextReason" class="text-fg-muted m-0 self-end text-[12.5px]">
              {{ nextReason }}
            </p>
          </div>
        </div>

        <!-- Summary rail from 860px of content -->
        <aside aria-label="Order summary" class="sticky top-24 hidden flex-col gap-3 @min-[860px]:flex">
          <div class="bg-card border-line-subtle flex flex-col gap-4 rounded-[22px] border p-[22px] shadow-[0_20px_48px_rgba(17,31,34,.07)] dark:shadow-none">
            <span class="text-fg-muted text-xs font-bold uppercase tracking-[.06em]">Your order</span>
            <template v-if="service">
              <div class="flex flex-col gap-1">
                <span class="font-heading text-fg-heading text-[19px] font-semibold tracking-[-0.02em]">{{ service.name }}</span>
                <span class="text-fg-muted text-[13.5px]">{{ plan ? plan.name + (kind === 'scope' ? '' : ' plan') : 'Choose a plan' }}</span>
              </div>
              <template v-if="summary">
                <div class="border-line-soft flex flex-col gap-2.5 border-y py-4">
                  <span class="font-heading text-fg-heading text-[40px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{{ summary.big }}<span class="text-fg-muted text-sm font-semibold">{{ summary.unit }}</span></span>
                  <div v-if="summary.dots && summary.dots <= 24" aria-hidden="true" class="flex flex-wrap gap-[5px]">
                    <span v-for="i in summary.dots" :key="i" class="bg-dot-unpaid block size-[9px] rounded-full" />
                  </div>
                  <span class="text-fg-muted text-[12.5px]">{{ summary.caption }}</span>
                </div>
                <div class="flex flex-col gap-2.5">
                  <div v-for="r in summary.rows" :key="r.k" class="flex items-baseline justify-between gap-3 text-sm">
                    <span class="text-fg-body">{{ r.k }}</span><span class="font-semibold tabular-nums" :class="'green' in r ? 'text-st-success-fg' : 'text-fg-heading'">{{ r.v }}</span>
                  </div>
                </div>
              </template>
            </template>
            <p v-else class="text-fg-body m-0 text-sm leading-relaxed">
              Choose a service to see the monthly figure and every payment date.
            </p>
            <span class="border-line-soft text-fg-muted flex items-center gap-2 border-t pt-3.5 text-[12.5px]"><Icon name="lucide:lock" class="size-3.5 text-[#22B07D]" />Figures include VAT · Nothing is charged today</span>
          </div>
          <NuxtLink to="/dashboards/support?tab=new" class="apex-ring border-line-subtle bg-card hover:border-line-strong flex items-center gap-3 rounded-2xl border px-4 py-3.5">
            <Icon name="solar:chat-round-dots-linear" class="text-accent-ink size-5" />
            <span class="flex grow flex-col gap-0.5"><span class="text-fg-heading text-sm font-semibold">Not sure which plan?</span><span class="text-fg-muted text-[12.5px]">Ask us. We reply within one working day.</span></span>
          </NuxtLink>
        </aside>
      </div>

      <!-- Footer strip below 860px of content: the figure, the summary, next -->
      <div class="bg-glass border-line-subtle sticky bottom-0 z-[6] -mx-[clamp(16px,3vw,40px)] -mb-[clamp(28px,4vw,56px)] flex flex-col gap-1.5 border-t px-[clamp(16px,3vw,40px)] pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-[16px] @min-[860px]:hidden">
        <p v-if="nextReason" class="text-fg-muted m-0 text-[12px]">
          {{ nextReason }}
        </p>
        <div class="flex items-center gap-2.5">
          <button v-if="canBack" type="button" aria-label="Back" class="apex-ring bg-card border-line-rule text-fg-heading inline-flex size-[46px] shrink-0 cursor-pointer items-center justify-center rounded-[14px] border" @click="back">
            <Icon name="lucide:arrow-left" class="size-[18px]" />
          </button>
          <button type="button" aria-label="View order summary" class="apex-ring flex min-w-0 grow cursor-pointer flex-col items-start gap-px rounded-lg px-1 text-left" @click="sumOpen = true">
            <span class="font-heading text-fg-heading whitespace-nowrap text-lg font-extrabold tracking-[-0.02em] tabular-nums">{{ summary?.bar ?? 'Your order' }}</span>
            <span class="text-accent-ink inline-flex items-center gap-1 text-xs font-semibold">Summary <Icon name="lucide:chevron-up" class="size-[13px]" /></span>
          </button>
          <ApexButton :disabled="!canNext || submitting" @click="next">
            {{ submitting ? 'Placing…' : NEXT_SHORT[step - 1] }}
          </ApexButton>
        </div>
      </div>

      <ApexBottomSheet v-model:open="sumOpen" surface="panel" title="Your order" description="The plan, the monthly figure and the total.">
        <div class="grid content-start gap-4 px-5 pb-6">
          <div class="flex items-center justify-between gap-3">
            <span class="font-heading text-fg-heading text-[19px] font-bold tracking-[-0.02em]">Your order</span>
            <button type="button" aria-label="Close" class="apex-ring text-fg-heading inline-flex size-11 cursor-pointer items-center justify-center rounded-xl" @click="sumOpen = false">
              <Icon name="lucide:x" class="size-5" />
            </button>
          </div>
          <div v-if="service" class="flex flex-col gap-1">
            <span class="text-fg-heading text-base font-semibold">{{ service.name }}</span>
            <span class="text-fg-muted text-[13.5px]">{{ plan ? plan.name : 'Choose a plan' }}</span>
          </div>
          <template v-if="summary">
            <span class="font-heading text-fg-heading text-4xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">{{ summary.big }}<span class="text-fg-muted text-sm font-semibold">{{ summary.unit }}</span></span>
            <span class="text-fg-muted text-[12.5px]">{{ summary.caption }}</span>
            <div class="border-line-soft flex flex-col gap-2.5 border-t pt-3.5">
              <div v-for="r in summary.rows" :key="r.k" class="flex items-baseline justify-between gap-3 text-[14.5px]">
                <span class="text-fg-body">{{ r.k }}</span><span class="font-semibold tabular-nums" :class="'green' in r ? 'text-st-success-fg' : 'text-fg-heading'">{{ r.v }}</span>
              </div>
            </div>
          </template>
          <p v-else class="text-fg-body m-0 text-sm leading-relaxed">
            Choose a service to see the monthly figure and every payment date.
          </p>
          <span class="text-fg-muted text-[12.5px]">Figures include VAT · Nothing is charged today</span>
        </div>
      </ApexBottomSheet>
    </template>

    <!-- Placed -->
    <section v-else aria-labelledby="h-done" class="mx-auto mt-[clamp(0px,2vw,24px)] flex w-full max-w-[760px] flex-col gap-6">
      <div class="bg-card border-line-subtle flex flex-col items-start gap-5 rounded-[28px] border p-[clamp(24px,3.4vw,44px)] shadow-[0_20px_48px_rgba(17,31,34,.07)] dark:shadow-none">
        <span aria-hidden="true" class="inline-flex size-14 items-center justify-center rounded-full bg-[#22B07D] text-2xl text-white">✓</span>
        <div class="flex flex-col gap-2.5">
          <h1 id="h-done" class="font-heading text-fg-heading m-0 text-[clamp(28px,1.3vw+18px,38px)] font-extrabold leading-[1.06] tracking-[-0.03em]">
            Order placed
          </h1>
          <p class="text-fg-body m-0 max-w-[52ch] text-base leading-relaxed">
            {{ fName || 'Your project' }} · {{ service?.name }}{{ plan ? `, ${plan.name}` : '' }}. Your signed agreement is saved with the order in My orders.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2.5">
          <ApexStatusChip tone="warning">
            Awaiting kickoff
          </ApexStatusChip>
          <span class="text-fg-muted text-[13.5px]">Order {{ placed.ref }} · signed {{ placed.signedAt }}</span>
        </div>
        <ol class="border-line-soft m-0 flex w-full list-none flex-col border-t p-0 pt-5">
          <li class="flex gap-4 pb-5">
            <div class="flex flex-col items-center gap-1.5">
              <span class="font-heading inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#7D53F2] text-[13px] font-extrabold text-white">1</span><span class="bg-line-subtle w-0.5 grow" />
            </div>
            <div class="flex flex-col gap-1 pt-1">
              <span class="font-heading text-fg-heading text-[17px] font-semibold">We read your brief</span><span class="text-fg-body text-sm leading-[1.55]">Your project lead replies within one working day with any questions.</span>
            </div>
          </li>
          <li class="flex gap-4 pb-5">
            <div class="flex flex-col items-center gap-1.5">
              <span class="font-heading inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#7D53F2] text-[13px] font-extrabold text-white">2</span><span class="bg-line-subtle w-0.5 grow" />
            </div>
            <div class="flex flex-col gap-1 pt-1">
              <span class="font-heading text-fg-heading text-[17px] font-semibold">Book your kickoff call</span><span class="text-fg-body text-sm leading-[1.55]">{{ doneKick }}</span>
            </div>
          </li>
          <li class="flex gap-4">
            <span aria-hidden="true" class="inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#22B07D] text-xs text-white">✓</span>
            <div class="flex flex-col gap-1 pt-1">
              <span class="font-heading text-fg-heading text-[17px] font-semibold">Work starts after the call</span><span class="text-fg-body text-sm leading-[1.55]">Progress, files and payments appear in My orders as they happen.</span>
            </div>
          </li>
        </ol>
        <div class="flex flex-wrap items-center gap-3 pt-1">
          <ApexButton :to="`/dashboards/support?new=kickoff&order=${placed.id}`">
            Book kickoff call
          </ApexButton>
          <ApexButton variant="light" :to="`/dashboards/orders?project=${placed.id}`">
            View in My orders
          </ApexButton>
        </div>
      </div>
      <button type="button" class="apex-ring text-accent-ink min-h-11 cursor-pointer self-center rounded-lg px-3 text-sm font-semibold" @click="restart">
        Start another order
      </button>
    </section>
  </div>
</template>
