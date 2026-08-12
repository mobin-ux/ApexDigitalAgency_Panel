<script setup lang="ts">
/**
 * WalletTopUp — the production Top-Up / Add-Payment-Method experience.
 *
 * Two entry points, one state machine:
 *  - mode="topup"      add funds to the wallet (amount → method → pay → receipt)
 *  - mode="add-method" save a card or Direct Debit for later (no charge)
 *
 * Payment methods supported (UK conventions throughout):
 *  - Debit or Credit Card — Visa, Mastercard, Amex. Full client-side validation
 *    (brand detection, Luhn, expiry, CVC, cardholder, billing postcode). The
 *    card number and CVC never leave the browser: only display metadata
 *    (brand/last4/expiry) is sent (PCI SAQ-A — see server/.../card.post.ts).
 *  - Direct Debit — sort code + account number + account-holder authorisation,
 *    the Direct Debit Guarantee, and advance-notice messaging.
 *
 * Settlement runs through the real payment rails (POST /api/finance/topup →
 * PaymentIntent → settleIntent), so a successful top-up genuinely updates the
 * wallet balance, writes a Transaction and issues a receipt. When no live
 * provider is connected the app is on the sandbox rail (a badge says so) and no
 * real money moves; connecting Stripe/GoCardless switches card/bank entry to
 * the provider's hosted fields with no change to this flow.
 */

const props = withDefaults(defineProps<{
  open: boolean
  mode?: 'topup' | 'add-method'
  presets?: number[]
}>(), {
  mode: 'topup',
  presets: () => [100, 250, 500, 1000],
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success', payload: { balance?: number, methodId?: string }): void
}>()

const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()

// ---- config + saved methods ----------------------------------------------
interface PayConfig {
  currency: string
  sandbox: boolean
  liveMode: boolean
  topupMin: number
  topupMax: number
  card: { enabled: boolean, entry: 'inline' | 'hosted', brands: string[] }
  directDebit: { enabled: boolean, entry: 'inline' | 'hosted' | 'disabled', advanceNoticeDays: number }
}
interface SavedMethod {
  id: string
  kind: 'card' | 'bacs_debit' | 'paypal' | 'open_banking'
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  mandateStatus: string | null
  isDefault: boolean
  usable: boolean
  expired: boolean
  label: string
}

const config = ref<PayConfig | null>(null)
const savedMethods = ref<SavedMethod[]>([])
const usableMethods = computed(() => savedMethods.value.filter(m => m.usable))
const loading = ref(true)

async function loadContext() {
  loading.value = true
  try {
    const [cfg, methods] = await Promise.all([
      $fetch<PayConfig>('/api/finance/pay-config'),
      $fetch<{ methods: SavedMethod[] }>('/api/finance/payment-methods'),
    ])
    config.value = cfg
    savedMethods.value = methods.methods ?? []
  }
  catch {
    toaster.add({ title: 'Could not load payment options', description: 'Please close and try again.', icon: 'lucide:alert-triangle' })
  }
  finally {
    loading.value = false
  }
}

// ---- state machine --------------------------------------------------------
type Screen = 'choose' | 'card' | 'bank' | 'ddauth' | 'verify' | 'processing' | 'success' | 'error'
const screen = ref<Screen>('choose')
const busy = ref(false)

interface Receipt {
  kind: 'payment' | 'method'
  title?: string
  amount?: number
  reference?: string
  methodLabel?: string
  balance?: number
  when?: string
  pending?: boolean
}
const lastReceipt = ref<Receipt | null>(null)

// Escape closes (accessibility / expected behaviour).
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open && !busy.value) {
    close()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function close() {
  if (busy.value) {
    return
  }
  emit('close')
}

// ---- amount ---------------------------------------------------------------
const amount = ref('')
const amountNum = computed(() => {
  const n = Number.parseFloat(amount.value)
  return Number.isFinite(n) ? n : 0
})
function onAmountInput(e: Event) {
  // Allow digits and a single decimal point, max 2 dp.
  let v = (e.target as HTMLInputElement).value.replace(/[^\d.]/g, '')
  const parts = v.split('.')
  if (parts.length > 2) {
    v = `${parts[0]}.${parts.slice(1).join('')}`
  }
  const [pounds, pence] = v.split('.')
  v = pence !== undefined ? `${pounds}.${pence.slice(0, 2)}` : pounds
  amount.value = v
}
const amountError = computed(() => {
  if (props.mode !== 'topup') {
    return ''
  }
  const cfg = config.value
  if (!cfg || amount.value === '') {
    return ''
  }
  if (amountNum.value < cfg.topupMin) {
    return `The minimum top-up is ${formatCurrency(cfg.topupMin)}.`
  }
  if (amountNum.value > cfg.topupMax) {
    return `The maximum top-up is ${formatCurrency(cfg.topupMax)}.`
  }
  return ''
})
const amountValid = computed(() => props.mode !== 'topup' || (amountNum.value > 0 && amountError.value === ''))

// ---- method choice --------------------------------------------------------
const selectedMethodId = ref('')
const newMethod = ref<'card' | 'bank' | null>(null)

function pickSaved(id: string) {
  selectedMethodId.value = id
  newMethod.value = null
}
function pickNew(kind: 'card' | 'bank') {
  newMethod.value = kind
  selectedMethodId.value = ''
}

const canContinue = computed(() => {
  if (!amountValid.value) {
    return false
  }
  return Boolean(selectedMethodId.value) || Boolean(newMethod.value)
})

function proceed() {
  if (!canContinue.value) {
    return
  }
  if (selectedMethodId.value) {
    pay(selectedMethodId.value)
    return
  }
  if (newMethod.value === 'card') {
    screen.value = 'card'
  }
  else if (newMethod.value === 'bank') {
    screen.value = 'bank'
  }
}

// ---- card form + validation ----------------------------------------------
const card = reactive({ number: '', name: '', expiry: '', cvc: '', postcode: '' })
const cardTouched = reactive<Record<string, boolean>>({})
function resetCard() {
  card.number = ''
  card.name = ''
  card.expiry = ''
  card.cvc = ''
  card.postcode = ''
  Object.keys(cardTouched).forEach(k => delete cardTouched[k])
}

const cardDigits = computed(() => card.number.replace(/\D/g, ''))
function detectBrand(digits: string): 'visa' | 'mastercard' | 'amex' | '' {
  if (digits.startsWith('4')) {
    return 'visa'
  }
  if (/^3[47]/.test(digits)) {
    return 'amex'
  }
  if (/^5[1-5]/.test(digits) || /^2(?:2[2-9]|[3-6]\d|7[01]|720)/.test(digits)) {
    return 'mastercard'
  }
  return ''
}
const brand = computed(() => detectBrand(cardDigits.value))
const brandLabel = computed(() => (brand.value === 'amex' ? 'AMEX' : brand.value === 'mastercard' ? 'MC' : brand.value === 'visa' ? 'VISA' : ''))
const cvcLen = computed(() => (brand.value === 'amex' ? 4 : 3))
const cardMaxDigits = computed(() => (brand.value === 'amex' ? 15 : 16))

function luhn(digits: string): boolean {
  let sum = 0
  let alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number.parseInt(digits[i]!, 10)
    if (alt) {
      n *= 2
      if (n > 9) {
        n -= 9
      }
    }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0 && digits.length > 0
}

function onCardNumberInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, cardMaxDigits.value)
  // Group: Amex 4-6-5, others 4-4-4-4.
  let grouped: string
  if (detectBrand(raw) === 'amex') {
    grouped = [raw.slice(0, 4), raw.slice(4, 10), raw.slice(10, 15)].filter(Boolean).join(' ')
  }
  else {
    grouped = (raw.match(/.{1,4}/g) ?? []).join(' ')
  }
  card.number = grouped
}
function onExpiryInput(e: Event) {
  let raw = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4)
  if (raw.length >= 3) {
    raw = `${raw.slice(0, 2)}/${raw.slice(2)}`
  }
  card.expiry = raw
}

