<script setup lang="ts">
/**
 * Settings — Apex Design V2, Phase 7.
 *
 * Four sections down a vertical sub-nav: Profile (the person), Company (the
 * business), Security (credentials), Billing (what goes on a receipt).
 *
 * The rule this page is built on: **only render a field the API round-trips.**
 * The previous version collected a preferred name, family status, birthday,
 * gender, a legal address, socials and a bio, but `onMounted` read back only
 * `city` and `country` — so those fields came back blank on reload and the
 * next save overwrote whatever had been stored. Everything rendered here is
 * returned by GET /api/settings/get-all and persisted by PUT
 * /api/settings/update-all; anything else is deliberately absent.
 *
 * Omitting a field is safe, not destructive: `update-all` writes each column
 * with `?? undefined`, which Prisma skips, so the values this page no longer
 * shows (bio, gender, coverImage, city, country, and the CRM fields below)
 * keep whatever they already hold.
 *
 * Not offered here, because the backing data does not exist (TODO(api)):
 *  - Company number, trading name and a structured UK address (line 1/2, town,
 *    county, postcode). `Company` has one free-text `address` column, so the
 *    registered office is one field. Rendering separate boxes for numbers we
 *    cannot store would recreate the exact write-then-lose bug above.
 *  - Avatar and company-logo upload. There is no upload endpoint, and the old
 *    base64 path did not merely bloat the request — `avatar` is capped at 500
 *    characters by the endpoint's schema, so any real photo made the *entire*
 *    settings save fail with a 400. Initials are used until
 *    `POST /api/settings/avatar` exists.
 *  - A device/session list and two-factor auth. Both are stated as pending
 *    rather than mocked; the previous page invented a MacBook in New York and
 *    wired its revoke button to an empty function.
 *
 * Income, employee count, account manager and company status were removed from
 * customer control — they are internal CRM fields, and a customer could set
 * their own account to Inactive or pick who managed them. They belong to the
 * admin customer view.
 */
definePageMeta({
  title: 'Settings',
  layout: 'sidenav',
  middleware: 'auth',
})

const toaster = useNuiToasts()

// ---- data -------------------------------------------------------------------
// `useFetch`, like every other page: SSR'd, with a `pending` flag to render a
// skeleton from. The old page used `onMounted` + `$fetch`, which guaranteed a
// flash of empty inputs on every visit.
const { data: settings, pending, refresh } = await useFetch<any>('/api/settings/get-all', { lazy: true })

const account = computed(() => (settings.value as any)?.user ?? null)

// ---- sections ---------------------------------------------------------------
type SectionKey = 'profile' | 'company' | 'security' | 'billing'

const SECTIONS: { key: SectionKey, label: string, icon: string }[] = [
  { key: 'profile', label: 'Profile', icon: 'lucide:user' },
  { key: 'company', label: 'Company', icon: 'lucide:building-2' },
  { key: 'security', label: 'Security', icon: 'lucide:shield' },
  { key: 'billing', label: 'Billing', icon: 'lucide:receipt' },
]

// Profile, not Company: someone opening Settings is looking for their own
// details first. The labels are explicit rather than `capitalize`d off the
// keys, which used to render the first tab as "general".
const section = ref<SectionKey>('profile')

// ---- business types ---------------------------------------------------------
/**
 * UK legal forms. The previous list — Solo / Small Company (LLC) / Medium
 * Company (Corp) / Bigger Company — was US-flavoured size bands, and "LLC" is
 * not a thing in UK law. Stored in the existing free-text `Company.type`
 * column, so this needs no migration.
 */
const BUSINESS_TYPES = [
  { key: 'ltd', label: 'Private limited company (Ltd)' },
  { key: 'plc', label: 'Public limited company (PLC)' },
  { key: 'llp', label: 'Limited liability partnership (LLP)' },
  { key: 'cic', label: 'Community interest company (CIC)' },
  { key: 'charity', label: 'Charity' },
  { key: 'sole', label: 'Sole trader' },
  { key: 'partnership', label: 'Partnership' },
] as const

