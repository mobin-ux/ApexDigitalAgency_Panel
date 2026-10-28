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
 * `website.view` may look. Every tile and row links to the screen that
 * lists what it counts, and the quick actions show only what the signed-in
 * role may do. "Retry now" runs the same job the scheduler runs every
 * minute, for a failed publish or a change the site's cache has not taken.
 */
definePageMeta({
  title: 'Website',
  layout: 'admin',
  middleware: 'admin',
})

const { can } = useStaffAccess()
const allowed = computed(() => can('website.view'))
const toaster = useNuiToasts()

const { data, pending, error, refresh } = await useFetch('/api/admin/website/overview', { immediate: allowed.value })

const total = computed(() => data.value?.documents.total ?? 0)
const by = computed(() => data.value?.documents.byStatus ?? {})

const tiles = computed(() => [
  { label: 'Published', value: (by.value.published ?? 0) + (by.value.published_changes ?? 0), icon: 'lucide:globe', accent: 'green' as const, hint: by.value.published_changes ? `${by.value.published_changes} with draft changes` : 'Live on the site', to: '/admin/website/pages?state=published' },
  { label: 'In review', value: (by.value.in_review ?? 0) + (by.value.approved ?? 0), icon: 'lucide:eye', accent: 'amber' as const, hint: by.value.approved ? `${by.value.approved} approved, waiting to publish` : 'Drafts awaiting a publisher', to: '/admin/website/pages?state=in_review' },
  { label: 'Scheduled', value: by.value.scheduled ?? 0, icon: 'lucide:calendar-clock', accent: 'blue' as const, hint: data.value?.scheduled[0]?.scheduledFor ? `Next: ${fmtDate(data.value.scheduled[0].scheduledFor)}` : 'Nothing queued', to: '/admin/website/pages?state=scheduled' },
  { label: 'Media files', value: data.value?.media.count ?? 0, icon: 'lucide:image', accent: 'violet' as const, hint: data.value?.media.bytes ? formatBytes(data.value.media.bytes) : 'Library is empty', to: '/admin/website/media' },
])

/** Where the signed-in role can go from here; a destination the role cannot open is left out rather than shown locked. */
const quickActions = computed(() => [
  { label: 'Pages', icon: 'lucide:file-text', to: '/admin/website/pages', needs: 'website.view' },
  { label: 'Navigation', icon: 'lucide:menu', to: '/admin/website/navigation', needs: 'website.view' },
  { label: 'Media', icon: 'lucide:image', to: '/admin/website/media', needs: 'website.view' },
  { label: 'SEO & redirects', icon: 'lucide:search', to: '/admin/website/seo', needs: 'website.seo' },
  { label: 'Site settings', icon: 'lucide:settings-2', to: '/admin/website/settings', needs: 'website.settings' },
  { label: 'Panel content', icon: 'lucide:layout-dashboard', to: '/admin/website/panel', needs: 'website.view' },
].filter(a => can(a.needs as any)))

