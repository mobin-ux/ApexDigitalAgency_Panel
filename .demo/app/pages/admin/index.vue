<script setup lang="ts">
/**
 * Admin Overview — headline platform stats, a "needs attention" queue
 * and the recent privileged-action trail. Backed by /api/admin/stats.
 */
definePageMeta({
  title: 'Overview',
  layout: 'admin',
  middleware: 'admin',
})

const { user } = useUser()
const { formatCurrency, formatNumber } = useCurrency()

const { data: stats } = await useFetch('/api/admin/stats')

const firstName = computed(() =>
  user.value?.firstName || (user.value?.email ? user.value.email.split('@')[0] : 'admin'),
)

/** Items that need an admin's action right now, with a direct route in. */
const attention = computed(() => {
  const s = stats.value
  if (!s)
    return []
  return [
    { count: s.pendingWithdrawals, label: 'withdrawal requests to review', to: '/admin/payments?tab=withdrawals', icon: 'lucide:banknote' },
    { count: s.unassignedTickets, label: 'unassigned open tickets', to: '/admin/tickets?assignee=unassigned', icon: 'lucide:inbox' },
    { count: s.pendingProjects, label: 'projects awaiting activation', to: '/admin/projects?status=PENDING', icon: 'lucide:folder-clock' },
    { count: s.suspendedUsers, label: 'suspended accounts', to: '/admin/users?status=SUSPENDED', icon: 'lucide:user-x' },
  ].filter(item => item.count > 0)
})

const modules = [
  { label: 'Users', desc: 'Accounts, roles, verification, company profiles', icon: 'solar:users-group-rounded-linear', to: '/admin/users' },
  { label: 'Projects', desc: 'Every project: status, milestones, managers', icon: 'solar:suitcase-linear', to: '/admin/projects' },
  { label: 'Payments', desc: 'Ledger, refunds, withdrawals, installments', icon: 'solar:wallet-2-linear', to: '/admin/payments' },
  { label: 'Tickets', desc: 'Support inbox, assignment, internal notes', icon: 'solar:headphones-round-linear', to: '/admin/tickets' },
  { label: 'Tools', desc: 'Audit trail, announcements, dev utilities', icon: 'solar:tuning-2-linear', to: '/admin/tools' },
  { label: 'Settings', desc: 'Platform-wide configuration', icon: 'solar:settings-linear', to: '/admin/settings' },
]

/** "admin.user.update" -> "User updated" for the audit feed. */
function auditLabel(action: string) {
  const parts = action.split('.')
  const target = parts[1] ?? 'record'
  const verbRaw = parts[2] ?? 'changed'
  const verbs: Record<string, string> = {
    'create': 'created',
    'update': 'updated',
    'delete': 'deleted',
    'reply': 'replied to',
    'note': 'noted on',
    'approve': 'approved',
    'reject': 'rejected',
    'refund': 'refunded',
    'broadcast': 'broadcast',
    'wallet-adjust': 'wallet-adjusted',
    'remove': 'removed',
  }
  const label = `${target.charAt(0).toUpperCase()}${target.slice(1)} ${verbs[verbRaw] ?? verbRaw}`
  return label
}