/** Types registered at Companies House — they have a registered office. */
const INCORPORATED = new Set(['ltd', 'plc', 'llp', 'cic', 'charity'])

// ---- form -------------------------------------------------------------------
// One object for everything PUT /api/settings/update-all accepts, so dirty
// tracking is a single comparison. Email is not here: the endpoint documents
// that changing the login identity needs verification, so it is shown
// read-only rather than offered as an input that silently does nothing.
const form = reactive({
  firstName: '',
  lastName: '',
  phone: '',
  companyName: '',
  companyType: '',
  companyWebsite: '',
  companyEmail: '',
  companyPhone: '',
  companyAddress: '',
  companyNotes: '',
  vatNumber: '',
})

/** Serialised copy of the last loaded values — the baseline for dirty/discard. */
const baseline = ref('')

function hydrate() {
  const u = account.value
  if (!u)
    return
  form.firstName = u.firstName || ''
  form.lastName = u.lastName || ''
  form.phone = u.phone || ''

  const c = u.company
  form.companyName = c?.name || ''
  // Legacy rows hold the old size bands; an unrecognised value becomes empty
  // so the control shows its placeholder instead of answering for the customer.
  form.companyType = BUSINESS_TYPES.some(t => t.key === c?.type) ? c!.type : ''
  form.companyWebsite = c?.website || ''
  form.companyEmail = c?.email || ''
  form.companyPhone = c?.phone || ''
  form.companyAddress = c?.address || ''
  form.companyNotes = c?.notes || ''
  form.vatNumber = c?.taxId || ''

  baseline.value = JSON.stringify(form)
}

watch(account, hydrate, { immediate: true })

const isDirty = computed(() => baseline.value !== '' && JSON.stringify(form) !== baseline.value)

function discard() {
  hydrate()
  toaster.add({ title: 'Changes discarded', description: 'The form is back to your saved details.', icon: 'lucide:undo-2', progress: true })
}

const isIncorporated = computed(() => INCORPORATED.has(form.companyType))

/**
 * The address heading follows the legal form: a sole trader has no registered
 * office, so asking for one asks for something that cannot exist. Same field
 * either way — only the label and hint change.
 */
const addressLabel = computed(() => (isIncorporated.value ? 'Registered office address' : 'Business address'))
const addressHint = computed(() =>
  isIncorporated.value
    ? 'The address on your Companies House record. It is often your accountant\'s, and may differ from where you work.'
    : 'Where your business operates. Used on contracts and receipts.',
)

// ---- VAT number -------------------------------------------------------------
/** GB VAT: 9 digits, 12 for a branch, or GD/HA + 3 for government and health bodies. */
const VAT_RE = /^GB(?:\d{9}|\d{12}|GD\d{3}|HA\d{3})$/

const vatNormalised = computed(() => form.vatNumber.replace(/\s+/g, '').toUpperCase())

/**
 * Format check only — this says the number is *shaped* like a GB VAT number,
 * never that it is registered. Claiming the latter would need HMRC's API.
 */
const vatState = computed<'empty' | 'valid' | 'invalid'>(() => {
  if (!form.vatNumber.trim())
    return 'empty'
  return VAT_RE.test(vatNormalised.value) ? 'valid' : 'invalid'
})

const vatMessage = computed(() => {
  if (vatState.value === 'empty')
    return 'Leave blank if you\'re not VAT registered.'
  if (vatState.value === 'valid')
    return 'Valid format.'
  if (!vatNormalised.value.startsWith('GB'))
    return 'A GB VAT number starts with GB — for example GB123456789.'
  return 'Expected GB followed by 9 digits (12 for a branch).'
})

function onVatInput() {
  form.vatNumber = form.vatNumber.toUpperCase()
}

// ---- save -------------------------------------------------------------------
const saving = ref(false)

