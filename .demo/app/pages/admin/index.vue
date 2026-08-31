<script setup lang="ts">
/**
 * Admin Overview (V2 Phase 9 — Overview & work, badges 1–3).
 *
 * The screen stopped being a dashboard and became a work queue. Three
 * rules from the spec drive everything here:
 *
 * 1. **Every tile is a count of records you can click through to.** The
 *    old header carried "Total revenue" with no period beside a customer
 *    count — a figure nobody could act on and one the API cannot scope.
 *    The four tiles are now active projects, finished work whose files
 *    are still withheld, open requests, and overdue instalments; each one
 *    links to the list it counts.
 * 2. **One queue, oldest first.** An admin's home screen is a to-do
 *    list, not four panels to scan. Every row names the record, who owns
 *    it and how long it has waited, and "Unassigned" is amber because it
 *    is usually the reason the thing has not moved.
 * 3. **Permissions hide the panel and say why.** Money never renders as a
 *    greyed-out number: the server does not send the figures to a role
 *    without `money.view`, and the card explains which roles have them.
 */
definePageMeta({
  title: 'Overview',
  layout: 'admin',
  middleware: 'admin',
})

const { user } = useUser()
const { formatCurrency, formatNumber } = useCurrency()
const { can, roleDef } = useStaffAccess()

const { data: stats, pending } = await useFetch('/api/admin/stats')

const firstName = computed(() =>
  user.value?.firstName || (user.value?.email ? user.value.email.split('@')[0] : 'there'),
)

/*
 * Today's date is a client fact: the server renders in the host's zone
 * and the browser in the reader's, so putting it in the SSR markup is
 * the hydration mismatch this project keeps re-learning (DemoToolbar's
 * ⌘/Ctrl hint, Settings' bar title). It is resolved after mount and the
 * sentence below reads correctly without it.
 */
const today = ref('')
onMounted(() => {
  today.value = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
})

const needs = computed(() => stats.value?.needs ?? [])

/** The four tiles, each a count of rows behind a real destination. */
const metrics = computed(() => {
  const s = stats.value
  return [
    {
      label: 'Active projects',
      value: formatNumber(s?.activeProjects ?? 0),
      sub: `${s?.totalProjects ?? 0} on the books · ${s?.totalCustomers ?? 0} clients`,
      icon: 'lucide:folder-open',
      tone: 'bg-primary-500/14 text-primary-400',
      to: '/admin/projects?status=IN_PROGRESS',
    },
    {
      label: 'Awaiting release',
      value: formatNumber(s?.awaitingRelease ?? 0),
      // A zero here means two different things, so the tile says which.
      sub: s?.holdEnabled
        ? 'Finished, files still held'
        : 'Holding is off — files go out on delivery',
      icon: 'lucide:lock',
      tone: 'bg-[#D9A521]/16 text-[#F2C14E]',
      to: '/admin/projects?status=COMPLETED',
    },
    {
      label: 'Open support requests',
      value: formatNumber(s?.openTickets ?? 0),
      sub: `${s?.ticketsAwaitingFirstReply ?? 0} awaiting a first reply`,
      icon: 'lucide:message-square',
      tone: 'bg-[#6EA8FE]/14 text-[#6EA8FE]',
      to: '/admin/tickets',
    },
    {
      label: 'Overdue instalments',
      value: formatNumber(s?.overdueInstallmentCount ?? 0),
      sub: can('money.view') && s?.money
        ? `${formatCurrency(s.money.overdue)} outstanding`
        : 'Amounts are limited to money roles',
      icon: 'lucide:alert-circle',
      tone: 'bg-[#EC6453]/16 text-[#EC6453]',
      to: '/admin/payments?tab=installments',
    },
  ]
})

/*
 * ACCENT_ON_LIGHT — why amber and coral text is paired to the ink token.
 *
 * The status accents are legible on the dark ink they were drawn for and
 * illegible on a white card: measured against `#ffffff`, `#F2C14E` is
 * **1.68:1** and `#EC6453` is **3.22:1**, both under the 4.5 AA floor for
 * body text, and the design system's darker amber (`--apex-warning`
 * `#D9A521`) only reaches 2.24 — no amber it defines clears AA on white.
 *
 * The light spec's answer is that on a light surface a status is a tinted
 * chip rather than coloured text ("keep the hue, drop the alpha fill …
 * so 11px chip text stays legible"), and it puts the light status palette
 * in a shared `utils/status.ts` that does not exist yet. Inventing one
 * here would give this page a convention the other admin screens do not
 * share, which is the thing that makes that sweep harder.
 *
 * So bare accent *text* pairs to the ink token in light and keeps the
 * accent in dark. The word itself still carries the meaning —
 * "Unassigned", "Overdue" — and the tinted icon beside it keeps the hue.
 * Chips and icons are untouched: they match the rest of the panel, and
 * they are that sweep's business, not this phase's.
 */
