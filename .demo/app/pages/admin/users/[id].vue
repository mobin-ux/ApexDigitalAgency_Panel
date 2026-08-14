<script setup lang="ts">
/**
 * Admin — user detail. Profile editing, account controls (role /
 * verification / suspension), company profile management, wallet
 * adjustments (always through the ledger) and recent activity.
 */
definePageMeta({
  title: 'User detail',
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const userId = route.params.id as string

const { user: me } = useUser()
const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()

const { data: detail, refresh } = await useFetch(`/api/admin/users/${userId}`)

const displayName = computed(() => {
  const u = detail.value
  if (!u)
    return 'User'
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  return full || u.email
})

const isSelf = computed(() => me.value?.id === userId)

function fmtDate(iso: string | Date | null | undefined) {
  if (!iso)
    return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toastError(error: any, fallback: string) {
  const fieldErrors = error?.data?.data?.fieldErrors as Record<string, string[]> | undefined
  const firstFieldError = fieldErrors ? Object.values(fieldErrors)[0]?.[0] : undefined
  toaster.add({ title: 'Something went wrong', description: firstFieldError || error?.data?.message || fallback, icon: 'lucide:alert-triangle', progress: true })
}

// --- Profile form ---
const profile = reactive({ firstName: '', lastName: '', phone: '', city: '', country: '' })
const savingProfile = ref(false)

watch(detail, (u) => {
  if (u) {
    Object.assign(profile, {
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      phone: u.phone ?? '',
      city: u.city ?? '',
      country: u.country ?? '',
    })
  }
}, { immediate: true })

async function saveProfile() {
  savingProfile.value = true
  try {
    await $fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: {
        ...(profile.firstName.trim() ? { firstName: profile.firstName.trim() } : {}),
        ...(profile.lastName.trim() ? { lastName: profile.lastName.trim() } : {}),
        phone: profile.phone.trim() || null,
        city: profile.city.trim() || null,
        country: profile.country.trim() || null,
      },
    })
    toaster.add({ title: 'Profile saved', icon: 'lucide:check', progress: true })
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The profile could not be saved.')
  }
  finally {
    savingProfile.value = false
  }
}

// --- Account controls ---
const savingAccount = ref(false)

async function patchAccount(body: Record<string, unknown>, successTitle: string) {
  savingAccount.value = true
  try {
    await $fetch(`/api/admin/users/${userId}`, { method: 'PATCH', body })
    toaster.add({ title: successTitle, icon: 'lucide:check', progress: true })
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The account could not be updated.')
  }
  finally {
    savingAccount.value = false
  }
}

// --- Suspend confirmation modal ---
const showSuspend = ref(false)

async function confirmSuspendToggle() {
  const next = detail.value?.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'
  showSuspend.value = false
  await patchAccount({ status: next }, next === 'SUSPENDED' ? 'Account suspended' : 'Account reactivated')
}

// --- Wallet adjustment modal ---
const showWallet = ref(false)
const walletDirection = ref<'credit' | 'debit'>('credit')
const walletAmount = ref<number | null>(null)
const walletReason = ref('')
const adjusting = ref(false)

function openWallet() {
  walletDirection.value = 'credit'
  walletAmount.value = null
  walletReason.value = ''
  showWallet.value = true
}

async function submitWallet() {
  if (!walletAmount.value || walletAmount.value <= 0 || adjusting.value)
    return
  adjusting.value = true
  try {
    const signed = walletDirection.value === 'debit' ? -walletAmount.value : walletAmount.value
    await $fetch(`/api/admin/users/${userId}/wallet`, {
      method: 'POST',
      body: { amount: signed, reason: walletReason.value },
    })
    toaster.add({ title: 'Wallet adjusted', description: `${walletDirection.value === 'debit' ? '−' : '+'}${formatCurrency(walletAmount.value)} recorded in the ledger.`, icon: 'lucide:check', progress: true })
    showWallet.value = false
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The adjustment was not applied.')
  }
  finally {
    adjusting.value = false
  }
}

// --- Company profile ---
const companyForm = reactive({ name: '', email: '', website: '', phone: '', taxId: '', address: '', type: '', employees: '', status: 'Active', notes: '' })
const savingCompany = ref(false)
const showCompanyForm = ref(false)
const showRemoveCompany = ref(false)

watch(detail, (u) => {
  const c = u?.company
  Object.assign(companyForm, {
    name: c?.name ?? '',
    email: c?.email ?? '',
    website: c?.website ?? '',
    phone: c?.phone ?? '',
    taxId: c?.taxId ?? '',
    address: c?.address ?? '',
    type: c?.type ?? '',
    employees: c?.employees ?? '',
    status: c?.status ?? 'Active',
    notes: c?.notes ?? '',
  })
  showCompanyForm.value = Boolean(c)
}, { immediate: true })

async function saveCompany() {
  savingCompany.value = true
  try {
    await $fetch(`/api/admin/users/${userId}/company`, {
      method: 'PUT',
      body: {
        name: companyForm.name.trim(),
        email: companyForm.email.trim() || null,
        website: companyForm.website.trim() || null,
        phone: companyForm.phone.trim() || null,
        taxId: companyForm.taxId.trim() || null,
        address: companyForm.address.trim() || null,
        type: companyForm.type.trim() || null,
        employees: companyForm.employees.trim() || null,
        status: companyForm.status,
        notes: companyForm.notes.trim() || null,
      },
    })
    toaster.add({ title: 'Company profile saved', icon: 'lucide:check', progress: true })
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The company profile could not be saved.')
  }
  finally {
    savingCompany.value = false
  }
}

async function removeCompany() {
  showRemoveCompany.value = false
  try {
    await $fetch(`/api/admin/users/${userId}/company`, { method: 'PUT', body: { remove: true } })
    toaster.add({ title: 'Company profile removed', description: 'This is an individual account again.', icon: 'lucide:check', progress: true })
    await refresh()
  }
  catch (error: any) {
    toastError(error, 'The company profile could not be removed.')
  }
}

const inputClass = 'w-full rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 sm:py-2.5 text-sm text-white outline-none placeholder:text-muted-500 focus:border-primary-400'
const labelClass = 'mb-2 block text-[12.5px] font-semibold text-white'
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-6 pb-8 font-sans text-muted-400">
    <NuxtLink to="/admin/users" class="-my-2 inline-flex min-h-11 w-fit items-center gap-1.5 py-2 text-[13.5px] font-semibold text-primary-400 transition hover:text-white sm:my-0 sm:min-h-0 sm:py-0">
      <Icon name="lucide:arrow-left" class="size-3.5" />All users
    </NuxtLink>

    <div v-if="detail" class="flex flex-col gap-6">
      <!-- ========== IDENTITY HEADER ========== -->
      <div class="flex flex-wrap items-center gap-5 rounded-[20px] border border-white/10 bg-muted-800 p-6">
        <BaseAvatar size="lg" :src="detail.avatar || '/img/avatars/10.svg'" />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2.5">
            <h1 class="font-heading text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-white">
              {{ displayName }}
            </h1>
            <Icon v-if="detail.verifiedAt" name="lucide:badge-check" class="size-5 text-[#6EA8FE]" aria-label="Verified account" />
            <AdminStatusChip :status="detail.status" />
            <AdminStatusChip :status="detail.role" :tone="detail.role === 'ADMIN' ? 'violet' : detail.role === 'EMPLOYEE' ? 'blue' : 'muted'" />
          </div>
          <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted-400">
            <span class="inline-flex items-center gap-1.5"><Icon name="lucide:mail" class="size-3.5" />{{ detail.email }}</span>
            <span v-if="detail.company" class="inline-flex items-center gap-1.5"><Icon name="lucide:building-2" class="size-3.5 text-primary-400" />{{ detail.company.name }}</span>
            <span class="inline-flex items-center gap-1.5"><Icon name="lucide:calendar" class="size-3.5" />Joined {{ fmtDate(detail.createdAt) }}</span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <BaseButton
            v-if="!isSelf" rounded="full"
            :class="detail.status === 'SUSPENDED' ? 'border border-[#22B07D]/30 bg-[#22B07D]/14 !text-[#22B07D] hover:bg-[#22B07D]/20' : 'border border-[#EC6453]/30 bg-[#EC6453]/14 !text-[#EC6453] hover:bg-[#EC6453]/20'"
            @click="showSuspend = true"
          >
            <Icon :name="detail.status === 'SUSPENDED' ? 'lucide:user-check' : 'lucide:user-x'" class="size-4" />
            {{ detail.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend' }}
          </BaseButton>
        </div>
      </div>

      <div class="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.55fr_1fr]">
        <!-- ========== LEFT COLUMN ========== -->
        <div class="flex flex-col gap-6">
          <!-- profile -->
          <section class="rounded-[20px] border border-white/10 bg-muted-800 p-6" aria-label="Profile">
            <h2 class="mb-5 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
              <span class="h-[18px] w-1.5 rounded-full bg-primary-500" />Profile
            </h2>
            <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="saveProfile">
              <div>
                <label for="pf-first" :class="labelClass">First name</label>
                <input id="pf-first" v-model="profile.firstName" :class="inputClass">
              </div>
              <div>
                <label for="pf-last" :class="labelClass">Last name</label>
                <input id="pf-last" v-model="profile.lastName" :class="inputClass">
              </div>
              <div>
                <label for="pf-phone" :class="labelClass">Phone</label>
                <input id="pf-phone" v-model="profile.phone" :class="inputClass">
              </div>
              <div>
                <label for="pf-city" :class="labelClass">City</label>
                <input id="pf-city" v-model="profile.city" :class="inputClass">
              </div>
              <div>
                <label for="pf-country" :class="labelClass">Country</label>
                <input id="pf-country" v-model="profile.country" :class="inputClass">
              </div>
              <div class="flex items-end justify-end">
                <BaseButton type="submit" rounded="full" variant="primary" :loading="savingProfile" :disabled="savingProfile">
                  <Icon name="lucide:check" class="size-4" />Save profile
                </BaseButton>
              </div>
            </form>
          </section>

          <!-- company profile -->
          <section class="rounded-[20px] border border-white/10 bg-muted-800 p-6" aria-label="Company profile">
            <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 class="flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
                <span class="h-[18px] w-1.5 rounded-full bg-[#6EA8FE]" />Company profile
              </h2>
              <button
                v-if="detail.company"
                type="button"
                class="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#EC6453] transition hover:text-white"
                @click="showRemoveCompany = true"
              >
                <Icon name="lucide:unlink" class="size-3.5" />Remove profile
              </button>
            </div>

            <div v-if="!showCompanyForm" class="flex flex-col items-start gap-3">
              <p class="text-[13.5px] text-muted-400">
                This is an individual account. Attach a company profile to treat it as a business customer.
              </p>
              <BaseButton rounded="full" class="border border-white/10 bg-muted-700 !text-white hover:bg-muted-600" @click="showCompanyForm = true">
                <Icon name="lucide:building-2" class="size-4" />Attach company profile
              </BaseButton>
            </div>

            <form v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="saveCompany">
              <div>
                <label for="co-name" :class="labelClass">Company name</label>
                <input id="co-name" v-model="companyForm.name" required :class="inputClass">
              </div>
              <div>
                <label for="co-email" :class="labelClass">Billing email</label>
                <input id="co-email" v-model="companyForm.email" type="email" :class="inputClass">
              </div>
              <div>
                <label for="co-website" :class="labelClass">Website</label>
                <input id="co-website" v-model="companyForm.website" :class="inputClass">
              </div>
              <div>
                <label for="co-phone" :class="labelClass">Phone</label>
                <input id="co-phone" v-model="companyForm.phone" :class="inputClass">
              </div>
              <div>
                <label for="co-taxid" :class="labelClass">Tax / VAT ID</label>
                <input id="co-taxid" v-model="companyForm.taxId" :class="inputClass">
              </div>
              <div>
                <label for="co-type" :class="labelClass">Industry / type</label>
                <input id="co-type" v-model="companyForm.type" :class="inputClass">
              </div>
              <div>
                <label for="co-employees" :class="labelClass">Employees</label>
                <input id="co-employees" v-model="companyForm.employees" placeholder="e.g. 11-50" :class="inputClass">
              </div>
              <div>
                <label for="co-status" :class="labelClass">Status</label>
                <select id="co-status" v-model="companyForm.status" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 sm:py-2.5 text-sm text-white outline-none focus:border-primary-400">
                  <option value="Active">
                    Active
                  </option>
                  <option value="Inactive">
                    Inactive
                  </option>
                </select>
              </div>
              <div class="sm:col-span-2">
                <label for="co-address" :class="labelClass">Registered address</label>
                <input id="co-address" v-model="companyForm.address" :class="inputClass">
              </div>
              <div class="sm:col-span-2">
                <label for="co-notes" :class="labelClass">Internal notes</label>
                <textarea id="co-notes" v-model="companyForm.notes" rows="3" class="w-full resize-y rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm leading-[1.55] text-white outline-none placeholder:text-muted-500 focus:border-primary-400" />
              </div>
              <div class="flex items-end justify-end sm:col-span-2">
                <BaseButton type="submit" rounded="full" variant="primary" :loading="savingCompany" :disabled="savingCompany || !companyForm.name.trim()">
                  <Icon name="lucide:check" class="size-4" />Save company
                </BaseButton>
              </div>
            </form>
          </section>

          <!-- recent activity -->
          <section class="rounded-[20px] border border-white/10 bg-muted-800 p-6" aria-label="Recent activity">
            <h2 class="mb-5 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
              <span class="h-[18px] w-1.5 rounded-full bg-[#22B07D]" />Recent activity
            </h2>

            <div class="flex flex-col gap-6">
              <div>
                <div class="mb-2.5 flex items-center justify-between">
                  <span class="text-[12.5px] font-bold uppercase tracking-[0.05em] text-muted-500">Projects ({{ detail._count.projects }})</span>
                  <NuxtLink :to="`/admin/projects?userId=${detail.id}`" class="text-[12.5px] font-semibold text-primary-400 hover:text-white">
                    View all
                  </NuxtLink>
                </div>
                <div v-if="detail.projects.length" class="overflow-hidden rounded-[14px] border border-white/8">
                  <template v-for="(p, idx) in detail.projects.slice(0, 5)" :key="p.id">
                    <div v-if="idx > 0" class="h-px bg-white/8" />
                    <NuxtLink :to="`/admin/projects/${p.id}`" class="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
                      <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-white">{{ p.name }}</span>
                      <span class="hidden text-[12.5px] text-muted-500 sm:block">{{ p.category }}</span>
                      <span class="text-[13px] font-semibold text-white tabular-nums">{{ formatCurrency(p.amount) }}</span>
                      <AdminStatusChip :status="p.status" />
                    </NuxtLink>
                  </template>
                </div>
                <p v-else class="text-[13px] text-muted-500">
                  No projects yet.
                </p>
              </div>

              <div>
                <div class="mb-2.5 flex items-center justify-between">
                  <span class="text-[12.5px] font-bold uppercase tracking-[0.05em] text-muted-500">Transactions ({{ detail._count.transactions }})</span>
                  <NuxtLink :to="`/admin/payments?userId=${detail.id}`" class="text-[12.5px] font-semibold text-primary-400 hover:text-white">
                    View all
                  </NuxtLink>
                </div>
                <div v-if="detail.transactions.length" class="overflow-hidden rounded-[14px] border border-white/8">
                  <template v-for="(t, idx) in detail.transactions.slice(0, 5)" :key="t.id">
                    <div v-if="idx > 0" class="h-px bg-white/8" />
                    <div class="flex items-center gap-3 px-4 py-3">
                      <span class="min-w-0 flex-1 truncate text-[13px] text-muted-400">{{ t.description || t.type }}</span>
                      <span class="hidden text-[12.5px] text-muted-500 sm:block">{{ fmtDate(t.createdAt) }}</span>
                      <span class="text-[13px] font-semibold tabular-nums" :class="t.amount < 0 ? 'text-[#EC6453]' : 'text-[#22B07D]'">
                        {{ t.amount < 0 ? '−' : '+' }}{{ formatCurrency(Math.abs(t.amount)) }}
                      </span>
                    </div>
                  </template>
                </div>
                <p v-else class="text-[13px] text-muted-500">
                  No transactions yet.
                </p>
              </div>

              <div>
                <div class="mb-2.5 flex items-center justify-between">
                  <span class="text-[12.5px] font-bold uppercase tracking-[0.05em] text-muted-500">Tickets ({{ detail._count.tickets }})</span>
                  <NuxtLink to="/admin/tickets" class="text-[12.5px] font-semibold text-primary-400 hover:text-white">
                    Inbox
                  </NuxtLink>
                </div>
                <div v-if="detail.tickets.length" class="overflow-hidden rounded-[14px] border border-white/8">
                  <template v-for="(t, idx) in detail.tickets.slice(0, 5)" :key="t.id">
                    <div v-if="idx > 0" class="h-px bg-white/8" />
                    <NuxtLink :to="`/admin/tickets?ticket=${t.id}`" class="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
                      <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-white">{{ t.subject }}</span>
                      <span class="hidden text-[12.5px] text-muted-500 sm:block">{{ fmtDate(t.updatedAt) }}</span>
                      <AdminStatusChip :status="t.status" />
                    </NuxtLink>
                  </template>
                </div>
                <p v-else class="text-[13px] text-muted-500">
                  No tickets yet.
                </p>
              </div>
            </div>
          </section>
        </div>

        <!-- ========== RIGHT RAIL ========== -->
        <div class="flex flex-col gap-6">
          <!-- wallet -->
          <section class="relative overflow-hidden rounded-[20px] border border-primary-500/30 p-6" style="background: linear-gradient(150deg, #241846, #16252A 72%);" aria-label="Wallet">
            <div class="mb-4 flex items-center justify-between">
              <span class="inline-flex items-center gap-3 text-[12.5px] font-bold tracking-[0.06em] text-primary-200">
                <span class="flex size-9 items-center justify-center rounded-[10px] bg-white/10 text-white"><Icon name="lucide:wallet" class="size-[18px]" /></span>WALLET BALANCE
              </span>
            </div>
            <div class="font-heading text-[30px] font-extrabold leading-none tracking-[-0.02em] text-white tabular-nums sm:text-[38px]">
              {{ formatCurrency(detail.walletBalance) }}
            </div>
            <div class="mt-2 text-[13px] text-muted-400">
              Ad credits: <span class="font-semibold text-white tabular-nums">{{ formatCurrency(detail.adCredits) }}</span>
            </div>
            <div class="mt-5">
              <BaseButton rounded="full" class="!bg-white !text-muted-900 hover:!bg-primary-50" @click="openWallet">
                <Icon name="lucide:arrow-up-down" class="size-4" />Adjust balance
              </BaseButton>
            </div>
          </section>

          <!-- account controls -->
          <section class="rounded-[20px] border border-white/10 bg-muted-800 p-6" aria-label="Account controls">
            <h2 class="mb-5 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
              <span class="h-[18px] w-1.5 rounded-full bg-[#F2C14E]" />Account controls
            </h2>
            <div class="flex flex-col gap-4">
              <div>
                <label for="acc-role" :class="labelClass">Role</label>
                <select
                  id="acc-role"
                  :value="detail.role"
                  :disabled="isSelf || savingAccount"
                  class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 sm:py-2.5 text-sm text-white outline-none focus:border-primary-400 disabled:cursor-not-allowed disabled:opacity-50"
                  @change="patchAccount({ role: ($event.target as HTMLSelectElement).value }, 'Role updated')"
                >
                  <option value="CUSTOMER">
                    Customer
                  </option>
                  <option value="EMPLOYEE">
                    Employee
                  </option>
                  <option value="ADMIN">
                    Admin
                  </option>
                </select>
                <p v-if="isSelf" class="mt-1.5 text-xs text-muted-500">
                  You can't change your own role.
                </p>
              </div>

              <div class="flex items-center justify-between rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3">
                <div class="min-w-0">
                  <div class="text-[13.5px] font-semibold text-white">
                    Verified account
                  </div>
                  <div class="mt-0.5 text-xs text-muted-500">
                    {{ detail.verifiedAt ? `Verified ${fmtDate(detail.verifiedAt)}` : 'Not verified yet' }}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="Boolean(detail.verifiedAt)"
                  aria-label="Toggle verification"
                  :disabled="savingAccount"
                  class="apex-tap relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50"
                  :class="detail.verifiedAt ? 'bg-[#22B07D]' : 'bg-white/10'"
                  @click="patchAccount({ verified: !detail.verifiedAt }, detail.verifiedAt ? 'Verification removed' : 'Account verified')"
                >
                  <span class="absolute top-0.5 size-5 rounded-full bg-white shadow transition-all" :class="detail.verifiedAt ? 'left-[22px]' : 'left-0.5'" />
                </button>
              </div>
            </div>
          </section>

          <!-- meta -->
          <section class="rounded-[20px] border border-white/10 bg-muted-800 p-6" aria-label="Record details">
            <h2 class="mb-4 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
              <span class="h-[18px] w-1.5 rounded-full bg-primary-200" />Record
            </h2>
            <dl class="flex flex-col gap-3 text-[13px]">
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-500">
                  User ID
                </dt>
                <dd class="truncate font-mono text-xs text-muted-400">
                  {{ detail.id }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-500">
                  Joined
                </dt>
                <dd class="text-white">
                  {{ fmtDate(detail.createdAt) }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-500">
                  Last updated
                </dt>
                <dd class="text-white">
                  {{ fmtDate(detail.updatedAt) }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-500">
                  Withdrawal requests
                </dt>
                <dd class="text-white tabular-nums">
                  {{ detail._count.withdrawalRequests }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-500">
                  Installment plans
                </dt>
                <dd class="text-white tabular-nums">
                  {{ detail._count.installments }}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>

    <AdminEmptyState v-else icon="lucide:user-x" title="User not found" subtitle="This account may have been deleted.">
      <BaseButton rounded="full" variant="primary" to="/admin/users">
        Back to users
      </BaseButton>
    </AdminEmptyState>

    <!-- ========== SUSPEND CONFIRM MODAL ========== -->
    <div v-if="showSuspend && detail" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Confirm status change">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showSuspend = false" />
      <div class="apex-pop relative w-full max-w-[420px] rounded-[20px] border border-white/10 bg-muted-800 p-6 shadow-[0_30px_60px_rgba(0,0,0,.5)]">
        <span class="mb-4 flex size-11 items-center justify-center rounded-xl" :class="detail.status === 'SUSPENDED' ? 'bg-[#22B07D]/14 text-[#22B07D]' : 'bg-[#EC6453]/14 text-[#EC6453]'">
          <Icon :name="detail.status === 'SUSPENDED' ? 'lucide:user-check' : 'lucide:user-x'" class="size-5" />
        </span>
        <div class="font-heading text-[19px] font-extrabold tracking-[-0.01em] text-white">
          {{ detail.status === 'SUSPENDED' ? 'Reactivate this account?' : 'Suspend this account?' }}
        </div>
        <p class="mt-2 text-[13.5px] leading-[1.55] text-muted-400">
          {{ detail.status === 'SUSPENDED'
            ? `${displayName} will be able to sign in and use the platform again.`
            : `${displayName} will be signed out at the next request and refused at login until reactivated.` }}
        </p>
        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <BaseButton rounded="full" class="border border-white/10 bg-muted-700 !text-white hover:bg-muted-600" @click="showSuspend = false">
            Cancel
          </BaseButton>
          <BaseButton
            rounded="full"
            :class="detail.status === 'SUSPENDED' ? '!bg-[#22B07D] !text-white hover:!bg-[#22B07D]/85' : '!bg-[#EC6453] !text-white hover:!bg-[#EC6453]/85'"
            @click="confirmSuspendToggle"
          >
            {{ detail.status === 'SUSPENDED' ? 'Reactivate account' : 'Suspend account' }}
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- ========== REMOVE COMPANY CONFIRM MODAL ========== -->
    <div v-if="showRemoveCompany" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Confirm company removal">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showRemoveCompany = false" />
      <div class="apex-pop relative w-full max-w-[420px] rounded-[20px] border border-white/10 bg-muted-800 p-6 shadow-[0_30px_60px_rgba(0,0,0,.5)]">
        <span class="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#EC6453]/14 text-[#EC6453]">
          <Icon name="lucide:unlink" class="size-5" />
        </span>
        <div class="font-heading text-[19px] font-extrabold tracking-[-0.01em] text-white">
          Remove the company profile?
        </div>
        <p class="mt-2 text-[13.5px] leading-[1.55] text-muted-400">
          The company details will be deleted and this becomes an individual account. This can't be undone.
        </p>
        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <BaseButton rounded="full" class="border border-white/10 bg-muted-700 !text-white hover:bg-muted-600" @click="showRemoveCompany = false">
            Cancel
          </BaseButton>
          <BaseButton rounded="full" class="!bg-[#EC6453] !text-white hover:!bg-[#EC6453]/85" @click="removeCompany">
            Remove profile
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- ========== WALLET ADJUST MODAL ========== -->
    <div v-if="showWallet" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Adjust wallet balance">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showWallet = false" />
      <div class="apex-pop relative w-full max-w-[440px] rounded-[20px] border border-white/10 bg-muted-800 p-6 shadow-[0_30px_60px_rgba(0,0,0,.5)]">
        <div class="mb-5">
          <div class="font-heading text-[20px] font-extrabold tracking-[-0.01em] text-white">
            Adjust wallet balance
          </div>
          <p class="mt-1 text-[13px] text-muted-400">
            Every adjustment writes a ledger entry — nothing moves silently.
          </p>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="submitWallet">
          <div class="flex items-center gap-2 rounded-full border border-white/8 bg-muted-700 p-[3px]" role="radiogroup" aria-label="Direction">
            <button
              type="button"
              role="radio"
              :aria-checked="walletDirection === 'credit'"
              class="flex-1 rounded-full px-4 py-2 text-[13px] font-bold transition"
              :class="walletDirection === 'credit' ? 'bg-[#22B07D]/20 text-[#22B07D]' : 'text-muted-400 hover:text-white'"
              @click="walletDirection = 'credit'"
            >
              Credit (+)
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="walletDirection === 'debit'"
              class="flex-1 rounded-full px-4 py-2 text-[13px] font-bold transition"
              :class="walletDirection === 'debit' ? 'bg-[#EC6453]/20 text-[#EC6453]' : 'text-muted-400 hover:text-white'"
              @click="walletDirection = 'debit'"
            >
              Debit (−)
            </button>
          </div>

          <div>
            <label for="wallet-amount" :class="labelClass">Amount (GBP)</label>
            <input id="wallet-amount" v-model.number="walletAmount" type="number" min="0.01" step="0.01" required placeholder="0.00" :class="inputClass">
          </div>
          <div>
            <label for="wallet-reason" :class="labelClass">Reason <span class="font-normal text-muted-500">(recorded in the audit trail)</span></label>
            <textarea id="wallet-reason" v-model="walletReason" rows="2" required minlength="3" placeholder="e.g. Goodwill credit for the delayed kickoff" class="w-full resize-y rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm leading-[1.55] text-white outline-none placeholder:text-muted-500 focus:border-primary-400" />
          </div>

          <div class="mt-1 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <BaseButton rounded="full" class="border border-white/10 bg-muted-700 !text-white hover:bg-muted-600" @click="showWallet = false">
              Cancel
            </BaseButton>
            <BaseButton type="submit" rounded="full" variant="primary" :loading="adjusting" :disabled="adjusting || !walletAmount || walletAmount <= 0 || walletReason.trim().length < 3">
              <Icon name="lucide:check" class="size-4" />Apply adjustment
            </BaseButton>
          </div>
        </form>
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