async function saveAll() {
  if (!isDirty.value || saving.value)
    return
  saving.value = true
  try {
    await $fetch('/api/settings/update-all', {
      method: 'PUT',
      body: {
        // `role` is deliberately not sent. A client must never be able to
        // submit its own role, and the endpoint would ignore it anyway.
        user: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
        },
        company: {
          name: form.companyName.trim(),
          type: form.companyType,
          website: form.companyWebsite.trim(),
          email: form.companyEmail.trim(),
          phone: form.companyPhone.trim(),
          address: form.companyAddress.trim(),
          notes: form.companyNotes.trim(),
          taxId: vatNormalised.value,
        },
      },
    })
    await refresh()
    toaster.add({ title: 'Settings saved', description: 'Your details are up to date.', icon: 'lucide:check', progress: true })
  }
  catch (error: any) {
    toaster.add({
      title: 'Could not save settings',
      description: error?.data?.message || error?.statusMessage || 'Please try again.',
      icon: 'lucide:alert-triangle',
      progress: true,
    })
  }
  finally {
    saving.value = false
  }
}

// ---- password ---------------------------------------------------------------
/**
 * Its own form and its own button. The old page posted the profile first and
 * only then compared the two password fields, so a typo in "confirm" produced
 * an error toast on a save that had already partly succeeded. Everything here
 * validates before any request is made.
 */
const pwForm = reactive({ current: '', next: '', confirm: '' })
const pwError = ref('')
const pwSaving = ref(false)

/**
 * One password policy across signup, reset and here (V2 Phase 8). The APIs
 * still accept 8 (signup/reset) and 6 (this endpoint) — a stricter client is
 * always compatible, and raising a server minimum would lock out accounts
 * that already exist.
 */
const PW_MIN = 10

const pwScore = computed(() => {
  const v = pwForm.next
  if (!v)
    return 0
  let score = 0
  if (v.length >= PW_MIN)
    score++
  if (v.length >= 12)
    score++
  if (/[a-z]/.test(v) && /[A-Z]/.test(v))
    score++
  if (/\d/.test(v) && /[^\w\s]/.test(v))
    score++
  return score
})

const PW_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const
const pwLabel = computed(() => PW_LABELS[pwScore.value] ?? '')
const pwTone = computed(() => {
  if (pwScore.value <= 1)
    return { bar: 'bg-[#EC6453]', text: 'text-[#EC6453]' }
  if (pwScore.value === 2)
    return { bar: 'bg-[#F2C14E]', text: 'text-[#F2C14E]' }
  if (pwScore.value === 3)
    return { bar: 'bg-primary-400', text: 'text-primary-400' }
  return { bar: 'bg-[#22B07D]', text: 'text-[#22B07D]' }
})

async function updatePassword() {
  pwError.value = ''
  if (!pwForm.current) {
    pwError.value = 'Enter your current password.'
    return
  }
  if (pwForm.next.length < PW_MIN) {
    pwError.value = `Your new password needs at least ${PW_MIN} characters.`
    return
  }
  if (pwForm.next === pwForm.current) {
    pwError.value = 'The new password must be different from your current one.'
    return
  }
  if (pwForm.next !== pwForm.confirm) {
    pwError.value = 'The two new password fields don\'t match.'
    return
  }

  pwSaving.value = true
  try {
    await $fetch('/api/settings/password', {
      method: 'POST',
      body: { currentPassword: pwForm.current, newPassword: pwForm.next },
    })
    pwForm.current = ''
    pwForm.next = ''
    pwForm.confirm = ''
    toaster.add({ title: 'Password updated', description: 'Use your new password next time you sign in.', icon: 'lucide:check', progress: true })
  }
  catch (error: any) {
    pwError.value = error?.data?.message || error?.statusMessage || 'Could not update your password. Please try again.'
  }
  finally {
    pwSaving.value = false
  }
}

// ---- this device ------------------------------------------------------------
/**
 * There is no session store, so this describes the browser you are using right
 * now and nothing else. It resolves in `onMounted` because it reads
 * `navigator`: anything derived from the browser during SSR mismatches on
 * hydration (the shell's ⌘/Ctrl hint learned that the hard way).
 */
const thisDevice = ref('This browser')

onMounted(() => {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Safari\//.test(ua)
        ? 'Safari'
        : /Firefox\//.test(ua) ? 'Firefox' : 'Your browser'
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua) ? 'iOS' : 'this device'
  thisDevice.value = `${browser} on ${os}`
})

