<script setup lang="ts">
import { PASSWORD_MIN } from '~~/shared/password'

/**
 * Settings — Panel v2 (`Settings.dc.html`).
 *
 * Five sections — Profile, Business, Security, Notifications, Appearance —
 * as a sub-nav beside the panel from 760px of content, and as a hub of rows
 * that each open their own screen below that. `?section=` carries the open
 * section, as it did in V2 Phase 7 Mobile. The layout switch is a container
 * query, not a measured width, so the server renders the right one.
 *
 * Every control saves something real, or is not drawn as a control:
 *  - Profile saves the name and mobile. The sign-in email is shown but not
 *    editable: changing it needs a confirmation email and there is no mail
 *    provider, so the page says how to change it instead (the reason
 *    `/api/settings/profile` was deleted on 2026-10-23).
 *  - Business saves the name, the Companies House number (new column), the
 *    registered address and the VAT number; "Look up" is offered only when
 *    the Companies House key is configured (`/api/config`).
 *  - Two-step verification, signed-in devices and email notifications are
 *    described, not switched: none exists yet, and a switch that stores
 *    nothing is the defect V2 Phase 7 removed.
 *  - The sticky save bar posts only the section on screen.
 */
definePageMeta({
  title: 'Settings',
  layout: 'sidenav',
  middleware: 'auth',
})

type Section = 'profile' | 'business' | 'security' | 'notify' | 'appearance'
const SECTIONS: { id: Section, label: string, icon: string, sub: string, intro: string }[] = [
  { id: 'profile', label: 'Profile', icon: 'solar:user-circle-linear', sub: 'Name, email and mobile', intro: 'How your team sees you, and where we reach you.' },
  { id: 'business', label: 'Business', icon: 'solar:buildings-2-linear', sub: 'Invoice details and VAT', intro: 'Used on every receipt and agreement.' },
  { id: 'security', label: 'Security', icon: 'solar:lock-keyhole-minimalistic-linear', sub: 'Password and sign-in', intro: 'Keep your account and payments safe.' },
  { id: 'notify', label: 'Notifications', icon: 'solar:bell-linear', sub: 'How we tell you about updates', intro: 'Where updates on your orders, payments and requests appear.' },
  { id: 'appearance', label: 'Appearance', icon: 'solar:pallete-2-linear', sub: 'Light or dark theme', intro: 'Choose how the panel looks on this device.' },
]

const route = useRoute()
const router = useRouter()
const toaster = useNuiToasts()
const { fetchUser } = useUser()
const { isDark, setTheme } = useApexTheme()
const { data: config } = useApexConfig()
const lookupAvailable = computed(() => Boolean((config.value as any)?.companiesHouseLookup))

const flash = ref('')
const found = ref<{ name: string, status: string, address: string } | null>(null)

const routeSection = computed<Section | null>(() => (SECTIONS.some(s => s.id === route.query.section) ? route.query.section as Section : null))
// With no section in the URL the two-column layout shows Profile; the hub
// layout shows the list of sections instead.
const section = computed<Section>(() => routeSection.value ?? 'profile')
const current = computed(() => SECTIONS.find(s => s.id === section.value)!)
function pick(id: Section) {
  flash.value = ''
  router.push({ query: { section: id } })
  window.scrollTo({ top: 0 })
}
function backToList() {
  router.push({ query: {} })
}

/* ------------------------------------------------------------------ data */
const { data, refresh } = await useFetch<any>('/api/settings/get-all', { key: 'settings' })
const { data: ordersData } = useFetch<{ data: { status: string }[] }>('/api/orders', { key: 'orders', lazy: true })
const openOrders = computed(() => (ordersData.value?.data ?? []).filter(o => !['COMPLETED', 'CANCELLED'].includes(o.status)).length)

