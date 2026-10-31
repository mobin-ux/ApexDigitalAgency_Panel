<script setup lang="ts">
import { personName, ukDateTime } from '~/utils/adminFormat'
import { ADMIN_INPUT, ADMIN_LABEL, ADMIN_TH } from '~/utils/adminUi'

/**
 * Admin console — Clients (`Admin Console.dc.html`). Formerly the Users directory. Paginated, searchable, filterable by role /
 * status / account type (individual vs company — derived from the
 * Company relation). Row click opens the user detail page. "Add user"
 * creates staff accounts via POST /api/admin/users.
 */
definePageMeta({
  title: 'Clients',
  layout: 'admin',
  middleware: 'admin',
})

const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()
const route = useRoute()

// --- Filters (status deep-linkable from the Overview page) ---
const search = ref('')
const debouncedSearch = ref('')
const role = ref<string>(typeof route.query.role === 'string' ? route.query.role : 'CUSTOMER')
const status = ref<string>(typeof route.query.status === 'string' ? route.query.status : '')
const accountType = ref<string>('')
const page = ref(1)

watchDebounced(search, (value) => {
  debouncedSearch.value = value.trim()
}, { debounce: 300 })

// Any filter change goes back to page 1.
watch([debouncedSearch, role, status, accountType], () => {
  page.value = 1
})

const query = computed(() => ({
  page: page.value,
  pageSize: 20,
  ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
  ...(role.value ? { role: role.value } : {}),
  ...(status.value ? { status: status.value } : {}),
  ...(accountType.value ? { accountType: accountType.value } : {}),
}))

const { data, pending, refresh } = await useFetch('/api/admin/users', { query })

const users = computed(() => data.value?.items ?? [])

function joined(iso: string | Date) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// --- Create user modal (plain v-if + apex keyframes — never <Transition>, see MEMORY.md) ---
const showCreate = ref(false)
const creating = ref(false)
const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  role: 'EMPLOYEE',
})

function openCreate() {
  Object.assign(form, { firstName: '', lastName: '', email: '', password: '', phone: '', role: 'EMPLOYEE' })
  showCreate.value = true
}