// ---- display ----------------------------------------------------------------
const fullName = computed(() => {
  const name = `${form.firstName} ${form.lastName}`.trim()
  return name || account.value?.email || 'Your account'
})

/**
 * Initials, never a stock photograph. The old fallback was
 * `https://i.pravatar.cc/150?u=101` — a real, random person's face presented
 * as the customer's own account, fetched from a third party on every load.
 */
const initials = computed(() => {
  const a = (form.firstName || '').trim()[0] || ''
  const b = (form.lastName || '').trim()[0] || ''
  const pair = `${a}${b}`.toUpperCase()
  return pair || (account.value?.email || '?').slice(0, 2).toUpperCase()
})

const companyInitials = computed(() => {
  const words = form.companyName.trim().split(/\s+/).filter(Boolean)
  if (!words.length)
    return '—'
  return words.slice(0, 2).map(w => w[0]!.toUpperCase()).join('')
})

const accountType = computed(() => (account.value?.role === 'ADMIN' ? 'Admin account' : 'Client account'))

/** Where receipts are sent — derived, never a second stored copy. */
const receiptEmail = computed(() => form.companyEmail.trim() || account.value?.email || '')

const INPUT_CLASS
  = 'apex-focus w-full rounded-xl border border-white/8 bg-muted-700 px-3.5 py-3 text-sm text-white outline-none placeholder:text-muted-500 focus:border-primary-400'
const LABEL_CLASS = 'mb-2 block text-[12.5px] font-semibold text-white'
</script>

