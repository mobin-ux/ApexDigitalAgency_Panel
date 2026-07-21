<script setup lang="ts">
/**
 * Dashboard home (Balance) — implementation of the Apex Design redesign.
 * Dark navy (.apex-dark) surface, electric-violet accent, Yellix display headings.
 *
 * Data: real values from /api/dashboard/stats where available (wallet, projects,
 * total spent, active count). Credit-line figures, the per-category expense split
 * and the service "from" prices are presentation placeholders until backed by the
 * API — flagged with TODO so they are easy to wire up later.
 */
definePageMeta({
  title: 'Dashboard',
  layout: 'sidenav',
  middleware: 'auth',
})

const { user } = useUser()
const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()

const showPromo = ref(true)

const { data } = await useFetch('/api/dashboard/stats')

const firstName = computed(() =>
  user.value?.firstName || (user.value?.email ? user.value.email.split('@')[0] : 'there'),
)

const stats = computed(() => data.value?.stats ?? { activeProjects: 0, walletBalance: 0, adCredits: 0, totalSpent: 0 })
const projects = computed(() => data.value?.projects ?? [])

// TODO(api): credit-line model not in schema yet — illustrative figures for now.
const credit = computed(() => {
  const limit = 12500
  const used = 3750
  return { limit, used, remaining: limit - used, pct: Math.round((used / limit) * 100) }
})

// Service catalogue — "from £X/mo" prices come from /api/config
// (Setting catalog.from-prices, admin-editable); card chrome stays local.
const { data: appConfig } = await useFetch('/api/config', { lazy: true })
const SERVICE_CARDS = [
  { key: 'marketing', name: 'Digital marketing', desc: 'Zero upfront cost · ROI-focused campaigns', fallback: 290, icon: 'lucide:megaphone', badge: 'HOT', badgeClass: 'text-[#EC6453] bg-[#EC6453]/15' },
  { key: 'development', name: 'Web development', desc: 'Modern stack · high-performance builds', fallback: 420, icon: 'lucide:code-2', badge: 'NEW', badgeClass: 'text-primary-200 bg-primary-500/20' },
  { key: 'seo', name: 'SEO Optimization', desc: 'Rank #1 on Google Search', fallback: 190, icon: 'lucide:search', badge: 'POPULAR', badgeClass: 'text-muted-400 bg-white/5' },
  { key: 'branding', name: 'Branding & Design', desc: 'Logo, UI/UX & visual identity', fallback: 250, icon: 'lucide:palette', badge: 'POPULAR', badgeClass: 'text-muted-400 bg-white/5' },
]
const services = computed(() => SERVICE_CARDS.map(card => ({
  ...card,
  from: (appConfig.value as any)?.fromPrices?.[card.key] ?? card.fallback,
})))

// TODO(api): per-category spend breakdown — illustrative split for now.
const expenses = [
  { label: 'Marketing', value: 3200, class: 'bg-primary-500' },
  { label: 'Development', value: 3100, class: 'bg-primary-400' },
  { label: 'Design', value: 1940, class: 'bg-primary-200' },
]
const expenseTotal = computed(() => expenses.reduce((s, e) => s + e.value, 0))

function statusMeta(status: string) {
  switch (status) {
    case 'In Progress':
      return { label: 'In progress', accent: '#22B07D', text: 'text-[#22B07D]', chip: 'bg-[#22B07D]/15', bar: 'bg-[#22B07D]' }
    case 'Completed':
      return { label: 'Completed', accent: '#9B79F6', text: 'text-primary-400', chip: 'bg-primary-500/16', bar: 'bg-primary-500' }
    case 'Pending':
      return { label: 'Pending', accent: '#F2C14E', text: 'text-[#F2C14E]', chip: 'bg-[#D9A521]/14', bar: 'bg-[#F2C14E]' }
    default:
      return { label: 'Started', accent: '#7D53F2', text: 'text-primary-400', chip: 'bg-primary-500/16', bar: 'bg-primary-500' }
  }
}

function comingSoon(feature: string) {
  toaster.add({ title: feature, description: 'Your account manager has been notified and will be in touch shortly.', icon: 'lucide:check', progress: true })
}