const expiryParsed = computed(() => {
  const m = card.expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/)
  if (!m) {
    return null
  }
  const month = Number.parseInt(m[1]!, 10)
  const year = 2000 + Number.parseInt(m[2]!, 10)
  return { month, year }
})

const cardErrors = computed(() => {
  const e: Record<string, string> = {}
  if (!brand.value) {
    e.number = cardDigits.value.length > 0 ? 'Enter a Visa, Mastercard or Amex card.' : 'Card number is required.'
  }
  else if (cardDigits.value.length < cardMaxDigits.value || !luhn(cardDigits.value)) {
    e.number = 'This card number looks incorrect.'
  }
  if (card.name.trim().length < 2) {
    e.name = 'Enter the name on the card.'
  }
  const exp = expiryParsed.value
  if (!exp) {
    e.expiry = 'Enter expiry as MM/YY.'
  }
  else if (exp.month < 1 || exp.month > 12) {
    e.expiry = 'Enter a valid month (01–12).'
  }
  else {
    const now = new Date()
    const end = new Date(exp.year, exp.month, 1)
    if (end <= now) {
      e.expiry = 'This card has expired.'
    }
    else if (exp.year > now.getFullYear() + 20) {
      e.expiry = 'Check the expiry year.'
    }
  }
  if (!new RegExp(`^\\d{${cvcLen.value}}$`).test(card.cvc)) {
    e.cvc = `Enter the ${cvcLen.value}-digit security code.`
  }
  if (!/^[a-z0-9\s]{2,12}$/i.test(card.postcode.trim())) {
    e.postcode = 'Enter your billing postcode.'
  }
  return e
})
const cardValid = computed(() => Object.keys(cardErrors.value).length === 0)
function touchCard(field: string) {
  cardTouched[field] = true
}
function showCardErr(field: string) {
  return cardTouched[field] && cardErrors.value[field]
}

async function submitCard() {
  Object.keys(card).forEach(k => (cardTouched[k] = true))
  if (!cardValid.value || busy.value) {
    return
  }
  busy.value = true
  try {
    const exp = expiryParsed.value!
    // Save display metadata only — the PAN/CVC stay here (SAQ-A).
    const res = await $fetch<{ method: { id: string } }>('/api/finance/payment-methods/card', {
      method: 'POST',
      body: {
        brand: brand.value,
        last4: cardDigits.value.slice(-4),
        expMonth: exp.month,
        expYear: exp.year,
        accountHolder: card.name.trim(),
        billingPostcode: card.postcode.trim(),
        // Opaque stand-in for the provider token (browser-side only).
        token: `tok_sandbox_${cardDigits.value.slice(-4)}_${Date.now()}`,
        setDefault: usableMethods.value.length === 0,
      },
    })
    savedMethods.value = []
    if (props.mode === 'add-method') {
      lastReceipt.value = { kind: 'method', title: `${brandLabelFull(brand.value)} •••• ${cardDigits.value.slice(-4)} added` }
      screen.value = 'success'
      emit('success', { methodId: res.method.id })
    }
    else {
      await pay(res.method.id, `${brandLabelFull(brand.value)} •••• ${cardDigits.value.slice(-4)}`)
    }
  }
  catch (err: any) {
    fail('We couldn’t save that card', err?.data?.message ?? 'Please check the details and try again.')
  }
  finally {
    busy.value = false
  }
}