/** The scheduler's job, run now: publishes what is due and retries what the site's cache has not taken. */
const retrying = ref(false)
async function retryNow() {
  retrying.value = true
  try {
    const result = await $fetch<{ published: string[], failed: { id: string, error: string }[], retried: number }>('/api/admin/website/publish-due', { method: 'POST', body: {} })
    const parts = []
    if (result.published.length) {
      parts.push(`${result.published.length} published`)
    }
    if (result.failed.length) {
      parts.push(`${result.failed.length} still failing`)
    }
    if (result.retried) {
      parts.push(`${result.retried} cache ${result.retried === 1 ? 'refresh' : 'refreshes'} sent`)
    }
    toaster.add({ title: 'Ran the publish job', description: parts.length ? parts.join(', ') : 'Nothing was due.', icon: 'lucide:check', progress: true })
    await refresh()
  }
  catch (e) {
    toaster.add({ title: 'Could not run it', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    retrying.value = false
  }
}

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

    <AdminWebsiteLoadError v-else-if="error" :error="error" title="Could not load the overview" @retry="refresh()" />

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
          :to="tile.to"
        />
      </div>

      <nav v-if="quickActions.length" aria-label="Website screens" class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="action in quickActions" :key="action.to" :to="action.to"
          class="apex-focus border-muted-200 text-muted-900 hover:border-primary-500 inline-flex min-h-10 items-center gap-2 rounded-full border bg-white px-4 text-[13px] font-semibold transition dark:border-white/10 dark:bg-muted-900 dark:text-white"
        >
          <Icon :name="action.icon" class="size-4 text-primary-500" aria-hidden="true" />
          {{ action.label }}
        </NuxtLink>
      </nav>

      <AdminEmptyState
        v-if="!pending && total === 0"
        icon="lucide:file-text"
        title="Nothing is managed yet"
        subtitle="The site renders from its code until its pages are imported here. Importing creates one document per page and per piece of chrome, published as revision 1, and nothing on the site changes until a document is edited and published."
      />

      <template v-else-if="!pending">
        <section v-if="data?.failed.length || data?.revalidatePending" :class="CARD" class="p-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <ApexSectionLabel>{{ data?.failed.length ? 'Failed to publish' : 'Waiting for the site' }}</ApexSectionLabel>
            <BaseButton v-if="can('website.publish')" size="sm" rounded="lg" variant="muted" :loading="retrying" :disabled="retrying" @click="retryNow">
              Retry now
            </BaseButton>
          </div>
          <ul v-if="data?.failed.length" class="mt-4 flex flex-col gap-3">
            <li v-for="doc in data.failed" :key="doc.id" class="flex flex-col gap-1 rounded-xl bg-[#EC6453]/8 px-4 py-3">
              <NuxtLink :to="`/admin/website/pages/${doc.id}`" class="apex-focus text-muted-900 text-sm font-semibold hover:underline dark:text-white">
                {{ doc.title }} <span class="text-muted-500 font-mono text-xs">{{ doc.key }}</span>
              </NuxtLink>
              <span class="text-[13px] text-[#EC6453]">{{ doc.error }}</span>
            </li>
          </ul>
          <p v-if="data?.revalidatePending" class="mt-4 text-[13px] text-[#D9A521] dark:text-[#F2C14E]">
            {{ data.revalidatePending }} published {{ data.revalidatePending === 1 ? 'change has' : 'changes have' }} not reached the site's cache yet; the scheduler retries every minute.
          </p>
        </section>

        <section v-if="data?.scheduled.length" :class="CARD" class="p-6">
          <ApexSectionLabel>Scheduled</ApexSectionLabel>
          <ul class="mt-4 flex flex-col divide-y divide-muted-200 dark:divide-white/5">
            <li v-for="doc in data.scheduled" :key="doc.id" class="flex items-center justify-between gap-4 py-3 text-sm">
              <NuxtLink :to="`/admin/website/pages/${doc.id}`" class="apex-focus text-muted-900 min-w-0 truncate font-semibold hover:underline dark:text-white">
                {{ doc.title }}
              </NuxtLink>
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
        </section>

        <section :class="CARD" class="p-6">
          <ApexSectionLabel>Search and addresses</ApexSectionLabel>
          <dl class="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-muted-500">
                Redirects on
              </dt>
              <dd class="text-muted-900 font-semibold tabular-nums dark:text-white">
                {{ data?.redirects.enabled ?? 0 }}<span v-if="data?.redirects.disabled" class="text-muted-500 font-normal"> (+{{ data.redirects.disabled }} off)</span>
              </dd>
            </div>
            <div v-if="data?.seo" class="flex items-baseline justify-between gap-3">
              <dt class="text-muted-500">
                SEO issues
              </dt>
              <dd class="text-muted-900 font-semibold tabular-nums dark:text-white">
                {{ data.seo.issues }}<span v-if="data.seo.errors" class="font-normal text-[#EC6453]"> ({{ data.seo.errors }} to fix)</span>
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-muted-500">
                Documents
              </dt>
              <dd class="text-muted-900 font-semibold tabular-nums dark:text-white">
                {{ data?.documents.byKind.page ?? 0 }} pages · {{ data?.documents.byKind.global ?? 0 }} chrome · {{ data?.documents.byKind.panel ?? 0 }} panel
              </dd>
            </div>
          </dl>
          <p v-if="can('website.seo')" class="mt-3 text-[12.5px]">
            <NuxtLink to="/admin/website/seo" class="apex-focus text-primary-500 hover:underline">
              Open SEO & redirects
            </NuxtLink>
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
