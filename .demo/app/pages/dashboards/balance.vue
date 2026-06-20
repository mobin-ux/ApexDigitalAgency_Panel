<script setup lang="ts">
/**
 * Dashboard home (Balance) — rebuilt on the Apex Digi design system.
 * - Surfaces use muted/primary tokens (themeable: dark default + light).
 * - Real data from /api/dashboard/stats, money formatted as GBP via useCurrency.
 */
definePageMeta({
  title: 'Dashboard',
  layout: 'sidenav',
  middleware: 'auth',
})

const { user } = useUser()
const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()

const showFeatures = ref(true)

const { data: dashboardData } = await useFetch('/api/dashboard/stats')

const firstName = computed(() => user.value?.firstName || (user.value?.email ? user.value.email.split('@')[0] : 'there'))

const stats = computed(() => dashboardData.value?.stats ?? {
  activeProjects: 0,
  walletBalance: 0,
  adCredits: 0,
  totalSpent: 0,
})
const projects = computed(() => dashboardData.value?.projects ?? [])

function statusClasses(status: string) {
  switch (status) {
    case 'In Progress':
      return 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20'
    case 'Pending':
      return 'bg-amber-500/10 text-amber-500 ring-amber-500/20'
    case 'Completed':
      return 'bg-primary-500/10 text-primary-500 ring-primary-500/20'
    default:
      return 'bg-muted-400/10 text-muted-500 ring-muted-400/20'
  }
}

function comingSoon(feature: string) {
  toaster.add({
    title: feature,
    description: 'Your account manager has been notified and will be in touch shortly.',
    icon: 'lucide:check',
    progress: true,
  })
}
</script>

