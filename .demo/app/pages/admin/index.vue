<script setup lang="ts">
import type { ApexTone } from '~/utils/panel'
import { creditRef } from '~~/shared/credit'
import { personName, ukDateTime, waitedSince } from '~/utils/adminFormat'

/**
 * Admin console — Overview (`Admin Console.dc.html`, 2026-10-31).
 *
 * A greeting, a row of count tiles, one queue of everything waiting on the
 * signed-in role (oldest first), and the website at a glance. The rules
 * from Phase 9B still hold: every tile is a count of records a screen
 * lists and links to it; the queue names the record, its owner and how
 * long it has waited; money is omitted, not blanked, for roles without it.
 *
 * Real or absent: the design's "Signups awaiting approval" (accounts are
 * active from signup, there is no approval step), "New enquiries" and
 * "Latest enquiries" (the site's contact form stores nothing) and the
 * "Website visits" placeholder bars (no analytics is connected) are left
 * out. The delivery pipeline and money card the Overview already had stay,
 * in the design's card vocabulary.
 */
definePageMeta({
  title: 'Overview',
  layout: 'admin',
  middleware: 'admin',
})

const { user } = useUser()
const { formatCurrency } = useCurrency()
const { can, roleDef } = useStaffAccess()

const { data: stats, pending, error, refresh } = await useFetch('/api/admin/stats')

// Records whose wait is computed in the browser load after hydration, so
// the server and the first client render never disagree about "6h".
const { data: credit } = useFetch<{ waiting: any[] }>('/api/admin/credit/applications', { server: false, immediate: can('money.view') })
const { data: review } = useFetch<{ items: any[] }>('/api/admin/website/documents', { server: false, immediate: can('website.view'), query: { state: 'in_review', pageSize: 100 } })
const { data: site } = useFetch<any>('/api/admin/website/overview', { server: false, immediate: can('website.view') })

/* The greeting and the date are client facts (time of day, the reader's zone). */
const greet = ref('Welcome back,')
const today = ref('')
onMounted(() => {
  const hour = new Date().getHours()
  greet.value = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,'
  today.value = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()).replace(',', '')
})

const firstName = computed(() => user.value?.firstName || personName(user.value, 'there').split('@')[0])
const subtitle = computed(() => `${today.value ? `${today.value} · ` : ''}What is waiting across the client portal and apexdigi.co.uk for ${roleDef.value?.label.toLowerCase() ?? 'staff'} access.`)

/* ------------------------------------------------------------- tiles --- */

const tiles = computed(() => {
  const s = stats.value
  const out: { label: string, value: number, cta: string, to: string }[] = []
  if (can('website.view')) {
    out.push({ label: 'Content waiting for review', value: review.value?.items.length ?? 0, cta: 'Review', to: '/admin/website/pages' })
  }
  if (can('money.view')) {
    out.push({ label: 'Credit applications to decide', value: credit.value?.waiting.length ?? 0, cta: 'Review', to: '/admin/credit' })
  }
  if (can('support.answer')) {
    out.push({ label: 'Open support requests', value: s?.openTickets ?? 0, cta: 'Inbox', to: '/admin/tickets' })
  }
  out.push({ label: 'Projects waiting to start', value: s?.pendingProjects ?? 0, cta: 'Projects', to: '/admin/projects?status=PENDING' })
  out.push({ label: s?.holdEnabled ? 'Finished work with files held' : 'Finished work, holding off', value: s?.awaitingRelease ?? 0, cta: 'Release', to: '/admin/projects?status=COMPLETED' })
  if (can('money.view')) {
    out.push({ label: 'Overdue instalments', value: s?.overdueInstallmentCount ?? 0, cta: 'Payments', to: '/admin/payments?tab=installments' })
  }
  return out
})

/* ------------------------------------------------------------- queue --- */

interface QueueRow {
  key: string
  kind: string
  tone: ApexTone
  title: string
  sub: string
  owner: string | null
  ownerNote?: string
  since: string
  to: string
}

const KIND: Record<string, { label: string, tone: ApexTone }> = {
  release: { label: 'Files held', tone: 'warning' },
  unassigned: { label: 'Project', tone: 'neutral' },
  money: { label: 'Overdue', tone: 'danger' },
  support: { label: 'Support', tone: 'neutral' },
}