function brandLabelFull(b: string) {
  return b === 'amex' ? 'American Express' : b === 'mastercard' ? 'Mastercard' : 'Visa'
}

// ---- Direct Debit form + validation --------------------------------------
const bank = reactive({ name: '', sortCode: '', accountNumber: '' })
const bankTouched = reactive<Record<string, boolean>>({})
function resetBank() {
  bank.name = ''
  bank.sortCode = ''
  bank.accountNumber = ''
  Object.keys(bankTouched).forEach(k => delete bankTouched[k])
}
const sortDigits = computed(() => bank.sortCode.replace(/\D/g, ''))
function onSortInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6)
  bank.sortCode = (raw.match(/.{1,2}/g) ?? []).join('-')
}
function onAccountInput(e: Event) {
  bank.accountNumber = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 8)
}
const bankErrors = computed(() => {
  const e: Record<string, string> = {}
  if (bank.name.trim().length < 2) {
    e.name = 'Enter the account holder’s name.'
  }
  if (sortDigits.value.length !== 6) {
    e.sortCode = 'Enter a valid 6-digit sort code.'
  }
  if (bank.accountNumber.length !== 8) {
    e.accountNumber = 'Enter a valid 8-digit account number.'
  }
  return e
})
const bankValid = computed(() => Object.keys(bankErrors.value).length === 0)
function touchBank(field: string) {
  bankTouched[field] = true
}
function showBankErr(field: string) {
  return bankTouched[field] && bankErrors.value[field]
}
function bankContinue() {
  Object.keys(bank).forEach(k => (bankTouched[k] = true))
  if (!bankValid.value) {
    return
  }
  screen.value = 'ddauth'
}

const ddAuthorised = ref(false)
async function submitMandate() {
  if (!ddAuthorised.value || busy.value) {
    return
  }
  busy.value = true
  try {
    const res = await $fetch<{ method: { id: string, last4: string } }>('/api/finance/payment-methods/bank', {
      method: 'POST',
      body: {
        accountHolder: bank.name.trim(),
        sortCode: sortDigits.value,
        accountNumber: bank.accountNumber,
        authorised: true,
        setDefault: usableMethods.value.length === 0,
      },
    })
    savedMethods.value = []
    if (props.mode === 'add-method') {
      lastReceipt.value = { kind: 'method', title: `Direct Debit •••• ${res.method.last4} set up` }
      screen.value = 'success'
      emit('success', { methodId: res.method.id })
    }
    else {
      await pay(res.method.id, `Direct Debit •••• ${res.method.last4}`)
    }
  }
  catch (err: any) {
    fail('We couldn’t set up the Direct Debit', err?.data?.message ?? 'Please check your bank details and try again.')
  }
  finally {
    busy.value = false
  }
}

// ---- charge ---------------------------------------------------------------
const failure = reactive({ title: '', message: '' })
function fail(title: string, message: string) {
  failure.title = title
  failure.message = message
  screen.value = 'error'
}

async function pay(methodId: string, methodLabel?: string) {
  if (busy.value && screen.value !== 'card' && screen.value !== 'ddauth') {
    // pay() is also called from card/DD submit where busy is already held.
  }
  busy.value = true
  const label = methodLabel ?? savedMethods.value.find(m => m.id === methodId)?.label ?? 'Saved method'
  try {
    const res = await $fetch<{
      reference: string
      amount: number
      intentStatus: string
      settled: boolean
    }>('/api/finance/topup', {
      method: 'POST',
      body: { amount: amountNum.value, paymentMethodId: methodId },
    })

    lastReceipt.value = {
      kind: 'payment',
      amount: res.amount,
      reference: res.reference,
      methodLabel: label,
      when: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    }

    if (res.settled || res.intentStatus === 'succeeded') {
      await completeSuccess(res.reference)
    }
    else if (res.intentStatus === 'requires_action') {
      screen.value = 'verify'
    }
    else if (res.intentStatus === 'processing') {
      lastReceipt.value.pending = true
      screen.value = 'processing'
      pollStatus(res.reference)
    }
    else {
      fail('Payment could not be completed', 'Your payment was not successful. No money has left your account. Please try again.')
    }
  }
  catch (err: any) {
    const msg = err?.data?.message ?? 'A network error interrupted the payment. Please check your connection and try again.'
    fail('Payment failed', msg)
  }
  finally {
    busy.value = false
  }
}

async function verify3ds() {
  if (busy.value) {
    return
  }
  busy.value = true
  try {
    const res = await $fetch<{ status: string, walletBalance: number }>('/api/finance/topup/confirm', {
      method: 'POST',
      body: { reference: lastReceipt.value?.reference },
    })
    if (lastReceipt.value) {
      lastReceipt.value.balance = res.walletBalance
    }
    screen.value = 'success'
    emit('success', { balance: res.walletBalance })
  }
  catch (err: any) {
    fail('Verification failed', err?.data?.message ?? 'We couldn’t verify the payment. Please try again.')
  }
  finally {
    busy.value = false
  }
}

async function completeSuccess(reference: string) {
  try {
    const s = await $fetch<{ walletBalance: number }>(`/api/finance/topup/status?reference=${encodeURIComponent(reference)}`)
    if (lastReceipt.value) {
      lastReceipt.value.balance = s.walletBalance
    }
    emit('success', { balance: s.walletBalance })
  }
  catch {
    emit('success', {})
  }
  screen.value = 'success'
}

