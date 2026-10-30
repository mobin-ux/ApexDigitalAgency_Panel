<script setup lang="ts">
import type { DisplayStatus, TemplateKey } from '~~/shared/cms'
import { ukDateTime } from '~/utils/adminFormat'
import { ADMIN_INPUT, ADMIN_TH } from '~/utils/adminUi'

/**
 * One template's documents as the admin console lists them
 * (`Admin Console.dc.html`): Insights is a table of articles, Case studies
 * a grid of cards. Both read `GET /api/admin/website/documents?template=`,
 * filter by display state with counts from the same rows, and open the
 * document in the editor.
 *
 * Articles and case studies are records in the site's code catalogue; the
 * panel overlays their words (ADR-021), so there is no "New article" here:
 * a new record is written in `web/app/data`, then imported.
 */
const { template, layout = 'table' } = defineProps<{
  template: TemplateKey
  layout?: 'table' | 'cards'
  noun: string
}>()

const { can } = useStaffAccess()
const { data, pending, error, refresh } = await useFetch<{ items: any[] }>('/api/admin/website/documents', {
  query: { template, pageSize: 100 },
})

const filter = ref<'all' | 'published' | 'in_review' | 'draft'>('all')
const all = computed(() => data.value?.items ?? [])
function matches(d: any, f: string) {
  return f === 'all'
    || (f === 'published' && (d.state === 'published' || d.state === 'published_changes'))
    || (f === 'draft' && (d.state === 'draft' || d.state === 'published_changes'))
    || d.state === f
}
const filters = computed(() => ([['all', 'All'], ['published', 'Published'], ['in_review', 'In review'], ['draft', 'Drafts']] as const)
  .map(([key, label]) => ({ key, label, n: all.value.filter(d => matches(d, key)).length })))
const rows = computed(() => all.value.filter(d => matches(d, filter.value)))
const search = ref('')
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? rows.value.filter(d => `${d.title} ${d.key}`.toLowerCase().includes(q)) : rows.value
})

const PILL = 'apex-ring inline-flex h-8 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-full border px-[13px] text-[13px]'
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex flex-wrap gap-2" role="group" :aria-label="`Filter ${noun}`">
        <button
          v-for="f in filters" :key="f.key" type="button" :aria-pressed="filter === f.key"
          :class="[PILL, filter === f.key ? 'bg-accent border-transparent font-semibold text-white' : 'border-line-subtle text-fg-heading hover:bg-hover font-medium']"
          @click="filter = f.key"
        >
          {{ f.label }} <span class="tabular-nums opacity-70">{{ f.n }}</span>
        </button>
      </div>
      <span class="hidden flex-1 lg:block" />
      <input v-model="search" type="search" :placeholder="`Search ${noun}`" :aria-label="`Search ${noun}`" :class="ADMIN_INPUT" class="h-9! min-w-0 flex-1 lg:w-[240px]! lg:flex-none">
    </div>

    <AdminWebsiteLoadError v-if="error" :error="error" :title="`Could not load the ${noun}`" @retry="refresh()" />

    <div v-else-if="pending" class="bg-card border-line-subtle h-40 animate-pulse rounded-2xl border" aria-hidden="true" />

    <AdminEmptyState
      v-else-if="!all.length"
      icon="lucide:file-text"
      :title="`No ${noun} are managed yet`"
      subtitle="They appear here once the site’s content is imported from Pages. New records are added in the site’s code, then imported."
    >
      <AdminButton to="/admin/website/pages">
        Go to Pages
      </AdminButton>
    </AdminEmptyState>

    <!-- Case studies: the design's cards. No cover band: the documents carry no cover image to show. -->
    <div v-else-if="layout === 'cards'" class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="d in shown" :key="d.id" :to="`/admin/website/pages/${d.id}`"
        class="apex-ring bg-card border-line-subtle hover:border-line-strong flex flex-col gap-2 rounded-2xl border px-[18px] pb-[18px] pt-4 transition-[transform,border-color] duration-200 motion-safe:hover:-translate-y-[3px]"
      >
        <span class="text-fg-muted truncate font-mono text-[11.5px]">{{ d.key }}</span>
        <span class="font-heading text-fg-heading text-[19px] font-bold tracking-[-0.02em]">{{ d.title }}</span>
        <span class="mt-1 flex flex-wrap items-center gap-2.5">
          <AdminWebsiteStatusChip :state="d.state as DisplayStatus" :error="d.lastPublishError" />
          <span class="text-fg-muted text-xs"><ClientOnly>{{ ukDateTime(d.draftUpdatedAt) }}</ClientOnly></span>
        </span>
      </NuxtLink>
      <p v-if="!shown.length" class="text-fg-body col-span-full text-sm">
        Nothing matches.
      </p>
    </div>

    <section v-else class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
      <div class="hidden grid-cols-[minmax(0,1fr)_170px_150px_150px_70px] gap-3.5 px-[22px] py-3.5 lg:grid" :class="ADMIN_TH">
        <span>Title</span><span>Status</span><span>Last edited</span><span>Published</span><span />
      </div>
      <ul>
        <li v-for="d in shown" :key="d.id">
          <NuxtLink
            :to="`/admin/website/pages/${d.id}`"
            class="apex-ring border-line-soft hover:bg-raised grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 border-t px-[18px] py-3 sm:px-[22px] lg:grid-cols-[minmax(0,1fr)_170px_150px_150px_70px]"
          >
            <span class="min-w-0">
              <span class="text-fg-heading block truncate text-sm font-semibold">{{ d.title }}</span>
              <span class="text-fg-muted mt-0.5 block truncate font-mono text-xs">{{ d.key }}</span>
            </span>
            <AdminWebsiteStatusChip :state="d.state as DisplayStatus" :error="d.lastPublishError" class="justify-self-end lg:justify-self-start" />
            <span class="text-fg-muted hidden text-[12.5px] tabular-nums lg:block"><ClientOnly>{{ ukDateTime(d.draftUpdatedAt) }}</ClientOnly></span>
            <span class="text-fg-muted hidden text-[12.5px] tabular-nums lg:block"><ClientOnly>{{ d.publishedAt ? ukDateTime(d.publishedAt) : '—' }}</ClientOnly></span>
            <span class="text-accent-ink hidden text-end text-[13px] font-semibold lg:block">{{ can('website.edit') ? 'Edit' : 'View' }} →</span>
          </NuxtLink>
        </li>
        <li v-if="!shown.length" class="border-line-soft text-fg-body border-t px-[22px] py-6 text-sm">
          Nothing matches.
        </li>
      </ul>
    </section>
  </div>
</template>