const queue = computed<QueueRow[]>(() => {
  const rows: QueueRow[] = (stats.value?.needs ?? []).map(n => ({
    key: `${n.kind}-${n.to}-${n.title}`,
    kind: KIND[n.kind]?.label ?? 'Work',
    tone: KIND[n.kind]?.tone ?? 'neutral',
    title: n.title,
    sub: n.sub,
    owner: n.owner,
    since: n.since,
    to: n.to,
  }))
  for (const a of credit.value?.waiting ?? []) {
    rows.push({
      key: `credit-${a.id}`,
      kind: 'Credit',
      tone: 'violet',
      title: `${a.companyName || `${a.firstName} ${a.lastName}`} · ${formatCurrency(a.requestedLimit)}`,
      sub: `${creditRef(a.id)} · waiting for a decision`,
      owner: null,
      ownerNote: can('credit.approve') ? 'You can decide' : 'Owner or Admin',
      since: a.submittedAt,
      to: `/admin/credit?application=${a.id}`,
    })
  }
  for (const d of review.value?.items ?? []) {
    rows.push({
      key: `doc-${d.id}`,
      kind: 'Content review',
      tone: 'warning',
      title: d.title,
      sub: `Submitted for review · ${d.path ?? d.key}`,
      owner: null,
      ownerNote: can('website.publish') ? 'You can publish' : 'Publisher or Admin',
      since: d.draftUpdatedAt ?? d.updatedAt,
      to: `/admin/website/pages/${d.id}`,
    })
  }
  return rows.sort((a, b) => new Date(a.since).getTime() - new Date(b.since).getTime())
})

const shown = computed(() => queue.value.slice(0, 8))

/* ----------------------------------------------------------- website --- */

const siteStats = computed(() => {
  const by = site.value?.documents?.byStatus ?? {}
  return [
    { n: (by.published ?? 0) + (by.published_changes ?? 0), label: 'Published', to: '/admin/website/pages?state=published' },
    { n: by.in_review ?? 0, label: 'In review', to: '/admin/website/pages?state=in_review' },
    { n: (by.draft ?? 0) + (by.published_changes ?? 0), label: 'Drafts', to: '/admin/website/pages?state=draft' },
  ]
})
const lastPublished = computed(() => {
  const row = (site.value?.recent ?? []).find((r: any) => /publish/.test(r.action) && !/unpublish/.test(r.action))
  if (!row) {
    return 'Nothing has been published from the console yet.'
  }
  const title = row.metadata?.title ?? row.metadata?.key ?? 'A document'
  return `Last published: ${title} · ${ukDateTime(row.createdAt)} by ${row.actorEmail}.`
})

/* ---------------------------------------------------- pipeline, money --- */

const pipeline = computed(() => {
  const rows = stats.value?.pipeline ?? []
  const max = Math.max(1, ...rows.map(r => r.count))
  return rows.map(row => ({
    ...row,
    pct: Math.max(row.count > 0 ? 3 : 0, Math.round((row.count / max) * 100)),
    bar: row.key === 'COMPLETED' ? 'bg-[#22B07D]' : row.key === 'CANCELLED' ? 'bg-[#EC6453]' : 'bg-accent',
    to: `/admin/projects?status=${row.key}`,
  }))
})

const moneyRows = computed(() => {
  const m = stats.value?.money
  return m
    ? [
        { label: 'Credit in use', value: formatCurrency(m.creditInUse) },
        { label: 'Due in the next 30 days', value: formatCurrency(m.dueNext30Days) },
        { label: 'Overdue', value: formatCurrency(m.overdue) },
      ]
    : []
})
</script>