const VIOLET_BLOB = 'radial-gradient(circle at 50% 38%, #9b79f6 0%, #7d53f2 55%, #6c40e8 100%)'
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-7 pb-8 font-sans text-muted-400">
    <!-- ========== PAGE HEADER ========== -->
    <div class="flex flex-wrap items-end justify-between gap-5">
      <div>
        <div class="mb-2 text-xs font-bold tracking-[0.04em] text-primary-400">
          👋 WELCOME BACK
        </div>
        <h1 class="font-heading text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white sm:text-[38px]">
          Welcome back, <span class="text-primary-400">{{ firstName }}</span>
        </h1>
        <p class="mt-2 text-[15px] text-muted-400">
          Manage your projects, wallet, and services — all in one place.
        </p>
      </div>
      <BaseButton rounded="full" to="/dashboards/wallet" class="border border-white/10 bg-muted-800 !text-white hover:bg-muted-700">
        <Icon name="lucide:history" class="size-4" />
        <span>History</span>
      </BaseButton>
    </div>

    <!-- ========== PROMO HERO ========== -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out" enter-from-class="opacity-0 -translate-y-2"
      leave-active-class="transition-all duration-300 ease-in" leave-to-class="opacity-0 -translate-y-2"
    >
      <section
        v-if="showPromo"
        aria-label="Promotion"
        class="relative overflow-hidden rounded-[28px] border border-white/10 p-7 sm:p-10"
        style="background: radial-gradient(120% 140% at 82% 18%, rgba(125,83,242,.32) 0%, rgba(125,83,242,0) 46%), linear-gradient(150deg, #16252A 0%, #101D21 60%, #0E181B 100%);"
      >
        <div class="pointer-events-none absolute -top-16 right-28 size-72 rounded-full opacity-45 blur-[70px]" :style="{ background: VIOLET_BLOB }" />
        <div class="pointer-events-none absolute inset-0 opacity-50" style="background-image: radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px); background-size: 22px 22px; mask-image: linear-gradient(120deg, transparent 40%, #000 100%);" />

        <button
          type="button" aria-label="Dismiss promotion"
          class="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-[9px] border border-white/10 bg-white/5 text-muted-400 transition hover:bg-white/10 hover:text-white"
          @click="showPromo = false"
        >
          <Icon name="lucide:x" class="size-4" />
        </button>

        <div class="relative z-[2] grid items-center gap-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div class="mb-5 flex flex-wrap gap-2.5">
              <span class="inline-flex items-center gap-1.5 rounded-full border border-[#D9A521]/30 bg-[#D9A521]/15 px-3 py-1.5 text-xs font-bold tracking-[0.03em] text-[#F2C14E]">🔥 HOT OFFER</span>
              <span class="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-[0.03em] text-muted-400">
                <Icon name="lucide:clock" class="size-3" /> LIMITED SPOTS AVAILABLE
              </span>
            </div>
            <h2 class="font-heading text-[34px] font-extrabold leading-[1.04] tracking-[-0.025em] text-white sm:text-5xl">
              Scale your business,<br>
              <span class="bg-gradient-to-r from-primary-400 to-primary-200 bg-clip-text text-transparent">pay from profits.</span>
            </h2>
            <p class="mb-6 mt-[18px] max-w-[520px] text-base leading-[1.55] text-muted-400">
              Don't let cash flow stop your growth. Use our <strong class="font-semibold text-white">Zero Upfront Payment</strong> plan for Digital Marketing &amp; SEO services. We invest in you, you split the win.
            </p>
            <div class="flex flex-wrap items-center gap-[18px]">
              <BaseButton to="/dashboards/services" rounded="full" variant="primary" size="lg" class="px-7">
                <span>Get started now</span>
                <Icon name="lucide:arrow-right" class="size-4" />
              </BaseButton>
              <button type="button" class="inline-flex items-center gap-2.5 text-[15px] font-semibold text-white transition hover:text-primary-400" @click="comingSoon('How it works')">
                <span class="inline-flex size-9 items-center justify-center rounded-full border border-white/15"><Icon name="lucide:play" class="size-3.5" /></span>
                How it works?
              </button>
            </div>
            <p class="mt-[22px] text-xs text-muted-500">
              * No credit card required for application.
            </p>
          </div>

          <!-- decorative revenue card -->
          <div class="hidden justify-center lg:flex">
            <div class="relative w-[300px]">
              <div class="-rotate-[4deg] rounded-[20px] border border-white/15 p-6 shadow-[0_30px_60px_rgba(0,0,0,.4)] backdrop-blur" style="background: linear-gradient(160deg, rgba(30,47,53,.9), rgba(16,29,33,.9));">
                <div class="mb-3.5 flex items-center justify-between">
                  <span class="text-[11px] font-bold tracking-[0.06em] text-muted-500">REVENUE GROWTH</span>
                  <span class="inline-flex size-[30px] items-center justify-center rounded-full bg-[#22B07D]/16 text-[#22B07D]"><Icon name="lucide:trending-up" class="size-[15px]" /></span>
                </div>
                <div class="font-heading text-[38px] font-extrabold leading-none tracking-[-0.02em] text-white">
                  +145%
                </div>
                <div class="mt-[18px] flex h-[74px] items-end gap-2.5">
                  <div class="flex-1 rounded-[5px] bg-primary-500/35" style="height:38%" />
                  <div class="flex-1 rounded-[5px] bg-primary-500/45" style="height:52%" />
                  <div class="flex-1 rounded-[5px] bg-primary-500/40" style="height:44%" />
                  <div class="flex-1 rounded-[5px] bg-primary-500/60" style="height:70%" />
                  <div class="flex-1 rounded-[5px] bg-gradient-to-b from-primary-400 to-primary-600 shadow-[0_6px_16px_rgba(125,83,242,.5)]" style="height:100%" />
                </div>
              </div>
              <div class="apex-float absolute -bottom-5 -right-3.5 flex size-[58px] items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-[0_16px_36px_rgba(125,83,242,.5)]">
                <Icon name="lucide:wand-sparkles" class="size-6 text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </Transition>

    <!-- ========== FINANCIAL STATUS ========== -->
    <section class="flex flex-col gap-4">
      <h2 class="flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
        <span class="h-[18px] w-1.5 rounded-full bg-primary-500" />Financial status
      </h2>

      <div class="grid items-stretch gap-[18px] lg:grid-cols-[1fr_1.32fr]">
        <!-- cash balance (emphasised) -->
        <div class="relative flex flex-col overflow-hidden rounded-[20px] border border-primary-500/30 p-6" style="background: linear-gradient(150deg, #241846, #16252A 72%);">
          <div class="pointer-events-none absolute -top-12 -right-6 size-40 rounded-full opacity-50 blur-[50px]" :style="{ background: VIOLET_BLOB }" />
          <div class="relative mb-5 flex items-center gap-3">
            <span class="flex size-9 items-center justify-center rounded-[10px] bg-white/10 text-white"><Icon name="lucide:wallet" class="size-[18px]" /></span>
            <span class="text-[12.5px] font-bold tracking-[0.06em] text-primary-200">CASH BALANCE</span>
          </div>
          <div class="relative flex items-baseline gap-2">
            <span class="font-heading text-[46px] font-extrabold leading-none tracking-[-0.02em] text-white tabular-nums">{{ formatCurrency(stats.walletBalance) }}</span>
          </div>
          <div class="relative mt-2 text-[13px] text-muted-400">
            Available to spend right now
          </div>
          <div class="relative mt-auto flex items-center gap-3 pt-6">
            <BaseButton rounded="full" to="/dashboards/wallet" class="!bg-white !text-muted-900 hover:!bg-primary-50">
              <Icon name="lucide:plus" class="size-4" /> Deposit funds
            </BaseButton>
            <NuxtLink to="/dashboards/wallet" class="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-primary-200 transition hover:text-white">
              Transactions <Icon name="lucide:arrow-right" class="size-3.5" />
            </NuxtLink>
          </div>
        </div>

        <!-- credit line -->
        <div class="flex flex-col rounded-[20px] border border-white/10 bg-muted-800 p-6 transition hover:border-white/15">
          <div class="mb-5 flex items-center justify-between">
            <span class="inline-flex items-center gap-3 text-[12.5px] font-bold tracking-[0.06em] text-muted-500">
              <span class="flex size-9 items-center justify-center rounded-[10px] bg-[#22B07D]/14 text-[#22B07D]"><Icon name="lucide:credit-card" class="size-[18px]" /></span>CREDIT LINE
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-[#22B07D]/14 px-2.5 py-1 text-[11px] font-bold text-[#22B07D]"><Icon name="lucide:check" class="size-3" />Approved</span>
          </div>
          <div class="flex flex-wrap items-baseline gap-2">
            <span class="font-heading text-[42px] font-extrabold leading-none tracking-[-0.02em] text-white tabular-nums">{{ formatCurrency(credit.remaining) }}</span>
            <span class="text-sm font-semibold text-muted-400">remaining</span>
            <span class="ml-auto text-[13.5px] text-muted-500">of <span class="font-semibold text-white tabular-nums">{{ formatCurrency(credit.limit) }}</span> limit</span>
          </div>
          <div role="progressbar" :aria-valuenow="credit.used" aria-valuemin="0" :aria-valuemax="credit.limit" class="my-4 h-2.5 overflow-hidden rounded-full bg-white/5">
            <div class="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-500 shadow-[0_0_12px_rgba(125,83,242,.5)]" :style="{ width: `${credit.pct}%` }" />
          </div>
          <div class="flex items-center justify-between text-[12.5px]">
            <span class="inline-flex items-center gap-1.5 text-muted-400"><span class="size-2 rounded-full bg-primary-500" />Used <strong class="font-semibold text-white tabular-nums">{{ formatCurrency(credit.used) }}</strong></span>
            <span class="inline-flex items-center gap-1.5 text-muted-400"><span class="size-2 rounded-full border border-white/15 bg-white/5" />Available <strong class="font-semibold text-white tabular-nums">{{ formatCurrency(credit.remaining) }}</strong></span>
          </div>
          <div class="mt-auto flex items-center gap-2 border-t border-white/10 pt-[18px] text-[13px] text-muted-400">
            <Icon name="lucide:shield-check" class="size-[15px] text-[#22B07D]" />Zero interest on installments for the next 30 days.
          </div>
        </div>
      </div>
    </section>

    <!-- ========== ACTIVE WORK ========== -->
    <section class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-3.5">
          <h2 class="flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
            <span class="h-[18px] w-1.5 rounded-full bg-[#22B07D]" />Active work
          </h2>
          <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[13px] font-semibold text-white tabular-nums">{{ stats.activeProjects }} project{{ stats.activeProjects === 1 ? '' : 's' }} running</span>
        </div>
        <NuxtLink to="/dashboards/orders" class="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-primary-400 transition hover:text-white">
          View all projects <Icon name="lucide:arrow-right" class="size-3.5" />
        </NuxtLink>
      </div>

      <div v-if="projects.length" role="list" class="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.02]">
        <template v-for="(project, idx) in projects" :key="project.id">
          <div v-if="idx > 0" class="h-px bg-white/10" />
          <NuxtLink
            to="/dashboards/orders" role="listitem"
            class="flex items-center gap-4 border-l-[3px] px-[22px] py-[18px] transition hover:bg-white/[0.03]"
            :style="{ borderLeftColor: statusMeta(project.status).accent }"
          >
            <span class="flex size-[42px] shrink-0 items-center justify-center rounded-[11px] border border-white/10 bg-white/5 text-muted-400"><Icon :name="project.icon" class="size-[19px]" /></span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[15.5px] font-semibold text-white">
                {{ project.name }}
              </div>
              <div class="mt-0.5 truncate text-[13px] text-muted-500">
                {{ project.category }}
              </div>
            </div>
            <div class="hidden w-[170px] shrink-0 items-center gap-2 sm:flex">
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <div class="h-full rounded-full" :class="statusMeta(project.status).bar" :style="{ width: `${project.progress}%` }" />
              </div>
              <span class="w-9 text-right text-xs font-bold text-white tabular-nums">{{ project.progress }}%</span>
            </div>
            <span v-if="project.deadline" class="hidden w-24 shrink-0 items-center gap-1.5 text-[12.5px] text-muted-500 md:inline-flex"><Icon name="lucide:calendar" class="size-3.5" />{{ project.deadline }}</span>
            <span class="shrink-0 rounded-full px-3 py-1.5 text-center text-[11px] font-bold" :class="[statusMeta(project.status).chip, statusMeta(project.status).text]">{{ statusMeta(project.status).label }}</span>
          </NuxtLink>
        </template>
      </div>

      <div v-else class="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-white/15 bg-white/[0.02] p-10 text-center">
        <span class="mb-4 flex size-14 items-center justify-center rounded-full bg-white/5 text-muted-500"><Icon name="lucide:folder-plus" class="size-7" /></span>
        <div class="text-base font-bold text-white">
          No active projects
        </div>
        <p class="mb-5 mt-1 max-w-[220px] text-[13px] text-muted-500">
          Start a new project to track its progress here.
        </p>
        <BaseButton to="/dashboards/services" rounded="full" variant="primary">
          <Icon name="lucide:plus" class="size-4" />Start a project
        </BaseButton>
      </div>
    </section>

    <!-- ========== ORDER A SERVICE ========== -->
    <section class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="mb-1.5 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
            <span class="h-[18px] w-1.5 rounded-full bg-primary-400" />Order a service
          </h2>
          <p class="text-sm text-muted-400">
            Pick a service to see pricing &amp; monthly installments, then start a new order.
          </p>
        </div>
        <NuxtLink to="/dashboards/services" class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-muted-800 px-4 py-2 text-[13px] font-semibold text-white transition hover:border-white/15 hover:bg-muted-700">
          View full catalog <Icon name="lucide:arrow-right" class="size-3.5" />
        </NuxtLink>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <NuxtLink
          v-for="svc in services" :key="svc.key"
          :to="`/dashboards/services?service=${svc.key}`"
          :aria-label="`Order ${svc.name} — from ${formatCurrency(svc.from)} per month`"
          class="group flex flex-col rounded-[20px] border border-white/10 bg-muted-800 p-5 transition duration-150 hover:-translate-y-[3px] hover:border-primary-500/50"
        >
          <div class="mb-[18px] flex items-center justify-between">
            <span class="flex size-11 items-center justify-center rounded-xl bg-primary-500/14 text-primary-400"><Icon :name="svc.icon" class="size-[21px]" /></span>
            <span class="rounded-full px-2.5 py-1 text-[10.5px] font-extrabold tracking-[0.05em]" :class="svc.badgeClass">{{ svc.badge }}</span>
          </div>
          <div class="font-heading text-[19px] font-bold tracking-[-0.01em] text-white">
            {{ svc.name }}
          </div>
          <div class="mt-1 text-[13px] leading-[1.45] text-muted-400">
            {{ svc.desc }}
          </div>
          <div class="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
            <span class="text-[12.5px] text-muted-500">from <strong class="text-sm font-bold text-white tabular-nums">{{ formatCurrency(svc.from) }}</strong>/mo</span>
            <span class="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary-400">Order <Icon name="lucide:arrow-right" class="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- ========== EXPENSES ========== -->
    <section class="flex flex-col gap-4">
      <h2 class="flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
        <span class="h-[18px] w-1.5 rounded-full bg-primary-200" />Expenses
      </h2>
      <div class="grid items-center gap-8 rounded-[20px] border border-white/10 bg-muted-800 p-6 md:grid-cols-[minmax(200px,260px)_1fr]">
        <div>
          <div class="text-[13px] font-medium text-muted-500">
            Total spent this quarter
          </div>
          <div class="mt-1.5 font-heading text-[40px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white tabular-nums">
            {{ formatCurrency(stats.totalSpent || expenseTotal) }}
          </div>
          <div class="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#22B07D]">
            <Icon name="lucide:trending-up" class="size-3.5" />+12% vs last quarter
          </div>
        </div>
        <div>
          <div role="img" aria-label="Spending breakdown" class="flex h-3.5 gap-0.5 overflow-hidden rounded-full">
            <div v-for="e in expenses" :key="e.label" class="h-full" :class="e.class" :style="{ flexGrow: e.value }" />
          </div>
          <div class="mt-[18px] grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div v-for="e in expenses" :key="e.label" class="flex flex-col gap-1.5">
              <span class="inline-flex items-center gap-2 text-[13px] text-muted-400"><span class="size-[9px] rounded-[3px]" :class="e.class" />{{ e.label }}</span>
              <span class="font-heading text-[18px] font-bold text-white tabular-nums">{{ formatCurrency(e.value) }} <span class="font-sans text-xs font-medium text-muted-500">{{ Math.round((e.value / expenseTotal) * 100) }}%</span></span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
@keyframes apex-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-7px);
  }
}
.apex-float {
  animation: apex-float 5s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}
@media (prefers-reduced-motion: reduce) {
  .apex-float {
    animation: none;
  }
}
</style>
