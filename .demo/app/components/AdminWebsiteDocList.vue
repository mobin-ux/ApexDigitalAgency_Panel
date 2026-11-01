<script setup lang="ts">
import type { WebsiteDocRow } from '~/composables/useWebsiteDocs'
import { ARTICLE_CATEGORIES } from '~~/shared/cms'
import { ADMIN_TH } from '~/utils/adminUi'

/**
 * The Pages and Insights lists (`Admin Console.dc.html` `v_20doclists`):
 * header with New, Pages' "All pages · Publish history" tabs, the four
 * status filters with counts over the whole collection, and one row per
 * document opening its editor. Rows and counts come from the server
 * (`GET /api/admin/website/documents`), filtered and sorted there.
 */
const { collection } = defineProps<{ collection: 'pages' | 'insights' }>()

const { can } = useStaffAccess()
const canEdit = computed(() => can('website.edit'))
const canImport = computed(() => can('website.publish'))
const isPages = computed(() => collection === 'pages')
const { busy, createDocument, importSite } = useWebsiteDocs()

type Filter = 'all' | 'published' | 'review' | 'draft'
const route = useRoute()
const tab = ref<'all' | 'history'>(isPages.value && route.query.tab === 'history' ? 'history' : 'all')
const filter = ref<Filter>((['published', 'review', 'draft'] as const).find(f => f === route.query.filter) ?? 'all')
const page = ref(1)
watch(filter, () => (page.value = 1))
watch([tab, filter], () => {
  const query = { ...route.query, tab: tab.value === 'history' ? 'history' : undefined, filter: filter.value === 'all' ? undefined : filter.value }
  navigateTo({ query }, { replace: true })
})

const { data, error, refresh, status } = await useFetch<{ items: WebsiteDocRow[], total: number, page: number, pageCount: number, counts: Record<Filter, number> }>('/api/admin/website/documents', {
  query: computed(() => ({ collection, filter: filter.value, page: page.value, pageSize: 50 })),
  key: `website-docs:${collection}`,
})

const history = ref(1)
const { data: log, error: logError, refresh: refreshLog } = await useFetch<{ items: { id: string, at: string, action: string, kind: string, actor: string, role: string | null, reason: string | null, subject: string, documentId: string | null }[], total: number, page: number, pageCount: number }>('/api/admin/website/history', {
  query: computed(() => ({ page: history.value, pageSize: 30 })),
  immediate: isPages.value,
  watch: [history],
  key: 'website-history',
})
watch(tab, (t) => {
  if (t === 'history') {
    refreshLog()
  }
})

const FILTERS: { key: Filter, label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'review', label: 'In review' },
  { key: 'draft', label: 'Drafts' },
]

const CATEGORY = Object.fromEntries(ARTICLE_CATEGORIES.map(c => [c.value, c.label])) as Record<string, string>
function typeOf(row: WebsiteDocRow) {
  if (isPages.value) {
    return row.type
  }
  const category = typeof row.meta?.category === 'string' ? CATEGORY[row.meta.category] : undefined
  return category ?? (row.built ? 'Article' : 'Written in the site')
}

function historyTone(kind: string) {
  return kind === 'publish' || kind === 'approve' ? 'success' : kind === 'submit' ? 'warning' : kind === 'reject' ? 'danger' : 'neutral'
}

const copy = computed(() => isPages.value
  ? { title: 'Website', accent: 'pages', sub: 'Every page on apexdigi.co.uk. Service pages take their prices from Services & pricing.', new: 'New page', noun: 'pages' }
  : { title: 'Insights', accent: 'articles', sub: 'Articles on /insights. Views per page are in Analytics.', new: 'New article', noun: 'articles' })