<template>
  <AdminPage>
    <AdminPageHeader :title="greet" :accent="firstName" :subtitle="subtitle" />

    <div v-if="error" role="alert" class="bg-st-danger-bg text-fg-heading flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-[13.5px]">
      <Icon name="lucide:alert-triangle" class="size-4 shrink-0 text-[#EC6453]" />
      <span class="flex-1">The work queue could not load. {{ error.statusMessage || 'Check your connection and try again.' }}</span>
      <AdminButton size="sm" @click="refresh()">
        Try again
      </AdminButton>
    </div>

    <section aria-label="Counts" class="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:auto-cols-fr xl:grid-flow-col xl:grid-cols-none">
      <template v-if="pending">
        <div v-for="i in 5" :key="i" class="bg-card border-line-subtle h-[132px] animate-pulse rounded-2xl border" aria-hidden="true" />
      </template>
      <AdminStatTile v-for="t in tiles" v-else :key="t.label" :label="t.label" :value="t.value" :cta="t.cta" :to="t.to" />
    </section>

    <div class="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <AdminCard label="Needs attention" :meta="queue.length ? `${queue.length} ${queue.length === 1 ? 'item' : 'items'} · oldest first` : undefined">
        <div v-if="pending" class="flex flex-col" aria-hidden="true">
          <div v-for="i in 4" :key="i" class="border-line-soft h-[62px] animate-pulse border-t" />
        </div>
        <p v-else-if="!queue.length" class="text-fg-body px-[22px] pb-8 pt-7 text-sm">
          Nothing waiting on your role. New items appear here oldest first.
        </p>
        <ul v-else>
          <li v-for="q in shown" :key="q.key">
            <NuxtLink
              :to="q.to"
              class="apex-ring border-line-soft hover:bg-raised grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 border-t px-[18px] py-[13px] sm:grid-cols-[132px_minmax(0,1fr)_128px_64px_18px] sm:px-[22px]"
            >
              <AdminStatusChip :tone="q.tone" :label="q.kind" class="col-span-2 sm:col-span-1" />
              <span class="min-w-0">
                <span class="text-fg-heading block truncate text-sm font-semibold">{{ q.title }}</span>
                <span class="text-fg-muted mt-0.5 block truncate text-[12.5px]">{{ q.sub }}</span>
              </span>
              <span class="hidden truncate text-[13px] sm:block" :class="q.owner ? 'text-fg-body' : 'text-st-warning-fg font-semibold'">
                {{ q.owner ?? q.ownerNote ?? 'Unassigned' }}
              </span>
              <span class="text-fg-muted text-end text-[12.5px] tabular-nums">
                <ClientOnly>{{ waitedSince(q.since) }}</ClientOnly>
              </span>
              <Icon name="lucide:chevron-right" class="text-fg-muted hidden size-[15px] sm:block" aria-hidden="true" />
            </NuxtLink>
          </li>
        </ul>
        <p v-if="queue.length > shown.length" class="border-line-soft text-fg-muted border-t px-[22px] py-3 text-[12.5px]">
          Showing the {{ shown.length }} longest-waiting of {{ queue.length }}.
        </p>
      </AdminCard>

      <div class="flex min-w-0 flex-col gap-5">
        <AdminCard v-if="can('website.view')" padded>
          <div class="flex flex-wrap items-center gap-2.5">
            <ApexSectionLabel>Website</ApexSectionLabel>
            <span class="flex-1" />
            <span class="text-fg-muted inline-flex items-center gap-1.5 text-[12.5px]">
              <span class="size-[7px] rounded-full bg-[#22B07D]" aria-hidden="true" />apexdigi.co.uk is live
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2.5">
            <NuxtLink v-for="s in siteStats" :key="s.label" :to="s.to" class="apex-ring bg-raised hover:outline-line-strong flex flex-col gap-1 rounded-xl p-3 hover:outline hover:outline-1">
              <span class="font-heading text-fg-heading text-2xl font-extrabold tabular-nums">{{ site ? s.n : '–' }}</span>
              <span class="text-fg-muted text-xs">{{ s.label }}</span>
            </NuxtLink>
          </div>
          <p class="text-fg-body text-[13px] leading-[1.55]">
            {{ site ? lastPublished : 'Loading the website’s state…' }}
          </p>
        </AdminCard>

        <AdminCard padded>
          <ApexSectionLabel>Delivery pipeline</ApexSectionLabel>
          <div class="flex flex-col gap-3">
            <NuxtLink v-for="p in pipeline" :key="p.key" :to="p.to" class="apex-ring group block rounded-lg">
              <span class="flex items-center gap-2.5">
                <span class="text-fg-body group-hover:text-fg-heading min-w-0 flex-1 text-[13.5px]">{{ p.label }}</span>
                <span class="font-heading text-fg-heading text-sm font-bold tabular-nums">{{ p.count }}</span>
              </span>
              <span class="bg-track mt-[7px] block h-[7px] overflow-hidden rounded-full">
                <span class="block h-full rounded-full" :class="p.bar" :style="{ width: `${p.pct}%` }" />
              </span>
            </NuxtLink>
          </div>
        </AdminCard>

        <AdminCard padded>
          <div class="flex items-center gap-2.5">
            <ApexSectionLabel>Money at a glance</ApexSectionLabel>
            <span class="flex-1" />
            <NuxtLink v-if="can('money.view')" to="/admin/payments" class="apex-ring text-accent-ink rounded text-[13px] font-semibold">
              Payments →
            </NuxtLink>
          </div>
          <dl v-if="moneyRows.length">
            <div v-for="m in moneyRows" :key="m.label" class="border-line-soft flex items-center gap-3 border-t py-[11px] first:border-t-0">
              <dt class="text-fg-body min-w-0 flex-1 text-[13.5px]">
                {{ m.label }}
              </dt>
              <dd class="font-heading text-fg-heading text-[15px] font-bold tabular-nums">
                {{ m.value }}
              </dd>
            </div>
          </dl>
          <p v-else class="text-fg-body text-[13px] leading-[1.55]">
            Money is shown to Owner, Admin and Finance. Your role does not receive these figures.
          </p>
        </AdminCard>
      </div>
    </div>
  </AdminPage>
</template>