async function createUser() {
  if (creating.value)
    return
  creating.value = true
  try {
    await $fetch('/api/admin/users', {
      method: 'POST',
      body: {
        firstName: form.firstName,
        lastName: form.lastName || undefined,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        role: form.role,
      },
    })
    toaster.add({ title: 'Account created', description: `${form.email} can sign in now.`, icon: 'lucide:check', progress: true })
    showCreate.value = false
    await refresh()
  }
  catch (error: any) {
    const fieldErrors = error?.data?.data?.fieldErrors as Record<string, string[]> | undefined
    const firstFieldError = fieldErrors ? Object.values(fieldErrors)[0]?.[0] : undefined
    toaster.add({ title: 'Could not create the account', description: firstFieldError || error?.data?.message || 'Please check the details and try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    creating.value = false
  }
}

/*
 * The design's columns: client, company, projects, credit line, portal
 * status and last active (the newest signed-in session). The design's
 * "Awaiting approval" panel is not drawn: accounts are active from signup
 * and there is no approval step to act on. A row opens the client's full
 * record (profile, company, wallet, credit, two-step reset, suspension)
 * rather than the design's drawer, because that record is a page today.
 */
const canMoney = computed(() => Boolean(data.value?.canMoney))
function creditText(u: any) {
  if (!canMoney.value) {
    return 'Hidden for your role'
  }
  const line = u.creditLine
  if (!line || line.status === 'REJECTED' || !line.limit) {
    return line?.status === 'PENDING' ? 'Under review' : 'No credit line'
  }
  return `${formatCurrency(line.used)} of ${formatCurrency(line.limit)}${line.status === 'FROZEN' ? ' · frozen' : ''}`
}
const ROLE_FILTERS: [string, string][] = [['CUSTOMER', 'Clients'], ['ADMIN', 'Staff'], ['', 'All accounts']]
const STATUS_FILTERS: [string, string][] = [['', 'Any status'], ['ACTIVE', 'Active'], ['SUSPENDED', 'Suspended']]
const PILL = 'apex-ring inline-flex h-8 cursor-pointer items-center whitespace-nowrap rounded-full border px-[13px] text-[13px]'
const GRID = 'xl:grid-cols-[minmax(0,1fr)_180px_80px_190px_120px_130px]'
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="Portal" accent="clients" subtitle="Accounts on the customer portal. Open one to see its projects, wallet, credit and access.">
      <AdminButton @click="openCreate">
        <Icon name="lucide:user-plus" class="size-[15px]" />Add account
      </AdminButton>
    </AdminPageHeader>

    <div class="flex flex-wrap items-center gap-2">
      <div class="flex flex-wrap gap-2" role="group" aria-label="Filter by account type">
        <button
          v-for="[key, label] in ROLE_FILTERS" :key="key || 'all'" type="button" :aria-pressed="role === key"
          :class="[PILL, role === key ? 'bg-accent border-transparent font-semibold text-white' : 'border-line-subtle text-fg-heading hover:bg-hover font-medium']"
          @click="role = key"
        >
          {{ label }}
        </button>
      </div>
      <div class="border-line-subtle flex rounded-full border p-[3px]" role="group" aria-label="Filter by status">
        <button
          v-for="[key, label] in STATUS_FILTERS" :key="key || 'any'" type="button" :aria-pressed="status === key"
          class="apex-ring h-[26px] rounded-full px-3 text-[12.5px]"
          :class="status === key ? 'bg-accent font-semibold text-white' : 'text-fg-heading font-medium'"
          @click="status = key"
        >
          {{ label }}
        </button>
      </div>
      <span class="hidden flex-1 xl:block" />
      <input v-model="search" type="search" placeholder="Search name, email or company" aria-label="Search clients" :class="ADMIN_INPUT" class="h-9! min-w-0 flex-1 xl:w-[260px]! xl:flex-none">
    </div>

    <section class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
      <div :class="[GRID, ADMIN_TH]" class="hidden gap-3.5 px-[22px] py-3.5 xl:grid">
        <span>Client</span><span>Company</span><span class="text-end">Projects</span><span>Credit line</span><span>Portal</span><span>Last active</span>
      </div>
      <div v-if="pending" aria-hidden="true">
        <div v-for="i in 6" :key="i" class="border-line-soft h-[60px] animate-pulse border-t" />
      </div>
      <ul v-else-if="users.length">
        <li v-for="u in users" :key="u.id">
          <NuxtLink
            :to="`/admin/users/${u.id}`"
            :class="GRID"
            class="apex-ring border-line-soft hover:bg-raised grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 border-t px-[18px] py-3 sm:px-[22px]"
          >
            <span class="flex min-w-0 items-center gap-3">
              <ApexPanelAvatar :person="u" :size="32" />
              <span class="min-w-0">
                <span class="text-fg-heading block truncate text-sm font-semibold">{{ personName(u) }}</span>
                <span class="text-fg-muted mt-0.5 block truncate text-[12.5px]">{{ u.email || u.phone }}</span>
              </span>
            </span>
            <span class="text-fg-body hidden truncate text-[13px] xl:block">{{ u.company?.name || 'Individual' }}</span>
            <span class="text-fg-heading hidden text-end text-[13.5px] tabular-nums xl:block">{{ u._count.projects }}</span>
            <span class="text-fg-body hidden truncate text-[13px] tabular-nums xl:block">{{ creditText(u) }}</span>
            <AdminStatusChip
              :tone="u.status === 'SUSPENDED' ? 'danger' : 'success'"
              :label="u.status === 'SUSPENDED' ? 'Suspended' : u.role === 'CUSTOMER' ? 'Active' : 'Staff'"
              dot
              class="justify-self-end xl:justify-self-start"
            />
            <span class="text-fg-muted col-span-2 text-[12.5px] xl:col-span-1">
              <span class="xl:hidden">{{ u.company?.name || 'Individual' }} · {{ u._count.projects }} project{{ u._count.projects === 1 ? '' : 's' }} · </span>
              <ClientOnly>{{ u.sessions?.[0] ? ukDateTime(u.sessions[0].lastSeenAt) : 'Never signed in' }}</ClientOnly>
            </span>
          </NuxtLink>
        </li>
      </ul>
      <div v-else class="border-line-soft text-fg-body border-t px-6 py-11 text-center text-sm">
        {{ debouncedSearch ? `Nothing matches “${debouncedSearch}”.` : 'No accounts match these filters.' }}
      </div>
    </section>

    <AdminPager v-if="data && data.pageCount > 1" :page="data.page" :page-count="data.pageCount" :total="data.total" noun="accounts" @update:page="page = $event" />

    <AdminDialog v-model:open="showCreate" title="Add an account" description="Creates an account that can sign in straight away. Staff are better invited from Team & roles, which lets them set their own password.">
      <form id="new-account" class="grid grid-cols-1 gap-3.5 pb-1 sm:grid-cols-2" @submit.prevent="createUser">
        <div>
          <label for="nu-first" :class="ADMIN_LABEL">First name</label>
          <input id="nu-first" v-model="form.firstName" required :class="ADMIN_INPUT">
        </div>
        <div>
          <label for="nu-last" :class="ADMIN_LABEL">Last name <span class="text-fg-muted font-normal">(optional)</span></label>
          <input id="nu-last" v-model="form.lastName" :class="ADMIN_INPUT">
        </div>
        <div class="sm:col-span-2">
          <label for="nu-email" :class="ADMIN_LABEL">Email</label>
          <input id="nu-email" v-model="form.email" type="email" required autocomplete="off" :class="ADMIN_INPUT">
        </div>
        <div>
          <label for="nu-password" :class="ADMIN_LABEL">Temporary password</label>
          <input id="nu-password" v-model="form.password" type="password" required minlength="12" autocomplete="new-password" :class="ADMIN_INPUT">
        </div>
        <div>
          <label for="nu-phone" :class="ADMIN_LABEL">Phone <span class="text-fg-muted font-normal">(optional)</span></label>
          <input id="nu-phone" v-model="form.phone" type="tel" :class="ADMIN_INPUT">
        </div>
        <div class="sm:col-span-2">
          <span :class="ADMIN_LABEL">Account type</span>
          <BaseSelect v-model="form.role" rounded="lg" aria-label="Account type">
            <BaseSelectItem value="CUSTOMER">
              Client
            </BaseSelectItem>
            <BaseSelectItem value="EMPLOYEE">
              Employee (assignment only)
            </BaseSelectItem>
            <BaseSelectItem value="ADMIN">
              Staff (Owner role until changed in Team & roles)
            </BaseSelectItem>
          </BaseSelect>
        </div>
      </form>
      <template #actions>
        <AdminButton @click="showCreate = false">
          Cancel
        </AdminButton>
        <AdminButton type="submit" form="new-account" variant="primary" :disabled="creating">
          Create account
        </AdminButton>
      </template>
    </AdminDialog>
  </AdminPage>
</template>
