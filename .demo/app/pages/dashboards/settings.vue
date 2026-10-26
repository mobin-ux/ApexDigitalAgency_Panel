<script setup lang="ts">
import { encode } from 'uqr'
import { AVATAR_MAX_BYTES, AVATAR_MIMES, AVATAR_MIN_PX, avatarPhoto } from '~~/shared/avatar'
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
 *  - Profile saves the photo (on choosing it), the name and mobile. The
 *    username the design draws does not exist: people sign in with an email
 *    or a phone number. The sign-in email is shown but not
 *    editable: changing it needs a confirmation email and there is no mail
 *    provider, so the page says how to change it instead (the reason
 *    `/api/settings/profile` was deleted on 2026-10-23).
 *  - Business saves the name, the Companies House number (new column), the
 *    registered address and the VAT number; "Look up" is offered only when
 *    the Companies House key is configured (`/api/config`).
 *  - Security: the password, two-step verification with an authenticator
 *    app (`/api/settings/two-factor/*`) and the signed-in devices, each of
 *    which can be signed out (`/api/settings/sessions`).
 *  - Email notifications are described, not switched: no emails are sent
 *    yet, and a switch that stores nothing is the defect V2 Phase 7 removed.
 *  - The sticky save bar posts only the section on screen.
 */
definePageMeta({
  title: 'Settings',
  layout: 'sidenav',
  middleware: 'auth',
})

