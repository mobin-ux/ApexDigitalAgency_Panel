<script setup lang="ts">
/**
 * Website › Analytics (`Admin Console.dc.html` `v_44analytics`, ADR-026
 * phase F): the design's period switch, four tiles, visits per day, top
 * pages, sources and enquiries by page.
 *
 * Real or absent: the design labels its traffic figures "Example" until
 * Plausible or Google Analytics is connected. The owner chose the site's
 * own cookieless counts instead, so every figure here is real: visits,
 * page views, pages and sources from the totals the site sends, and the
 * enquiry and order figures from their records. The design's "Visitors"
 * becomes "Visits": with no cookie or identifier nothing can tell two
 * visits by one person apart, so the screen counts page loads that came
 * from outside the site and says so. Days before counting began are drawn
 * as not counted, never as zero. The period is in the address (`?days=`).
 */
definePageMeta({
  title: 'Analytics',
  layout: 'admin',
  middleware: 'admin',
})

interface Report {
  days: number
  from: string
  to: string
  firstDay: string | null
  totals: { views: number, visits: number }
  series: { day: string, views: number, visits: number, counted: boolean }[]
  pages: { path: string, views: number }[]
  sources: { source: string, visits: number }[]
  enquiries: { received: number, won: number, byPage: { path: string, count: number }[] }
  orders: number
}

const PERIODS = [7, 30, 90] as const
const route = useRoute()
const router = useRouter()
const days = computed(() => {
  const asked = Number(route.query.days)
  return (PERIODS as readonly number[]).includes(asked) ? asked : 30
})
function choose(d: number) {
  router.replace({ query: { ...route.query, days: d === 30 ? undefined : String(d) } })
}

const fetchApi = useRequestFetch()
const { data: report, error, refresh, status } = await useAsyncData<Report>(
  'website-analytics',
  () => fetchApi<Report>('/api/admin/website/analytics', { query: { days: days.value } }),
  { watch: [days] },
)

const n = (v: number) => v.toLocaleString('en-GB')
const dmy = (day: string) => day.split('-').reverse().join('/')

const range = computed(() => report.value ? `${dmy(report.value.from)} – ${dmy(report.value.to)} · Europe/London` : 'Visits, pages and sources from apexdigi.co.uk.')

const tiles = computed(() => {
  const r = report.value
  if (!r) {
    return []
  }
  return [
    { label: 'Visits', value: n(r.totals.visits), chip: 'Counted', note: `${n(r.totals.views)} page ${r.totals.views === 1 ? 'view' : 'views'} · no cookies` },
    { label: 'Enquiries received', value: n(r.enquiries.received), chip: 'Records', note: 'Contact form messages in this period' },
    { label: 'Enquiries won', value: `${n(r.enquiries.won)} of ${n(r.enquiries.received)}`, chip: 'Records', note: 'Of those received, now marked Won' },
    { label: 'Orders placed in portal', value: n(r.orders), chip: 'Records', note: 'All time, from Projects' },
  ]
})

const bars = computed(() => {
  const series = report.value?.series ?? []
  const max = Math.max(1, ...series.map(s => s.visits))
  return series.map(s => ({
    ...s,
    pct: s.counted ? Math.max(s.visits ? 2 : 0, Math.round((s.visits / max) * 100)) : 100,
    title: s.counted ? `${dmy(s.day)} · ${n(s.visits)} ${s.visits === 1 ? 'visit' : 'visits'}, ${n(s.views)} page ${s.views === 1 ? 'view' : 'views'}` : `${dmy(s.day)} · not counted yet`,
  }))
})

const PILL = 'apex-ring inline-flex h-8 cursor-pointer items-center whitespace-nowrap rounded-full border px-[13px] text-[13px]'
const ROW = 'border-line-soft flex gap-2.5 border-t py-2 text-[13.5px]'
</script>

