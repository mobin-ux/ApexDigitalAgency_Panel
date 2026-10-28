<script setup lang="ts">
import { DISPLAY_STATUS_LABEL } from '~~/shared/cms'

/**
 * Website — overview (ADR-021).
 *
 * The first screen of the website module: how many documents exist in each
 * state, what is scheduled, what failed to publish, and the latest website
 * activity from the audit log. Every number is a count of rows the module's
 * other screens list; while nothing has been imported yet the page says so
 * rather than drawing zeros as if they meant something.
 *
 * `website.view` may look. The actions arrive with their screens in later
 * gates; a button with no screen behind it is the dead control this panel
 * does not ship.
 */
definePageMeta({
  title: 'Website',
  layout: 'admin',
  middleware: 'admin',
})

const { can } = useStaffAccess()
const allowed = computed(() => can('website.view'))

const { data, pending } = await useFetch('/api/admin/website/overview', { immediate: allowed.value })

const total = computed(() => data.value?.documents.total ?? 0)
const by = computed(() => data.value?.documents.byStatus ?? {})

const tiles = computed(() => [
  { label: 'Published', value: (by.value.published ?? 0) + (by.value.published_changes ?? 0), icon: 'lucide:globe', accent: 'green' as const, hint: by.value.published_changes ? `${by.value.published_changes} with draft changes` : 'Live on the site' },
  { label: 'In review', value: (by.value.in_review ?? 0) + (by.value.approved ?? 0), icon: 'lucide:eye', accent: 'amber' as const, hint: by.value.approved ? `${by.value.approved} approved, waiting to publish` : 'Drafts awaiting a publisher' },
  { label: 'Scheduled', value: by.value.scheduled ?? 0, icon: 'lucide:calendar-clock', accent: 'blue' as const, hint: data.value?.scheduled[0]?.scheduledFor ? `Next: ${fmtDate(data.value.scheduled[0].scheduledFor)}` : 'Nothing queued' },
  { label: 'Media files', value: data.value?.media.count ?? 0, icon: 'lucide:image', accent: 'violet' as const, hint: data.value?.media.bytes ? formatBytes(data.value.media.bytes) : 'Library is empty' },
])

function fmtDate(iso: string | Date | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}

function formatBytes(n: number) {
  if (n < 1024) {
    return `${n} B`
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(0)} KB`
  }
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function humanise(action: string) {
  return action.replace(/^admin\.website\./, '').replace(/[.-]/g, ' ')
}

const CARD = 'border-muted-200 bg-white dark:border-muted-800 dark:bg-muted-900 rounded-2xl border'
</script>

<template>
  <div class="mx-auto flex max-w-[1180px] flex-col gap-8 pb-10">
    <AdminPageHeader
      title="Website"
      subtitle="Pages, menus, media and SEO for the public site, and the customer-facing documents in this panel."
    />

    <AdminAccessWall
      v-if="!allowed"
      permission="website.view"
      title="Website content is not part of your role"
      body="The website module shows the public site's pages, media and settings."
    />

    <template v-else>
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatTile
          v-for="tile in tiles"
          :key="tile.label"
          :label="tile.label"
          :value="pending ? '…' : tile.value"
          :icon="tile.icon"
          :accent="tile.accent"
          :hint="tile.hint"
        />
      </div>

      <AdminEmptyState
        v-if="!pending && total === 0"
        icon="lucide:file-text"
        title="Nothing is managed yet"
        subtitle="The site renders from its code until its pages are imported here. Importing creates one document per page and per piece of chrome, published as revision 1, and nothing on the site changes until a document is edited and published."
      />

      <template v-else-if="!pending">
        <section v-if="data?.failed.length" :class="CARD" class="p-6">
          <ApexSectionLabel>Failed to publish</ApexSectionLabel>
          <ul class="mt-4 flex flex-col gap-3">
            <li v-for="doc in data.failed" :key="doc.id" class="flex flex-col gap-1 rounded-xl bg-[#EC6453]/8 px-4 py-3">
              <span class="text-muted-900 text-sm font-semibold dark:text-white">{{ doc.title }} <span class="text-muted-500 font-mono text-xs">{{ doc.key }}</span></span>
              <span class="text-[13px] text-[#EC6453]">{{ doc.error }}</span>
            </li>
          </ul>
        </section>

        <section v-if="data?.scheduled.length" :class="CARD" class="p-6">
          <ApexSectionLabel>Scheduled</ApexSectionLabel>
          <ul class="mt-4 flex flex-col divide-y divide-muted-200 dark:divide-white/5">
            <li v-for="doc in data.scheduled" :key="doc.id" class="flex items-center justify-between gap-4 py-3 text-sm">
              <span class="text-muted-900 min-w-0 truncate font-semibold dark:text-white">{{ doc.title }}</span>
              <span class="text-muted-500 shrink-0 tabular-nums">{{ fmtDate(doc.scheduledFor) }}</span>
            </li>
          </ul>
        </section>

        <section :class="CARD" class="p-6">
          <ApexSectionLabel>By status</ApexSectionLabel>
          <dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
            <div v-for="(label, key) in DISPLAY_STATUS_LABEL" :key="key" class="flex items-baseline justify-between gap-3">
              <dt class="text-muted-500">
                {{ label }}
              </dt>
              <dd class="text-muted-900 font-semibold tabular-nums dark:text-white">
                {{ by[key] ?? 0 }}
              </dd>
            </div>
          </dl>
          <p v-if="data?.revalidatePending" class="mt-4 text-[13px] text-[#F2C14E]">
            {{ data.revalidatePending }} published {{ data.revalidatePending === 1 ? 'change has' : 'changes have' }} not reached the site's cache yet; the scheduler retries every minute.
          </p>
        </section>

        <section :class="CARD" class="p-6">
          <ApexSectionLabel>Recent activity</ApexSectionLabel>
          <p v-if="!data?.recent.length" class="text-muted-500 mt-4 text-sm">
            No website actions have been recorded yet.
          </p>
          <ul v-else class="mt-4 flex flex-col divide-y divide-muted-200 dark:divide-white/5">
            <li v-for="row in data.recent" :key="row.id" class="flex items-center justify-between gap-4 py-3 text-sm">
              <span class="min-w-0 truncate">
                <span class="text-muted-900 font-semibold dark:text-white">{{ humanise(row.action) }}</span>
                <span class="text-muted-500"> · {{ row.actorEmail }}</span>
              </span>
              <span class="text-muted-500 shrink-0 tabular-nums">{{ fmtDate(row.createdAt) }}</span>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </div>
</template>
