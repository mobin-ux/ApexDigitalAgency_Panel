<script setup lang="ts">
import type { Catalog, ServiceId } from '~~/shared/catalog'
import { DEFAULT_CATALOG, featuredPlan, fromMonthly, paymentCount } from '~~/shared/catalog'

/**
 * Dashboard — Panel v2 (`Dashboard.dc.html` inside `Panel Breakpoints.dc.html`).
 *
 * Order of business, as drawn: what is waiting on the customer, then money
 * (wallet, next payment, credit), active work, the pay-monthly band, services
 * to order, and what has been paid so far.
 *
 * Every figure comes from `/api/dashboard/overview` or the catalogue in
 * `/api/config` — the honesty rules from V2 Phase 2 still hold: the paid-so-far
 * split is withheld unless every payment is attributed to an order, and a
 * section with nothing real to show says so rather than drawing zeros.
 *
 * Layout follows the content width, not the viewport: the page wrapper is a
 * size container, so the rail at 1024px and the sidebar at 1440px get the
 * layouts the design draws for their actual content widths.
 */
definePageMeta({
  title: 'Dashboard',
  layout: 'sidenav',
  middleware: 'auth',
})

interface Overview {
  firstName: string | null
  walletBalance: number
  needs: { kind: string, title: string, context: string, cta: string, to: string }[]
  nextPayment: null | { amount: number, due: string, plans: { name: string, amount: number, paid: number, total: number, retainer: boolean }[] }
  credit: { state: 'none' | 'review' | 'approved' | 'frozen', status: string, limit: number, used: number, available: number, requestedLimit: number | null }
  projects: { id: string, ref: string, name: string, service: string, plan: string | null, serviceId: string | null, status: string, progress: number, deadline: string | null, awaitingKickoff: boolean }[]
  paid: { total: number, count: number, projects: number, split: { id: string, name: string, amount: number }[] | null }
}

const { user } = useUser()
const { formatCurrency } = useCurrency()
const { data, pending, error, refresh } = await useFetch<Overview>('/api/dashboard/overview', { key: 'dashboard-overview' })
const { data: config } = useApexConfig({ lazy: false })
const catalog = computed<Catalog>(() => ((config.value as any)?.catalog as Catalog | undefined) ?? DEFAULT_CATALOG)

const firstName = computed(() => data.value?.firstName || (user.value as any)?.firstName || 'there')

/* ---------------------------------------------------------- money cards */
const credit = computed(() => data.value?.credit)
const creditPct = computed(() => {
  const c = credit.value
  return c && c.limit > 0 ? Math.min(100, Math.round(c.used / c.limit * 100)) : 0
})
// The design's three states — not set up, under review, approved — plus on
// hold, when staff freeze a line. Credit is applied for from the Wallet
// (`?credit=apply`) and decided in /admin/credit.
const creditState = computed(() => credit.value?.state ?? 'none')
const creditChip = computed(() => creditState.value === 'frozen'
  ? { label: 'On hold', tone: 'warning' as const }
  : creditState.value === 'review'
    ? { label: 'Under review', tone: 'warning' as const }
    : { label: 'Approved', tone: 'success' as const })

/* ---------------------------------------------------------- active work */
const projects = computed(() => (data.value?.projects ?? []).map((p) => {
  const st = projectStatus(p.status)
  return {
    ...p,
    st,
    glyph: glyphFor(p.serviceId, p.service),
    meta: [p.service, p.plan].filter(Boolean).join(' · '),
    due: p.awaitingKickoff ? 'Starts after your kickoff call' : p.deadline ? `Due ${ukDate(p.deadline)}` : 'Date to be agreed',
    to: `/dashboards/orders?project=${p.id}`,
  }
}))

/* ------------------------------------------------- pay-monthly promo band */
// The band sells one plan, as drawn: Website Design on its featured plan. The
// figures are the catalogue's, so the card in the illustration, the fine print
// and the New order wizard it opens all quote the same plan.
const calc = computed(() => {
  const svc = catalog.value.services.find(s => s.id === 'web')
  if (!svc) {
    return null
  }
  const plan = featuredPlan(svc)
  const n = paymentCount(svc, plan)
  const monthly = plan.monthly ?? 0
  const deposit = plan.deposit ?? 0
  return {
    n,
    monthly,
    deposit,
    planName: plan.name,
    href: `/dashboards/services?service=${svc.slug}&plan=${plan.id}`,
    cta: `Start ${plan.name} plan`,
    // "No deposit." as drawn, unless the admin catalogue has given the plan one.
    fine: deposit > 0
      ? `${formatCurrency(deposit)} deposit, then ${n} × ${formatCurrency(monthly)}. Figures include VAT.`
      : `No deposit. ${n} × ${formatCurrency(monthly)}. Figures include VAT.`,
    illoLabel: `Illustration: Website Design ${plan.name} plan at ${formatCurrency(monthly)} a month, paid off in ${n} monthly payments with no interest`,
  }
})