const QUEUE_TONE: Record<string, { icon: string, class: string }> = {
  release: { icon: 'lucide:lock', class: 'bg-[#D9A521]/16 text-[#F2C14E]' },
  unassigned: { icon: 'lucide:user-x', class: 'bg-[#D9A521]/16 text-[#F2C14E]' },
  money: { icon: 'lucide:credit-card', class: 'bg-[#EC6453]/16 text-[#EC6453]' },
  support: { icon: 'lucide:message-square', class: 'bg-[#6EA8FE]/14 text-[#6EA8FE]' },
}

/** The delivery pipeline, as a share of the largest bucket. */
const pipeline = computed(() => {
  const rows = stats.value?.pipeline ?? []
  const max = Math.max(1, ...rows.map(r => r.count))
  return rows.map(row => ({
    ...row,
    width: `${Math.max(row.count > 0 ? 3 : 0, Math.round((row.count / max) * 100))}%`,
    bar: row.key === 'COMPLETED' ? 'bg-[#22B07D]' : row.key === 'CANCELLED' ? 'bg-[#EC6453]' : 'bg-primary-500',
    to: `/admin/projects?status=${row.key}`,
  }))
})

const moneyRows = computed(() => {
  const m = stats.value?.money
  if (!m) {
    return []
  }
  return [
    { label: 'Credit in use', value: formatCurrency(m.creditInUse), tone: 'text-muted-900 dark:text-white' },
    { label: 'Due in the next 30 days', value: formatCurrency(m.dueNext30Days), tone: 'text-muted-900 dark:text-white' },
    // Coral reads 3.22:1 on a white card — below AA. See ACCENT_ON_LIGHT.
    { label: 'Overdue', value: formatCurrency(m.overdue), tone: m.overdue > 0 ? 'text-muted-900 dark:text-[#EC6453]' : 'text-muted-900 dark:text-white' },
  ]
})