<template>
  <AdminPage>
    <AdminPageHeader title="Website" accent="analytics" :subtitle="range">
      <div class="flex gap-1.5" role="group" aria-label="Period">
        <button
          v-for="d in PERIODS" :key="d" type="button" :aria-pressed="days === d"
          :class="[PILL, days === d ? 'bg-accent border-transparent font-semibold text-white' : 'border-line-subtle text-fg-heading hover:bg-hover font-medium']"
          @click="choose(d)"
        >
          Last {{ d }} days
        </button>
      </div>
    </AdminPageHeader>

    <div v-if="error" role="alert" class="bg-st-danger-bg text-fg-heading flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-[13.5px]">
      <Icon name="lucide:alert-triangle" class="text-st-danger-fg size-4 shrink-0" />
      <span class="flex-1">Analytics could not load. {{ error.statusMessage || 'Check your connection and try again.' }}</span>
      <AdminButton size="sm" @click="refresh()">
        Try again
      </AdminButton>
    </div>

    <template v-else-if="report">
      <div class="bg-st-info-bg text-fg-heading flex items-start gap-3 rounded-xl px-4 py-3.5 text-[13.5px] leading-[1.55]">
        <Icon name="lucide:shield-check" class="text-st-info-fg mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span class="flex-1">
          Counted by apexdigi.co.uk itself: no cookies, no tracking script and no IP address kept. A visit is a page load that came from outside the site; page views count every page shown. Browsers with JavaScript off and self-declared bots are not counted.
          <template v-if="report.firstDay">Counting began on {{ dmy(report.firstDay) }}.</template>
          <template v-else>No visits have been counted yet.</template>
          Enquiry and order figures come from their records.
        </span>
      </div>

      <section aria-label="Totals" class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4" :aria-busy="status === 'pending'">
        <div v-for="t in tiles" :key="t.label" class="bg-card border-line-subtle flex flex-col gap-2 rounded-2xl border p-[18px]">
          <span class="flex items-center gap-2">
            <span class="text-fg-muted flex-1 text-[12.5px]">{{ t.label }}</span>
            <AdminStatusChip tone="success" :label="t.chip" />
          </span>
          <span class="font-heading text-fg-heading text-[30px] font-extrabold tabular-nums tracking-[-0.03em]">{{ t.value }}</span>
          <span class="text-fg-muted text-xs">{{ t.note }}</span>
        </div>
      </section>

      <AdminCard padded>
        <div class="flex items-center gap-2.5">
          <ApexSectionLabel>Visits per day</ApexSectionLabel>
          <span class="flex-1" />
          <span class="text-fg-muted text-[12.5px] tabular-nums">{{ n(report.totals.visits) }} in {{ report.days }} days</span>
        </div>
        <div class="flex h-40 items-end" :class="report.days > 30 ? 'sm:gap-px' : 'gap-1'" aria-hidden="true">
          <span
            v-for="b in bars" :key="b.day" :title="b.title"
            class="min-w-0 flex-1 rounded-t border"
            :class="b.counted ? 'bg-accent border-transparent' : 'border-line-rule border-dashed'"
            :style="{ height: `${b.pct}%` }"
          />
        </div>
        <div class="text-fg-muted flex justify-between text-xs tabular-nums" aria-hidden="true">
          <span>{{ dmy(report.from) }}</span>
          <span>{{ dmy(report.to) }}</span>
        </div>
        <table class="sr-only">
          <caption>Visits and page views per day</caption>
          <thead>
            <tr><th>Day</th><th>Visits</th><th>Page views</th></tr>
          </thead>
          <tbody>
            <tr v-for="b in bars" :key="b.day">
              <td>{{ dmy(b.day) }}</td>
              <td>{{ b.counted ? b.visits : 'Not counted' }}</td>
              <td>{{ b.counted ? b.views : 'Not counted' }}</td>
            </tr>
          </tbody>
        </table>
      </AdminCard>

      <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <AdminCard padded>
          <div class="flex items-center gap-2.5">
            <ApexSectionLabel>Top pages</ApexSectionLabel>
            <span class="flex-1" />
            <span class="text-fg-muted text-xs">Page views</span>
          </div>
          <ul v-if="report.pages.length">
            <li v-for="p in report.pages" :key="p.path" :class="ROW">
              <span class="text-fg-heading min-w-0 flex-1 truncate">{{ p.path === '(other)' ? 'Other pages' : p.path }}</span>
              <span class="text-fg-body tabular-nums">{{ n(p.views) }}</span>
            </li>
          </ul>
          <p v-else class="text-fg-body text-[13px]">
            No page views in this period.
          </p>
        </AdminCard>

        <AdminCard padded>
          <div class="flex items-center gap-2.5">
            <ApexSectionLabel>Sources</ApexSectionLabel>
            <span class="flex-1" />
            <span class="text-fg-muted text-xs">Visits</span>
          </div>
          <ul v-if="report.sources.length">
            <li v-for="s in report.sources" :key="s.source" :class="ROW">
              <span class="text-fg-heading min-w-0 flex-1 truncate">{{ s.source }}</span>
              <span class="text-fg-body tabular-nums">{{ n(s.visits) }}</span>
            </li>
          </ul>
          <p v-else class="text-fg-body text-[13px]">
            No visits in this period.
          </p>
        </AdminCard>

        <AdminCard padded>
          <div class="flex items-center gap-2.5">
            <ApexSectionLabel>Enquiries by page</ApexSectionLabel>
            <span class="flex-1" />
            <AdminStatusChip tone="success" label="Records" />
          </div>
          <ul v-if="report.enquiries.byPage.length">
            <li v-for="e in report.enquiries.byPage" :key="e.path" :class="ROW">
              <span class="text-fg-heading min-w-0 flex-1 truncate">{{ e.path }}</span>
              <span class="text-fg-body tabular-nums">{{ n(e.count) }}</span>
            </li>
          </ul>
          <p v-else class="text-fg-body text-[13px]">
            No enquiries in this period.
          </p>
        </AdminCard>
      </div>
    </template>
  </AdminPage>
</template>
