<script setup lang="ts">
import type { Catalog } from '~~/shared/catalog'
import { DEFAULT_CATALOG, findPlan, findService, orderTerms } from '~~/shared/catalog'
import { APPLICANT_ROLES, BUSINESS_TYPES, CREDIT_REQUEST_MIN, CREDIT_REQUEST_STEP, dobProblem, isPostcode, TURNOVER_BANDS } from '~~/shared/credit'

/**
 * The credit line application (Wallet.dc.html, 2026-10-25): an intro with two
 * eligibility checks, then Business · About you · Banking · Limit and review.
 * Submits to `POST /api/credit/application`; staff decide it in /admin/credit.
 *
 * Where the design and the product differ, the product wins:
 *  - "Connect your bank" (Open Banking) is not offered: no provider is set up,
 *    so statements are uploaded, which the design offers as the other way.
 *  - The home address is typed. The design's "Find address" needs a postcode
 *    lookup service this platform does not have.
 *  - Company search is Companies House's own, when `NUXT_COMPANIES_HOUSE_KEY`
 *    is set; without it the name and number are typed and staff check them.
 *  - The consent and the footnote say what staff actually check (Companies
 *    House, the ID and the statements); there is no fraud-agency check.
 *  - The example limit counts only fixed plans, because retainers never draw
 *    credit here (`computeCreditUsed`).
 * Files are uploaded as they are chosen and discarded again if replaced, so a
 * replaced passport photo is not left on disk.
 */
const { ceiling } = defineProps<{ ceiling: number }>()
const emit = defineEmits<{ exit: [], submitted: [] }>()

const { formatCurrency } = useCurrency()
const { data: config } = useApexConfig()
const lookup = computed(() => Boolean((config.value as any)?.companiesHouseLookup))
const catalog = computed<Catalog>(() => ((config.value as any)?.catalog as Catalog | undefined) ?? DEFAULT_CATALOG)

const step = ref(0)
const tried = ref(false)
const LABELS = ['Business', 'About you', 'Banking', 'Limit and review']

/* ------------------------------------------------------------ 0 · intro */
const ELIG = [['uk', 'Is your business registered or based in the UK?'], ['six', 'Has it been trading for at least six months?']] as const
const elig = reactive<Record<'uk' | 'six', 'yes' | 'no' | null>>({ uk: null, six: null })
const notEligible = computed(() => elig.uk === 'no' || elig.six === 'no')

/* --------------------------------------------------------- 1 · business */
const bizType = ref<typeof BUSINESS_TYPES[number][0]>('ltd')
const isCo = computed(() => bizType.value !== 'sole')
const coQ = ref('')
const coResults = ref<{ number: string, name: string, status: string, closed: boolean, incorporated: string, ceased: string, address: string }[] | null>(null)
const coBusy = ref(false)
const coError = ref('')
const coSel = ref<string | null>(null)
const picked = computed(() => coResults.value?.find(c => c.number === coSel.value) ?? null)
const manualName = ref('')
const manualNumber = ref('')
watch(coQ, () => {
  coResults.value = null
  coSel.value = null
  coError.value = ''
})
async function searchCompanies() {
  if (coQ.value.trim().length < 2) {
    return
  }
  coBusy.value = true
  coError.value = ''
  try {
    const res = await $fetch<{ items: any[] }>('/api/credit/companies', { query: { q: coQ.value.trim() } })
    coResults.value = res.items
    if (!res.items.length) {
      coError.value = 'Nothing found. Try the company number, or the name as it is registered.'
    }
  }
  catch (e) {
    coError.value = errorMessage(e)
  }
  finally {
    coBusy.value = false
  }
}
const tradeName = ref('')
const bizPc = ref('')
const turnover = ref<string | null>(null)