function timeAgo(iso: string | Date) {
  const then = new Date(iso).getTime()
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 1)
    return 'just now'
  if (mins < 60)
    return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24)
    return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-7 pb-8 font-sans text-muted-400">
    <AdminPageHeader
      eyebrow="🛡️ ADMIN PANEL"
      :title="`Good to see you, ${firstName}`"
      subtitle="Everything across the platform — users, projects, money and support — in one place."
    >
      <BaseButton rounded="full" to="/admin/tools" class="border border-white/10 bg-muted-800 !text-white hover:bg-muted-700">
        <Icon name="lucide:scroll-text" class="size-4" />
        <span>Audit trail</span>
      </BaseButton>
    </AdminPageHeader>

    <!-- ========== HEADLINE STATS ========== -->
    <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Platform statistics">
      <AdminStatTile
        label="Customers" :value="formatNumber(stats?.totalCustomers ?? 0)" icon="lucide:users" accent="violet"
        :hint="`+${stats?.newCustomers30d ?? 0} in the last 30 days`"
      />
      <AdminStatTile
        label="Total revenue" :value="formatCurrency(stats?.totalRevenue ?? 0)" icon="lucide:trending-up" accent="green"
        :hint="`${formatCurrency(stats?.revenue30d ?? 0)} in the last 30 days`"
      />
      <AdminStatTile
        label="Active projects" :value="formatNumber(stats?.activeProjects ?? 0)" icon="lucide:briefcase" accent="blue"
        :hint="`${stats?.totalProjects ?? 0} projects overall`"
      />
      <AdminStatTile
        label="Open tickets" :value="formatNumber(stats?.openTickets ?? 0)" icon="lucide:life-buoy" accent="amber"
        :hint="`${stats?.unassignedTickets ?? 0} unassigned`"
      />
    </section>

    <!-- ========== NEEDS ATTENTION ========== -->
    <section v-if="attention.length" class="flex flex-col gap-4" aria-label="Needs attention">
      <h2 class="flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
        <span class="h-[18px] w-1.5 rounded-full bg-[#F2C14E]" />Needs attention
      </h2>
      <div class="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.02]" role="list">
        <template v-for="(item, idx) in attention" :key="item.label">
          <div v-if="idx > 0" class="h-px bg-white/10" />
          <NuxtLink :to="item.to" role="listitem" class="flex items-center gap-4 px-[22px] py-4 transition hover:bg-white/[0.03]">
            <span class="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[#D9A521]/14 text-[#F2C14E]">
              <Icon :name="item.icon" class="size-[17px]" />
            </span>
            <span class="min-w-0 flex-1 truncate text-[14.5px] text-muted-400">
              <strong class="font-bold text-white tabular-nums">{{ item.count }}</strong> {{ item.label }}
            </span>
            <Icon name="lucide:arrow-right" class="size-4 shrink-0 text-muted-500" />
          </NuxtLink>
        </template>
      </div>
    </section>

    <!-- ========== MODULES + AUDIT FEED ========== -->
    <div class="grid items-start gap-7 xl:grid-cols-[1.4fr_1fr]">
      <section class="flex flex-col gap-4" aria-label="Management modules">
        <h2 class="flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
          <span class="h-[18px] w-1.5 rounded-full bg-primary-500" />Manage
        </h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NuxtLink
            v-for="mod in modules" :key="mod.label" :to="mod.to"
            class="group flex flex-col rounded-[20px] border border-white/10 bg-muted-800 p-5 transition duration-150 hover:-translate-y-[3px] hover:border-primary-500/50"
          >
            <div class="mb-4 flex items-center justify-between">
              <span class="flex size-11 items-center justify-center rounded-xl bg-primary-500/14 text-primary-400">
                <Icon :name="mod.icon" class="size-[21px]" />
              </span>
              <Icon name="lucide:arrow-right" class="size-4 text-muted-500 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-400" />
            </div>
            <div class="font-heading text-[17px] font-bold tracking-[-0.01em] text-white">
              {{ mod.label }}
            </div>
            <div class="mt-1 text-[13px] leading-[1.45] text-muted-400">
              {{ mod.desc }}
            </div>
          </NuxtLink>
        </div>
      </section>

      <section class="flex flex-col gap-4" aria-label="Recent admin activity">
        <div class="flex items-center justify-between">
          <h2 class="flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
            <span class="h-[18px] w-1.5 rounded-full bg-[#22B07D]" />Recent activity
          </h2>
          <NuxtLink to="/admin/tools" class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-400 transition hover:text-white">
            Full trail <Icon name="lucide:arrow-right" class="size-3.5" />
          </NuxtLink>
        </div>

        <div v-if="stats?.recentAudit?.length" class="overflow-hidden rounded-[20px] border border-white/10 bg-muted-800" role="list">
          <template v-for="(entry, idx) in stats.recentAudit" :key="entry.id">
            <div v-if="idx > 0" class="mx-5 h-px bg-white/10" />
            <div role="listitem" class="flex items-start gap-3 px-5 py-3.5">
              <span class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-muted-500">
                <Icon name="lucide:activity" class="size-3.5" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-[13.5px] font-semibold text-white">
                  {{ auditLabel(entry.action) }}
                </div>
                <div class="mt-0.5 truncate text-xs text-muted-500">
                  {{ entry.actorEmail }} · {{ timeAgo(entry.createdAt) }}
                </div>
              </div>
            </div>
          </template>
        </div>

        <AdminEmptyState
          v-else icon="lucide:scroll-text" title="No admin activity yet"
          subtitle="Privileged actions will appear here as they happen."
        />
      </section>
    </div>
  </div>
</template>
