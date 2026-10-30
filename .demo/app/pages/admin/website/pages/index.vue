<script setup lang="ts">
import type { DisplayStatus, TemplateKey } from '~~/shared/cms'
import { creatableTemplates, TEMPLATES } from '~~/shared/cms'
import { ukDateTime } from '~/utils/adminFormat'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL, ADMIN_TH } from '~/utils/adminUi'

/**
 * Website — pages (ADR-021). Every managed document in one list: the
 * public pages, the chrome, the panel documents; each row names its state
 * (the one label that folds published, draft and schedule together) and
 * opens the editor. Filters are server-side; the state filter is derived
 * per row on the server, so the counts and the rows cannot disagree.
 *
 * "Import current site content" appears only while nothing is managed, and
 * only to a role that may change site settings: it creates one document
 * per page from the site's own words and changes nothing on the site.
 */
definePageMeta({
  title: 'Pages',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()
const route = useRoute()
const router = useRouter()
const { can } = useStaffAccess()
const allowed = computed(() => can('website.view'))

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const debouncedSearch = ref(search.value)
const kind = ref<string>(typeof route.query.kind === 'string' ? route.query.kind : '')
const state = ref<string>(typeof route.query.state === 'string' ? route.query.state : '')
const page = ref(1)

watchDebounced(search, (value) => {
  debouncedSearch.value = value.trim()
}, { debounce: 300 })

watch([debouncedSearch, kind, state], () => {
  page.value = 1
  router.replace({ query: { ...(debouncedSearch.value ? { q: debouncedSearch.value } : {}), ...(kind.value ? { kind: kind.value } : {}), ...(state.value ? { state: state.value } : {}) } })
})

const query = computed(() => ({
  page: page.value,
  pageSize: 40,
  ...(debouncedSearch.value ? { q: debouncedSearch.value } : {}),
  ...(kind.value ? { kind: kind.value } : {}),
  ...(state.value ? { state: state.value } : {}),
}))

const { data, pending, refresh, error } = await useFetch('/api/admin/website/documents', { query, immediate: allowed.value, watch: [query] })
const items = computed(() => data.value?.items ?? [])
const filtered = computed(() => Boolean(debouncedSearch.value || kind.value || state.value))

const KIND_LABEL: Record<string, string> = { page: 'Page', global: 'Chrome', panel: 'Panel' }

function fmtDate(iso: string | Date | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}

/* ------------------------------------------------------------ import */
const importing = ref(false)
async function importBaseline() {
  importing.value = true
  try {
    const result = await $fetch<{ created: string[], skipped: string[], invalid: string[] }>('/api/admin/website/import-baseline', { method: 'POST', body: {} })
    toaster.add({
      title: result.created.length ? `${result.created.length} documents imported` : 'Nothing new to import',
      description: result.created.length
        ? 'Each page and piece of chrome now has a document, published as it was. The site is unchanged until you edit and publish.'
        : `${result.skipped.length} documents already existed.`,
      icon: 'lucide:check',
      progress: true,
    })
    await refresh()
  }
  catch (e) {
    toaster.add({ title: 'Import failed', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    importing.value = false
  }
}

/* ------------------------------------------------------------ create */
const showCreate = ref(false)
const createTemplate = ref<TemplateKey>('landing')
const createTitle = ref('')
const createKey = ref('')
const creating = ref(false)
const createOptions = computed(() => creatableTemplates().map(key => ({ key, label: TEMPLATES[key].label, detail: TEMPLATES[key].detail, needsKey: TEMPLATES[key].kind === 'page' })))
const createNeedsKey = computed(() => TEMPLATES[createTemplate.value].kind === 'page')
const keyTouched = ref(false)

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
watch(createTitle, (value) => {
  if (createNeedsKey.value && !keyTouched.value) {
    createKey.value = value ? `/${slugify(value)}` : ''
  }
})

async function create() {
  creating.value = true
  try {
    const doc = await $fetch<{ id: string }>('/api/admin/website/documents', {
      method: 'POST',
      body: { template: createTemplate.value, title: createTitle.value.trim(), ...(createNeedsKey.value ? { key: createKey.value.trim() } : {}) },
    })
    showCreate.value = false
    await navigateTo(`/admin/website/pages/${doc.id}`)
  }
  catch (e) {
    toaster.add({ title: 'Not created', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    creating.value = false
  }
}

/* ------------------------------------------------- console layout --- */

/**
 * Admin console (`Admin Console.dc.html`): the design's state pills with
 * counts, its table, and a Publish history tab. The counts come from the
 * website overview (every document by display state), so they are shown
 * only while no kind filter narrows the list they would not match. The
 * history is the overview's latest `admin.website.*` audit rows; the full
 * trail is the Audit log.
 */
const view = ref<'all' | 'history'>('all')
const { data: overview } = useFetch<any>('/api/admin/website/overview', { server: false, immediate: allowed.value })

const stateFilters = computed(() => {
  const by = overview.value?.documents?.byStatus
  const n = (k: string) => (by && !kind.value ? by[k] ?? 0 : null)
  return [
    { key: '', label: 'All', n: by && !kind.value ? overview.value.documents.total : null },
    { key: 'published', label: 'Published', n: n('published') },
    { key: 'published_changes', label: 'Draft changes', n: n('published_changes') },
    { key: 'in_review', label: 'In review', n: n('in_review') },
    { key: 'scheduled', label: 'Scheduled', n: n('scheduled') },
    { key: 'draft', label: 'Drafts', n: n('draft') },
    { key: 'archived', label: 'Archived', n: n('archived') },
  ]
})

function auditMeta(raw: unknown): Record<string, any> {
  if (typeof raw !== 'string') {
    return (raw as Record<string, any>) ?? {}
  }
  try {
    return JSON.parse(raw)
  }
  catch {
    return {}
  }
}
const history = computed(() => (overview.value?.recent ?? []).map((r: any) => {
  const verb = String(r.action).replace('admin.website.', '').split('.').pop() ?? ''
  const meta = auditMeta(r.metadata)
  const tone = /publish/.test(verb) ? 'success' : /fail/.test(verb) ? 'danger' : /submit|review/.test(verb) ? 'warning' : 'neutral'
  return {
    id: r.id,
    createdAt: r.createdAt,
    actorEmail: r.actorEmail,
    label: verb ? verb.charAt(0).toUpperCase() + verb.slice(1).replaceAll('-', ' ') : 'Changed',
    tone,
    title: meta.title ?? meta.key ?? meta.from ?? r.action.replace('admin.website.', ''),
  }
}))

const PILL = 'apex-ring inline-flex h-8 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-full border px-[13px] text-[13px]'
const TAB_CLS = 'apex-ring -mb-px inline-flex h-10 shrink-0 cursor-pointer items-center border-b-2 text-sm'
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="Website" accent="pages" subtitle="Every page on apexdigi.co.uk, the site chrome and the panel’s customer-facing text. Service pages take their prices from Services & pricing.">
      <AdminButton v-if="allowed && can('website.edit')" variant="primary" @click="showCreate = true">
        <Icon name="lucide:plus" class="size-[15px]" />New page
      </AdminButton>
    </AdminPageHeader>

    <div class="border-line-subtle flex gap-6 overflow-x-auto border-b" role="tablist" aria-label="Pages sections">
      <button
        v-for="[k, l] in ([['all', 'All pages'], ['history', 'Publish history']] as const)" :key="k"
        type="button" role="tab" :aria-selected="view === k"
        :class="[TAB_CLS, view === k ? 'border-accent text-fg-heading font-semibold' : 'text-fg-muted border-transparent font-medium']"
        @click="view = k"
      >
        {{ l }}
      </button>
    </div>

    <AdminWebsiteLoadError v-if="error" :error="error" title="Could not load the pages" @retry="refresh()" />

    <!-- ================================================= Publish history -->
    <AdminCard v-else-if="view === 'history'" role="tabpanel">
      <p class="text-fg-muted px-[22px] py-3.5 text-[13px]">
        The latest saves, submissions and publishes across the website. Every published version can be restored from the editor’s Revisions tab; the full trail is in the Audit log.
      </p>
      <ul v-if="history.length">
        <li v-for="h in history" :key="h.id" class="border-line-soft grid grid-cols-1 items-start gap-x-3.5 gap-y-1 border-t px-[18px] py-3 sm:px-[22px] lg:grid-cols-[150px_180px_minmax(0,1fr)_220px]">
          <span class="text-fg-muted text-[12.5px] tabular-nums"><ClientOnly>{{ ukDateTime(h.createdAt) }}</ClientOnly></span>
          <AdminStatusChip :tone="h.tone" :label="h.label" />
          <span class="text-fg-heading min-w-0 truncate text-sm">{{ h.title }}</span>
          <span class="text-fg-body truncate text-[13px]">{{ h.actorEmail }}</span>
        </li>
      </ul>
      <p v-else class="border-line-soft text-fg-body border-t px-[22px] py-6 text-sm">
        Nothing has been changed from the console yet.
      </p>
    </AdminCard>

    <!-- ===================================================== All pages -->
    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex flex-wrap gap-2" role="group" aria-label="Filter by state">
          <button
            v-for="f in stateFilters" :key="f.key || 'all'" type="button" :aria-pressed="state === f.key"
            :class="[PILL, state === f.key ? 'bg-accent border-transparent font-semibold text-white' : 'border-line-subtle text-fg-heading hover:bg-hover font-medium']"
            @click="state = f.key"
          >
            {{ f.label }} <span v-if="f.n !== null" class="tabular-nums opacity-70">{{ f.n }}</span>
          </button>
        </div>
        <span class="hidden flex-1 xl:block" />
        <div class="flex w-full flex-wrap gap-2 xl:w-auto">
          <label class="sr-only" for="pages-search">Search pages</label>
          <input id="pages-search" v-model="search" type="search" placeholder="Search by title or address" :class="ADMIN_INPUT" class="h-9! min-w-0 flex-1 xl:w-[240px]! xl:flex-none">
          <div class="w-full sm:w-[180px]">
            <BaseSelect v-model="kind" rounded="lg" size="sm" aria-label="Filter by kind" placeholder="All kinds">
              <BaseSelectItem value="page">
                Pages
              </BaseSelectItem>
              <BaseSelectItem value="global">
                Chrome
              </BaseSelectItem>
              <BaseSelectItem value="panel">
                Panel documents
              </BaseSelectItem>
            </BaseSelect>
          </div>
          <button v-if="filtered" type="button" class="apex-ring text-accent-ink rounded text-[13px] font-semibold" @click="search = ''; kind = ''; state = ''">
            Clear filters
          </button>
        </div>
      </div>

      <AdminCard v-if="!pending && !items.length && !filtered" padded>
        <AdminEmptyState
          icon="lucide:file-text"
          title="Nothing is managed yet"
          subtitle="The site renders from its code until its pages are imported. Importing creates one document per page and per piece of chrome, published exactly as the site shows them today."
        >
          <AdminButton v-if="can('website.settings')" variant="primary" :disabled="importing" @click="importBaseline">
            Import current site content
          </AdminButton>
          <p v-else class="text-fg-muted text-[12.5px]">
            An Owner or Admin runs the import.
          </p>
        </AdminEmptyState>
      </AdminCard>

      <AdminEmptyState v-else-if="!pending && !items.length" icon="lucide:search-x" title="No documents match" subtitle="Try another word, or clear the filters." />

      <section v-else class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
        <div class="hidden grid-cols-[minmax(0,1fr)_140px_170px_130px_130px_70px] gap-3.5 px-[22px] py-3.5 xl:grid" :class="ADMIN_TH">
          <span>Title</span><span>Type</span><span>Status</span><span>Last edited</span><span>Published</span><span />
        </div>
        <div v-if="pending" aria-hidden="true">
          <div v-for="i in 6" :key="i" class="border-line-soft h-[58px] animate-pulse border-t" />
        </div>
        <ul v-else>
          <li v-for="doc in items" :key="doc.id">
            <NuxtLink
              :to="`/admin/website/pages/${doc.id}`"
              class="apex-ring border-line-soft hover:bg-raised grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 border-t px-[18px] py-3 sm:px-[22px] xl:grid-cols-[minmax(0,1fr)_140px_170px_130px_130px_70px]"
            >
              <span class="min-w-0">
                <span class="text-fg-heading block truncate text-sm font-semibold">{{ doc.title }}</span>
                <span class="text-fg-muted mt-0.5 block truncate font-mono text-xs">{{ doc.kind === 'page' ? doc.key : doc.templateLabel }}</span>
              </span>
              <span class="text-fg-body hidden truncate text-[13px] xl:block">{{ doc.templateLabel }}</span>
              <AdminWebsiteStatusChip :state="doc.state as DisplayStatus" :error="doc.lastPublishError" class="justify-self-end xl:justify-self-start" />
              <span class="text-fg-muted hidden text-[12.5px] tabular-nums xl:block"><ClientOnly>{{ fmtDate(doc.draftUpdatedAt) }}</ClientOnly></span>
              <span class="text-fg-muted hidden text-[12.5px] tabular-nums xl:block"><ClientOnly>{{ fmtDate(doc.publishedAt) }}</ClientOnly></span>
              <span class="text-accent-ink hidden text-end text-[13px] font-semibold xl:block">{{ can('website.edit') ? 'Edit' : 'View' }} →</span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <AdminPager
        v-if="data && data.pageCount > 1" :page="data.page" :page-count="data.pageCount" :total="data.total" noun="documents"
        @update:page="page = $event"
      />
    </template>

    <AdminDialog v-model:open="showCreate" title="New page" description="It starts as a draft; nothing shows on the site until it is published.">
      <form id="create-doc" class="flex flex-col gap-4 pb-1" @submit.prevent="create">
        <div role="radiogroup" aria-label="Template" class="flex flex-col gap-2">
          <label
            v-for="option in createOptions"
            :key="option.key"
            class="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3"
            :class="createTemplate === option.key ? 'border-accent bg-accent-tint' : 'border-line-subtle hover:bg-raised'"
          >
            <input v-model="createTemplate" type="radio" name="template" :value="option.key" class="accent-[#7D53F2] mt-1">
            <span>
              <span class="text-fg-heading block text-sm font-semibold">{{ option.label }}</span>
              <span class="text-fg-muted block text-xs">{{ option.detail }}</span>
            </span>
          </label>
        </div>
        <div>
          <label for="create-name" :class="ADMIN_LABEL">Name</label>
          <input id="create-name" v-model="createTitle" required maxlength="120" :class="ADMIN_INPUT">
        </div>
        <div v-if="createNeedsKey">
          <label for="create-key" :class="ADMIN_LABEL">Address</label>
          <input id="create-key" v-model="createKey" required placeholder="/offers/spring" :class="ADMIN_INPUT" class="font-mono" @input="keyTouched = true">
          <span :class="ADMIN_HINT">A path on the site. Addresses the site already renders from code cannot be taken.</span>
        </div>
      </form>
      <template #actions>
        <AdminButton @click="showCreate = false">
          Cancel
        </AdminButton>
        <AdminButton type="submit" form="create-doc" variant="primary" :disabled="creating || !createTitle.trim() || (createNeedsKey && !createKey.trim())">
          Create draft
        </AdminButton>
      </template>
    </AdminDialog>
  </AdminPage>
</template>