// The illustration's wide composition needs ~470px of its own; measure the
// slot rather than guessing from the viewport.
const illoBox = ref<HTMLElement | null>(null)
const { width: illoWidth } = useElementSize(illoBox)
const illoWide = computed(() => illoWidth.value >= 470)

/* ------------------------------------------------------- order a service */
const SERVICE_CARDS: ServiceId[] = ['web', 'mkt', 'seo', 'ppc']
const serviceCards = computed(() => SERVICE_CARDS.map((id) => {
  const s = catalog.value.services.find(x => x.id === id)
  if (!s) {
    return null
  }
  return { id, name: s.name, line: s.line, from: fromMonthly(s), to: `/dashboards/services?service=${s.slug}`, popular: id === 'web' }
}).filter(Boolean) as { id: ServiceId, name: string, line: string, from: number | null, to: string, popular: boolean }[])

/* -------------------------------------------------------------- paid so far */
const paid = computed(() => data.value?.paid)
const split = computed(() => {
  const p = paid.value
  if (!p?.split?.length || p.total <= 0) {
    return []
  }
  return p.split.map((row, i) => ({ ...row, pct: Math.round(row.amount / p.total * 100), color: i === 0 ? 'bg-accent' : i === 1 ? 'bg-[#AE96F9]' : 'bg-[#C9B8FB]' }))
})

const H2 = 'font-heading text-fg-heading m-0 text-[21px] font-bold tracking-[-0.02em]'
const CARD = 'bg-card border-line-subtle shadow-panel rounded-[20px] border'
const LINK = 'apex-ring text-accent-ink rounded-md text-sm font-semibold hover:underline'
</script>