/* -------------------------------------------------------- 2 · about you */
const fName = ref('')
const lName = ref('')
const dob = ref('')
watch(dob, (v) => {
  const d = v.replace(/\D/g, '').slice(0, 8)
  const f = d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
  if (f !== v) {
    dob.value = f
  }
})
const role = ref<string | null>(null)
const homeAddress = ref('')
const idUpload = useApexUploads()
const idFile = computed(() => idUpload.files.value[0] ?? null)
async function onId(e: Event) {
  const input = e.target as HTMLInputElement
  const old = idFile.value
  idUpload.reset()
  await idUpload.add(input.files ? [...input.files].slice(0, 1) : null)
  input.value = ''
  if (old) {
    discard(old.id)
  }
}
function replaceId() {
  if (idFile.value) {
    discard(idFile.value.id)
  }
  idUpload.reset()
}

/* ---------------------------------------------------------- 3 · banking */
const stmts = useApexUploads()
async function onStmts(e: Event) {
  const input = e.target as HTMLInputElement
  await stmts.add(input.files)
  input.value = ''
}
function removeStmt(id: string) {
  stmts.remove(id)
  discard(id)
}
const months = computed(() => {
  const now = new Date()
  const names = [3, 2, 1].map(k => new Date(now.getFullYear(), now.getMonth() - k, 1))
  return `${names.slice(0, 2).map(d => d.toLocaleDateString('en-GB', { month: 'long' })).join(', ')} and ${names[2]!.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
})
const stmtHint = computed(() => {
  const n = stmts.files.value.length
  return n >= 3 ? 'All three months added.' : n ? `${3 - n} more month${3 - n === 1 ? '' : 's'} recommended for the quickest decision.` : 'One PDF per month works best.'
})
// Best effort: a file the customer took back should not stay on disk.
function discard(id: string) {
  $fetch(`/api/uploads/${id}`, { method: 'DELETE' }).catch(() => {})
}

/* -------------------------------------------------- 4 · limit and review */
const top = computed(() => Math.max(CREDIT_REQUEST_MIN, Math.floor(ceiling / CREDIT_REQUEST_STEP) * CREDIT_REQUEST_STEP))
const limit = ref(Math.min(7500, top.value))
const example = computed(() => {
  const web = findService(catalog.value, 'web')
  const brand = findService(catalog.value, 'brand')
  const wp = findPlan(web, 'growth')
  const bp = findPlan(brand, 'identity')
  if (!web || !brand || !wp || !bp) {
    return ''
  }
  const a = orderTerms(web, wp, 'monthly')
  const b = orderTerms(brand, bp, 'monthly')
  return `For example, a ${wp.name} website (${a.payments} × ${formatCurrency(a.monthly)}) and the ${bp.name} branding plan (${b.payments} × ${formatCurrency(b.monthly)}) running together need ${formatCurrency(a.financed + b.financed)}. Monthly retainers such as SEO do not count. We may offer a lower limit based on your trading.`
})
const CONSENTS = [
  ['truth', 'The information I have given is true and complete, and I can act for this business.'],
  ['checks', 'Apex can check my business and identity, including with Companies House, using the documents I have sent.'],
] as const
const consent = reactive({ truth: false, checks: false })

/* -------------------------------------------------------------- errors */
const errors = computed(() => ({
  1: {
    co: isCo.value && !(lookup.value ? picked.value : manualName.value.trim() && /^[A-Z0-9]{8}$/i.test(manualNumber.value.trim()))
      ? (lookup.value ? (coResults.value ? 'Choose your company from the list' : 'Search for your company and choose it') : 'Add the registered name and the eight-character company number')
      : '',
    trade: !isCo.value && !tradeName.value.trim() ? 'Add your trading name' : '',
    bizPc: !isCo.value && !isPostcode(bizPc.value) ? 'Add your business postcode' : '',
    turn: !turnover.value ? 'Choose a turnover band' : '',
  },
  2: {
    fName: !fName.value.trim() ? 'Add your first name' : '',
    lName: !lName.value.trim() ? 'Add your last name' : '',
    dob: dobProblem(dob.value),
    role: !role.value ? 'Choose your role' : '',
    addr: homeAddress.value.trim().length < 10 ? 'Add your home address, including the postcode' : '',
    id: !idFile.value ? 'Upload a photo ID' : '',
  },
  3: { bank: !stmts.files.value.length ? 'Upload at least one statement' : '' },
  4: { consent: !(consent.truth && consent.checks) ? 'Tick both boxes to submit' : '' },
}) as Record<number, Record<string, string>>)
function show(k: number, f: string) {
  return tried.value && step.value === k ? (errors.value[k]?.[f] ?? '') : ''
}
const stepBlocked = computed(() => step.value === 0
  ? !(elig.uk === 'yes' && elig.six === 'yes')
  : Object.values(errors.value[step.value] ?? {}).some(Boolean))

function scrollTop() {
  window.scrollTo({ top: 0 })
}
function go(n: number) {
  step.value = n
  tried.value = false
  scrollTop()
}

/* -------------------------------------------------------------- submit */
const sending = ref(false)
const sendError = ref('')
async function next() {
  if (stepBlocked.value) {
    tried.value = true
    return
  }
  if (step.value < 4) {
    go(step.value + 1)
    return
  }
  sending.value = true
  sendError.value = ''
  try {
    await $fetch('/api/credit/application', {
      method: 'POST',
      body: {
        businessType: bizType.value,
        ...(isCo.value
          ? { companyNumber: lookup.value ? picked.value!.number : manualNumber.value.trim().toUpperCase(), companyName: lookup.value ? picked.value!.name : manualName.value.trim() }
          : { tradingName: tradeName.value.trim(), businessPostcode: bizPc.value.trim().toUpperCase() }),
        turnover: turnover.value,
        firstName: fName.value.trim(),
        lastName: lName.value.trim(),
        dateOfBirth: dob.value,
        role: role.value,
        homeAddress: homeAddress.value.trim(),
        requestedLimit: limit.value,
        idAttachmentId: idFile.value!.id,
        statementIds: stmts.ids.value,
        consentTrue: true,
        consentChecks: true,
      },
    })
    emit('submitted')
  }
  catch (e) {
    sendError.value = errorMessage(e)
  }
  finally {
    sending.value = false
  }
}

const BIZ_LABEL = Object.fromEntries(BUSINESS_TYPES) as Record<string, string>
const review = computed(() => [
  { k: 'Business', v: isCo.value ? (lookup.value ? (picked.value ? `${picked.value.name} · ${picked.value.number}` : '') : `${manualName.value.trim()} · ${manualNumber.value.trim().toUpperCase()}`) : `${tradeName.value.trim()} · ${bizPc.value.trim().toUpperCase()}`, to: 1 },
  { k: 'Turnover', v: turnover.value ?? '', to: 1 },
  { k: 'Applicant', v: `${[fName.value.trim(), lName.value.trim()].join(' ')}${role.value ? `, ${role.value}` : ''} · born ${dob.value}`, to: 2 },
  { k: 'Home address', v: homeAddress.value.trim(), to: 2 },
  { k: 'Photo ID', v: idFile.value?.name ?? '', to: 2 },
  { k: 'Banking', v: `${stmts.files.value.length} statement${stmts.files.value.length === 1 ? '' : 's'} uploaded`, to: 3 },
])

const CARD = 'bg-card border-line-subtle shadow-panel rounded-[20px] border'
const OVERLINE = 'text-fg-muted text-xs font-bold uppercase tracking-[.06em]'
const LABEL = 'text-fg-heading text-sm font-semibold'
const ERR = 'text-[13px] font-semibold text-[#EC6453]'
const PILL = 'apex-ring h-10 cursor-pointer whitespace-nowrap rounded-full border px-4 text-sm font-semibold'
function pill(on: boolean) {
  return on ? 'bg-fg-heading border-fg-heading text-card' : 'bg-card border-line-rule text-fg-body'
}
const RADIO_DOT = 'inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] text-white'
const DROP = 'relative flex cursor-pointer items-center gap-3.5 rounded-[14px] border-[1.5px] border-dashed border-line-rule bg-raised p-[18px] focus-within:outline-2 focus-within:outline-[var(--accent)]'
</script>

<template>
  <section aria-labelledby="h-apply" class="flex w-full max-w-[800px] flex-col gap-[22px]">
    <button type="button" class="apex-ring text-fg-body hover:text-fg-heading inline-flex min-h-10 cursor-pointer items-center gap-2 self-start rounded-md text-sm font-semibold" @click="emit('exit')">
      <Icon name="lucide:arrow-left" class="size-4" />Wallet &amp; credit
    </button>
    <div class="flex flex-col gap-3.5">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h1 id="h-apply" class="font-heading text-fg-heading m-0 text-[clamp(26px,1.2vw+18px,34px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
          {{ step === 0 ? 'Apply for a credit line' : LABELS[step - 1] }}
        </h1>
        <span v-if="step" class="text-fg-muted text-[13px] font-semibold">Step {{ step }} of 4 · {{ LABELS[step - 1] }}</span>
      </div>
      <div v-if="step" aria-hidden="true" class="flex gap-1.5">
        <span v-for="k in 4" :key="k" class="block h-1 grow rounded-full" :class="k <= step ? 'bg-accent' : 'bg-track'" />
      </div>
    </div>

    <!-- ============================================================ intro -->
    <template v-if="step === 0">
      <p class="text-fg-body m-0 max-w-[62ch] text-base leading-[1.65]">
        A credit line is the most you can have in open instalment plans at once. It is not a loan, no interest is charged and we do not run a credit check.
      </p>
      <div :class="CARD" class="flex flex-col gap-4 p-[clamp(18px,2vw,24px)]">
        <span :class="OVERLINE">What you will need</span>
        <div
          v-for="nd in [
            { icon: 'solar:buildings-2-linear', t: 'Your company number', d: 'Or your trading name and postcode if you are a sole trader.' },
            { icon: 'solar:user-id-linear', t: 'Photo ID for a director or owner', d: 'A passport or UK driving licence.' },
            { icon: 'solar:card-transfer-linear', t: 'Three months of business banking', d: 'PDF statements from your bank.' },
          ]" :key="nd.t" class="flex items-start gap-3.5"
        >
          <span class="bg-accent-tint text-accent-ink inline-flex size-10 shrink-0 items-center justify-center rounded-xl"><Icon :name="nd.icon" class="size-5" /></span>
          <span class="flex flex-col gap-0.5"><span class="text-fg-heading text-[15px] font-semibold">{{ nd.t }}</span><span class="text-fg-muted text-[13.5px] leading-normal">{{ nd.d }}</span></span>
        </div>
      </div>
      <div :class="CARD" class="flex flex-col gap-[18px] p-[clamp(18px,2vw,24px)]">
        <span :class="OVERLINE">Two quick checks</span>
        <div v-for="[key, q] in ELIG" :key="key" class="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <span class="text-fg-heading flex-[1_1_260px] text-[15px] leading-normal">{{ q }}</span>
          <div role="radiogroup" :aria-label="q" class="bg-raised border-line-subtle inline-flex gap-0.5 rounded-xl border p-1">
            <button
              v-for="val in (['yes', 'no'] as const)"
              :key="val"
              type="button"
              role="radio"
              :aria-checked="elig[key] === val"
              class="apex-ring h-9 min-w-16 cursor-pointer rounded-[9px] px-3.5 text-sm font-semibold"
              :class="elig[key] === val ? 'bg-card shadow-panel text-fg-heading' : 'text-fg-muted bg-transparent'"
              @click="elig[key] = val"
            >
              {{ val === 'yes' ? 'Yes' : 'No' }}
            </button>
          </div>
        </div>
        <div v-if="notEligible" role="status" class="bg-st-warning-bg text-st-warning-fg flex items-start gap-3 rounded-[14px] px-4 py-3.5 text-sm leading-[1.55]">
          <Icon name="lucide:info" class="mt-0.5 size-[18px] shrink-0" />
          <span>We cannot offer a credit line yet. You can still order any service on a fixed monthly plan, one at a time. <NuxtLink to="/dashboards/services" class="font-semibold underline">Start an order</NuxtLink></span>
        </div>
      </div>
    </template>

    <!-- ========================================================= business -->
    <div v-if="step === 1" :class="CARD" class="flex flex-col gap-[22px] p-[clamp(18px,2vw,26px)]">
      <div class="flex flex-col gap-2.5">
        <span :class="LABEL">Business type</span>
        <div role="radiogroup" aria-label="Business type" class="flex flex-wrap gap-2">
          <button v-for="[id, label] in BUSINESS_TYPES" :key="id" type="button" role="radio" :aria-checked="bizType === id" :class="[PILL, pill(bizType === id)]" @click="bizType = id">
            {{ label }}
          </button>
        </div>
      </div>

      <div v-if="isCo && lookup" class="flex flex-col gap-2.5">
        <form class="flex flex-wrap items-end gap-2.5" @submit.prevent="searchCompanies">
          <div class="min-w-0 flex-[1_1_260px]">
            <ApexField v-model="coQ" label="Find your company" placeholder="Company name or number" />
          </div>
          <ApexButton type="submit" variant="light" :disabled="coQ.trim().length < 2 || coBusy">
            {{ coBusy ? 'Searching…' : 'Search' }}
          </ApexButton>
        </form>
        <span class="text-fg-muted text-[12.5px]">We look your company up on Companies House.</span>
        <div v-if="coResults?.length" role="radiogroup" aria-label="Companies found" class="apex-pop-in flex flex-col gap-2">
          <button
            v-for="c in coResults"
            :key="c.number"
            type="button"
            role="radio"
            :aria-checked="coSel === c.number"
            :aria-disabled="c.closed"
            class="apex-ring bg-card flex items-center gap-3 rounded-[14px] border px-4 py-3.5 text-left"
            :class="[coSel === c.number ? 'border-accent shadow-[0_0_0_3px_var(--accent-tint)]' : 'border-line-subtle', c.closed ? 'cursor-not-allowed opacity-60' : 'cursor-pointer']"
            @click="c.closed || (coSel = c.number)"
          >
            <span class="flex min-w-0 grow flex-col gap-[3px]">
              <span class="text-fg-heading text-[14.5px] font-semibold">{{ c.name }}</span>
              <span class="text-fg-muted text-[12.5px]">{{ c.number }} · {{ c.status }}{{ c.closed && c.ceased ? ` ${c.ceased}` : c.incorporated ? ` · Incorporated ${c.incorporated}` : '' }}</span>
              <span v-if="c.closed" class="text-fg-body text-[12.5px] font-semibold">Dissolved companies cannot apply.</span>
            </span>
            <span aria-hidden="true" :class="[RADIO_DOT, coSel === c.number ? 'bg-accent border-accent' : 'border-line-rule']">{{ coSel === c.number ? '✓' : '' }}</span>
          </button>
        </div>
        <div v-if="picked" class="bg-raised grid gap-x-5 gap-y-3 rounded-[14px] p-4 @min-[620px]:grid-cols-2">
          <div v-for="cf in [{ k: 'Registered office', v: picked.address }, { k: 'Incorporated', v: picked.incorporated }, { k: 'Status', v: picked.status }, { k: 'Company number', v: picked.number }].filter(f => f.v)" :key="cf.k" class="flex min-w-0 flex-col gap-0.5">
            <span class="text-fg-muted text-xs">{{ cf.k }}</span><span class="text-fg-heading text-sm font-semibold">{{ cf.v }}</span>
          </div>
        </div>
        <span v-if="coError" role="alert" :class="ERR">{{ coError }}</span>
        <span v-else-if="show(1, 'co')" role="alert" :class="ERR">{{ show(1, 'co') }}</span>
      </div>
      <div v-else-if="isCo" class="grid gap-3.5 @min-[620px]:grid-cols-2">
        <ApexField v-model="manualName" label="Registered company name" required placeholder="As it appears on Companies House" :error="show(1, 'co') && !manualName.trim() ? 'Add the registered name' : ''" />
        <ApexField v-model="manualNumber" label="Company number" required placeholder="12345678" hint="Eight characters, on your certificate of incorporation" :error="show(1, 'co') && !/^[A-Z0-9]{8}$/i.test(manualNumber.trim()) ? 'Company numbers are eight characters' : ''" />
      </div>
      <div v-else class="grid gap-3.5 @min-[620px]:grid-cols-2">
        <ApexField v-model="tradeName" label="Trading name" required placeholder="The name customers know you by" :error="show(1, 'trade')" />
        <ApexField v-model="bizPc" label="Business postcode" required placeholder="ME14 1AA" :error="show(1, 'bizPc')" @blur="bizPc = bizPc.toUpperCase()" />
      </div>

      <div class="flex flex-col gap-2.5">
        <span :class="LABEL">Yearly turnover</span>
        <div role="radiogroup" aria-label="Yearly turnover" class="flex flex-wrap gap-2">
          <button v-for="t in TURNOVER_BANDS" :key="t" type="button" role="radio" :aria-checked="turnover === t" :class="[PILL, pill(turnover === t)]" @click="turnover = t">
            {{ t }}
          </button>
        </div>
        <span v-if="show(1, 'turn')" role="alert" :class="ERR">{{ show(1, 'turn') }}</span>
      </div>
    </div>

    <!-- ======================================================== about you -->
    <div v-if="step === 2" :class="CARD" class="flex flex-col gap-[22px] p-[clamp(18px,2vw,26px)]">
      <p class="text-fg-body m-0 text-sm leading-relaxed">
        The person applying must be a director, owner or partner of the business.
      </p>
      <div class="grid gap-3.5 @min-[620px]:grid-cols-2">
        <ApexField v-model="fName" label="First name" required autocomplete="given-name" :error="show(2, 'fName')" />
        <ApexField v-model="lName" label="Last name" required autocomplete="family-name" :error="show(2, 'lName')" />
        <ApexField v-model="dob" label="Date of birth" required placeholder="DD/MM/YYYY" inputmode="numeric" autocomplete="bday" :error="show(2, 'dob')" />
        <div class="flex flex-col gap-2.5">
          <span :class="LABEL">Your role</span>
          <div role="radiogroup" aria-label="Your role" class="flex flex-wrap gap-2">
            <button v-for="r in APPLICANT_ROLES" :key="r" type="button" role="radio" :aria-checked="role === r" :class="[PILL, pill(role === r)]" @click="role = r">
              {{ r }}
            </button>
          </div>
          <span v-if="show(2, 'role')" role="alert" :class="ERR">{{ show(2, 'role') }}</span>
        </div>
      </div>
      <ApexField v-model="homeAddress" label="Home address" required multiline :rows="3" autocomplete="street-address" hint="House number, street, town and postcode" :error="show(2, 'addr')" />
      <div class="flex flex-col gap-2.5">
        <span :class="LABEL">Photo ID</span>
        <label v-if="!idFile" :class="DROP">
          <span class="bg-accent-tint text-accent-ink inline-flex size-10 shrink-0 items-center justify-center rounded-xl"><Icon :name="idUpload.uploading.value ? 'lucide:loader-circle' : 'solar:user-id-linear'" class="size-5" :class="idUpload.uploading.value ? 'motion-safe:animate-spin' : ''" /></span>
          <span class="flex grow flex-col gap-0.5"><span class="text-fg-heading text-sm font-semibold">Passport or UK driving licence</span><span class="text-fg-muted text-[12.5px]">A clear photo of the photo page or the front of the card</span></span>
          <span class="text-accent-ink text-[13.5px] font-semibold">Upload</span>
          <input type="file" accept="image/*,.pdf" class="absolute size-px opacity-0" :disabled="idUpload.uploading.value" @change="onId">
        </label>
        <div v-else class="border-line-subtle flex items-center gap-3 rounded-[14px] border px-4 py-3.5">
          <span aria-hidden="true" class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#22B07D] text-[13px] text-white">✓</span>
          <span class="flex min-w-0 grow flex-col gap-0.5"><span class="text-fg-heading truncate text-sm font-semibold">{{ idFile.name }}</span><span class="text-fg-muted text-[12.5px]">Ready to check</span></span>
          <button type="button" class="apex-ring text-fg-body hover:bg-hover min-h-9 cursor-pointer rounded-[10px] px-2.5 text-[13.5px] font-semibold" @click="replaceId">
            Replace
          </button>
        </div>
        <span v-if="idUpload.error.value" role="alert" :class="ERR">{{ idUpload.error.value }}</span>
        <span v-else-if="show(2, 'id')" role="alert" :class="ERR">{{ show(2, 'id') }}</span>
      </div>
    </div>

    <!-- ========================================================== banking -->
    <template v-if="step === 3">
      <p class="text-fg-body m-0 max-w-[62ch] text-[14.5px] leading-relaxed">
        We look at three months of business banking to set a limit that suits your trading. Upload a statement for each month.
      </p>
      <div :class="CARD" class="flex flex-col gap-3 p-[clamp(18px,2vw,24px)]">
        <label :class="DROP" class="gap-3">
          <Icon :name="stmts.uploading.value ? 'lucide:loader-circle' : 'solar:upload-minimalistic-linear'" class="text-accent-ink size-5" :class="stmts.uploading.value ? 'motion-safe:animate-spin' : ''" />
          <span class="flex grow flex-col gap-0.5"><span class="text-fg-heading text-sm font-semibold">Business bank statements</span><span class="text-fg-muted text-[12.5px]">PDFs for {{ months }}</span></span>
          <span class="text-accent-ink text-[13.5px] font-semibold">Choose files</span>
          <input type="file" multiple accept=".pdf" class="absolute size-px opacity-0" :disabled="stmts.uploading.value" @change="onStmts">
        </label>
        <div v-for="f in stmts.files.value" :key="f.id" class="border-line-subtle flex items-center gap-3 rounded-xl border px-3 py-2.5">
          <Icon name="solar:file-text-linear" class="text-accent-ink size-[18px] shrink-0" />
          <span class="text-fg-heading min-w-0 grow truncate text-[13.5px] font-semibold">{{ f.name }}</span>
          <button type="button" :aria-label="`Remove ${f.name}`" class="apex-ring text-fg-muted inline-flex size-8 cursor-pointer items-center justify-center rounded-lg" @click="removeStmt(f.id)">
            <Icon name="lucide:x" class="size-[15px]" />
          </button>
        </div>
        <span class="text-fg-muted text-[12.5px]">{{ stmtHint }}</span>
      </div>
      <span v-if="stmts.error.value" role="alert" :class="ERR">{{ stmts.error.value }}</span>
      <span v-else-if="show(3, 'bank')" role="alert" :class="ERR">{{ show(3, 'bank') }}</span>
    </template>

    <!-- ================================================ limit and review -->
    <template v-if="step === 4">
      <div :class="CARD" class="flex flex-col gap-3.5 p-[clamp(18px,2vw,26px)]">
        <span :class="LABEL">Credit line you would like</span>
        <span class="font-heading text-fg-heading text-[clamp(36px,2vw+20px,48px)] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{{ formatCurrency(limit) }}</span>
        <input v-model.number="limit" type="range" :min="CREDIT_REQUEST_MIN" :max="top" :step="CREDIT_REQUEST_STEP" aria-label="Credit line amount" class="h-7 w-full cursor-pointer accent-[#7D53F2]">
        <div class="text-fg-muted flex justify-between text-[12.5px]">
          <span>{{ formatCurrency(CREDIT_REQUEST_MIN) }}</span><span>{{ formatCurrency(top) }}</span>
        </div>
        <p v-if="example" class="border-line-soft text-fg-body m-0 border-t pt-3 text-[13.5px] leading-relaxed">
          {{ example }}
        </p>
      </div>
      <div :class="CARD" class="overflow-hidden">
        <span class="block px-[clamp(16px,2vw,22px)] pb-1.5 pt-4" :class="OVERLINE">Check your details</span>
        <div v-for="rv in review" :key="rv.k" class="border-line-soft flex items-start gap-4 border-t px-[clamp(16px,2vw,22px)] py-3.5">
          <span class="text-fg-muted w-[120px] shrink-0 text-[13.5px]">{{ rv.k }}</span>
          <span class="text-fg-heading min-w-0 grow text-[14.5px] leading-normal [overflow-wrap:anywhere]">{{ rv.v }}</span>
          <button type="button" class="apex-ring text-accent-ink hover:bg-accent-tint min-h-8 shrink-0 cursor-pointer rounded-lg px-2 text-[13.5px] font-semibold" :aria-label="`Edit ${rv.k.toLowerCase()}`" @click="go(rv.to)">
            Edit
          </button>
        </div>
      </div>
      <div :class="CARD" class="flex flex-col gap-4 p-[clamp(18px,2vw,24px)]">
        <button
          v-for="[key, t] in CONSENTS"
          :key="key"
          type="button"
          role="checkbox"
          :aria-checked="consent[key]"
          class="apex-ring flex cursor-pointer items-start gap-3 rounded-md text-left"
          @click="consent[key] = !consent[key]"
        >
          <span aria-hidden="true" class="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-md border-2 text-[11px] text-white" :class="consent[key] ? 'bg-accent border-accent' : 'border-line-rule'">{{ consent[key] ? '✓' : '' }}</span>
          <span class="text-fg-heading text-sm leading-[1.55]">{{ t }}</span>
        </button>
        <span v-if="show(4, 'consent')" role="alert" :class="ERR">{{ show(4, 'consent') }}</span>
        <span class="border-line-soft text-fg-muted flex items-start gap-2 border-t pt-3.5 text-[12.5px] leading-[1.55]">
          <Icon name="lucide:shield-check" class="mt-0.5 size-[15px] shrink-0" />Our team checks your business on Companies House and reviews your ID and statements. We do not use credit reference agencies and nothing appears on your credit file.
        </span>
      </div>
      <p v-if="sendError" role="alert" class="bg-st-danger-bg text-st-danger-fg m-0 rounded-[14px] px-4 py-3 text-sm">
        {{ sendError }}
      </p>
    </template>

    <div class="flex items-center justify-between gap-3 pt-0.5">
      <button v-if="step > 0" type="button" class="apex-ring bg-card border-line-rule text-fg-heading inline-flex h-[46px] cursor-pointer items-center gap-2 rounded-[14px] border px-4 text-[15px] font-semibold" @click="go(step - 1)">
        <Icon name="lucide:arrow-left" class="size-4" />Back
      </button>
      <button v-else type="button" class="apex-ring text-fg-body min-h-[46px] cursor-pointer rounded-md px-1 text-[15px] font-semibold" @click="emit('exit')">
        Cancel
      </button>
      <ApexButton :disabled="(step === 0 && stepBlocked) || sending || idUpload.uploading.value || stmts.uploading.value" @click="next">
        {{ step === 0 ? 'Start application' : step === 4 ? (sending ? 'Sending…' : 'Submit application') : 'Continue' }}
      </ApexButton>
    </div>
  </section>
</template>
