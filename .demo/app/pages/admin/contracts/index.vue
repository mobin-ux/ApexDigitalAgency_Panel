<script setup lang="ts">
/**
 * Admin — Contract Management. Every signed financing agreement across all
 * customers: reference, value, chosen repayment term and lifecycle status,
 * with search / status filters and headline totals. Each row opens the full
 * contract dossier.
 */
definePageMeta({
  title: 'Agreements',
  layout: 'admin',
  middleware: 'admin',
})

const { formatCurrency } = useCurrency()
const route = useRoute()

const search = ref('')
const debouncedSearch = ref('')
const status = ref<string>(typeof route.query.status === 'string' ? route.query.status : '')
const userId = ref<string>(typeof route.query.userId === 'string' ? route.query.userId : '')
const page = ref(1)

watchDebounced(search, (value) => {
  debouncedSearch.value = value.trim()
}, { debounce: 300 })

watch([debouncedSearch, status], () => {
  page.value = 1
})

const query = computed(() => ({
  page: page.value,
  pageSize: 20,
  ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
  ...(status.value ? { status: status.value } : {}),
  ...(userId.value ? { userId: userId.value } : {}),
}))

const { data, pending } = await useFetch('/api/admin/contracts', { query })

const contracts = computed(() => data.value?.items ?? [])
const counts = computed(() => data.value?.statusCounts ?? { SIGNED: 0, ACTIVE: 0, COMPLETED: 0, CANCELLED: 0 })

/** AdminUserCell needs a string email; phone-only customers fall back to phone. */
function asUser(u: any) {
  return { ...u, email: u?.email || u?.phone || '—' }
}

function fmtDate(iso: string | Date | null) {
  if (!iso)
    return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1180px] px-4 pt-5 sm:px-8 sm:pt-7 flex-col gap-6 pb-8 text-fg-body">
    <AdminPageHeader
      title="Client"
      accent="agreements"
      subtitle="Every signed financing agreement — terms, repayment plan, signature and status, across all customers."
    />

    <!-- ========== SUMMARY TILES ========== -->
    <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <AdminStatTile label="Active" :value="counts.ACTIVE" icon="solar:play-circle-linear" accent="green" hint="Live agreements" />
      <AdminStatTile label="Completed" :value="counts.COMPLETED" icon="solar:check-circle-linear" accent="blue" hint="Fully repaid" />
      <AdminStatTile label="Cancelled" :value="counts.CANCELLED" icon="solar:close-circle-linear" accent="coral" />
      <AdminStatTile label="Total value" :value="formatCurrency(data?.totalValue ?? 0)" icon="solar:banknote-2-linear" accent="violet" hint="Financed principal" />
    </div>

    <!-- owner filter notice (arrived via ?userId= deep link) -->
    <div v-if="userId" class="flex items-center gap-3 rounded-[14px] border border-primary-500/30 bg-accent-tint px-4 py-3 text-[13px] text-accent-ink">
      <Icon name="lucide:filter" class="size-4 shrink-0" />
      Showing contracts for one customer only.
      <button type="button" class="ms-auto inline-flex items-center gap-1.5 font-semibold text-fg-heading hover:text-accent-ink" @click="userId = ''">
        Clear <Icon name="lucide:x" class="size-3.5" />
      </button>
    </div>

    <!-- ========== FILTER BAR ========== -->
    <div class="grid grid-cols-1 gap-3 rounded-[20px] border border-line-subtle bg-card p-4 sm:grid-cols-[1.8fr_1fr]">
      <label class="flex items-center gap-2.5 rounded-[11px] border border-line-subtle bg-raised px-3.5 py-2.5 focus-within:border-primary-400">
        <Icon name="lucide:search" class="size-4 shrink-0 text-fg-muted" />
        <input v-model="search" placeholder="Search reference, project or customer email…" class="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-fg-heading outline-none placeholder:text-fg-muted">
      </label>
      <select v-model="status" aria-label="Filter by status" class="w-full cursor-pointer rounded-[11px] border border-line-subtle bg-raised px-3.5 py-3 sm:py-2.5 text-[13px] text-fg-heading outline-none focus:border-primary-400">
        <option value="">
          All statuses
        </option>
        <option value="ACTIVE">
          Active
        </option>
        <option value="COMPLETED">
          Completed
        </option>
        <option value="SIGNED">
          Signed
        </option>
        <option value="CANCELLED">
          Cancelled
        </option>
      </select>
    </div>

    <!-- ========== LIST ========== -->
    <div v-if="pending" class="flex flex-col gap-2" aria-hidden="true">
      <div v-for="i in 6" :key="i" class="h-[76px] animate-pulse rounded-[16px] border border-line-subtle bg-card" />
    </div>

    <div v-else-if="contracts.length" class="overflow-hidden rounded-[20px] border border-line-subtle bg-chip" role="list">
      <template v-for="(c, idx) in contracts" :key="c.id">
        <div v-if="idx > 0" class="h-px bg-chip" />
        <NuxtLink :to="`/admin/contracts/${c.id}`" role="listitem" class="flex items-center gap-4 px-[22px] py-4 transition hover:bg-chip">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-mono text-[12px] font-semibold text-accent-ink">{{ c.reference }}</span>
              <span aria-hidden="true" class="text-fg-body">·</span>
              <span class="truncate text-[14.5px] font-semibold text-fg-heading">{{ c.project?.name }}</span>
            </div>
            <div class="mt-0.5 truncate text-[12.5px] text-fg-muted">
              {{ c.project?.category }} · signed {{ fmtDate(c.signedAt) }}
            </div>
          </div>

          <div class="hidden w-48 shrink-0 lg:block">
            <AdminUserCell :user="asUser(c.user)" compact />
          </div>

          <span class="hidden w-24 shrink-0 text-right text-[13px] font-semibold text-fg-heading tabular-nums md:block">
            {{ formatCurrency(c.amount) }}
          </span>

          <span class="hidden w-[104px] shrink-0 text-right text-[12.5px] text-fg-body tabular-nums xl:block">
            {{ formatCurrency(c.monthlyAmount) }}<span class="text-fg-body">/mo</span>
          </span>

          <span class="hidden w-16 shrink-0 text-center text-[12px] font-semibold text-fg-body tabular-nums xl:block">
            {{ c.termMonths }}mo
          </span>

          <AdminStatusChip :status="c.status" />
          <Icon name="lucide:chevron-right" class="size-4 shrink-0 text-fg-muted" />
        </NuxtLink>
      </template>
    </div>

    <AdminEmptyState
      v-else icon="solar:document-text-linear" title="No contracts yet"
      subtitle="Signed financing agreements appear here the moment a customer places a financed order."
    />

    <AdminPager
      v-if="data" :page="data.page" :page-count="data.pageCount" :total="data.total" noun="contracts"
      @update:page="page = $event"
    />
  </div>
</template>
