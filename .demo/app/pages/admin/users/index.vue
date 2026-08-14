<script setup lang="ts">
/**
 * Admin — Users directory. Paginated, searchable, filterable by role /
 * status / account type (individual vs company — derived from the
 * Company relation). Row click opens the user detail page. "Add user"
 * creates staff accounts via POST /api/admin/users.
 */
definePageMeta({
  title: 'Users',
  layout: 'admin',
  middleware: 'admin',
})

const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()
const route = useRoute()

// --- Filters (status deep-linkable from the Overview page) ---
const search = ref('')
const debouncedSearch = ref('')
const role = ref<string>('')
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
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-6 pb-8 font-sans text-muted-400">
    <AdminPageHeader
      eyebrow="ADMIN · USERS"
      title="Users"
      subtitle="Every account on the platform — customers, companies and staff."
    >
      <BaseButton rounded="full" variant="primary" @click="openCreate">
        <Icon name="lucide:user-plus" class="size-4" />
        <span>Add user</span>
      </BaseButton>
    </AdminPageHeader>

    <!-- ========== FILTER BAR ========== -->
    <div class="grid grid-cols-1 gap-3 rounded-[20px] border border-white/10 bg-muted-800 p-4 sm:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1fr]">
      <label class="flex items-center gap-2.5 rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 focus-within:border-primary-400">
        <Icon name="lucide:search" class="size-4 shrink-0 text-muted-500" />
        <input v-model="search" placeholder="Search name, email or company…" class="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-white outline-none placeholder:text-muted-500">
      </label>
      <select v-model="role" aria-label="Filter by role" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 sm:py-2.5 text-[13px] text-white outline-none focus:border-primary-400">
        <option value="">
          All roles
        </option>
        <option value="CUSTOMER">
          Customers
        </option>
        <option value="EMPLOYEE">
          Employees
        </option>
        <option value="ADMIN">
          Admins
        </option>
      </select>
      <select v-model="status" aria-label="Filter by status" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 sm:py-2.5 text-[13px] text-white outline-none focus:border-primary-400">
        <option value="">
          All statuses
        </option>
        <option value="ACTIVE">
          Active
        </option>
        <option value="SUSPENDED">
          Suspended
        </option>
      </select>
      <select v-model="accountType" aria-label="Filter by account type" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 sm:py-2.5 text-[13px] text-white outline-none focus:border-primary-400">
        <option value="">
          All account types
        </option>
        <option value="individual">
          Individuals
        </option>
        <option value="company">
          Companies
        </option>
      </select>
    </div>

    <!-- ========== LIST ========== -->
    <div v-if="pending" class="flex flex-col gap-2" aria-hidden="true">
      <div v-for="i in 6" :key="i" class="h-[72px] animate-pulse rounded-[16px] border border-white/5 bg-muted-800/60" />
    </div>

    <div v-else-if="users.length" class="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.02]" role="list">
      <template v-for="(u, idx) in users" :key="u.id">
        <div v-if="idx > 0" class="h-px bg-white/10" />
        <NuxtLink :to="`/admin/users/${u.id}`" role="listitem" class="flex items-center gap-4 px-[22px] py-4 transition hover:bg-white/[0.03]">
          <div class="min-w-0 flex-1">
            <AdminUserCell :user="u" />
          </div>

          <!-- account type -->
          <span v-if="u.company" class="hidden w-36 shrink-0 items-center gap-1.5 truncate text-[12.5px] font-semibold text-white lg:inline-flex">
            <Icon name="lucide:building-2" class="size-3.5 shrink-0 text-primary-400" />
            <span class="truncate">{{ u.company.name }}</span>
          </span>
          <span v-else class="hidden w-36 shrink-0 items-center gap-1.5 text-[12.5px] text-muted-500 lg:inline-flex">
            <Icon name="lucide:user" class="size-3.5 shrink-0" />Individual
          </span>

          <!-- role -->
          <AdminStatusChip class="hidden sm:inline-flex" :status="u.role" :tone="u.role === 'ADMIN' ? 'violet' : u.role === 'EMPLOYEE' ? 'blue' : 'muted'" />

          <!-- wallet -->
          <span class="hidden w-24 shrink-0 text-right text-[13px] font-semibold text-white tabular-nums md:block">
            {{ formatCurrency(u.walletBalance) }}
          </span>

          <!-- projects / joined -->
          <span class="hidden w-20 shrink-0 text-center text-[12.5px] text-muted-500 xl:block tabular-nums">
            {{ u._count.projects }} proj.
          </span>
          <span class="hidden w-28 shrink-0 text-[12.5px] text-muted-500 xl:block">
            {{ joined(u.createdAt) }}
          </span>

          <!-- status + verified -->
          <span class="flex shrink-0 items-center gap-2">
            <Icon
              v-if="u.verifiedAt" name="lucide:badge-check" class="size-4 text-[#6EA8FE]"
              aria-label="Verified account"
            />
            <AdminStatusChip :status="u.status" />
          </span>
          <Icon name="lucide:chevron-right" class="size-4 shrink-0 text-muted-500" />
        </NuxtLink>
      </template>
    </div>

    <AdminEmptyState
      v-else icon="lucide:users" title="No users match"
      subtitle="Try a different search or clear the filters."
    />

    <AdminPager
      v-if="data" :page="data.page" :page-count="data.pageCount" :total="data.total" noun="users"
      @update:page="page = $event"
    />

    <!-- ========== CREATE USER MODAL ========== -->
    <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Add user">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showCreate = false" />
      <div class="apex-pop relative w-full max-w-[480px] rounded-[20px] border border-white/10 bg-muted-800 p-6 shadow-[0_30px_60px_rgba(0,0,0,.5)]">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <div class="font-heading text-[20px] font-extrabold tracking-[-0.01em] text-white">
              Add user
            </div>
            <p class="mt-1 text-[13px] text-muted-400">
              Typically staff accounts — customers sign up themselves.
            </p>
          </div>
          <button type="button" aria-label="Close" class="flex size-8 items-center justify-center rounded-[9px] border border-white/10 bg-white/5 text-muted-400 transition hover:bg-white/10 hover:text-white" @click="showCreate = false">
            <Icon name="lucide:x" class="size-4" />
          </button>
        </div>

        <form class="flex flex-col gap-3.5" @submit.prevent="createUser">
          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label for="new-user-first" class="mb-2 block text-[12.5px] font-semibold text-white">First name</label>
              <input id="new-user-first" v-model="form.firstName" required class="w-full rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-muted-500 focus:border-primary-400">
            </div>
            <div>
              <label for="new-user-last" class="mb-2 block text-[12.5px] font-semibold text-white">Last name <span class="font-normal text-muted-500">(optional)</span></label>
              <input id="new-user-last" v-model="form.lastName" class="w-full rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-muted-500 focus:border-primary-400">
            </div>
          </div>
          <div>
            <label for="new-user-email" class="mb-2 block text-[12.5px] font-semibold text-white">Email</label>
            <input id="new-user-email" v-model="form.email" type="email" required class="w-full rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-muted-500 focus:border-primary-400">
          </div>
          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label for="new-user-password" class="mb-2 block text-[12.5px] font-semibold text-white">Temporary password</label>
              <input id="new-user-password" v-model="form.password" type="password" required minlength="8" autocomplete="new-password" class="w-full rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-muted-500 focus:border-primary-400">
            </div>
            <div>
              <label for="new-user-role" class="mb-2 block text-[12.5px] font-semibold text-white">Role</label>
              <select id="new-user-role" v-model="form.role" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 sm:py-2.5 text-sm text-white outline-none focus:border-primary-400">
                <option value="EMPLOYEE">
                  Employee
                </option>
                <option value="ADMIN">
                  Admin
                </option>
                <option value="CUSTOMER">
                  Customer
                </option>
              </select>
            </div>
          </div>
          <div>
            <label for="new-user-phone" class="mb-2 block text-[12.5px] font-semibold text-white">Phone <span class="font-normal text-muted-500">(optional)</span></label>
            <input id="new-user-phone" v-model="form.phone" class="w-full rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-muted-500 focus:border-primary-400">
          </div>

          <div class="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <BaseButton rounded="full" class="border border-white/10 bg-muted-700 !text-white hover:bg-muted-600" @click="showCreate = false">
              Cancel
            </BaseButton>
            <BaseButton type="submit" rounded="full" variant="primary" :disabled="creating" :loading="creating">
              <Icon name="lucide:user-plus" class="size-4" />
              Create account
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