interface Form { name: string, phone: string, bName: string, bCrn: string, bAddress: string, bVat: string }
function fromServer(): Form {
  const u = data.value?.user ?? data.value ?? {}
  const c = u.company ?? data.value?.company ?? {}
  return {
    name: [u.firstName, u.lastName].filter(Boolean).join(' '),
    phone: u.phone ?? '',
    bName: c.name ?? '',
    bCrn: c.companyNumber ?? '',
    bAddress: c.address ?? '',
    bVat: c.taxId ?? '',
  }
}
const saved = ref<Form>(fromServer())
const form = reactive<Form>({ ...saved.value })
watch(data, () => {
  saved.value = fromServer()
  Object.assign(form, saved.value)
})
const email = computed(() => (data.value?.user ?? data.value)?.email ?? '')
const initials = computed(() => (form.name || email.value || 'A').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p: string) => p[0]!.toUpperCase()).join(''))

const SECTION_FIELDS: Record<'profile' | 'business', (keyof Form)[]> = {
  profile: ['name', 'phone'],
  business: ['bName', 'bCrn', 'bAddress', 'bVat'],
}
const editable = computed(() => (section.value === 'profile' || section.value === 'business') ? SECTION_FIELDS[section.value] : [])
const dirtyN = computed(() => editable.value.filter(f => form[f] !== saved.value[f]).length)

const errName = computed(() => (!form.name.trim() ? 'Add your name' : ''))
const errPhone = computed(() => (form.phone.trim() && !/^\+?[\d\s()-]{7,20}$/.test(form.phone.trim()) ? 'Enter a phone number like 07700 900123' : ''))
const crnOk = computed(() => /^[A-Z0-9]{8}$/i.test(form.bCrn.trim()))
const errCrn = computed(() => (form.bCrn.trim() && !crnOk.value ? 'Companies House numbers are eight characters' : ''))
// GB VAT: GB + 9 digits, 12 for a branch, or the GD/HA government forms.
const errVat = computed(() => {
  const v = form.bVat.replace(/\s/g, '').toUpperCase()
  return v && !/^GB(?:\d{9}|\d{12}|GD\d{3}|HA\d{3})$/.test(v) ? 'UK VAT numbers look like GB123456789' : ''
})
const saveBlocked = computed(() => section.value === 'profile' ? Boolean(errName.value || errPhone.value) : Boolean(errCrn.value || errVat.value || !form.bName.trim()))

