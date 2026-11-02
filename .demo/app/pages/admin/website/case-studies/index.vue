<script setup lang="ts">
import type { WebsiteDocRow } from '~/composables/useWebsiteDocs'

/**
 * Website › Case studies (`Admin Console.dc.html` `is.work`): a card per
 * study, opening its editor. The design's striped cover band is left out:
 * a study's images live in its sections, and a placeholder band would
 * read as a missing picture. A study written in the site's code shows its
 * address where a built one shows its sector and service.
 */
definePageMeta({
  title: 'Case studies',
  layout: 'admin',
  middleware: 'admin',
})

const { can } = useStaffAccess()
const canEdit = computed(() => can('website.edit'))
const { busy, createDocument } = useWebsiteDocs()

const { data, error, refresh } = await useFetch<{ items: WebsiteDocRow[], total: number }>('/api/admin/website/documents', {
  query: { collection: 'work', pageSize: 100 },
  key: 'website-docs:work',
})

function over(row: WebsiteDocRow) {
  const meta = row.meta as { sector?: string, service?: string } | null
  const parts = [meta?.sector, meta?.service].filter(Boolean)
  return parts.length ? parts.join(' · ') : row.path
}
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="Case" accent="studies" subtitle="Shown on /our-work. Figures in a case study must come from the client's own reporting.">
      <AdminButton v-if="canEdit" variant="primary" :disabled="busy" @click="createDocument('work')">
        <Icon name="lucide:plus" class="size-[15px]" /> New case study
      </AdminButton>
    </AdminPageHeader>

    <AdminLoadError v-if="error" :error="error" title="Could not load the case studies" @retry="refresh" />
    <AdminEmptyState
      v-else-if="data && data.items.length === 0"
      icon="solar:case-round-linear"
      title="No case studies here yet"
      subtitle="Studies written in the site arrive with Import on the Pages screen; new ones start here."
    >
      <AdminButton v-if="canEdit" variant="primary" :disabled="busy" @click="createDocument('work')">
        New case study
      </AdminButton>
    </AdminEmptyState>
    <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="w in data?.items ?? []" :key="w.id" :to="`/admin/website/case-studies/${w.id}`"
        class="apex-ring bg-card border-line-subtle hover:border-line-strong flex flex-col gap-2 rounded-2xl border px-[18px] pb-[18px] pt-4 transition-[transform,border-color] duration-200 motion-safe:hover:-translate-y-[3px]"
      >
        <span v-if="over(w) === w.path" class="text-fg-muted truncate text-xs font-semibold">{{ w.path }}</span>
        <span v-else class="text-fg-muted truncate text-[11px] font-bold uppercase tracking-[0.07em]">{{ over(w) }}</span>
        <span class="font-heading text-fg-heading text-[19px] font-bold tracking-[-0.02em]">{{ w.title }}</span>
        <span class="mt-1 flex items-center gap-2.5">
          <AdminStatusChip :tone="w.chip.tone" :label="w.chip.label" />
          <span class="text-fg-muted text-xs tabular-nums">{{ ukDateTime(w.updatedAt).slice(0, 10) }}</span>
        </span>
      </NuxtLink>
    </div>
  </AdminPage>
</template>
