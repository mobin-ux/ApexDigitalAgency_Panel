<script setup lang="ts">
import type { DisplayStatus, TemplateKey } from '~~/shared/cms'
import { creatableTemplates, DISPLAY_STATUS_LABEL, DISPLAY_STATUSES, TEMPLATES } from '~~/shared/cms'

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
  title: 'Website pages',
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

const CARD = 'border-muted-200 bg-white dark:border-muted-800 dark:bg-muted-900 rounded-2xl border'
const TEXT_INPUT = 'focus:border-primary-400 w-full rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-2.5 text-sm text-muted-900 outline-none placeholder:text-muted-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500'
</script>

<template>
  <div class="mx-auto flex max-w-[1180px] flex-col gap-8 pb-10">
    <AdminPageHeader
      title="Pages"
      subtitle="Every managed document: the public pages, the site chrome and the panel's customer-facing text."
    >
      <template v-if="allowed && can('website.edit')">
        <BaseButton variant="primary" rounded="full" @click="showCreate = true">
          <Icon name="lucide:plus" class="size-4" />
          New page
        </BaseButton>
      </template>
    </AdminPageHeader>

    <AdminAccessWall
      v-if="!allowed"
      permission="website.view"
      title="Website content is not part of your role"
      body="The pages list shows every document the website is built from."
    />

    <AdminWebsiteLoadError v-else-if="error" :error="error" title="Could not load the pages" @retry="refresh()" />

    <template v-else>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label class="sr-only" for="pages-search">Search pages</label>
        <input id="pages-search" v-model="search" type="search" placeholder="Search by title or address" :class="TEXT_INPUT" class="sm:max-w-xs">
        <BaseSelect v-model="kind" rounded="lg" aria-label="Filter by kind" placeholder="All kinds">
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
        <BaseSelect v-model="state" rounded="lg" aria-label="Filter by state" placeholder="Any state">
          <BaseSelectItem v-for="s in DISPLAY_STATUSES" :key="s" :value="s">
            {{ DISPLAY_STATUS_LABEL[s] }}
          </BaseSelectItem>
        </BaseSelect>
        <button
          v-if="filtered"
          type="button"
          class="apex-focus text-primary-500 dark:text-primary-400 rounded text-[12.5px] font-semibold hover:underline"
          @click="search = ''; kind = ''; state = ''"
        >
          Clear filters
        </button>
      </div>

      <div v-if="!pending && !items.length && !filtered" :class="CARD" class="flex flex-col items-start gap-4 p-6">
        <AdminEmptyState
          icon="lucide:file-text"
          title="Nothing is managed yet"
          subtitle="The site renders from its code until its pages are imported. Importing creates one document per page and per piece of chrome, published exactly as the site shows them today."
        />
        <BaseButton v-if="can('website.settings')" variant="primary" rounded="lg" :loading="importing" :disabled="importing" @click="importBaseline">
          Import current site content
        </BaseButton>
        <p v-else class="text-muted-500 text-[12.5px]">
          An Owner or Admin runs the import.
        </p>
      </div>

      <AdminEmptyState
        v-else-if="!pending && !items.length"
        icon="lucide:search-x"
        title="No documents match"
        subtitle="Try another word, or clear the filters."
      />

      <div v-else :class="CARD" class="overflow-x-auto">
        <table class="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr class="border-muted-200 bg-muted-50 border-b text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-500 dark:border-white/10 dark:bg-white/[0.02]">
              <th scope="col" class="px-[18px] py-3 text-start">
                Document
              </th>
              <th scope="col" class="px-3 py-3 text-start">
                Kind
              </th>
              <th scope="col" class="px-3 py-3 text-start">
                State
              </th>
              <th scope="col" class="px-3 py-3 text-start">
                Last edited
              </th>
              <th scope="col" class="px-[18px] py-3 text-end">
                Published
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="doc in items" :key="doc.id" class="border-muted-200 border-b last:border-b-0 hover:bg-muted-50 dark:border-white/5 dark:hover:bg-white/[0.03]">
              <td class="px-[18px] py-3.5">
                <NuxtLink :to="`/admin/website/pages/${doc.id}`" class="apex-focus block rounded">
                  <span class="text-muted-900 block font-semibold dark:text-white">{{ doc.title }}</span>
                  <span class="text-muted-500 mt-0.5 block font-mono text-xs">{{ doc.kind === 'page' ? doc.key : doc.templateLabel }}</span>
                </NuxtLink>
              </td>
              <td class="text-muted-500 px-3 py-3.5">
                {{ KIND_LABEL[doc.kind] ?? doc.kind }}
              </td>
              <td class="px-3 py-3.5">
                <AdminWebsiteStatusChip :state="doc.state as DisplayStatus" :error="doc.lastPublishError" />
              </td>
              <td class="text-muted-500 px-3 py-3.5 tabular-nums">
                {{ fmtDate(doc.draftUpdatedAt) }}
              </td>
              <td class="text-muted-500 px-[18px] py-3.5 text-end tabular-nums">
                {{ fmtDate(doc.publishedAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AdminPager
        v-if="data && data.pageCount > 1" :page="data.page" :page-count="data.pageCount" :total="data.total" noun="documents"
        @update:page="page = $event"
      />
    </template>

    <!-- ========== NEW PAGE ========== -->
    <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showCreate = false" />
      <form class="apex-pop relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[520px] flex-col gap-5 overflow-y-auto rounded-2xl border border-muted-200 bg-white p-6 shadow-[0_30px_60px_rgba(0,0,0,.5)] dark:border-white/10 dark:bg-muted-800" @submit.prevent="create">
        <div>
          <h2 id="create-title" class="font-heading text-muted-900 text-[18px] font-extrabold tracking-[-0.01em] dark:text-white">
            New document
          </h2>
          <p class="text-muted-500 mt-1.5 text-[12.5px]">
            It starts as a draft; nothing shows on the site until it is published.
          </p>
        </div>
        <div role="group" aria-label="Template" class="flex flex-col gap-2">
          <label
            v-for="option in createOptions"
            :key="option.key"
            class="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition"
            :class="createTemplate === option.key ? 'border-primary-500 bg-primary-500/8' : 'border-muted-200 hover:bg-muted-50 dark:border-white/10 dark:hover:bg-white/5'"
          >
            <input v-model="createTemplate" type="radio" name="template" :value="option.key" class="mt-1">
            <span>
              <span class="text-muted-900 block text-sm font-semibold dark:text-white">{{ option.label }}</span>
              <span class="text-muted-500 block text-xs">{{ option.detail }}</span>
            </span>
          </label>
        </div>
        <div>
          <label for="create-name" class="text-muted-900 mb-1.5 block text-[13.5px] font-semibold dark:text-white">Name</label>
          <input id="create-name" v-model="createTitle" required maxlength="120" :class="TEXT_INPUT">
        </div>
        <div v-if="createNeedsKey">
          <label for="create-key" class="text-muted-900 mb-1.5 block text-[13.5px] font-semibold dark:text-white">Address</label>
          <input id="create-key" v-model="createKey" required placeholder="/offers/spring" :class="TEXT_INPUT" class="font-mono" @input="keyTouched = true">
          <p class="text-muted-500 mt-1.5 text-xs">
            A path on the site. Addresses the site already renders from code cannot be taken.
          </p>
        </div>
        <div class="flex justify-end gap-2">
          <BaseButton type="button" variant="muted" rounded="lg" @click="showCreate = false">
            Cancel
          </BaseButton>
          <BaseButton type="submit" variant="primary" rounded="lg" :loading="creating" :disabled="creating || !createTitle.trim() || (createNeedsKey && !createKey.trim())">
            Create draft
          </BaseButton>
        </div>
      </form>
    </div>
  </div>
</template>
