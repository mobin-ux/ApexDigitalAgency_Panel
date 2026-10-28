<script setup lang="ts">
import type { DisplayStatus } from '~~/shared/cms'
import { TEMPLATES } from '~~/shared/cms'

/**
 * Website — navigation and chrome (ADR-021). The documents every public
 * page shares: the header (menu, sign-in and start buttons, breadcrumb
 * names), the footer (strip, link columns, legal line), the announcement
 * bar and the three chrome documents for service, case-study and article
 * pages. Each exists once; the baseline import creates them from the site
 * code, and this screen opens the editor for each. A chrome document that
 * does not exist yet says so rather than offering a form the site would
 * ignore.
 */
definePageMeta({
  title: 'Website navigation',
  layout: 'admin',
  middleware: 'admin',
})

const { can } = useStaffAccess()
const allowed = computed(() => can('website.view'))

const { data, pending } = await useFetch('/api/admin/website/documents', { query: { kind: 'global', pageSize: 50 }, immediate: allowed.value })

const ORDER = ['header', 'footer', 'announcement', 'service-chrome', 'case-study-chrome', 'article-chrome'] as const
const rows = computed(() => ORDER.map((template) => {
  const doc = data.value?.items.find(d => d.template === template) ?? null
  return { template, label: TEMPLATES[template].label, detail: TEMPLATES[template].detail, doc }
}))

function fmtDate(iso: string | Date | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}

const CARD = 'border-muted-200 bg-white dark:border-muted-800 dark:bg-muted-900 rounded-2xl border'
</script>

<template>
  <div class="mx-auto flex max-w-[1180px] flex-col gap-8 pb-10">
    <AdminPageHeader
      title="Navigation and chrome"
      subtitle="The menu, the footer, the announcement bar and the words every service, case-study and article page shares."
    />

    <AdminAccessWall
      v-if="!allowed"
      permission="website.view"
      title="Website content is not part of your role"
      body="Navigation is part of the website module."
    />

    <div v-else :class="CARD" class="divide-muted-200 flex flex-col divide-y dark:divide-white/5">
      <div v-for="row in rows" :key="row.template" class="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center">
        <div class="min-w-0 flex-1">
          <p class="text-muted-900 text-sm font-semibold dark:text-white">
            {{ row.label }}
          </p>
          <p class="text-muted-500 text-[12.5px]">
            {{ row.detail }}
          </p>
          <p v-if="row.doc" class="text-muted-500 mt-1 text-xs">
            Last edited {{ fmtDate(row.doc.draftUpdatedAt) }}<template v-if="row.doc.publishedAt">
              · published {{ fmtDate(row.doc.publishedAt) }}
            </template>
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <template v-if="row.doc">
            <AdminWebsiteStatusChip :state="row.doc.state as DisplayStatus" :error="row.doc.lastPublishError" />
            <BaseButton size="sm" rounded="lg" variant="muted" :to="`/admin/website/pages/${row.doc.id}`">
              {{ can('website.edit') ? 'Edit' : 'View' }}
            </BaseButton>
          </template>
          <span v-else-if="!pending" class="text-muted-500 text-[12.5px]">
            Not imported yet. The site renders its code until the baseline is imported from the Pages screen.
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