<template>
  <div class="@container mx-auto flex max-w-[1260px] flex-col gap-[clamp(28px,3vw,40px)] px-[clamp(16px,3vw,40px)] pb-[clamp(28px,4vw,56px)] pt-[clamp(20px,3vw,40px)]">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div class="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
        <h1 class="font-heading text-fg-heading m-0 text-balance text-[clamp(28px,1.3vw+18px,38px)] font-extrabold leading-[1.06] tracking-[-0.03em]">
          Welcome back, <span class="text-fg-accent">{{ firstName }}</span>
        </h1>
        <p class="text-fg-body m-0 max-w-[52ch] text-pretty text-[clamp(15px,.3vw+14px,17px)] leading-relaxed">
          Progress, payments and files for every project, in one place.
        </p>
      </div>
      <ApexButton to="/dashboards/services">
        New order
      </ApexButton>
    </div>

    <div v-if="error" role="alert" class="bg-st-danger-bg text-st-danger-fg flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4 text-sm">
      <Icon name="lucide:circle-alert" class="size-5 shrink-0" />
      <span class="grow">Your dashboard did not load. Your orders and payments are safe.</span>
      <ApexButton size="sm" variant="light" @click="refresh()">
        Try again
      </ApexButton>
    </div>

    <!-- Waiting on you -->
    <section v-if="data?.needs.length" aria-labelledby="h-needs" class="flex flex-col gap-3.5">
      <h2 id="h-needs" :class="H2" class="flex items-center gap-2.5">
        Waiting on you
        <span class="bg-st-warning-bg text-st-warning-fg rounded-full px-2.5 py-[3px] font-sans text-[12.5px] font-bold tracking-normal">{{ data.needs.length }}</span>
      </h2>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3.5">
        <div v-for="nd in data.needs" :key="nd.to + nd.title" class="bg-card border-line-subtle shadow-panel flex min-w-0 items-center gap-3.5 rounded-[18px] border px-[18px] py-4">
          <span aria-hidden="true" class="size-2 shrink-0 rounded-full bg-[#D9A521]" />
          <span class="flex min-w-0 grow flex-col gap-0.5">
            <span class="text-fg-heading text-[14.5px] font-semibold">{{ nd.title }}</span>
            <span class="text-fg-muted truncate text-[13px]">{{ nd.context }}</span>
          </span>
          <NuxtLink :to="nd.to" class="apex-ring bg-accent-tint text-accent-ink hover:bg-accent inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-xl px-3.5 text-[13.5px] font-bold hover:text-white">
            {{ nd.cta }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Money -->
    <section aria-label="Money" class="flex flex-wrap gap-5">
      <div class="relative flex min-h-[230px] min-w-0 flex-[1.2_1_300px] flex-col gap-1.5 overflow-hidden rounded-3xl bg-[#6C40E8] p-[clamp(22px,2vw,28px)] text-white shadow-violet">
        <div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_110%_at_100%_0%,rgba(155,121,246,.75)_0%,rgba(155,121,246,0)_58%)]" />
        <div class="relative mb-3 flex items-center gap-3">
          <span class="inline-flex size-[38px] items-center justify-center rounded-xl bg-white/[.16]"><Icon name="solar:wallet-2-linear" class="size-5" /></span>
          <span class="text-sm font-semibold">Wallet balance</span>
        </div>
        <BasePlaceload v-if="pending && !data" class="relative h-12 w-40 rounded-lg opacity-40" />
        <span v-else class="font-heading relative text-[clamp(40px,1.8vw+20px,52px)] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{{ formatCurrency(data?.walletBalance ?? 0) }}</span>
        <span class="relative text-sm">Available to spend now</span>
        <div class="relative mt-auto flex flex-wrap items-center gap-4 pt-[22px]">
          <ApexButton to="/dashboards/wallet?add=1" variant="white" size="sm">
            Add funds
          </ApexButton>
          <NuxtLink to="/dashboards/wallet?tab=tx" class="apex-ring inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-white">
            Transactions →
          </NuxtLink>
        </div>
      </div>

      <div :class="CARD" class="flex min-w-0 flex-[1_1_280px] flex-col gap-4 p-[clamp(20px,2vw,24px)]">
        <div class="flex items-center justify-between gap-3">
          <span class="text-fg-heading text-sm font-semibold">Next payment</span>
          <ApexStatusChip v-if="data?.nextPayment" tone="violet">
            {{ inDays(data.nextPayment.due) }}
          </ApexStatusChip>
        </div>
        <template v-if="data?.nextPayment">
          <div class="flex flex-wrap items-baseline gap-2.5">
            <span class="font-heading text-fg-heading text-4xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">{{ formatCurrency(data.nextPayment.amount) }}</span>
            <span class="text-fg-muted whitespace-nowrap text-[13.5px]">due {{ ukDate(data.nextPayment.due) }}</span>
          </div>
          <div class="border-line-soft flex flex-col gap-3.5 border-t pt-3.5">
            <div v-for="pl in data.nextPayment.plans" :key="pl.name" class="flex flex-col gap-2">
              <div class="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span class="text-fg-heading min-w-0 truncate font-semibold">{{ pl.name }}</span>
                <span class="text-fg-heading font-semibold tabular-nums">{{ formatCurrency(pl.amount) }}</span>
              </div>
              <div class="flex items-center gap-[5px]">
                <template v-if="!pl.retainer && pl.total <= 24">
                  <span v-for="i in pl.total" :key="i" class="block size-[9px] rounded-full" :class="i <= pl.paid ? 'bg-accent' : 'bg-dot-unpaid'" />
                </template>
                <span class="text-fg-muted ml-auto whitespace-nowrap pl-1.5 text-[12.5px]">{{ pl.retainer ? `${pl.paid} paid · rolling` : `${pl.paid} of ${pl.total} paid` }}</span>
              </div>
            </div>
          </div>
          <div class="text-fg-muted mt-auto flex items-center justify-between gap-3 text-[12.5px]">
            <span>Figures include VAT · no interest</span>
            <NuxtLink to="/dashboards/wallet?tab=plans" :class="LINK" class="whitespace-nowrap text-[13.5px]">
              Schedule →
            </NuxtLink>
          </div>
        </template>
        <template v-else-if="!pending">
          <p class="text-fg-body m-0 text-sm leading-relaxed">
            No payments are scheduled. Monthly payments start after a project's kickoff.
          </p>
          <NuxtLink to="/dashboards/services" :class="LINK" class="mt-auto self-start">
            Start a project →
          </NuxtLink>
        </template>
      </div>

      <div :class="CARD" class="flex min-w-0 flex-[1_1_280px] flex-col gap-4 p-[clamp(20px,2vw,24px)]">
        <div class="flex items-center justify-between gap-3">
          <span class="text-fg-heading text-sm font-semibold">Credit line</span>
          <ApexStatusChip v-if="credit && creditState === 'none'" tone="neutral" :dot="false">
            Not set up
          </ApexStatusChip>
          <ApexStatusChip v-else-if="credit" :tone="creditChip.tone">
            {{ creditChip.label }}
          </ApexStatusChip>
        </div>
        <template v-if="credit && creditState === 'none'">
          <span class="font-heading text-fg-heading text-xl font-bold leading-tight tracking-[-0.02em]">Run more than one project at once</span>
          <div class="flex flex-col gap-[7px]">
            <span v-for="t in ['No credit check', 'Never any interest', 'Decision within one working day']" :key="t" class="text-fg-body flex items-center gap-[9px] text-[13px] leading-normal">
              <span aria-hidden="true" class="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#22B07D] text-[9.5px] text-white">✓</span>{{ t }}
            </span>
          </div>
          <ApexButton to="/dashboards/wallet?credit=apply" size="sm" class="mt-auto self-start">
            Apply now
          </ApexButton>
        </template>
        <template v-else-if="credit && creditState === 'review'">
          <div class="flex flex-wrap items-baseline gap-2.5">
            <span class="font-heading text-fg-heading text-4xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">{{ formatCurrency(credit.requestedLimit ?? 0) }}</span>
            <span class="text-fg-muted text-[13.5px]">requested</span>
          </div>
          <div aria-hidden="true" class="flex gap-1.5">
            <span class="bg-accent block h-1.5 grow rounded-full" /><span class="bg-accent block h-1.5 grow rounded-full opacity-45" /><span class="bg-track block h-1.5 grow rounded-full" />
          </div>
          <span class="text-fg-body text-[13.5px] leading-[1.55]">We are checking your business. Decision usually within one working day.</span>
          <NuxtLink to="/dashboards/wallet?credit=status" class="apex-ring text-accent-ink mt-auto self-start rounded-md text-[13.5px] font-semibold hover:underline">
            View application →
          </NuxtLink>
        </template>
        <template v-else-if="credit">
          <div class="flex flex-wrap items-baseline gap-2.5">
            <span class="font-heading text-fg-heading text-4xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">{{ formatCurrency(credit.available) }}</span>
            <span class="text-fg-muted text-[13.5px]">available of {{ formatCurrency(credit.limit) }}</span>
          </div>
          <div role="progressbar" aria-label="Credit committed" :aria-valuenow="creditPct" aria-valuemin="0" aria-valuemax="100" class="bg-track h-2 overflow-hidden rounded-full">
            <div class="bg-accent h-full rounded-full" :style="{ width: `${creditPct}%` }" />
          </div>
          <div class="text-fg-muted flex justify-between gap-3 text-[13px]">
            <span>{{ formatCurrency(credit.used) }} committed to plans</span><span class="tabular-nums">{{ creditPct }}%</span>
          </div>
          <div class="border-line-soft text-fg-body mt-auto flex items-center gap-[9px] border-t pt-3.5 text-[13px] leading-normal">
            <span class="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#22B07D] text-[10px] text-white">✓</span>
            Apex monthly plans never carry interest.
          </div>
        </template>
      </div>
    </section>

    <!-- Active work -->
    <section class="flex flex-col gap-4">
      <div class="flex flex-wrap items-baseline justify-between gap-4">
        <h2 :class="H2" class="flex items-center gap-2.5">
          Active work
          <span class="bg-card border-line-subtle text-fg-body rounded-full border px-2.5 py-[3px] font-sans text-[12.5px] font-bold tracking-normal">{{ projects.length }}</span>
        </h2>
        <NuxtLink to="/dashboards/orders" :class="LINK">
          View all orders →
        </NuxtLink>
      </div>
      <div v-if="projects.length" role="list" :class="CARD" class="overflow-hidden">
        <NuxtLink
          v-for="p in projects"
          :key="p.id"
          :to="p.to"
          role="listitem"
          class="apex-ring border-line-soft hover:bg-hover flex flex-col gap-3 border-b p-4 last:border-b-0 @min-[720px]:flex-row @min-[720px]:items-center @min-[720px]:gap-[18px] @min-[720px]:px-[22px] @min-[720px]:py-[18px]"
        >
          <span class="flex min-w-0 items-center gap-3 @min-[720px]:grow @min-[720px]:gap-[18px]">
            <span class="bg-accent-tint inline-flex size-[42px] shrink-0 items-center justify-center rounded-xl @min-[720px]:size-[46px] @min-[720px]:rounded-[14px]">
              <ApexGlyph :kind="p.glyph" />
            </span>
            <span class="flex min-w-0 grow flex-col gap-0.5 @min-[720px]:gap-[3px]">
              <span class="text-fg-heading truncate text-[15px] font-semibold @min-[720px]:text-[15.5px]">{{ p.name }}</span>
              <span class="text-fg-muted truncate text-[13px] @min-[720px]:text-[13.5px]">{{ p.meta }}</span>
            </span>
            <span class="@min-[720px]:hidden"><ApexStatusChip :tone="p.st.tone">{{ p.st.label }}</ApexStatusChip></span>
          </span>
          <span class="flex items-center gap-3 @min-[720px]:w-[clamp(160px,18vw,230px)] @min-[720px]:shrink-0 @min-[720px]:flex-col @min-[720px]:items-stretch @min-[720px]:gap-[7px]">
            <span class="bg-track block h-1.5 grow overflow-hidden rounded-full @min-[720px]:grow-0"><span class="bg-accent block h-full rounded-full" :style="{ width: `${p.progress}%` }" /></span>
            <span class="text-fg-muted flex justify-between gap-2 text-[12.5px]">
              <span class="text-fg-heading min-w-[34px] text-right font-semibold tabular-nums @min-[720px]:text-left">{{ p.progress }}%</span>
              <span class="hidden truncate @min-[720px]:inline">{{ p.due }}</span>
            </span>
          </span>
          <span class="text-fg-muted text-[12.5px] @min-[720px]:hidden">{{ p.due }}</span>
          <span class="hidden w-32 shrink-0 justify-end @min-[720px]:flex"><ApexStatusChip :tone="p.st.tone">{{ p.st.label }}</ApexStatusChip></span>
          <Icon name="lucide:chevron-right" class="text-fg-muted hidden size-[18px] shrink-0 @min-[720px]:block" />
        </NuxtLink>
      </div>
      <div v-else-if="!pending" :class="CARD" class="flex flex-col items-start gap-3 p-6">
        <p class="text-fg-body m-0 text-sm">
          No active work yet. Choose a service and we will book your kickoff call.
        </p>
        <NuxtLink to="/dashboards/services" :class="LINK">
          Start a project →
        </NuxtLink>
      </div>
    </section>

    <!-- Pay monthly: the calculator band, navy in both themes -->
    <section v-if="calc" aria-labelledby="h-calc" class="apex-dark relative flex flex-wrap items-center gap-x-10 gap-y-8 overflow-hidden rounded-[28px] bg-[#0C1719] p-[clamp(22px,3.4vw,48px)]">
      <div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_120%_at_88%_26%,rgba(125,83,242,.30),transparent_60%)]" />
      <div class="relative flex min-w-0 flex-[1_1_320px] flex-col items-start gap-[18px]">
        <span class="inline-flex items-center whitespace-nowrap rounded-full border border-white/[.12] bg-white/[.08] px-4 py-2 text-[13px] font-semibold text-white">Grow now, pay monthly</span>
        <h2 id="h-calc" class="font-heading m-0 text-balance text-[clamp(28px,1.6vw+16px,42px)] font-bold leading-[1.06] tracking-[-0.03em] text-white">
          Build your business. <span class="text-[#9B79F6]">Let it pay its own way.</span>
        </h2>
        <!-- "Order today", not the design's "Launch today": work starts at the
             kickoff call, not on signing (ADR-019). -->
        <p class="m-0 max-w-[44ch] text-pretty text-base leading-[1.62] text-[#A9B2B8]">
          Order today and spread the cost into small monthly payments. As your new website and marketing bring in customers, the revenue covers each payment. No interest, no credit check.
        </p>
        <div class="mt-1.5 flex flex-wrap items-center gap-x-[18px] gap-y-3.5">
          <ApexButton :to="calc.href">
            {{ calc.cta }}
          </ApexButton>
          <span class="max-w-[30ch] text-[13px] leading-[1.55] text-[#A9B2B8]">{{ calc.fine }}</span>
        </div>
      </div>
      <div ref="illoBox" role="img" :aria-label="calc.illoLabel" class="relative h-[380px] min-w-0 flex-[1.05_1_340px] @min-[900px]:h-[440px]">
        <ApexPayMonthlyIllo
          kind="web"
          service="Website Design"
          :plan="calc.planName"
          :monthly="calc.monthly"
          :payments="calc.n"
          :deposit="calc.deposit"
          :fixed="true"
          live-text="Live in 4–6 weeks"
          :wide="illoWide"
        />
      </div>
    </section>

    <!-- Order a service -->
    <section class="flex flex-col gap-4">
      <div class="flex flex-wrap items-baseline justify-between gap-4">
        <h2 :class="H2">
          Order a service
        </h2>
        <NuxtLink to="/dashboards/services" :class="LINK">
          All services →
        </NuxtLink>
      </div>
      <div class="grid grid-cols-2 gap-[clamp(12px,1.4vw,20px)] @min-[860px]:grid-cols-4">
        <NuxtLink
          v-for="c in serviceCards"
          :key="c.id"
          :to="c.to"
          class="apex-ring bg-card border-line-subtle shadow-panel hover:shadow-panel-hover flex min-w-0 flex-col gap-3 rounded-[22px] border p-[clamp(16px,1.6vw,24px)] transition-[box-shadow,transform] duration-200 hover:-translate-y-[3px] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <span class="flex h-[30px] items-center justify-between gap-2">
            <ApexGlyph :kind="c.id" :size="28" />
            <span v-if="c.popular" class="bg-accent-tint text-accent-ink whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold">Most popular</span>
          </span>
          <span class="font-heading text-fg-heading text-[clamp(16px,.35vw+14px,19px)] font-semibold leading-[1.2] tracking-[-0.02em]">{{ c.name }}</span>
          <span class="text-fg-body text-[13.5px] leading-normal">{{ c.line }}</span>
          <span class="border-line-soft text-fg-muted mt-auto flex items-center justify-between gap-2 border-t pt-3 text-[13px]">
            <span v-if="c.from">From <strong class="text-fg-heading font-bold">{{ formatCurrency(c.from) }}</strong>/mo</span>
            <span v-else>Scoped on a call</span>
            <span aria-hidden="true" class="text-accent-ink text-base">→</span>
          </span>
        </NuxtLink>
      </div>
    </section>

    <!-- Paid so far -->
    <section v-if="paid" class="flex flex-col gap-4">
      <div class="flex flex-wrap items-baseline justify-between gap-4">
        <h2 :class="H2">
          Paid so far
        </h2>
        <NuxtLink to="/dashboards/wallet?tab=tx" :class="LINK">
          Payment history →
        </NuxtLink>
      </div>
      <div :class="CARD" class="flex flex-wrap items-center gap-x-12 gap-y-6 p-[clamp(20px,2vw,28px)]">
        <div class="flex flex-[0_1_220px] flex-col gap-1.5">
          <span class="font-heading text-fg-heading text-[clamp(34px,1vw+24px,42px)] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{{ formatCurrency(paid.total) }}</span>
          <span class="text-fg-muted text-[13.5px]">
            {{ paid.count }} {{ paid.count === 1 ? 'payment' : 'payments' }}<template v-if="paid.projects"> across {{ paid.projects }} {{ paid.projects === 1 ? 'project' : 'projects' }}</template>
          </span>
        </div>
        <div v-if="split.length" class="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <div role="img" :aria-label="split.map(r => `${r.name} ${formatCurrency(r.amount)}`).join(', ')" class="flex h-3 gap-[3px] overflow-hidden rounded-full">
            <span v-for="r in split" :key="r.id" class="block" :class="r.color" :style="{ flexGrow: r.amount }" />
          </div>
          <div class="flex flex-wrap gap-x-10 gap-y-3">
            <div v-for="r in split" :key="r.id" class="text-fg-body flex items-center gap-2.5 text-sm">
              <span class="block size-2.5 rounded-[3px]" :class="r.color" />{{ r.name }}
              <strong class="text-fg-heading font-bold tabular-nums">{{ formatCurrency(r.amount) }}</strong>
              <span class="text-fg-muted">{{ r.pct }}%</span>
            </div>
          </div>
        </div>
        <p v-else-if="paid.count === 0" class="text-fg-body m-0 flex-[1_1_320px] text-sm">
          Payments appear here once your first kickoff payment is taken.
        </p>
      </div>
    </section>
  </div>
</template>