const saving = ref(false)
async function save() {
  if (saveBlocked.value || saving.value) {
    return
  }
  saving.value = true
  try {
    if (section.value === 'profile') {
      const [first, ...rest] = form.name.trim().split(/\s+/)
      await $fetch('/api/settings/update-all', { method: 'PUT', body: { user: { firstName: first, lastName: rest.join(' '), phone: form.phone.trim() || null } } })
      await fetchUser()
    }
    else {
      await $fetch('/api/settings/update-all', {
        method: 'PUT',
        body: { user: {}, company: { name: form.bName.trim(), companyNumber: form.bCrn.trim().toUpperCase(), address: form.bAddress.trim(), taxId: form.bVat.replace(/\s/g, '').toUpperCase() } },
      })
    }
    await refresh()
    flash.value = 'Changes saved.'
  }
  catch (e) {
    toaster.add({ title: 'Not saved', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    saving.value = false
  }
}
function discard() {
  for (const f of editable.value) {
    form[f] = saved.value[f]
  }
  found.value = null
}

/* ------------------------------------------------- Companies House lookup */
const lookupBusy = ref(false)
watch(() => form.bCrn, () => {
  found.value = null
})
async function lookup() {
  if (!crnOk.value) {
    return
  }
  lookupBusy.value = true
  try {
    // A plain string URL: the typed-route inference on this one recursed past TS's depth limit.
    found.value = await $fetch<{ name: string, status: string, address: string }>('/api/settings/companies-house' as string, { query: { number: form.bCrn.trim().toUpperCase() } })
  }
  catch (e) {
    toaster.add({ title: 'Lookup did not work', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    lookupBusy.value = false
  }
}
function useFound() {
  if (found.value) {
    form.bName = found.value.name
    form.bAddress = found.value.address
  }
}

/* ---------------------------------------------------------------- password */
const pw0 = ref('')
const pw1 = ref('')
const pwSaving = ref(false)
const pwErr = computed(() => (pw1.value.length > 0 && pw1.value.length < PASSWORD_MIN ? `Use at least ${PASSWORD_MIN} characters` : ''))
const pwDisabled = computed(() => !(pw0.value.length > 0 && pw1.value.length >= PASSWORD_MIN) || pwSaving.value)
async function savePw() {
  if (pwDisabled.value) {
    return
  }
  pwSaving.value = true
  try {
    await $fetch('/api/settings/password', { method: 'POST', body: { currentPassword: pw0.value, newPassword: pw1.value } })
    pw0.value = ''
    pw1.value = ''
    flash.value = 'Password updated. Your other devices are still signed in.'
  }
  catch (e) {
    toaster.add({ title: 'Password not changed', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    pwSaving.value = false
  }
}

/* This browser, read after mount because `navigator` does not exist on the server. */
const thisDevice = ref('This browser')
onMounted(() => {
  const ua = navigator.userAgent
  const os = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'This device'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Browser'
  thisDevice.value = `${os} · ${browser}`
})

const THEMES = [
  { id: 'light' as const, label: 'Light', page: 'bg-[#F7F8F9]', chrome: 'bg-white', card: 'bg-white', ink: 'bg-[#101828]', muted: 'bg-[#EDEFF1]', line: 'border-[#EDEFF1]' },
  { id: 'dark' as const, label: 'Dark', page: 'bg-[#0B1517]', chrome: 'bg-[#0C1719]', card: 'bg-[#16252A]', ink: 'bg-white', muted: 'bg-white/[.12]', line: 'border-white/10' },
]

const CARD = 'bg-card border-line-subtle shadow-panel rounded-[20px] border'
</script>

<template>
  <div class="@container mx-auto flex max-w-[1260px] flex-col gap-[clamp(20px,2.2vw,28px)] px-[clamp(16px,3vw,40px)] pb-[clamp(28px,4vw,56px)] pt-[clamp(20px,3vw,40px)]">
    <div class="flex-col gap-2.5" :class="routeSection ? 'hidden @min-[760px]:flex' : 'flex'">
      <h1 class="font-heading text-fg-heading m-0 text-[clamp(28px,1.3vw+18px,38px)] font-extrabold leading-[1.06] tracking-[-0.03em]">
        Settings
      </h1>
      <p class="text-fg-body m-0 max-w-[52ch] text-[clamp(15px,.3vw+14px,17px)] leading-relaxed">
        Your details, your business and how we contact you.
      </p>
    </div>

    <div class="grid items-start gap-[clamp(20px,2.4vw,32px)] @min-[760px]:grid-cols-[250px_minmax(0,1fr)]">
      <nav
        aria-label="Settings sections"
        class="bg-card border-line-subtle shadow-panel flex-col gap-0.5 rounded-[20px] border px-2 py-1 @min-[760px]:sticky @min-[760px]:top-24 @min-[760px]:p-2"
        :class="routeSection ? 'hidden @min-[760px]:flex' : 'flex'"
      >
        <button
          v-for="s in SECTIONS"
          :key="s.id"
          type="button"
          :aria-current="section === s.id ? 'page' : undefined"
          class="apex-ring border-line-soft flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl border-b px-3 text-left text-[14.5px] last:border-b-0 @min-[760px]:min-h-[46px] @min-[760px]:border-b-0"
          :class="section === s.id ? '@min-[760px]:apex-panel-nav-active text-fg-heading @min-[760px]:text-nav-fg font-medium @min-[760px]:font-semibold' : 'text-fg-heading hover:bg-hover font-medium'"
          @click="pick(s.id)"
        >
          <Icon :name="s.icon" class="size-5" :class="section === s.id ? 'text-fg-muted @min-[760px]:text-nav-fg' : 'text-fg-muted'" />
          <span class="flex grow flex-col gap-px">
            <span>{{ s.label }}</span>
            <span class="text-fg-muted text-[12.5px] font-medium @min-[760px]:hidden">{{ s.sub }}</span>
          </span>
          <Icon name="lucide:chevron-right" class="text-fg-muted size-[17px] @min-[760px]:hidden" />
        </button>
      </nav>

      <div class="min-w-0 flex-col gap-5" :class="routeSection ? 'flex' : 'hidden @min-[760px]:flex'">
        <button type="button" class="apex-ring text-fg-body -mb-1.5 inline-flex min-h-10 cursor-pointer items-center gap-2 self-start rounded-lg px-1 text-sm font-semibold @min-[760px]:hidden" @click="backToList">
          <Icon name="lucide:arrow-left" class="size-4" />Settings
        </button>
        <div class="flex flex-col gap-1.5">
          <h2 class="font-heading text-fg-heading m-0 text-2xl font-bold tracking-[-0.02em]">
            {{ current.label }}
          </h2>
          <p class="text-fg-body m-0 text-[14.5px] leading-relaxed">
            {{ current.intro }}
          </p>
        </div>

        <!-- Profile -->
        <template v-if="section === 'profile'">
          <div :class="CARD" class="flex flex-col gap-[22px] p-[clamp(18px,2vw,26px)]">
            <div class="flex flex-wrap items-center gap-4">
              <span aria-hidden="true" class="font-heading inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-[#7D53F2] text-xl font-semibold text-white shadow-[0_0_0_4px_var(--accent-tint)]">{{ initials }}</span>
              <span class="flex flex-[1_1_200px] flex-col gap-[3px]">
                <span class="text-fg-heading text-[15px] font-semibold">Your initials</span>
                <span class="text-fg-muted text-[13px]">Shown to your Apex team beside your messages. Profile photos are not supported yet.</span>
              </span>
            </div>
            <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-5">
              <ApexField v-model="form.name" label="Full name" required autocomplete="name" :error="errName" />
              <ApexField :model-value="email" label="Email" readonly hint="This is how you sign in. To change it, ask in Support and we will confirm the new address with you." />
              <ApexField v-model="form.phone" label="Mobile" type="tel" inputmode="tel" autocomplete="tel" hint="Optional · Used to arrange calls" :error="errPhone" />
            </div>
          </div>
          <div :class="CARD" class="flex flex-wrap items-center gap-x-5 gap-y-3.5 p-[clamp(18px,2vw,26px)]">
            <span class="flex flex-[1_1_280px] flex-col gap-1">
              <span class="text-fg-heading text-[15px] font-semibold">Close account</span>
              <span class="text-fg-body text-[13.5px] leading-[1.55]">
                <template v-if="openOrders">You have {{ openOrders }} open {{ openOrders === 1 ? 'order' : 'orders' }}. Closing becomes available once they are complete or cancelled, so no payment or file is left behind.</template>
                <template v-else>We close accounts by request, so we can hand over every file and receipt first.</template>
              </span>
            </span>
            <ApexButton variant="light" :disabled="openOrders > 0" to="/dashboards/support?tab=new">
              Close account
            </ApexButton>
          </div>
        </template>

        <!-- Business -->
        <div v-if="section === 'business'" :class="CARD" class="flex flex-col gap-5 p-[clamp(18px,2vw,26px)]">
          <ApexField v-model="form.bName" label="Business name" required hint="As it should appear on receipts and agreements" :error="!form.bName.trim() && dirtyN ? 'Add your business name' : ''" />
          <div class="flex flex-wrap items-start gap-3">
            <div class="min-w-0 flex-[1_1_220px]">
              <ApexField v-model="form.bCrn" label="Companies House number" hint="Eight characters, for limited companies" :error="errCrn" />
            </div>
            <button
              v-if="lookupAvailable"
              type="button"
              :disabled="lookupBusy || !crnOk"
              class="apex-ring border-line-rule bg-card text-fg-heading mt-[30px] inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              @click="lookup"
            >
              <Icon name="lucide:search" class="size-4" />{{ lookupBusy ? 'Looking up…' : 'Look up' }}
            </button>
          </div>
          <div v-if="found" class="bg-raised border-line-subtle flex flex-col gap-2 rounded-[14px] border px-[18px] py-4">
            <span class="text-st-success-fg flex items-center gap-2 text-[13px] font-bold">
              <span aria-hidden="true" class="inline-flex size-[18px] items-center justify-center rounded-full bg-[#22B07D] text-[9.5px] text-white">✓</span>Found on Companies House{{ found.status ? ` · ${found.status.charAt(0).toUpperCase()}${found.status.slice(1)}` : '' }}
            </span>
            <span class="text-fg-heading text-[15px] font-semibold">{{ found.name }}</span>
            <span class="text-fg-body text-[13.5px] leading-[1.55]">{{ found.address }}</span>
            <button type="button" class="apex-ring text-accent-ink self-start rounded-md text-[13.5px] font-semibold hover:underline" @click="useFound">
              Use this name and address
            </button>
          </div>
          <ApexField v-model="form.bAddress" label="Registered or business address" multiline :rows="2" hint="Printed on receipts and agreements" />
          <ApexField v-model="form.bVat" label="VAT number" hint="Optional · Added to receipts once saved" :error="errVat" />
        </div>

        <!-- Security -->
        <template v-if="section === 'security'">
          <div :class="CARD" class="flex flex-col gap-[18px] p-[clamp(18px,2vw,26px)]">
            <span class="text-fg-heading text-[15px] font-semibold">Change password</span>
            <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-[18px]">
              <ApexField v-model="pw0" label="Current password" type="password" autocomplete="current-password" />
              <ApexField v-model="pw1" label="New password" type="password" autocomplete="new-password" :hint="`At least ${PASSWORD_MIN} characters`" :error="pwErr" />
            </div>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <span class="text-fg-muted max-w-[52ch] text-[13px] leading-[1.55]">Changing your password does not sign out your other devices.</span>
              <ApexButton size="sm" :disabled="pwDisabled" @click="savePw">
                {{ pwSaving ? 'Updating…' : 'Update password' }}
              </ApexButton>
            </div>
          </div>
          <div :class="CARD" class="flex items-center gap-3.5 px-[clamp(18px,2vw,26px)] py-[18px]">
            <span class="bg-accent-tint text-accent-ink inline-flex size-[42px] shrink-0 items-center justify-center rounded-xl"><Icon name="solar:shield-check-linear" class="size-[21px]" /></span>
            <span class="flex min-w-0 grow flex-col gap-[3px]">
              <span class="text-fg-heading text-[15px] font-semibold">Two-step verification</span>
              <span class="text-fg-muted text-[13px]">Not available yet. Your password is the only sign-in step for now.</span>
            </span>
          </div>
          <div :class="CARD" class="overflow-hidden">
            <span class="border-line-soft text-fg-heading block border-b px-[clamp(18px,2vw,26px)] py-4 text-[15px] font-semibold">Signed-in devices</span>
            <div class="border-line-soft flex flex-wrap items-center gap-3.5 border-b px-[clamp(18px,2vw,26px)] py-3.5">
              <Icon name="solar:laptop-minimalistic-linear" class="text-fg-muted size-[22px]" />
              <span class="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5"><span class="text-fg-heading text-[14.5px] font-semibold">{{ thisDevice }}</span><span class="text-fg-muted text-[12.5px]">Active now</span></span>
              <span class="text-st-success-fg text-[12.5px] font-bold">This device</span>
            </div>
            <p class="text-fg-muted m-0 px-[clamp(18px,2vw,26px)] py-3.5 text-[12.5px] leading-relaxed">
              We do not keep a list of your other devices yet, so they cannot be signed out from here. Each sign-in lasts seven days.
            </p>
          </div>
        </template>

        <!-- Notifications -->
        <div v-if="section === 'notify'" :class="CARD" class="flex flex-col gap-3 p-[clamp(18px,2vw,26px)]">
          <div class="flex items-start gap-3.5">
            <span class="bg-accent-tint text-accent-ink inline-flex size-[42px] shrink-0 items-center justify-center rounded-xl"><Icon name="solar:bell-linear" class="size-[21px]" /></span>
            <span class="flex flex-col gap-1">
              <span class="text-fg-heading text-[15px] font-semibold">In the panel</span>
              <span class="text-fg-body text-[13.5px] leading-[1.55]">Milestones, files, replies to your requests, payments taken and anything your team needs from you appear under the bell in the top bar.</span>
            </span>
          </div>
          <p class="bg-raised text-fg-muted m-0 rounded-xl px-3.5 py-3 text-[12.5px] leading-relaxed">
            We do not send notification emails yet, so there is nothing to switch on or off here. When we do, you will choose which ones on this page.
          </p>
        </div>

        <!-- Appearance -->
        <template v-if="section === 'appearance'">
          <div role="radiogroup" aria-label="Theme" class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
            <button
              v-for="t in THEMES"
              :key="t.id"
              type="button"
              role="radio"
              :aria-checked="(t.id === 'dark') === isDark"
              class="apex-ring bg-card flex cursor-pointer flex-col gap-3.5 rounded-[20px] border p-3.5 text-left"
              :class="(t.id === 'dark') === isDark ? 'border-accent shadow-[0_0_0_3px_var(--accent-tint)]' : 'border-line-subtle shadow-panel'"
              @click="setTheme(t.id)"
            >
              <span aria-hidden="true" class="flex h-[120px] overflow-hidden rounded-[14px] border" :class="[t.page, t.line]">
                <span class="flex w-[30%] flex-col gap-1.5 border-r px-2 py-2.5" :class="[t.chrome, t.line]">
                  <span class="block h-1.5 w-3/5 rounded-[3px] bg-[#7D53F2]" /><span class="block h-[5px] rounded-[3px]" :class="t.muted" /><span class="block h-[5px] rounded-[3px]" :class="t.muted" />
                </span>
                <span class="flex grow flex-col gap-2 p-3">
                  <span class="block h-2 w-[55%] rounded-[3px]" :class="t.ink" />
                  <span class="flex grow gap-1.5"><span class="block grow rounded-[7px] bg-[#6C40E8]" /><span class="block grow rounded-[7px] border" :class="[t.card, t.line]" /></span>
                </span>
              </span>
              <span class="flex items-center justify-between gap-2.5">
                <span class="text-fg-heading text-[15px] font-semibold">{{ t.label }}</span>
                <span aria-hidden="true" class="inline-flex size-[22px] items-center justify-center rounded-full border-2 text-[11px] text-white" :class="(t.id === 'dark') === isDark ? 'bg-accent border-accent' : 'border-line-rule'">{{ (t.id === 'dark') === isDark ? '✓' : '' }}</span>
              </span>
            </button>
          </div>
          <p class="text-fg-muted m-0 text-[13px] leading-relaxed">
            Saved on this device. You can also switch from the moon and sun button in the top bar.
          </p>
        </template>

        <div v-if="dirtyN > 0" class="bg-card border-line-subtle shadow-pop sticky bottom-[calc(78px+env(safe-area-inset-bottom))] z-[6] flex flex-wrap items-center gap-3 rounded-2xl border py-3 pl-[18px] pr-3 md:bottom-3">
          <span class="text-fg-heading flex-[1_1_160px] text-sm font-semibold">{{ dirtyN === 1 ? '1 unsaved change' : `${dirtyN} unsaved changes` }}</span>
          <button type="button" class="apex-ring text-fg-body min-h-[42px] cursor-pointer rounded-xl px-3.5 text-sm font-semibold" @click="discard">
            Discard
          </button>
          <ApexButton size="sm" :disabled="saveBlocked || saving" @click="save">
            {{ saving ? 'Saving…' : 'Save changes' }}
          </ApexButton>
        </div>
        <div v-else-if="flash" role="status" class="bg-st-success-bg text-st-success-fg flex items-center gap-2.5 rounded-[14px] px-[18px] py-3.5 text-sm font-semibold">
          <span aria-hidden="true" class="inline-flex size-5 items-center justify-center rounded-full bg-[#22B07D] text-[10px] text-white">✓</span>{{ flash }}
        </div>
      </div>
    </div>
  </div>
</template>