const TAB_CLS = 'apex-ring -mb-px inline-flex h-10 shrink-0 cursor-pointer items-center border-b-2 text-sm'
const PILL = 'apex-ring inline-flex h-8 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-full border px-[13px] text-[13px]'
const COLS = 'xl:grid-cols-[minmax(0,1fr)_140px_190px_150px_140px_72px]'
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader :title="copy.title" :accent="copy.accent" :subtitle="copy.sub">
      <AdminButton v-if="canImport && isPages" :disabled="busy" @click="importSite(refresh)">
        <Icon name="lucide:download" class="size-[15px]" /> Import from site
      </AdminButton>
      <AdminButton v-if="canEdit" variant="primary" :disabled="busy" @click="createDocument(collection)">
        <Icon name="lucide:plus" class="size-[15px]" /> {{ copy.new }}
      </AdminButton>
    </AdminPageHeader>

    <div v-if="isPages" class="border-line-subtle flex gap-6 overflow-x-auto border-b" role="tablist" aria-label="Pages">
      <button
        v-for="t in [{ key: 'all', label: 'All pages' }, { key: 'history', label: 'Publish history' }] as const" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key"
        :class="[TAB_CLS, tab === t.key ? 'border-accent text-fg-heading font-semibold' : 'text-fg-muted border-transparent font-medium']"
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <template v-if="tab === 'all'">
      <div class="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        <button
          v-for="f in FILTERS" :key="f.key" type="button" :aria-pressed="filter === f.key"
          :class="[PILL, filter === f.key ? 'bg-accent border-transparent font-semibold text-white' : 'border-line-subtle text-fg-heading hover:bg-hover font-medium']"
          @click="filter = f.key"
        >
          {{ f.label }} <span class="tabular-nums opacity-70">{{ data?.counts?.[f.key] ?? 0 }}</span>
        </button>
      </div>

      <AdminLoadError v-if="error" :error="error" :title="`Could not load the ${copy.noun}`" @retry="refresh" />
      <AdminEmptyState
        v-else-if="data && data.counts.all === 0"
        icon="solar:document-text-linear"
        :title="isPages ? 'No pages here yet' : 'No articles here yet'"
        :subtitle="isPages ? 'Import brings the site\'s current pages in, published with exactly the words visitors already see.' : 'Articles written in the site arrive with Import on the Pages screen; new ones start here.'"
      >
        <div class="flex flex-wrap justify-center gap-2.5">
          <AdminButton v-if="canImport && isPages" :disabled="busy" @click="importSite(refresh)">
            Import from site
          </AdminButton>
          <AdminButton v-if="canEdit" variant="primary" :disabled="busy" @click="createDocument(collection)">
            {{ copy.new }}
          </AdminButton>
        </div>
      </AdminEmptyState>
      <section v-else class="bg-card border-line-subtle overflow-hidden rounded-2xl border" :aria-busy="status === 'pending'">
        <div class="hidden gap-3.5 px-[22px] py-3.5 xl:grid" :class="[ADMIN_TH, COLS]">
          <span>Title</span><span>{{ isPages ? 'Type' : 'Category' }}</span><span>Status</span><span>Last edited by</span><span>Updated</span><span />
        </div>
        <p v-if="data && data.items.length === 0" class="border-line-soft text-fg-muted border-t px-[22px] py-6 text-[13.5px]">
          Nothing matches this filter.
        </p>
        <NuxtLink
          v-for="r in data?.items ?? []" :key="r.id" :to="`/admin/website/${collection}/${r.id}`"
          class="apex-ring border-line-soft hover:bg-raised grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 border-t px-[18px] py-3 sm:px-[22px]"
          :class="COLS"
        >
          <span class="min-w-0">
            <span class="text-fg-heading block truncate text-sm font-semibold">{{ r.title }}</span>
            <span class="text-fg-muted mt-0.5 block truncate text-[12.5px]">{{ r.path }}</span>
          </span>
          <span class="text-fg-body hidden text-[13px] xl:block">{{ typeOf(r) }}</span>
          <AdminStatusChip :tone="r.chip.tone" :label="r.chip.label" class="row-start-1 col-start-2 xl:col-auto xl:row-auto" />
          <span class="text-fg-body col-span-2 text-[13px] xl:col-auto">
            <span class="text-fg-muted xl:hidden">{{ typeOf(r) }} · </span>{{ r.updatedBy ?? '—' }}<span class="text-fg-muted xl:hidden"> · {{ ukDateTime(r.updatedAt) }}</span>
          </span>
          <span class="text-fg-muted hidden text-[12.5px] tabular-nums xl:block">{{ ukDateTime(r.updatedAt) }}</span>
          <span class="text-accent-ink hidden text-end text-[13px] font-semibold xl:block">{{ canEdit ? 'Edit' : 'View' }} →</span>
        </NuxtLink>
      </section>
      <AdminPager v-if="data && data.pageCount > 1" v-model:page="page" :page-count="data.pageCount" :total="data.total" :noun="copy.noun" />
    </template>

    <template v-else>
      <AdminLoadError v-if="logError" :error="logError" title="Could not load the publish history" @retry="refreshLog" />
      <section v-else class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
        <p class="text-fg-muted px-[22px] py-3.5 text-[13px]">
          Every submission, decision and publish across pages, articles and case studies. Each published version can be restored from the editor's Revisions tab.
        </p>
        <p v-if="log && log.items.length === 0" class="border-line-soft text-fg-muted border-t px-[22px] py-6 text-[13.5px]">
          Nothing has been published from the console yet.
        </p>
        <div
          v-for="h in log?.items ?? []" :key="h.id"
          class="border-line-soft grid grid-cols-1 items-start gap-x-3.5 gap-y-1.5 border-t px-[18px] py-3 sm:px-[22px] xl:grid-cols-[170px_190px_minmax(0,1fr)_230px]"
        >
          <span class="text-fg-muted text-[12.5px] tabular-nums">{{ ukDateTime(h.at) }}</span>
          <AdminStatusChip :tone="historyTone(h.kind)" :label="h.action" />
          <span class="min-w-0">
            <span class="text-fg-heading block text-sm">{{ h.subject || 'A website document' }}</span>
            <span v-if="h.reason" class="text-fg-muted mt-0.5 block text-[12.5px]">“{{ h.reason }}”</span>
          </span>
          <span class="text-fg-body text-[13px]">{{ h.actor }}{{ h.role ? ` · ${h.role}` : '' }}</span>
        </div>
      </section>
      <AdminPager v-if="log && log.pageCount > 1" v-model:page="history" :page-count="log.pageCount" :total="log.total" noun="events" />
    </template>
  </AdminPage>
</template>