const CARD = 'rounded-2xl border border-muted-200 bg-white p-[18px] dark:border-white/10 dark:bg-muted-800'
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-6 pb-8 font-sans">
    <AdminPageHeader
      dense
      :title="`Good to see you, ${firstName}`"
      :subtitle="`${stats?.totalProjects ?? 0} projects on the books, ${stats?.needsTotal ?? 0} things waiting on someone.`"
    />
    <p v-if="today" class="-mt-4 text-[13px] text-muted-500">
      {{ today }}
    </p>

    <!-- ========== METRICS (badge 1) ========== -->
    <section class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Platform figures">
      <NuxtLink
        v-for="m in metrics" :key="m.label" :to="m.to"
        class="apex-focus group rounded-2xl border border-muted-200 bg-white p-[18px] transition hover:border-primary-500/50 dark:border-white/10 dark:bg-muted-800"
      >
        <div class="flex items-center gap-2.5">
          <span class="flex size-[30px] shrink-0 items-center justify-center rounded-[9px]" :class="m.tone">
            <Icon :name="m.icon" class="size-[17px]" />
          </span>
          <span class="text-[12.5px] text-muted-500">{{ m.label }}</span>
          <Icon name="lucide:arrow-up-right" class="ms-auto size-4 shrink-0 text-muted-400 opacity-0 transition group-hover:opacity-100 dark:text-muted-500" />
        </div>
        <div class="font-heading mt-3.5 text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] tabular-nums text-muted-900 dark:text-white">
          {{ m.value }}
        </div>
        <div class="mt-1.5 text-[12.5px] leading-[1.45] text-muted-500">
          {{ m.sub }}
        </div>
      </NuxtLink>
    </section>

    <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_380px]">
      <!-- ========== THE QUEUE (badge 2) ========== -->
      <section aria-label="Waiting on someone">
        <div class="mb-3 flex items-center gap-2.5">
          <ApexSectionLabel as="h2" label="Waiting on someone" />
          <span class="grow" />
          <span class="text-[12.5px] text-muted-500">Oldest first</span>
        </div>

        <div v-if="pending" class="flex flex-col gap-2" aria-hidden="true">
          <div v-for="i in 4" :key="i" class="h-[70px] animate-pulse rounded-2xl border border-muted-200 bg-muted-100 dark:border-white/5 dark:bg-muted-800/60" />
        </div>

        <div
          v-else-if="needs.length"
          class="rounded-2xl border border-muted-200 bg-white px-[18px] dark:border-white/10 dark:bg-muted-800"
          role="list"
        >
          <div
            v-for="(n, index) in needs" :key="`${n.kind}-${n.to}-${n.title}`"
            role="listitem"
            class="flex flex-wrap items-center gap-3 py-3.5"
            :class="index < needs.length - 1 ? 'border-b border-muted-200 dark:border-white/5' : ''"
          >
            <span class="flex size-[34px] shrink-0 items-center justify-center rounded-[10px]" :class="QUEUE_TONE[n.kind]?.class">
              <Icon :name="QUEUE_TONE[n.kind]?.icon ?? 'lucide:circle'" class="size-[17px]" />
            </span>
            <span class="min-w-0 flex-1 basis-[200px]">
              <span class="block text-[14.5px] font-semibold leading-[1.35] text-muted-900 dark:text-white">{{ n.title }}</span>
              <span class="mt-[3px] block text-[12.5px] text-muted-500">{{ n.sub }}</span>
            </span>
            <!-- Badge 5: an owner nobody has set is a word, in amber, never a blank cell. -->
            <span
              class="w-[104px] shrink-0 truncate text-[12.5px]"
              :class="n.owner ? 'text-muted-600 dark:text-muted-300' : 'font-semibold text-muted-900 dark:text-[#F2C14E]'"
            >{{ n.owner ?? 'Unassigned' }}</span>
            <span class="w-[74px] shrink-0 text-end text-[12.5px] text-muted-500">{{ n.waited }}</span>
            <BaseButton :to="n.to" size="sm" rounded="lg" class="shrink-0">
              Open
            </BaseButton>
          </div>
        </div>

        <AdminEmptyState
          v-else icon="lucide:check-check" title="Nothing is waiting"
          subtitle="No unassigned work, no held files, no unanswered requests."
        />

        <p v-if="needs.length && (stats?.needsTotal ?? 0) > needs.length" class="mt-3 text-[12.5px] text-muted-500">
          Showing the {{ needs.length }} longest-waiting of {{ stats?.needsTotal }}.
        </p>
      </section>

      <div class="flex flex-col gap-4">
        <!-- ========== PIPELINE ========== -->
        <section :class="CARD" aria-label="Delivery pipeline">
          <div class="font-heading text-[15.5px] font-bold text-muted-900 dark:text-white">
            Delivery pipeline
          </div>
          <div class="mt-3.5 flex flex-col gap-3">
            <NuxtLink v-for="p in pipeline" :key="p.key" :to="p.to" class="apex-focus group block">
              <div class="flex items-center gap-2.5">
                <span class="min-w-0 flex-1 text-[13.5px] text-muted-600 group-hover:text-muted-900 dark:text-muted-300 dark:group-hover:text-white">{{ p.label }}</span>
                <span class="font-heading text-sm font-bold tabular-nums text-muted-900 dark:text-white">{{ p.count }}</span>
              </div>
              <div class="mt-[7px] h-[7px] overflow-hidden rounded-full bg-muted-200 dark:bg-white/6">
                <div class="h-full rounded-full transition-all" :class="p.bar" :style="{ width: p.width }" />
              </div>
            </NuxtLink>
          </div>
        </section>

        <!-- ========== MONEY (badge 3) ========== -->
        <section :class="CARD" aria-label="Money at a glance">
          <div class="flex items-center gap-2.5">
            <span class="font-heading text-[15.5px] font-bold text-muted-900 dark:text-white">Money at a glance</span>
            <span class="grow" />
            <NuxtLink v-if="can('money.view')" to="/admin/payments" class="text-primary-500 dark:text-primary-400 text-[12.5px] font-semibold hover:underline">
              Open finance
            </NuxtLink>
          </div>

          <div v-if="moneyRows.length" class="mt-3.5">
            <div
              v-for="(m, index) in moneyRows" :key="m.label"
              class="flex items-center gap-3 py-[11px]"
              :class="index < moneyRows.length - 1 ? 'border-b border-muted-200 dark:border-white/5' : ''"
            >
              <span class="min-w-0 flex-1 text-[13.5px] text-muted-600 dark:text-muted-300">{{ m.label }}</span>
              <span class="font-heading text-[15px] font-bold tabular-nums" :class="m.tone">{{ m.value }}</span>
            </div>
          </div>

          <!--
            Badge 3: the panel is absent and explains itself, rather than
            rendering figures behind a greyed-out link. The server does not
            send them either, so there is nothing here to inspect.
          -->
          <p v-else class="mt-3 text-[13px] leading-[1.6] text-muted-500">
            Financial figures are limited to the Owner, Admin and Finance roles.
            <template v-if="roleDef">
              Your role, {{ roleDef.label }}, covers {{ roleDef.covers }}.
            </template>
            Ask an owner if you need them for your work.
          </p>
        </section>
      </div>
    </div>
  </div>
</template>