<template>
  <div class="relative min-h-screen w-full overflow-x-hidden pb-10">
    <!-- Ambient brand accents (subtle in both themes) -->
    <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div class="absolute -left-[5%] -top-[10%] size-[600px] rounded-full bg-primary-500/5 blur-[120px]" />
      <div class="absolute -bottom-[10%] -right-[5%] size-[700px] rounded-full bg-indigo-500/5 blur-[120px]" />
    </div>

    <!-- Header -->
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <BaseHeading as="h1" size="2xl" weight="light" class="text-muted-900 dark:text-white">
          Welcome back, <span class="font-bold text-primary-500">{{ firstName }}</span>
        </BaseHeading>
        <BaseParagraph size="sm" class="mt-1 text-muted-500">
          Manage your projects, wallet, and services.
        </BaseParagraph>
      </div>
      <BaseButton rounded="lg" variant="ghost" to="/dashboards/wallet" class="self-start sm:self-auto">
        <Icon name="lucide:history" class="size-4" />
        <span>History</span>
      </BaseButton>
    </div>

    <div class="space-y-8">
      <!-- Hero: 0% finance offer (intentionally dark in both themes) -->
      <Transition
        enter-active-class="transition-all duration-500 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        leave-active-class="transition-all duration-300 ease-in"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div v-if="showFeatures" class="relative overflow-hidden rounded-3xl border border-muted-800 bg-muted-950 shadow-2xl">
          <div class="absolute right-0 top-0 size-[500px] -translate-y-1/3 translate-x-1/3 rounded-full bg-primary-600/20 blur-[120px]" />
          <div class="absolute bottom-0 left-0 size-[350px] -translate-x-1/3 translate-y-1/3 rounded-full bg-indigo-600/10 blur-[100px]" />

          <button
            type="button"
            class="absolute right-4 top-4 z-20 flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Dismiss"
            @click="showFeatures = false"
          >
            <Icon name="lucide:x" class="size-4" />
          </button>

          <div class="relative z-10 grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-12">
            <div class="space-y-6 lg:col-span-7">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-400">
                  <Icon name="lucide:flame" class="size-3" /> 0% Finance
                </span>
                <span class="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-400">
                  <Icon name="lucide:clock" class="size-3" /> No upfront payment
                </span>
              </div>

              <div>
                <h2 class="mb-3 text-3xl font-black leading-tight tracking-tight text-white md:text-4xl">
                  Scale your business,<br>
                  <span class="bg-gradient-to-r from-primary-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">pay from profits.</span>
                </h2>
                <p class="max-w-xl leading-relaxed text-muted-400">
                  Don't let cash flow stop your growth. Spread the cost of digital
                  marketing &amp; development over <strong class="text-muted-200">12 interest-free
                    months</strong> — no upfront payment, no credit checks.
                </p>
              </div>

              <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <BaseButton to="/dashboards/services" rounded="lg" variant="primary" size="lg" class="w-full sm:w-auto">
                  <span>Get started</span>
                  <Icon name="lucide:arrow-right" class="size-4" />
                </BaseButton>
                <BaseButton rounded="lg" variant="ghost" class="w-full text-white hover:text-primary-300 sm:w-auto" @click="comingSoon('How it works')">
                  <Icon name="lucide:play-circle" class="size-5" />
                  <span>How it works?</span>
                </BaseButton>
              </div>
            </div>

            <!-- Decorative stat card cluster (hidden on small screens) -->
            <div class="relative hidden h-[260px] lg:col-span-5 lg:block">
              <div class="absolute left-1/2 top-1/2 w-60 -translate-x-1/2 -translate-y-1/2 rotate-[-6deg] rounded-3xl border border-white/10 bg-muted-900/90 p-5 shadow-2xl backdrop-blur-xl">
                <div class="mb-4 flex items-center justify-between">
                  <div class="flex flex-col">
                    <span class="text-[10px] font-bold uppercase text-muted-400">Revenue growth</span>
                    <span class="text-xl font-bold text-white">+145%</span>
                  </div>
                  <div class="flex size-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <Icon name="lucide:trending-up" class="size-4" />
                  </div>
                </div>
                <div class="flex h-16 w-full items-end gap-1">
                  <div class="h-[30%] w-1/5 rounded-t-sm bg-primary-500/20" />
                  <div class="h-[50%] w-1/5 rounded-t-sm bg-primary-500/40" />
                  <div class="h-[40%] w-1/5 rounded-t-sm bg-primary-500/60" />
                  <div class="h-[70%] w-1/5 rounded-t-sm bg-primary-500/80" />
                  <div class="h-full w-1/5 animate-pulse rounded-t-sm bg-primary-500" />
                </div>
              </div>
              <div class="animate-float absolute left-1/2 top-1/2 w-44 -translate-x-[30%] -translate-y-[70%] rotate-[12deg] rounded-2xl border border-white/5 bg-muted-800/80 p-4 shadow-xl backdrop-blur-md">
                <div class="flex items-center gap-3">
                  <div class="rounded-lg bg-fuchsia-500/20 p-2 text-fuchsia-400">
                    <Icon name="lucide:megaphone" class="size-5" />
                  </div>
                  <div>
                    <p class="text-xs font-bold text-white">
                      Ads campaign
                    </p>
                    <p class="text-[10px] text-muted-400">
                      Active
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Stat cards -->
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <!-- Active projects -->
        <BaseCard rounded="lg" class="group relative overflow-hidden p-6">
          <div class="absolute -right-6 -top-6 size-24 rounded-full bg-orange-500/10 blur-2xl transition-all group-hover:bg-orange-500/20" />
          <div class="relative z-10">
            <div class="mb-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                <Icon name="lucide:layers" class="size-5" />
              </div>
              <span class="text-xs font-bold uppercase tracking-wider text-muted-500">Active projects</span>
            </div>
            <div class="flex items-end gap-2">
              <h3 class="text-3xl font-black text-muted-900 dark:text-white">
                {{ stats.activeProjects }}
              </h3>
              <span class="mb-1.5 text-xs font-medium text-muted-500">in progress</span>
            </div>
            <NuxtLink to="/dashboards/orders" class="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary-500 transition hover:text-primary-400">
              View all <Icon name="lucide:arrow-right" class="size-3" />
            </NuxtLink>
          </div>
        </BaseCard>

        <!-- Cash wallet -->
        <BaseCard rounded="lg" class="group relative overflow-hidden p-6">
          <div class="absolute -right-6 -top-6 size-24 rounded-full bg-emerald-500/10 blur-2xl transition-all group-hover:bg-emerald-500/20" />
          <div class="relative z-10">
            <div class="mb-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Icon name="lucide:wallet" class="size-5" />
              </div>
              <span class="text-xs font-bold uppercase tracking-wider text-muted-500">Cash wallet</span>
            </div>
            <h3 class="text-3xl font-black text-muted-900 dark:text-white">
              {{ formatCurrency(stats.walletBalance) }}
            </h3>
            <div class="mt-4 grid grid-cols-2 gap-3">
              <BaseButton size="sm" rounded="lg" variant="muted" to="/dashboards/wallet">
                <Icon name="lucide:plus" class="size-3.5 text-emerald-500" /> Deposit
              </BaseButton>
              <BaseButton size="sm" rounded="lg" variant="muted" to="/dashboards/wallet">
                <Icon name="lucide:arrow-up-right" class="size-3.5" /> Send
              </BaseButton>
            </div>
          </div>
        </BaseCard>

        <!-- Ad credits -->
        <BaseCard rounded="lg" class="group relative overflow-hidden p-6 sm:col-span-2 lg:col-span-1">
          <div class="absolute -right-6 -top-6 size-24 rounded-full bg-primary-500/10 blur-2xl transition-all group-hover:bg-primary-500/20" />
          <div class="relative z-10">
            <div class="mb-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
                <Icon name="lucide:sparkles" class="size-5" />
              </div>
              <span class="text-xs font-bold uppercase tracking-wider text-muted-500">Ad credits</span>
            </div>
            <h3 class="text-3xl font-black text-muted-900 dark:text-white">
              {{ formatCurrency(stats.adCredits) }}
            </h3>
            <BaseButton size="sm" rounded="lg" variant="muted" class="mt-4 w-full" @click="comingSoon('Top up ad credits')">
              <Icon name="lucide:zap" class="size-3.5 text-primary-500" /> Top up credits
            </BaseButton>
          </div>
        </BaseCard>
      </div>

      <!-- Main two-column area -->
      <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <!-- Left: projects + total spent -->
        <div class="flex flex-col gap-6 lg:col-span-5">
          <div class="flex items-center justify-between">
            <BaseHeading as="h3" size="lg" weight="medium" class="flex items-center gap-2 text-muted-900 dark:text-white">
              <Icon name="lucide:folder-open" class="size-5 text-primary-500" />
              Active projects
            </BaseHeading>
            <NuxtLink v-if="projects.length" to="/dashboards/orders" class="group flex items-center gap-1 text-xs font-bold text-primary-500 transition hover:text-primary-400">
              View all <Icon name="lucide:arrow-right" class="size-3 transition-transform group-hover:translate-x-1" />
            </NuxtLink>
          </div>

          <div v-if="projects.length" class="space-y-3">
            <NuxtLink
              v-for="project in projects" :key="project.id"
              to="/dashboards/orders"
              class="group flex items-center gap-4 rounded-2xl border border-muted-200 bg-white p-4 transition hover:border-primary-500/40 hover:shadow-lg dark:border-muted-800 dark:bg-muted-900"
            >
              <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted-100 text-muted-500 ring-1 ring-muted-200 transition group-hover:bg-primary-500/10 group-hover:text-primary-500 dark:bg-muted-800 dark:ring-muted-700">
                <Icon :name="project.icon" class="size-6" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <h4 class="truncate text-sm font-bold text-muted-900 transition group-hover:text-primary-500 dark:text-white">
                      {{ project.name }}
                    </h4>
                    <p class="truncate text-xs text-muted-500">
                      {{ project.category }}
                    </p>
                  </div>
                  <span class="inline-flex shrink-0 items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase ring-1 ring-inset" :class="statusClasses(project.status)">
                    {{ project.status }}
                  </span>
                </div>
                <div class="mt-3 flex items-center justify-between gap-3">
                  <span class="text-sm font-bold text-muted-900 dark:text-white">{{ formatCurrency(project.amount) }}</span>
                  <div class="flex w-24 items-center gap-2">
                    <div class="h-1.5 w-full rounded-full bg-muted-200 dark:bg-muted-800">
                      <div class="h-full rounded-full bg-primary-500" :style="{ width: `${project.progress}%` }" />
                    </div>
                    <span class="text-[10px] font-bold text-muted-500">{{ project.progress }}%</span>
                  </div>
                </div>
              </div>
            </NuxtLink>
          </div>

          <div v-else class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-muted-300 p-8 text-center dark:border-muted-700">
            <div class="mb-4 flex size-16 items-center justify-center rounded-full bg-muted-100 ring-1 ring-muted-200 dark:bg-muted-800 dark:ring-muted-700">
              <Icon name="lucide:folder-plus" class="size-8 text-muted-500" />
            </div>
            <BaseHeading as="h4" size="md" weight="bold" class="text-muted-900 dark:text-white">
              No active projects
            </BaseHeading>
            <BaseParagraph size="xs" class="mb-6 mt-1 max-w-[220px] text-muted-500">
              Your workspace is empty. Start a new project to track your growth.
            </BaseParagraph>
            <BaseButton to="/dashboards/services" rounded="lg" variant="primary">
              <Icon name="lucide:plus" class="size-4" /> Start a project
            </BaseButton>
          </div>

          <!-- Total spent -->
          <BaseCard rounded="lg" class="relative overflow-hidden border-none bg-gradient-to-br from-muted-900 to-muted-800 p-6 text-white">
            <div class="absolute -bottom-10 -left-10 size-32 rounded-full bg-primary-500/10 blur-2xl" />
            <div class="relative z-10 flex items-center justify-between">
              <div>
                <p class="text-xs font-medium text-muted-400">
                  Total spent
                </p>
                <p class="mt-1 text-3xl font-black tracking-tight text-white">
                  {{ formatCurrency(stats.totalSpent) }}
                </p>
                <span class="mt-2 inline-flex items-center gap-1 text-[10px] text-emerald-400">
                  <Icon name="lucide:trending-up" class="size-3" /> Lifetime investment
                </span>
              </div>
              <div class="relative size-16">
                <svg class="size-full -rotate-90" viewBox="0 0 36 36">
                  <path class="text-white/10" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" />
                  <path class="text-primary-500" stroke-dasharray="75, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
                </svg>
                <div class="absolute inset-0 flex items-center justify-center">
                  <Icon name="lucide:pound-sterling" class="size-6 text-white" />
                </div>
              </div>
            </div>
          </BaseCard>
        </div>

        <!-- Right: services -->
        <div class="flex flex-col gap-8 lg:col-span-7">
          <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <BaseHeading as="h2" size="xl" weight="medium" class="text-muted-900 dark:text-white">
                Explore services
              </BaseHeading>
              <BaseParagraph size="sm" class="text-muted-500">
                Grow your business with our professional solutions.
              </BaseParagraph>
            </div>
            <BaseButton rounded="lg" variant="primary" to="/dashboards/services" class="self-start sm:self-auto">
              View catalog
            </BaseButton>
          </div>

          <!-- Trending -->
          <div>
            <BaseHeading as="h3" size="md" weight="medium" class="mb-4 text-muted-900 dark:text-white">
              Trending now
            </BaseHeading>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NuxtLink
                to="/dashboards/services?service=marketing"
                class="group relative flex h-60 flex-col overflow-hidden rounded-2xl shadow-lg transition hover:-translate-y-1"
              >
                <div class="absolute inset-0 bg-gradient-to-br from-fuchsia-600 via-purple-600 to-primary-700 transition-transform duration-500 group-hover:scale-110" />
                <div class="absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div class="absolute inset-0 z-20 flex flex-col justify-between p-5">
                  <div class="flex items-center justify-between">
                    <span class="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/20 px-3 py-1 text-[10px] font-bold text-fuchsia-200 backdrop-blur-md">HOT</span>
                    <div class="flex size-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
                      <Icon name="lucide:megaphone" class="size-4 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 class="mb-1 text-xl font-bold text-white">
                      Digital marketing
                    </h3>
                    <p class="text-xs text-white/70">
                      Zero upfront cost • ROI focused
                    </p>
                  </div>
                </div>
              </NuxtLink>

              <NuxtLink
                to="/dashboards/services?service=development"
                class="group relative flex h-60 flex-col overflow-hidden rounded-2xl shadow-lg transition hover:-translate-y-1"
              >
                <div class="absolute inset-0 bg-gradient-to-br from-cyan-500 via-sky-600 to-indigo-700 transition-transform duration-500 group-hover:scale-110" />
                <div class="absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div class="absolute inset-0 z-20 flex flex-col justify-between p-5">
                  <div class="flex items-center justify-between">
                    <span class="rounded-full border border-cyan-500/30 bg-cyan-500/20 px-3 py-1 text-[10px] font-bold text-cyan-200 backdrop-blur-md">NEW</span>
                    <div class="flex size-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
                      <Icon name="lucide:code-2" class="size-4 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 class="mb-1 text-xl font-bold text-white">
                      Web development
                    </h3>
                    <p class="text-xs text-white/70">
                      Modern stack • High performance
                    </p>
                  </div>
                </div>
              </NuxtLink>
            </div>
          </div>

          <!-- Popular solutions -->
          <div>
            <BaseHeading as="h3" size="md" weight="medium" class="mb-4 text-muted-900 dark:text-white">
              Popular solutions
            </BaseHeading>
            <div class="space-y-3">
              <BaseCard rounded="lg" class="group flex cursor-pointer items-center gap-4 p-4 transition hover:border-primary-500/40" @click="navigateTo('/dashboards/services?service=seo')">
                <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 transition group-hover:bg-amber-500 group-hover:text-white">
                  <Icon name="lucide:search" class="size-5" />
                </div>
                <div class="grow">
                  <BaseHeading as="h4" size="sm" weight="medium" class="text-muted-900 transition group-hover:text-primary-500 dark:text-white">
                    SEO optimisation
                  </BaseHeading>
                  <BaseParagraph size="xs" class="text-muted-500">
                    Rank #1 on Google search
                  </BaseParagraph>
                </div>
                <BaseButton size="icon-md" rounded="lg" variant="muted" class="transition group-hover:bg-primary-500 group-hover:text-white">
                  <Icon name="lucide:arrow-right" class="size-5" />
                </BaseButton>
              </BaseCard>

              <BaseCard rounded="lg" class="group flex cursor-pointer items-center gap-4 p-4 transition hover:border-primary-500/40" @click="navigateTo('/dashboards/services?service=branding')">
                <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/10 text-fuchsia-500 transition group-hover:bg-fuchsia-500 group-hover:text-white">
                  <Icon name="lucide:palette" class="size-5" />
                </div>
                <div class="grow">
                  <BaseHeading as="h4" size="sm" weight="medium" class="text-muted-900 transition group-hover:text-primary-500 dark:text-white">
                    Branding &amp; design
                  </BaseHeading>
                  <BaseParagraph size="xs" class="text-muted-500">
                    Logo, UI/UX &amp; visual identity
                  </BaseParagraph>
                </div>
                <BaseButton size="icon-md" rounded="lg" variant="muted" class="transition group-hover:bg-primary-500 group-hover:text-white">
                  <Icon name="lucide:arrow-right" class="size-5" />
                </BaseButton>
              </BaseCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes float {
  0%,
  100% {
    transform: translateY(-70%) translateX(-30%) rotate(12deg);
  }
  50% {
    transform: translateY(-80%) translateX(-30%) rotate(10deg);
  }
}
.animate-float {
  animation: float 6s ease-in-out infinite;
}
</style>