<template>
  <div class="mx-auto flex max-w-[1180px] flex-col gap-7 md:gap-8">
    <ApexPageHeader
      title="Account"
      accent="settings"
      subtitle="Your details, your company record and how you sign in."
    >
      <template #actions>
        <!--
          A light/dark token pair, not a forced `text-white!`: BaseButton's own
          background is white in light mode, so white text on it disappears
          entirely. The rest of this page sits on `muted-800`, which is dark in
          both themes, but a control with its own surface needs both halves.
        -->
        <BaseButton
          rounded="full"
          class="apex-focus h-12! flex-1 border-muted-300! dark:border-white/8! bg-muted-100! dark:bg-muted-800! text-muted-700! dark:text-white! border px-5 sm:h-11! sm:flex-none"
          :disabled="!isDirty || saving"
          @click="discard"
        >
          Discard
        </BaseButton>
        <!--
          Disabled until something actually changed. The old button was always
          live, so "Save Changes" on an untouched form fired a PUT and a success
          toast for nothing.
        -->
        <BaseButton
          rounded="full"
          variant="primary"
          class="h-12! flex-1 px-6 shadow-[0_10px_24px_rgba(125,83,242,0.32)] sm:h-11! sm:flex-none"
          :disabled="!isDirty || saving"
          @click="saveAll"
        >
          <Icon v-if="saving" name="lucide:loader-2" class="size-4 animate-spin" />
          <Icon v-else name="lucide:check" class="size-4" />
          <span>{{ saving ? 'Saving…' : 'Save changes' }}</span>
        </BaseButton>
      </template>
    </ApexPageHeader>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
      <!-- ============================================================ SUB-NAV -->
      <nav aria-label="Settings sections" class="lg:sticky lg:top-6 lg:self-start">
        <ul class="flex gap-1 overflow-x-auto rounded-2xl border border-white/8 bg-muted-800 p-2 lg:flex-col lg:overflow-visible">
          <li v-for="s in SECTIONS" :key="s.key" class="shrink-0 lg:w-full">
            <button
              type="button"
              :aria-current="section === s.key ? 'page' : undefined"
              class="apex-focus flex min-h-11 w-full items-center gap-3 whitespace-nowrap rounded-xl px-3.5 text-[14.5px] transition-colors"
              :class="section === s.key
                ? 'apex-nav-active font-semibold text-white'
                : 'font-medium text-muted-400 hover:bg-muted-700/60 hover:text-white'"
              @click="section = s.key"
            >
              <Icon :name="s.icon" class="size-[18px] shrink-0" :class="section === s.key ? 'text-white' : 'text-muted-500'" />
              <span>{{ s.label }}</span>
            </button>
          </li>
        </ul>
      </nav>

      <!-- ============================================================ PANELS -->
      <div class="min-w-0 flex flex-col gap-5">
        <!-- loading skeleton — the old page rendered empty inputs first -->
        <div v-if="pending && !account" class="flex flex-col gap-5">
          <div v-for="n in 2" :key="n" class="rounded-2xl border border-white/8 bg-muted-800 p-6">
            <div class="h-4 w-32 animate-pulse rounded bg-muted-700" />
            <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div v-for="i in 4" :key="i" class="h-[70px] animate-pulse rounded-xl bg-muted-700" />
            </div>
          </div>
        </div>

        <!-- ======================================================== PROFILE -->
        <template v-else-if="section === 'profile'">
          <section class="apex-rise rounded-2xl border border-white/8 bg-muted-800 p-6">
            <ApexSectionLabel label="Your profile" />
            <!--
              One identity row, not a social-network header. The page used to
              open with a 288px cover photo and a 144px avatar carrying a
              verified tick and a pulsing status dot — none of it editable, and
              none of it any help to someone updating a phone number.
            -->
            <div class="mt-5 flex flex-wrap items-center gap-4">
              <span class="inline-flex size-[72px] shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-white" style="background: linear-gradient(135deg, #9B79F6, #6C40E8);">
                {{ initials }}
              </span>
              <div class="min-w-0">
                <div class="font-heading truncate text-lg font-bold text-white">
                  {{ fullName }}
                </div>
                <div class="mt-0.5 text-[13px] text-muted-500">
                  {{ accountType }}
                </div>
              </div>
            </div>
            <!--
              No upload control: there is no avatar endpoint, and the old base64
              path exceeded the field's 500-character cap, which failed the
              whole save. A disabled button would be the dead end Phase 5
              removed from the credit card, so this states the position instead.
            -->
            <p class="mt-4 rounded-xl border border-white/8 bg-muted-700 px-3.5 py-3 text-[12.5px] leading-relaxed text-muted-400">
              Your initials stand in for a photo. Profile photo uploads arrive alongside file attachments in support.
            </p>

            <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label for="set-first" :class="LABEL_CLASS">First name</label>
                <input id="set-first" v-model="form.firstName" :class="INPUT_CLASS" placeholder="Jane" autocomplete="given-name">
              </div>
              <div>
                <label for="set-last" :class="LABEL_CLASS">Last name</label>
                <input id="set-last" v-model="form.lastName" :class="INPUT_CLASS" placeholder="Okafor" autocomplete="family-name">
              </div>
              <div>
                <label for="set-phone" :class="LABEL_CLASS">Phone</label>
                <input id="set-phone" v-model="form.phone" :class="INPUT_CLASS" placeholder="07700 900123" autocomplete="tel" inputmode="tel">
              </div>
              <div>
                <label for="set-email" :class="LABEL_CLASS">Email</label>
                <!--
                  Read-only on purpose: `update-all` documents that changing the
                  login identity needs verification, so an editable box here
                  would accept a change it never applies.
                -->
                <input id="set-email" :value="account?.email || ''" readonly class="cursor-not-allowed text-muted-400" :class="[INPUT_CLASS]">
                <span class="mt-1.5 block text-[11.5px] text-muted-500">Your sign-in address. <NuxtLink to="/dashboards/support" class="font-semibold text-primary-400 hover:text-primary-300">Ask support</NuxtLink> to change it — we verify the new address first.</span>
              </div>
            </div>
          </section>
        </template>

        <!-- ======================================================== COMPANY -->
        <template v-else-if="section === 'company'">
          <section class="apex-rise rounded-2xl border border-white/8 bg-muted-800 p-6">
            <ApexSectionLabel label="Company identity" />
            <div class="mt-5 flex flex-wrap items-center gap-4">
              <span class="inline-flex size-[52px] shrink-0 items-center justify-center rounded-xl border border-white/8 bg-muted-700 text-sm font-extrabold text-primary-400">
                {{ companyInitials }}
              </span>
              <p class="min-w-0 flex-1 text-[12.5px] leading-relaxed text-muted-400">
                Used on your contracts and receipts. Enter the name exactly as it is registered, including <span class="text-white">Ltd</span> or <span class="text-white">Limited</span>.
              </p>
            </div>

            <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="sm:col-span-2">
                <label for="set-cname" :class="LABEL_CLASS">Registered company name</label>
                <input id="set-cname" v-model="form.companyName" :class="INPUT_CLASS" placeholder="Riverside Studios Ltd" autocomplete="organization">
              </div>
              <div>
                <!-- Labels a listbox trigger, not an input, so the control owns
                     its accessible name. -->
                <span :class="LABEL_CLASS">Business type</span>
                <!--
                  `placeholder`, not a `value=""` item: the underlying listbox
                  reserves the empty string for "no selection", so an empty
                  option renders as a blank trigger. Same reason New Order
                  (Phase 3) uses the prop — and, as there, an untouched control
                  must not answer for the customer.
                -->
                <BaseSelect
                  v-model="form.companyType"
                  aria-label="Business type"
                  placeholder="Select a type"
                  rounded="lg"
                  size="lg"
                  class="bg-muted-700! h-11! w-full! rounded-xl! border-white/8! text-white!"
                  :classes="{ text: 'text-sm' }"
                >
                  <BaseSelectItem v-for="t in BUSINESS_TYPES" :key="t.key" :value="t.key">
                    {{ t.label }}
                  </BaseSelectItem>
                </BaseSelect>
              </div>
              <div>
                <label for="set-cweb" :class="LABEL_CLASS">Website <span class="font-normal text-muted-500">(optional)</span></label>
                <input id="set-cweb" v-model="form.companyWebsite" :class="INPUT_CLASS" placeholder="riversidestudios.co.uk" inputmode="url">
              </div>
            </div>
          </section>

          <section class="apex-rise rounded-2xl border border-white/8 bg-muted-800 p-6">
            <ApexSectionLabel :label="addressLabel" />
            <p class="mt-3 text-[12.5px] leading-relaxed text-muted-400">
              {{ addressHint }}
            </p>
            <label for="set-caddr" class="sr-only">{{ addressLabel }}</label>
            <!--
              One field, because `Company` has one free-text `address` column.
              Separate line 1 / line 2 / town / county / postcode boxes would
              look right and store nothing — see the TODO(api) at the top.
            -->
            <textarea
              id="set-caddr" v-model="form.companyAddress" rows="3"
              class="mt-4 resize-y leading-[1.55]" :class="[INPUT_CLASS]"
              placeholder="Unit 7, Riverside Park&#10;Maidstone&#10;ME15 6RS"
            />
          </section>

          <section class="apex-rise rounded-2xl border border-white/8 bg-muted-800 p-6">
            <ApexSectionLabel label="Business contact" />
            <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label for="set-cemail" :class="LABEL_CLASS">Company email</label>
                <input id="set-cemail" v-model="form.companyEmail" :class="INPUT_CLASS" placeholder="hello@riversidestudios.co.uk" inputmode="email">
              </div>
              <div>
                <label for="set-cphone" :class="LABEL_CLASS">Company phone</label>
                <input id="set-cphone" v-model="form.companyPhone" :class="INPUT_CLASS" placeholder="020 7946 0100" inputmode="tel">
              </div>
              <div class="sm:col-span-2">
                <label for="set-cnotes" :class="LABEL_CLASS">Notes for your project team <span class="font-normal text-muted-500">(optional)</span></label>
                <textarea id="set-cnotes" v-model="form.companyNotes" rows="3" class="resize-y leading-[1.55]" :class="[INPUT_CLASS]" placeholder="Anything the team should know — brand guidelines, preferred contact hours, access details." />
              </div>
            </div>
          </section>
        </template>

        <!-- ======================================================= SECURITY -->
        <template v-else-if="section === 'security'">
          <section class="apex-rise rounded-2xl border border-white/8 bg-muted-800 p-6">
            <ApexSectionLabel label="Password" />
            <p class="mt-3 text-[12.5px] leading-relaxed text-muted-400">
              Choose something at least {{ PW_MIN }} characters long that you don't use anywhere else.
            </p>

            <div class="mt-5 flex max-w-[420px] flex-col gap-4">
              <div>
                <label for="pw-current" :class="LABEL_CLASS">Current password</label>
                <input id="pw-current" v-model="pwForm.current" type="password" autocomplete="current-password" :class="INPUT_CLASS" placeholder="••••••••">
              </div>
              <div>
                <label for="pw-new" :class="LABEL_CLASS">New password</label>
                <input id="pw-new" v-model="pwForm.next" type="password" autocomplete="new-password" :class="INPUT_CLASS" :placeholder="`At least ${PW_MIN} characters`">
                <div v-if="pwForm.next" class="mt-2 flex items-center gap-2.5">
                  <span class="h-1 flex-1 overflow-hidden rounded-full bg-muted-700">
                    <span class="block h-full rounded-full transition-all" :class="pwTone.bar" :style="{ width: `${(pwScore / 4) * 100}%` }" />
                  </span>
                  <span class="text-[11.5px] font-semibold" :class="pwTone.text">{{ pwLabel }}</span>
                </div>
              </div>
              <div>
                <label for="pw-confirm" :class="LABEL_CLASS">Confirm new password</label>
                <input id="pw-confirm" v-model="pwForm.confirm" type="password" autocomplete="new-password" :class="INPUT_CLASS" placeholder="Re-enter it">
              </div>

              <p v-if="pwError" role="alert" class="flex items-start gap-2 rounded-xl border border-[#EC6453]/30 bg-[#EC6453]/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#EC6453]">
                <Icon name="lucide:alert-triangle" class="mt-px size-4 shrink-0" />
                <span>{{ pwError }}</span>
              </p>

              <div>
                <BaseButton
                  rounded="full"
                  variant="primary"
                  class="h-11! px-6"
                  :disabled="pwSaving"
                  @click="updatePassword"
                >
                  <Icon v-if="pwSaving" name="lucide:loader-2" class="size-4 animate-spin" />
                  <span>{{ pwSaving ? 'Updating…' : 'Update password' }}</span>
                </BaseButton>
              </div>
            </div>
          </section>

          <section class="apex-rise rounded-2xl border border-white/8 bg-muted-800 p-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0 max-w-[560px]">
                <div class="font-heading text-base font-bold text-white">
                  Two-factor authentication
                </div>
                <p class="mt-1.5 text-[12.5px] leading-relaxed text-muted-400">
                  A one-time code from your authenticator app when you sign in. Strongly recommended once you have a payment method on file.
                </p>
              </div>
              <!--
                A statement, not a switch. `securityForm.twoFactor` used to be
                posted on every save and read by nothing.
              -->
              <span class="inline-flex items-center rounded-full bg-muted-700 px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-muted-400">
                Coming soon
              </span>
            </div>
          </section>

          <section class="apex-rise rounded-2xl border border-white/8 bg-muted-800 p-6">
            <ApexSectionLabel label="Where you're signed in" />
            <!--
              The current browser and nothing else. This list used to be one
              hardcoded MacBook in New York on a private-range IP, with a revoke
              button wired to an empty function — fabricated security data is
              worse than none.
            -->
            <div class="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-muted-700 px-4 py-3.5">
              <Icon name="lucide:monitor" class="size-[18px] shrink-0 text-primary-400" />
              <span class="min-w-0 flex-1">
                <span class="block text-[13.5px] font-semibold text-white">This device</span>
                <span class="block text-[11.5px] text-muted-500">{{ thisDevice }} · signed in now</span>
              </span>
              <span class="inline-flex items-center rounded-full bg-[#22B07D]/14 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[#22B07D]">Current</span>
            </div>
            <p class="mt-3.5 text-[12.5px] leading-relaxed text-muted-400">
              We don't keep a device history yet, so we can't list your other sessions or sign them out from here. If you think someone else has your password, change it above and tell us in a support request.
            </p>
          </section>
        </template>

        <!-- ======================================================== BILLING -->
        <template v-else>
          <section class="apex-rise rounded-2xl border border-white/8 bg-muted-800 p-6">
            <ApexSectionLabel label="Tax details" />
            <div class="mt-5 max-w-[420px]">
              <label for="set-vat" :class="LABEL_CLASS">VAT number <span class="font-normal text-muted-500">(optional)</span></label>
              <input
                id="set-vat"
                v-model="form.vatNumber"
                :class="[
                  INPUT_CLASS,
                  vatState === 'valid' ? 'border-[#22B07D]/50!' : '',
                  vatState === 'invalid' ? 'border-[#EC6453]/50!' : '',
                ]"
                placeholder="GB123456789"
                :aria-invalid="vatState === 'invalid'"
                aria-describedby="set-vat-hint"
                @input="onVatInput"
              >
              <span
                id="set-vat-hint"
                class="mt-1.5 block text-[11.5px]"
                :class="vatState === 'valid' ? 'text-[#22B07D]' : vatState === 'invalid' ? 'text-[#EC6453]' : 'text-muted-500'"
              >{{ vatMessage }}</span>
            </div>
          </section>

          <section class="apex-rise rounded-2xl border border-white/8 bg-muted-800 p-6">
            <ApexSectionLabel label="What goes on your receipts" />
            <!--
              Both facts are derived from the Company tab rather than stored
              again here. A second copy is how a total and its parts end up
              disagreeing — the problem Phases 2 and 5 were mostly about.
            -->
            <dl class="mt-5 flex flex-col gap-4">
              <div>
                <dt class="text-[12.5px] font-semibold text-white">
                  Receipts are sent to
                </dt>
                <dd v-if="receiptEmail" class="mt-1 text-sm text-muted-400">
                  {{ receiptEmail }}
                </dd>
                <dd v-else class="mt-1 text-sm text-muted-400">
                  Your sign-in address.
                </dd>
              </div>
              <div>
                <dt class="text-[12.5px] font-semibold text-white">
                  Billing address
                </dt>
                <dd v-if="form.companyAddress.trim()" class="mt-1 whitespace-pre-line text-sm leading-[1.55] text-muted-400">
                  {{ form.companyAddress }}
                </dd>
                <dd v-else class="mt-1 text-sm text-muted-400">
                  Nothing on file yet.
                </dd>
              </div>
            </dl>
            <p class="mt-4 rounded-xl border border-white/8 bg-muted-700 px-3.5 py-3 text-[12.5px] leading-relaxed text-muted-400">
              Both come from your company record.
              <button type="button" class="apex-focus rounded font-semibold text-primary-400 hover:text-primary-300" @click="section = 'company'">
                Edit them under Company
              </button>.
            </p>
          </section>

          <section class="apex-rise flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/8 bg-muted-800 p-6">
            <div>
              <div class="font-heading text-base font-bold text-white">
                Payments, methods and receipts
              </div>
              <p class="mt-1 text-[13px] text-muted-400">
                Your balance, installment plans and every receipt live in one place.
              </p>
            </div>
            <!--
              One source of financial truth. This tab used to carry a single
              hardcoded `INV-001 · $29.00` row — dollars on a GBP product —
              duplicating the receipts list Phase 5 corrected on Wallet.
            -->
            <BaseButton to="/dashboards/wallet" rounded="full" variant="primary" class="h-11! px-6">
              <Icon name="lucide:wallet" class="size-4" />
              <span>Open Wallet &amp; credit</span>
            </BaseButton>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * The previous version redefined Tailwind's `.hidden` utility here as a
 * visually-hidden clip, which broke every `hidden md:block` on the page — the
 * elements stayed in the layout as 1px boxes. It also duplicated main.css's
 * scrollbar rules and set its own indigo focus shadow. All of that is gone;
 * `sr-only` covers the one visually-hidden label, and focus comes from the
 * shell's `.apex-focus`.
 */
.apex-rise {
  animation: apexRise 0.3s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
@keyframes apexRise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .apex-rise {
    animation: none;
  }
}
</style>