type Section = 'profile' | 'business' | 'security' | 'notify' | 'appearance'
const SECTIONS: { id: Section, label: string, icon: string, sub: string, intro: string }[] = [
  { id: 'profile', label: 'Profile', icon: 'solar:user-circle-linear', sub: 'Name, email and photo', intro: 'How your team sees you, and where we reach you.' },
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

/* ------------------------------------------------------------ profile photo */
// Saved the moment it is chosen, like every other upload in the panel: the
// file goes to /api/uploads and the avatar endpoint claims it. Not part of the
// save bar, which only covers the text fields.
const { user } = useUser()
const hasPhoto = computed(() => Boolean(avatarPhoto((user.value as any)?.avatar)))
const photoBusy = ref(false)
const photoError = ref('')

/** Width and height of an image file, read in the browser. */
function imageSize(file: File) {
  return new Promise<{ w: number, h: number } | null>((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

async function choosePhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }
  photoError.value = ''
  flash.value = ''
  if (!AVATAR_MIMES.includes(file.type)) {
    photoError.value = 'Use a JPG, PNG, WebP or GIF image.'
    return
  }
  if (file.size > AVATAR_MAX_BYTES) {
    photoError.value = 'Use a photo under 5 MB.'
    return
  }
  const dims = await imageSize(file)
  if (!dims) {
    photoError.value = 'That image could not be opened. Try another.'
    return
  }
  if (Math.min(dims.w, dims.h) < AVATAR_MIN_PX) {
    photoError.value = `That photo is ${dims.w} × ${dims.h}px. Use one at least ${AVATAR_MIN_PX}px on each side.`
    return
  }
  photoBusy.value = true
  try {
    const body = new FormData()
    body.append('files', file, file.name)
    const up = await $fetch<{ files: { id: string }[] }>('/api/uploads', { method: 'POST', body })
    await $fetch('/api/settings/avatar', { method: 'PUT', body: { fileId: up.files[0]!.id } })
    await fetchUser({ force: true })
    flash.value = 'Photo updated.'
  }
  catch (e) {
    photoError.value = errorMessage(e, 'Your photo did not upload. Please try again.')
  }
  finally {
    photoBusy.value = false
  }
}

async function removePhoto() {
  photoError.value = ''
  photoBusy.value = true
  try {
    await $fetch('/api/settings/avatar', { method: 'DELETE' })
    await fetchUser({ force: true })
    flash.value = 'Photo removed.'
  }
  catch (e) {
    photoError.value = errorMessage(e, 'Your photo was not removed. Please try again.')
  }
  finally {
    photoBusy.value = false
  }
}

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
      await fetchUser({ force: true })
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

/* -------------------------------------------------------- signed-in devices */
// Client-only: the list call can hand a browser on an old token a new session
// cookie, and a cookie set during SSR's internal fetch never reaches it.
interface Device { id: string, name: string, kind: 'phone' | 'tablet' | 'laptop' | 'desktop', createdAt: string, lastSeenAt: string, current: boolean }
const { data: devicesData, refresh: refreshDevices, status: devicesStatus, execute: loadDevices } = useFetch<{ sessions: Device[] }>('/api/settings/sessions', { key: 'sessions', server: false, immediate: false })
const devices = computed(() => devicesData.value?.sessions ?? [])
const DEVICE_ICON: Record<Device['kind'], string> = { phone: 'solar:smartphone-2-linear', tablet: 'solar:tablet-linear', laptop: 'solar:laptop-minimalistic-linear', desktop: 'solar:monitor-linear' }

/** "Active now", "Active 40 min ago", "Active today at 09:12", "Active 3 days ago", then the date. */
function lastActive(d: Device) {
  const at = new Date(d.lastSeenAt)
  const mins = Math.round((Date.now() - at.getTime()) / 60_000)
  if (d.current || mins < 6) {
    return 'Active now'
  }
  if (mins < 60) {
    return `Active ${mins} min ago`
  }
  const days = -daysUntil(at)
  if (days <= 0) {
    return `Active today at ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  }
  return days === 1 ? 'Active yesterday' : days < 7 ? `Active ${days} days ago` : `Active ${ukDate(at)}`
}

const deviceBusy = ref<string | null>(null)
async function signOutDevice(d: Device) {
  deviceBusy.value = d.id
  try {
    await $fetch(`/api/settings/sessions/${d.id}`, { method: 'DELETE' })
    flash.value = `Signed out of ${d.name}.`
  }
  catch (e) {
    toaster.add({ title: 'Not signed out', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    deviceBusy.value = null
    await refreshDevices()
  }
}
async function signOutOthers() {
  deviceBusy.value = 'others'
  try {
    // Not "no other device": sign-ins from before the list existed are ended
    // too, and they cannot be counted.
    await $fetch('/api/settings/sessions/others', { method: 'POST' })
    flash.value = 'Signed out of every other device.'
  }
  catch (e) {
    toaster.add({ title: 'Not signed out', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    deviceBusy.value = null
    await refreshDevices()
  }
}

/* --------------------------------------------------- two-step verification */
interface TwoFactorStatus { enabled: boolean, enabledAt: string | null, backupCodesLeft: number }
const { data: tf, refresh: refreshTf, execute: loadTf } = useFetch<TwoFactorStatus>('/api/settings/two-factor', { key: 'two-factor', server: false, immediate: false })
watch(section, (s) => {
  if (s === 'security') {
    loadDevices()
    loadTf()
  }
}, { immediate: true })

type TfStep = 'setup' | 'codes' | 'disable' | 'renew'
const tfStep = ref<TfStep | null>(null)
const tfOpen = computed({
  get: () => tfStep.value !== null,
  set: (v) => {
    if (!v) {
      tfStep.value = null
    }
  },
})
const tfSetup = ref<{ secret: string, uri: string } | null>(null)
const tfCode = ref('')
const tfPassword = ref('')
const tfBusy = ref(false)
const tfError = ref('')
const backupCodes = ref<string[]>([])
const codesCopied = ref(false)

/** The setup QR as one SVG path: a 1×1 square per dark module. */
const qr = computed(() => {
  if (!tfSetup.value) {
    return null
  }
  const { data, size } = encode(tfSetup.value.uri, { border: 0 })
  let d = ''
  data.forEach((row, y) => row.forEach((on, x) => {
    if (on) {
      d += `M${x} ${y}h1v1h-1z`
    }
  }))
  return { size, d }
})
const secretGroups = computed(() => tfSetup.value?.secret.match(/.{1,4}/g)?.join(' ') ?? '')

function openTf(step: TfStep) {
  tfCode.value = ''
  tfPassword.value = ''
  tfError.value = ''
  tfStep.value = step
}
async function toggleTwoFactor() {
  if (tf.value?.enabled) {
    openTf('disable')
    return
  }
  tfBusy.value = true
  try {
    tfSetup.value = await $fetch<{ secret: string, uri: string }>('/api/settings/two-factor/setup', { method: 'POST' })
    openTf('setup')
  }
  catch (e) {
    toaster.add({ title: 'Two-step verification', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    tfBusy.value = false
  }
}
async function submitTf() {
  tfError.value = ''
  tfBusy.value = true
  try {
    if (tfStep.value === 'setup') {
      backupCodes.value = (await $fetch<{ backupCodes: string[] }>('/api/settings/two-factor/enable', { method: 'POST', body: { code: tfCode.value } })).backupCodes
      tfSetup.value = null
      codesCopied.value = false
      tfStep.value = 'codes'
      flash.value = 'Two-step verification is on.'
    }
    else if (tfStep.value === 'renew') {
      backupCodes.value = (await $fetch<{ backupCodes: string[] }>('/api/settings/two-factor/backup-codes', { method: 'POST', body: { code: tfCode.value } })).backupCodes
      codesCopied.value = false
      tfStep.value = 'codes'
      flash.value = 'New backup codes made. The old ones no longer work.'
    }
    else if (tfStep.value === 'disable') {
      await $fetch('/api/settings/two-factor/disable', { method: 'POST', body: { password: tfPassword.value, code: tfCode.value } })
      tfStep.value = null
      flash.value = 'Two-step verification is off.'
    }
    await refreshTf()
  }
  catch (e) {
    tfError.value = errorMessage(e)
  }
  finally {
    tfBusy.value = false
  }
}
async function copyCodes() {
  try {
    await navigator.clipboard.writeText(backupCodes.value.join('\n'))
    codesCopied.value = true
  }
  catch {
    tfError.value = 'Copying did not work here. Download the codes instead.'
  }
}
function downloadCodes() {
  const text = `Apex Digi backup codes\nEach code works once.\n\n${backupCodes.value.join('\n')}\n`
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'apex-backup-codes.txt'
  a.click()
  URL.revokeObjectURL(url)
}
const TF_TITLES: Record<TfStep, string> = { setup: 'Turn on two-step verification', codes: 'Save your backup codes', disable: 'Turn off two-step verification', renew: 'New backup codes' }
const tfTitle = computed(() => TF_TITLES[tfStep.value ?? 'setup'])
// Six digits from the app; turning it off also takes a ten-character backup code.
const tfCodeOk = computed(() => /^\d{6}$/.test(tfCode.value.replace(/\s/g, '')) || (tfStep.value === 'disable' && tfCode.value.replace(/[^a-z0-9]/gi, '').length === 10))

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
            <div class="flex flex-col gap-2.5">
              <div class="flex flex-wrap items-center gap-4">
                <span class="shrink-0 rounded-full shadow-[0_0_0_4px_var(--accent-tint)]"><ApexPanelAvatar :size="64" /></span>
                <span class="flex flex-[1_1_200px] flex-col gap-[3px]">
                  <span id="photo-label" class="text-fg-heading text-[15px] font-semibold">Profile photo</span>
                  <span id="photo-hint" class="text-fg-muted text-[13px]">Shown to your Apex team. Square, at least {{ AVATAR_MIN_PX }}px.</span>
                </span>
                <span class="flex flex-wrap items-center gap-2">
                  <button v-if="hasPhoto" type="button" :disabled="photoBusy" class="apex-ring text-fg-body min-h-10 cursor-pointer rounded-xl px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" @click="removePhoto">
                    Remove
                  </button>
                  <label
                    class="border-line-rule text-fg-heading hover:bg-hover relative inline-flex min-h-10 cursor-pointer items-center rounded-xl border px-3.5 text-sm font-semibold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]"
                    :class="photoBusy ? 'pointer-events-none opacity-50' : ''"
                  >
                    {{ photoBusy ? 'Uploading…' : hasPhoto ? 'Change' : 'Upload' }}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      aria-labelledby="photo-label"
                      aria-describedby="photo-hint"
                      class="absolute size-px opacity-0"
                      :disabled="photoBusy"
                      @change="choosePhoto"
                    >
                  </label>
                </span>
              </div>
              <p v-if="photoError" role="alert" class="text-st-danger-fg m-0 text-[13px] font-medium">
                {{ photoError }}
              </p>
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
              <span class="text-fg-muted max-w-[52ch] text-[13px] leading-[1.55]">Changing your password does not sign out your other devices. Sign them out below.</span>
              <ApexButton size="sm" :disabled="pwDisabled" @click="savePw">
                {{ pwSaving ? 'Updating…' : 'Update password' }}
              </ApexButton>
            </div>
          </div>
          <div :class="CARD" class="flex flex-col gap-3 px-[clamp(18px,2vw,26px)] py-[18px]">
            <div class="flex items-center gap-3.5">
              <span class="bg-accent-tint text-accent-ink inline-flex size-[42px] shrink-0 items-center justify-center rounded-xl"><Icon name="solar:shield-check-linear" class="size-[21px]" /></span>
              <span class="flex min-w-0 grow flex-col gap-[3px]">
                <span id="tf-label" class="text-fg-heading text-[15px] font-semibold">Two-step verification</span>
                <span v-if="!tf" class="bg-raised block h-4 w-40 animate-pulse rounded motion-reduce:animate-none" />
                <span v-else class="text-fg-muted text-[13px]">{{ tf.enabled ? `On · Authenticator app · ${tf.backupCodesLeft} backup ${tf.backupCodesLeft === 1 ? 'code' : 'codes'} left` : 'Off · We recommend turning this on' }}</span>
              </span>
              <button
                type="button"
                role="switch"
                :aria-checked="Boolean(tf?.enabled)"
                aria-labelledby="tf-label"
                :disabled="!tf || tfBusy"
                class="apex-ring relative h-7 w-[46px] shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                :class="tf?.enabled ? 'bg-accent' : 'bg-line-strong'"
                @click="toggleTwoFactor"
              >
                <span class="absolute top-[3px] size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(17,31,34,.25)] transition-[left] duration-150 motion-reduce:transition-none" :class="tf?.enabled ? 'left-[21px]' : 'left-[3px]'" />
              </button>
            </div>
            <p v-if="tf?.enabled" class="text-fg-muted m-0 text-[13px] leading-[1.55]">
              Signing in asks for a code from your app after your password.
              <button type="button" class="apex-ring text-accent-ink rounded font-semibold hover:underline" @click="openTf('renew')">
                Make new backup codes
              </button>
            </p>
          </div>
          <div :class="CARD" class="overflow-hidden">
            <span class="border-line-soft text-fg-heading block border-b px-[clamp(18px,2vw,26px)] py-4 text-[15px] font-semibold">Signed-in devices</span>
            <div v-if="devicesStatus === 'pending' && !devices.length" class="px-[clamp(18px,2vw,26px)] py-4">
              <span class="bg-raised block h-10 animate-pulse rounded-xl motion-reduce:animate-none" />
            </div>
            <ul class="m-0 list-none p-0">
              <li v-for="d in devices" :key="d.id" class="border-line-soft flex flex-wrap items-center gap-3.5 border-b px-[clamp(18px,2vw,26px)] py-3.5">
                <Icon :name="DEVICE_ICON[d.kind]" class="text-fg-muted size-[22px]" />
                <span class="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                  <span class="text-fg-heading text-[14.5px] font-semibold">{{ d.name }}</span>
                  <span class="text-fg-muted text-[12.5px]">{{ lastActive(d) }} · Signed in {{ ukDate(d.createdAt) }}</span>
                </span>
                <span v-if="d.current" class="text-st-success-fg text-[12.5px] font-bold">This device</span>
                <button
                  v-else
                  type="button"
                  :disabled="deviceBusy !== null"
                  :aria-label="`Sign out of ${d.name}, ${lastActive(d).toLowerCase()}`"
                  class="apex-ring border-line-rule bg-card text-fg-heading hover:bg-hover min-h-[38px] cursor-pointer rounded-[10px] border px-3 text-[13.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  @click="signOutDevice(d)"
                >
                  {{ deviceBusy === d.id ? 'Signing out…' : 'Sign out' }}
                </button>
              </li>
            </ul>
            <div class="flex flex-wrap items-center justify-between gap-3 px-[clamp(18px,2vw,26px)] py-3.5">
              <span class="text-fg-muted max-w-[52ch] text-[12.5px] leading-relaxed">Each sign-in lasts seven days. A device you sign out has to sign in again.</span>
              <button
                v-if="devices.length"
                type="button"
                :disabled="deviceBusy !== null"
                class="apex-ring text-fg-body hover:bg-hover min-h-[38px] cursor-pointer rounded-[10px] px-2 text-[13.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                @click="signOutOthers"
              >
                {{ deviceBusy === 'others' ? 'Signing out…' : 'Sign out of all other devices' }}
              </button>
            </div>
          </div>

          <ApexPanelDialog v-model:open="tfOpen" :title="tfTitle" description="Two-step verification for your Apex account." :width="460">
            <template v-if="tfStep === 'setup'">
              <ol class="text-fg-body m-0 flex list-decimal flex-col gap-1.5 ps-5 text-[14px] leading-[1.55]">
                <li>Open an authenticator app, such as Google Authenticator, Microsoft Authenticator or 1Password.</li>
                <li>Scan this code, or enter the key below.</li>
                <li>Type the six-digit code the app shows.</li>
              </ol>
              <div v-if="qr" class="flex justify-center">
                <svg :viewBox="`-4 -4 ${qr.size + 8} ${qr.size + 8}`" class="size-[184px] rounded-xl bg-white" role="img" aria-label="QR code for your authenticator app" shape-rendering="crispEdges">
                  <path :d="qr.d" fill="#101828" />
                </svg>
              </div>
              <div class="bg-raised flex flex-col gap-1 rounded-xl px-3.5 py-3">
                <span class="text-fg-muted text-[12px] font-semibold">Key, if you cannot scan</span>
                <code class="text-fg-heading select-all break-all font-mono text-[14px] tracking-[0.04em]">{{ secretGroups }}</code>
              </div>
            </template>
            <template v-if="tfStep === 'codes'">
              <p class="text-fg-body m-0 text-[14px] leading-[1.55]">
                If you lose your phone, each of these codes signs you in once. Keep them somewhere safe. This is the only time we show them.
              </p>
              <ul class="bg-raised m-0 grid list-none grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl p-4 font-mono text-[14.5px]" aria-label="Backup codes">
                <li v-for="c in backupCodes" :key="c" class="text-fg-heading select-all">
                  {{ c }}
                </li>
              </ul>
              <div class="flex flex-wrap gap-2.5">
                <ApexButton variant="soft" size="sm" @click="copyCodes">
                  {{ codesCopied ? 'Copied' : 'Copy codes' }}
                </ApexButton>
                <ApexButton variant="soft" size="sm" @click="downloadCodes">
                  Download
                </ApexButton>
              </div>
              <p v-if="tfError" role="alert" class="text-st-danger-fg m-0 text-[13px] font-medium">
                {{ tfError }}
              </p>
              <ApexButton block @click="tfStep = null">
                I have saved them
              </ApexButton>
            </template>
            <template v-if="tfStep === 'disable'">
              <p class="text-fg-body m-0 text-[14px] leading-[1.55]">
                Signing in will only ask for your password. Enter it, and a code from your app or a backup code.
              </p>
              <ApexField v-model="tfPassword" label="Password" type="password" autocomplete="current-password" required />
            </template>
            <template v-if="tfStep === 'renew'">
              <p class="text-fg-body m-0 text-[14px] leading-[1.55]">
                Your current backup codes will stop working. Enter a code from your app to make ten new ones.
              </p>
            </template>
            <form v-if="tfStep && tfStep !== 'codes'" class="flex flex-col gap-3.5" @submit.prevent="submitTf">
              <ApexField
                v-model="tfCode"
                :label="tfStep === 'disable' ? 'Code from your app, or a backup code' : 'Six-digit code from your app'"
                :inputmode="tfStep === 'disable' ? 'text' : 'numeric'"
                autocomplete="one-time-code"
                required
                :error="tfError"
              />
              <ApexButton type="submit" block :disabled="!tfCodeOk || tfBusy || (tfStep === 'disable' && !tfPassword)">
                {{ tfBusy ? 'Checking…' : tfStep === 'setup' ? 'Turn on' : tfStep === 'disable' ? 'Turn off' : 'Make new codes' }}
              </ApexButton>
            </form>
          </ApexPanelDialog>
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