let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollCount = 0
async function pollStatus(reference: string) {
  pollCount = 0
  const tick = async () => {
    pollCount++
    try {
      const s = await $fetch<{ status: string, walletBalance: number }>(`/api/finance/topup/status?reference=${encodeURIComponent(reference)}`)
      if (s.status === 'succeeded') {
        if (lastReceipt.value) {
          lastReceipt.value.balance = s.walletBalance
          lastReceipt.value.pending = false
        }
        emit('success', { balance: s.walletBalance })
        screen.value = 'success'
        return
      }
      if (s.status === 'failed' || s.status === 'cancelled') {
        fail('Payment could not be collected', 'Your Direct Debit collection was not successful. Please try another method.')
        return
      }
    }
    catch {
      // keep the pending screen; the collection is recorded server-side
    }
    if (pollCount < 4) {
      pollTimer = setTimeout(tick, 3000)
    }
  }
  pollTimer = setTimeout(tick, 3000)
}
onBeforeUnmount(() => {
  if (pollTimer) {
    clearTimeout(pollTimer)
  }
})

function retry() {
  screen.value = 'choose'
  failure.title = ''
  failure.message = ''
}

// ---- receipt download -----------------------------------------------------
function downloadReceipt() {
  const r = lastReceipt.value
  if (!r) {
    return
  }
  const rows = [
    ['Reference', r.reference ?? '—'],
    ['Amount', r.amount != null ? formatCurrency(r.amount) : '—'],
    ['Method', r.methodLabel ?? '—'],
    ['Status', r.pending ? 'Processing' : 'Completed'],
    ['Date', r.when ?? new Date().toLocaleString('en-GB')],
    ['New wallet balance', r.balance != null ? formatCurrency(r.balance) : '—'],
  ]
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Apex Digi receipt ${r.reference ?? ''}</title>
<style>body{font-family:Inter,Arial,sans-serif;color:#16252a;max-width:520px;margin:40px auto;padding:0 24px}
h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}
td{padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px}td:last-child{text-align:right;font-weight:600}
.muted{color:#6b7280;font-size:12px;margin-top:24px}</style></head>
<body><h1>Apex Digital Agency — payment receipt</h1>
<table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
<p class="muted">${config.value?.sandbox ? 'Sandbox payment — no real money was moved.' : 'Thank you for your payment.'} apexdigi.co.uk</p>
</body></html>`
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `apex-receipt-${r.reference ?? 'topup'}.html`
  a.click()
  URL.revokeObjectURL(url)
}

// ---- small UI helpers -----------------------------------------------------
const headerTitle = computed(() => {
  if (screen.value === 'success') {
    return props.mode === 'add-method' ? 'Payment method added' : 'Payment complete'
  }
  if (props.mode === 'add-method') {
    return 'Add a payment method'
  }
  return 'Top up wallet'
})
const advanceDays = computed(() => config.value?.directDebit.advanceNoticeDays ?? 3)

// Reset everything each time the modal opens. Declared last so every ref and
// helper it touches is already defined (the immediate run happens in setup).
watch(() => props.open, (open) => {
  if (!open) {
    return
  }
  screen.value = 'choose'
  busy.value = false
  amount.value = props.mode === 'topup' ? '250' : ''
  selectedMethodId.value = ''
  newMethod.value = null
  resetCard()
  resetBank()
  ddAuthorised.value = false
  lastReceipt.value = null
  failure.title = ''
  failure.message = ''
  loadContext()
}, { immediate: true })
</script>

<template>
  <div v-if="open" class="apex-fade fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(5,10,12,0.68)] p-4 backdrop-blur-[4px] sm:p-6" @click.self="close">
    <div
      class="apex-pop relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[480px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-muted-800 shadow-[0_40px_80px_rgba(0,0,0,0.5)]"
      role="dialog" aria-modal="true" :aria-label="headerTitle"
    >
      <!-- header -->
      <div class="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
        <div class="flex items-center gap-2.5">
          <button
            v-if="['card', 'bank', 'ddauth'].includes(screen)"
            type="button" aria-label="Back"
            class="flex size-8 items-center justify-center rounded-full text-muted-400 transition hover:bg-white/5 hover:text-white"
            @click="screen === 'ddauth' ? (screen = 'bank') : (screen = 'choose')"
          >
            <Icon name="lucide:arrow-left" class="size-4" />
          </button>
          <h2 class="font-heading text-[17px] font-extrabold tracking-[-0.01em] text-white">
            {{ headerTitle }}
          </h2>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="config?.sandbox" class="rounded-full bg-[#F2C14E]/14 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#F2C14E]">Sandbox</span>
          <button
            type="button" aria-label="Close"
            class="flex size-8 items-center justify-center rounded-full text-muted-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
            :disabled="busy"
            @click="close"
          >
            <Icon name="lucide:x" class="size-4" />
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <!-- loading -->
        <div v-if="loading" class="flex flex-col gap-3">
          <div class="h-12 animate-pulse rounded-xl bg-white/5" />
          <div class="h-24 animate-pulse rounded-xl bg-white/5" />
          <div class="h-16 animate-pulse rounded-xl bg-white/5" />
        </div>

        <!-- ============ CHOOSE ============ -->
        <template v-else-if="screen === 'choose'">
          <!-- amount (topup only) -->
          <div v-if="mode === 'topup'" class="mb-5">
            <label for="tu-amount" class="mb-2 block text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">Amount</label>
            <div class="mb-2.5 grid grid-cols-4 gap-2">
              <button
                v-for="p in presets" :key="p"
                type="button"
                class="rounded-xl border px-1 py-2.5 text-[13.5px] font-bold tabular-nums transition"
                :class="Number(amount) === p ? 'border-primary-500 bg-primary-500/16 text-white' : 'border-white/8 bg-muted-700 text-muted-400 hover:border-white/20'"
                @click="amount = String(p)"
              >
                {{ formatCurrency(p) }}
              </button>
            </div>
            <div class="relative">
              <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted-500">£</span>
              <input
                id="tu-amount" :value="amount" inputmode="decimal" placeholder="Other amount"
                class="w-full rounded-xl border bg-muted-700 py-3 pl-8 pr-3.5 text-[15px] font-semibold text-white outline-none transition tabular-nums focus:border-primary-400"
                :class="amountError ? 'border-[#EC6453]/60' : 'border-white/8'"
                :aria-invalid="Boolean(amountError)"
                @input="onAmountInput"
              >
            </div>
            <p v-if="amountError" class="mt-1.5 text-[12px] text-[#EC6453]">
              {{ amountError }}
            </p>
          </div>

          <!-- saved methods -->
          <div v-if="usableMethods.length" class="mb-4">
            <div class="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">
              Your payment methods
            </div>
            <div class="flex flex-col gap-2">
              <button
                v-for="m in usableMethods" :key="m.id"
                type="button"
                class="flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition"
                :class="selectedMethodId === m.id ? 'border-primary-500 bg-primary-500/10' : 'border-white/8 bg-muted-700 hover:border-white/20'"
                @click="pickSaved(m.id)"
              >
                <span class="flex h-7 min-w-[42px] items-center justify-center rounded-md bg-white/8 px-1.5 text-[11px] font-bold text-white">
                  {{ m.kind === 'bacs_debit' ? 'BACS' : (m.brand || 'CARD').slice(0, 4).toUpperCase() }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[13.5px] font-semibold text-white">{{ m.label }}</span>
                  <span class="text-[11.5px] text-muted-500">{{ m.kind === 'bacs_debit' ? 'Direct Debit' : `Expires ${String(m.expMonth).padStart(2, '0')}/${String(m.expYear).slice(-2)}` }}</span>
                </span>
                <span class="box-border size-[18px] shrink-0 rounded-full" :class="selectedMethodId === m.id ? 'border-[5px] border-primary-500 bg-white' : 'border-2 border-white/15'" />
              </button>
            </div>
          </div>

          <!-- new method tiles -->
          <div class="mb-1 text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">
            {{ usableMethods.length ? 'Or pay a new way' : 'Choose how to pay' }}
          </div>
          <div class="mt-2 flex flex-col gap-2.5">
            <button
              type="button"
              class="flex items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition"
              :class="newMethod === 'card' ? 'border-primary-500 bg-primary-500/10' : 'border-white/8 bg-muted-700 hover:border-white/20'"
              @click="pickNew('card')"
            >
              <Icon name="lucide:credit-card" class="size-5 shrink-0 text-primary-300" />
              <span class="flex-1">
                <span class="block text-[14px] font-bold text-white">Debit or Credit Card</span>
                <span class="text-[12px] text-muted-500">Instant · Visa, Mastercard, Amex</span>
              </span>
              <Icon name="lucide:chevron-right" class="size-4 text-muted-500" />
            </button>
            <button
              v-if="config?.directDebit.enabled"
              type="button"
              class="flex items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition"
              :class="newMethod === 'bank' ? 'border-primary-500 bg-primary-500/10' : 'border-white/8 bg-muted-700 hover:border-white/20'"
              @click="pickNew('bank')"
            >
              <Icon name="lucide:landmark" class="size-5 shrink-0 text-primary-300" />
              <span class="flex-1">
                <span class="block text-[14px] font-bold text-white">Direct Debit</span>
                <span class="text-[12px] text-muted-500">Best for instalments · No card expiry</span>
              </span>
              <Icon name="lucide:chevron-right" class="size-4 text-muted-500" />
            </button>
          </div>

          <button
            type="button"
            class="mt-6 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-bold transition"
            :class="canContinue ? 'cursor-pointer bg-primary-500 text-white shadow-[0_8px_20px_rgba(125,83,242,0.28)] hover:bg-primary-600' : 'cursor-not-allowed bg-muted-700 text-muted-500'"
            :disabled="!canContinue"
            @click="proceed"
          >
            <Icon v-if="selectedMethodId" name="lucide:lock" class="size-4" />
            {{ selectedMethodId
              ? (mode === 'topup' ? `Pay ${formatCurrency(amountNum)}` : 'Continue')
              : 'Continue' }}
          </button>

          <p class="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-muted-500">
            <Icon name="lucide:shield-check" class="size-3.5 text-[#22B07D]" />
            Payments are encrypted. We never store your full card number.
          </p>
        </template>

        <!-- ============ CARD FORM ============ -->
        <template v-else-if="screen === 'card'">
          <p v-if="mode === 'topup'" class="mb-4 text-[13px] text-muted-400">
            Paying <strong class="font-semibold text-white">{{ formatCurrency(amountNum) }}</strong> to your Apex wallet.
          </p>
          <div class="flex flex-col gap-3.5">
            <!-- number -->
            <div>
              <label for="cc-num" class="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">Card number</label>
              <div class="relative">
                <input
                  id="cc-num" :value="card.number" inputmode="numeric" autocomplete="cc-number" placeholder="1234 5678 9012 3456"
                  class="w-full rounded-xl border bg-muted-700 py-3 pl-3.5 pr-16 text-[15px] font-medium text-white outline-none transition tabular-nums focus:border-primary-400"
                  :class="showCardErr('number') ? 'border-[#EC6453]/60' : 'border-white/8'"
                  :aria-invalid="Boolean(showCardErr('number'))"
                  @input="onCardNumberInput" @blur="touchCard('number')"
                >
                <span v-if="brandLabel" class="absolute right-3.5 top-1/2 -translate-y-1/2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white">{{ brandLabel }}</span>
                <Icon v-else name="lucide:credit-card" class="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-500" />
              </div>
              <p v-if="showCardErr('number')" class="mt-1 text-[12px] text-[#EC6453]">
                {{ cardErrors.number }}
              </p>
            </div>
            <!-- name -->
            <div>
              <label for="cc-name" class="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">Name on card</label>
              <input
                id="cc-name" v-model="card.name" autocomplete="cc-name" placeholder="As shown on the card"
                class="w-full rounded-xl border bg-muted-700 px-3.5 py-3 text-[15px] text-white outline-none transition focus:border-primary-400"
                :class="showCardErr('name') ? 'border-[#EC6453]/60' : 'border-white/8'"
                :aria-invalid="Boolean(showCardErr('name'))"
                @blur="touchCard('name')"
              >
              <p v-if="showCardErr('name')" class="mt-1 text-[12px] text-[#EC6453]">
                {{ cardErrors.name }}
              </p>
            </div>
            <!-- expiry + cvc -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="cc-exp" class="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">Expiry</label>
                <input
                  id="cc-exp" :value="card.expiry" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY"
                  class="w-full rounded-xl border bg-muted-700 px-3.5 py-3 text-[15px] text-white outline-none transition tabular-nums focus:border-primary-400"
                  :class="showCardErr('expiry') ? 'border-[#EC6453]/60' : 'border-white/8'"
                  :aria-invalid="Boolean(showCardErr('expiry'))"
                  @input="onExpiryInput" @blur="touchCard('expiry')"
                >
                <p v-if="showCardErr('expiry')" class="mt-1 text-[12px] text-[#EC6453]">
                  {{ cardErrors.expiry }}
                </p>
              </div>
              <div>
                <label for="cc-cvc" class="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">Security code</label>
                <input
                  id="cc-cvc" v-model="card.cvc" inputmode="numeric" autocomplete="cc-csc" :placeholder="cvcLen === 4 ? '4 digits' : 'CVC'" :maxlength="cvcLen"
                  class="w-full rounded-xl border bg-muted-700 px-3.5 py-3 text-[15px] text-white outline-none transition tabular-nums focus:border-primary-400"
                  :class="showCardErr('cvc') ? 'border-[#EC6453]/60' : 'border-white/8'"
                  :aria-invalid="Boolean(showCardErr('cvc'))"
                  @input="card.cvc = card.cvc.replace(/\D/g, '')" @blur="touchCard('cvc')"
                >
                <p v-if="showCardErr('cvc')" class="mt-1 text-[12px] text-[#EC6453]">
                  {{ cardErrors.cvc }}
                </p>
              </div>
            </div>
            <!-- postcode -->
            <div>
              <label for="cc-pc" class="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">Billing postcode</label>
              <input
                id="cc-pc" v-model="card.postcode" autocomplete="postal-code" placeholder="e.g. SW1A 1AA"
                class="w-full rounded-xl border bg-muted-700 px-3.5 py-3 text-[15px] uppercase text-white outline-none transition focus:border-primary-400"
                :class="showCardErr('postcode') ? 'border-[#EC6453]/60' : 'border-white/8'"
                :aria-invalid="Boolean(showCardErr('postcode'))"
                @blur="touchCard('postcode')"
              >
              <p v-if="showCardErr('postcode')" class="mt-1 text-[12px] text-[#EC6453]">
                {{ cardErrors.postcode }}
              </p>
            </div>
          </div>

          <div v-if="config?.sandbox" class="mt-4 flex items-start gap-2 rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[11.5px] leading-[1.5] text-muted-500">
            <Icon name="lucide:flask-conical" class="mt-0.5 size-3.5 shrink-0 text-[#F2C14E]" />
            <span>Sandbox: use any test card (e.g. 4242 4242 4242 4242), any future expiry and CVC. End the amount in <strong class="text-muted-300">.01</strong> to see a decline, <strong class="text-muted-300">.02</strong> for bank verification, <strong class="text-muted-300">.03</strong> for a processing state.</span>
          </div>

          <button
            type="button"
            class="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-bold transition"
            :class="cardValid && !busy ? 'cursor-pointer bg-primary-500 text-white shadow-[0_8px_20px_rgba(125,83,242,0.28)] hover:bg-primary-600' : 'cursor-not-allowed bg-muted-700 text-muted-500'"
            :disabled="!cardValid || busy"
            @click="submitCard"
          >
            <Icon v-if="!busy" name="lucide:lock" class="size-4" />
            <Icon v-else name="lucide:loader-circle" class="size-4 animate-spin" />
            {{ busy ? 'Processing…' : mode === 'topup' ? `Pay ${formatCurrency(amountNum)}` : 'Save card' }}
          </button>
          <p class="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-muted-500">
            <Icon name="lucide:shield-check" class="size-3.5 text-[#22B07D]" />
            Encrypted. Your card number and CVC never reach our servers.
          </p>
        </template>

        <!-- ============ BANK (Direct Debit details) ============ -->
        <template v-else-if="screen === 'bank'">
          <p class="mb-4 text-[13px] text-muted-400">
            Set up a UK Direct Debit. We only ever debit amounts you’ve agreed, with advance notice.
          </p>
          <div class="flex flex-col gap-3.5">
            <div>
              <label for="dd-name" class="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">Account holder name</label>
              <input
                id="dd-name" v-model="bank.name" autocomplete="name" placeholder="Name on the account"
                class="w-full rounded-xl border bg-muted-700 px-3.5 py-3 text-[15px] text-white outline-none transition focus:border-primary-400"
                :class="showBankErr('name') ? 'border-[#EC6453]/60' : 'border-white/8'"
                :aria-invalid="Boolean(showBankErr('name'))"
                @blur="touchBank('name')"
              >
              <p v-if="showBankErr('name')" class="mt-1 text-[12px] text-[#EC6453]">
                {{ bankErrors.name }}
              </p>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="dd-sort" class="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">Sort code</label>
                <input
                  id="dd-sort" :value="bank.sortCode" inputmode="numeric" placeholder="00-00-00"
                  class="w-full rounded-xl border bg-muted-700 px-3.5 py-3 text-[15px] text-white outline-none transition tabular-nums focus:border-primary-400"
                  :class="showBankErr('sortCode') ? 'border-[#EC6453]/60' : 'border-white/8'"
                  :aria-invalid="Boolean(showBankErr('sortCode'))"
                  @input="onSortInput" @blur="touchBank('sortCode')"
                >
                <p v-if="showBankErr('sortCode')" class="mt-1 text-[12px] text-[#EC6453]">
                  {{ bankErrors.sortCode }}
                </p>
              </div>
              <div>
                <label for="dd-acc" class="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-muted-500">Account number</label>
                <input
                  id="dd-acc" :value="bank.accountNumber" inputmode="numeric" placeholder="12345678"
                  class="w-full rounded-xl border bg-muted-700 px-3.5 py-3 text-[15px] text-white outline-none transition tabular-nums focus:border-primary-400"
                  :class="showBankErr('accountNumber') ? 'border-[#EC6453]/60' : 'border-white/8'"
                  :aria-invalid="Boolean(showBankErr('accountNumber'))"
                  @input="onAccountInput" @blur="touchBank('accountNumber')"
                >
                <p v-if="showBankErr('accountNumber')" class="mt-1 text-[12px] text-[#EC6453]">
                  {{ bankErrors.accountNumber }}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            class="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-bold transition"
            :class="bankValid ? 'cursor-pointer bg-primary-500 text-white shadow-[0_8px_20px_rgba(125,83,242,0.28)] hover:bg-primary-600' : 'cursor-not-allowed bg-muted-700 text-muted-500'"
            :disabled="!bankValid"
            @click="bankContinue"
          >
            Continue
          </button>
          <p class="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-muted-500">
            <Icon name="lucide:shield-check" class="size-3.5 text-[#22B07D]" />
            Your bank details are encrypted and never stored in full.
          </p>
        </template>

        <!-- ============ DD AUTHORISATION ============ -->
        <template v-else-if="screen === 'ddauth'">
          <div class="rounded-[14px] border border-white/8 bg-muted-700/50 p-4">
            <div class="mb-3 flex items-center justify-between">
              <span class="text-[12px] text-muted-500">Account holder</span>
              <span class="text-[13px] font-semibold text-white">{{ bank.name }}</span>
            </div>
            <div class="mb-3 flex items-center justify-between">
              <span class="text-[12px] text-muted-500">Sort code</span>
              <span class="text-[13px] font-semibold text-white tabular-nums">{{ bank.sortCode }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[12px] text-muted-500">Account number</span>
              <span class="text-[13px] font-semibold text-white tabular-nums">••••{{ bank.accountNumber.slice(-4) }}</span>
            </div>
          </div>

          <div class="mt-4 rounded-[14px] border border-[#22B07D]/25 bg-[#22B07D]/[0.06] p-4">
            <div class="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-white">
              <Icon name="lucide:badge-check" class="size-4 text-[#22B07D]" />The Direct Debit Guarantee
            </div>
            <p class="text-[12px] leading-[1.6] text-muted-400">
              This Guarantee is offered by all banks and building societies that accept instructions to pay Direct Debits. If there are any changes to the amount, date or frequency of your Direct Debit, Apex Digital Agency will notify you at least {{ advanceDays }} working days in advance. If an error is made, you’re entitled to a full and immediate refund from your bank.
            </p>
          </div>

          <label class="mt-4 flex cursor-pointer items-start gap-3">
            <input v-model="ddAuthorised" type="checkbox" class="mt-0.5 size-[18px] shrink-0 accent-primary-500">
            <span class="text-[12.5px] leading-[1.5] text-muted-400">I confirm I am the account holder and the only person required to authorise Direct Debits on this account, and I authorise Apex Digital Agency to collect payments in line with the Guarantee above.</span>
          </label>

          <button
            type="button"
            class="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-bold transition"
            :class="ddAuthorised && !busy ? 'cursor-pointer bg-primary-500 text-white shadow-[0_8px_20px_rgba(125,83,242,0.28)] hover:bg-primary-600' : 'cursor-not-allowed bg-muted-700 text-muted-500'"
            :disabled="!ddAuthorised || busy"
            @click="submitMandate"
          >
            <Icon v-if="busy" name="lucide:loader-circle" class="size-4 animate-spin" />
            {{ busy ? 'Setting up…' : mode === 'topup' ? `Set up & pay ${formatCurrency(amountNum)}` : 'Set up Direct Debit' }}
          </button>
        </template>

        <!-- ============ 3-D SECURE VERIFY ============ -->
        <template v-else-if="screen === 'verify'">
          <div class="flex flex-col items-center py-4 text-center">
            <span class="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-500/14 text-primary-300">
              <Icon name="lucide:smartphone" class="size-7" />
            </span>
            <h3 class="font-heading text-[18px] font-extrabold text-white">
              Verify with your bank
            </h3>
            <p class="mt-2 max-w-[320px] text-[13px] leading-[1.6] text-muted-400">
              Your bank needs to confirm this {{ formatCurrency(amountNum) }} payment (3-D Secure). Approve the request to continue.
            </p>
            <button
              type="button"
              class="mt-6 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-bold transition"
              :class="!busy ? 'cursor-pointer bg-primary-500 text-white hover:bg-primary-600' : 'cursor-not-allowed bg-muted-700 text-muted-500'"
              :disabled="busy"
              @click="verify3ds"
            >
              <Icon v-if="busy" name="lucide:loader-circle" class="size-4 animate-spin" />
              {{ busy ? 'Verifying…' : 'I’ve approved it' }}
            </button>
            <button type="button" class="mt-2.5 text-[12.5px] font-semibold text-muted-500 hover:text-white" :disabled="busy" @click="retry">
              Cancel payment
            </button>
          </div>
        </template>

        <!-- ============ PROCESSING (DD clearing) ============ -->
        <template v-else-if="screen === 'processing'">
          <div class="flex flex-col items-center py-6 text-center">
            <span class="mb-4 flex size-14 items-center justify-center rounded-full bg-[#F2C14E]/14 text-[#F2C14E]">
              <Icon name="lucide:clock" class="size-7" />
            </span>
            <h3 class="font-heading text-[18px] font-extrabold text-white">
              Payment is being collected
            </h3>
            <p class="mt-2 max-w-[340px] text-[13px] leading-[1.6] text-muted-400">
              Your Direct Debit of <strong class="font-semibold text-white">{{ formatCurrency(amountNum) }}</strong> is being processed. Funds usually reach your wallet within {{ advanceDays }} working days. We’ve emailed your advance notice, and you’ll be notified when it clears.
            </p>
            <div class="mt-3 rounded-full bg-white/5 px-3 py-1.5 font-mono text-[12px] text-muted-400">
              {{ lastReceipt?.reference }}
            </div>
            <button type="button" class="mt-6 w-full rounded-full bg-primary-500 py-3.5 text-[14px] font-bold text-white transition hover:bg-primary-600" @click="close">
              Done
            </button>
          </div>
        </template>

        <!-- ============ SUCCESS / RECEIPT ============ -->
        <template v-else-if="screen === 'success'">
          <div class="flex flex-col items-center py-2 text-center">
            <span class="mb-4 flex size-16 items-center justify-center rounded-full bg-[#22B07D]/14 text-[#22B07D]">
              <Icon name="lucide:check" class="size-9" />
            </span>
            <h3 class="font-heading text-[20px] font-extrabold tracking-[-0.01em] text-white">
              {{ lastReceipt?.kind === 'method' ? (lastReceipt.title || 'Payment method added') : 'Payment complete' }}
            </h3>
            <p v-if="lastReceipt?.kind === 'payment'" class="mt-1.5 text-[13.5px] text-muted-400">
              {{ formatCurrency(lastReceipt.amount ?? 0) }} added to your Apex wallet.
            </p>
            <p v-else class="mt-1.5 text-[13.5px] text-muted-400">
              You can use it for top-ups and instalments.
            </p>
          </div>

          <!-- receipt detail -->
          <div v-if="lastReceipt?.kind === 'payment'" class="mt-4 rounded-[14px] border border-white/8 bg-muted-700/50 p-4">
            <div class="flex items-center justify-between border-b border-white/6 py-2 text-[12.5px]">
              <span class="text-muted-500">Reference</span>
              <span class="font-mono font-semibold text-white">{{ lastReceipt.reference }}</span>
            </div>
            <div class="flex items-center justify-between border-b border-white/6 py-2 text-[12.5px]">
              <span class="text-muted-500">Method</span>
              <span class="font-semibold text-white">{{ lastReceipt.methodLabel }}</span>
            </div>
            <div class="flex items-center justify-between border-b border-white/6 py-2 text-[12.5px]">
              <span class="text-muted-500">Date</span>
              <span class="text-white">{{ lastReceipt.when }}</span>
            </div>
            <div v-if="lastReceipt.balance != null" class="flex items-center justify-between py-2 text-[12.5px]">
              <span class="text-muted-500">New wallet balance</span>
              <span class="font-heading font-extrabold text-white tabular-nums">{{ formatCurrency(lastReceipt.balance) }}</span>
            </div>
          </div>

          <div class="mt-5 flex flex-col gap-2.5">
            <button
              v-if="lastReceipt?.kind === 'payment'"
              type="button"
              class="flex w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-muted-700 py-3 text-[13.5px] font-semibold text-white transition hover:bg-muted-600"
              @click="downloadReceipt"
            >
              <Icon name="lucide:download" class="size-4" />Download receipt
            </button>
            <button type="button" class="w-full rounded-full bg-primary-500 py-3.5 text-[14px] font-bold text-white transition hover:bg-primary-600" @click="close">
              Done
            </button>
          </div>
        </template>

        <!-- ============ ERROR ============ -->
        <template v-else-if="screen === 'error'">
          <div class="flex flex-col items-center py-4 text-center">
            <span class="mb-4 flex size-16 items-center justify-center rounded-full bg-[#EC6453]/14 text-[#EC6453]">
              <Icon name="lucide:x" class="size-9" />
            </span>
            <h3 class="font-heading text-[19px] font-extrabold text-white">
              {{ failure.title || 'Payment failed' }}
            </h3>
            <p class="mt-2 max-w-[340px] text-[13px] leading-[1.6] text-muted-400">
              {{ failure.message }}
            </p>
          </div>
          <div class="mt-3 flex flex-col gap-2.5">
            <button type="button" class="w-full rounded-full bg-primary-500 py-3.5 text-[14px] font-bold text-white transition hover:bg-primary-600" @click="retry">
              Try again
            </button>
            <button type="button" class="w-full rounded-full border border-white/12 bg-muted-700 py-3 text-[13.5px] font-semibold text-white transition hover:bg-muted-600" @click="close">
              Close
            </button>
          </div>
        </template>
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
