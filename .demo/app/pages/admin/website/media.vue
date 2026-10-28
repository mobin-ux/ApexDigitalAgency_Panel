<script setup lang="ts">
/**
 * Website — media library (ADR-021 §4). Images and PDFs the public pages
 * use: a grid with search and a type filter, upload (up to ten files,
 * 10 MB each, checked by their bytes), and a detail panel for the alt text,
 * a caption, where the file is used, Replace (same id, new version, so
 * every page keeps pointing at it) and Delete, which is refused while any
 * document still uses the file and says which.
 *
 * `website.view` may look; `website.media` may change.
 */
definePageMeta({
  title: 'Website media',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()
const { can } = useStaffAccess()
const allowed = computed(() => can('website.view'))
const canEdit = computed(() => can('website.media'))

const search = ref('')
const debouncedSearch = ref('')
const kind = ref<string>('')
const page = ref(1)
watchDebounced(search, (v) => {
  debouncedSearch.value = v.trim()
  page.value = 1
}, { debounce: 300 })
watch(kind, () => {
  page.value = 1
})
const query = computed(() => ({ page: page.value, pageSize: 48, ...(debouncedSearch.value ? { q: debouncedSearch.value } : {}), ...(kind.value ? { kind: kind.value } : {}) }))
const { data, pending, refresh } = await useFetch('/api/admin/website/media', { query, immediate: allowed.value, watch: [query] })
const items = computed(() => data.value?.items ?? [])

/* ------------------------------------------------------------ upload */
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const uploading = ref(false)
async function upload(files: FileList | null) {
  if (!files?.length) {
    return
  }
  const form = new FormData()
  for (const file of Array.from(files).slice(0, 10)) {
    form.append('files', file)
  }
  uploading.value = true
  try {
    const result = await $fetch<{ files: any[] }>('/api/admin/website/media', { method: 'POST', body: form })
    toaster.add({ title: `${result.files.length} file${result.files.length === 1 ? '' : 's'} uploaded`, description: 'Add alt text before using an image on a page.', icon: 'lucide:check', progress: true })
    await refresh()
    if (result.files.length === 1) {
      await open(result.files[0].id)
    }
  }
  catch (e) {
    toaster.add({ title: 'Not uploaded', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    uploading.value = false
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

/* ------------------------------------------------------------ detail */
const selected = ref<any | null>(null)
const alt = ref('')
const caption = ref('')
const saving = ref(false)
const replacing = ref(false)
const confirmingDelete = ref(false)
const replaceInput = useTemplateRef<HTMLInputElement>('replaceInput')

async function open(id: string) {
  try {
    selected.value = await $fetch<any>(`/api/admin/website/media/${id}`)
    alt.value = selected.value.alt ?? ''
    caption.value = selected.value.caption ?? ''
    confirmingDelete.value = false
  }
  catch (e) {
    toaster.add({ title: 'Could not open', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
}
const detailDirty = computed(() => selected.value && (alt.value !== (selected.value.alt ?? '') || caption.value !== (selected.value.caption ?? '')))

async function saveDetail() {
  if (!selected.value) {
    return
  }
  saving.value = true
  try {
    const row = await $fetch<any>(`/api/admin/website/media/${selected.value.id}`, { method: 'PATCH', body: { alt: alt.value, caption: caption.value || null } })
    selected.value = { ...selected.value, ...row }
    toaster.add({ title: 'Saved', icon: 'lucide:check', progress: true })
    await refresh()
  }
  catch (e) {
    toaster.add({ title: 'Not saved', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    saving.value = false
  }
}

async function replaceFile(files: FileList | null) {
  if (!files?.[0] || !selected.value) {
    return
  }
  const form = new FormData()
  form.append('file', files[0])
  replacing.value = true
  try {
    const row = await $fetch<any>(`/api/admin/website/media/${selected.value.id}/replace`, { method: 'POST', body: form })
    selected.value = { ...selected.value, ...row }
    toaster.add({ title: 'File replaced', description: `Now version ${row.version}; every page using it shows the new file.`, icon: 'lucide:check', progress: true })
    await refresh()
  }
  catch (e) {
    toaster.add({ title: 'Not replaced', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    replacing.value = false
    if (replaceInput.value) {
      replaceInput.value.value = ''
    }
  }
}

async function remove() {
  if (!selected.value) {
    return
  }
  try {
    await $fetch(`/api/admin/website/media/${selected.value.id}`, { method: 'DELETE' })
    toaster.add({ title: 'File deleted', icon: 'lucide:check', progress: true })
    selected.value = null
    await refresh()
  }
  catch (e: any) {
    const usage = e?.data?.data?.usage as { title: string }[] | undefined
    toaster.add({ title: 'Still in use', description: usage?.length ? `Used by ${usage.map(u => u.title).join(', ')}. Remove it from those pages first.` : errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    confirmingDelete.value = false
  }
}

function fmtBytes(n: number) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`
}
function fmtDate(iso: string | Date | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}

const CARD = 'border-muted-200 bg-white dark:border-muted-800 dark:bg-muted-900 rounded-2xl border'
const INPUT = 'focus:border-primary-400 w-full rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-2.5 text-sm text-muted-900 outline-none placeholder:text-muted-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500'
const LABEL = 'text-muted-900 mb-1.5 block text-[13.5px] font-semibold dark:text-white'
</script>

<template>
  <div class="mx-auto flex max-w-[1180px] flex-col gap-8 pb-10">
    <AdminPageHeader
      title="Media"
      subtitle="Images and PDFs the public pages use. Each file is checked by its contents, sized from its header and served with a year's cache."
    >
      <template v-if="allowed && canEdit">
        <input ref="fileInput" type="file" class="sr-only" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" multiple @change="upload(($event.target as HTMLInputElement).files)">
        <BaseButton variant="primary" rounded="full" :loading="uploading" :disabled="uploading" @click="fileInput?.click()">
          <Icon name="lucide:upload" class="size-4" />
          Upload
        </BaseButton>
      </template>
    </AdminPageHeader>

    <AdminAccessWall
      v-if="!allowed"
      permission="website.view"
      title="Website content is not part of your role"
      body="The media library holds the files the public pages use."
    />

    <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label class="sr-only" for="media-search">Search media</label>
          <input id="media-search" v-model="search" type="search" placeholder="Search by file name or alt text" :class="INPUT" class="sm:max-w-xs">
          <BaseSelect v-model="kind" rounded="lg" aria-label="Filter by type" placeholder="All types">
            <BaseSelectItem value="image">
              Images
            </BaseSelectItem>
            <BaseSelectItem value="pdf">
              PDFs
            </BaseSelectItem>
          </BaseSelect>
          <span v-if="data" class="text-muted-500 text-[12.5px]">{{ data.total }} file{{ data.total === 1 ? '' : 's' }}</span>
        </div>

        <AdminEmptyState v-if="!pending && !items.length" icon="lucide:image" title="No files yet" :subtitle="canEdit ? 'Upload JPEG, PNG, GIF, WebP or PDF files up to 10 MB each.' : 'Nothing has been uploaded yet.'" />

        <ul v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" role="list">
          <li v-for="m in items" :key="m.id">
            <button
              type="button"
              class="apex-focus group flex w-full flex-col overflow-hidden rounded-xl border text-start transition"
              :class="selected?.id === m.id ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-muted-200 hover:border-primary-400 dark:border-white/10'"
              :aria-pressed="selected?.id === m.id"
              @click="open(m.id)"
            >
              <span class="bg-muted-100 flex aspect-[4/3] items-center justify-center overflow-hidden dark:bg-white/5">
                <img v-if="m.mime.startsWith('image/')" :src="m.src" :alt="m.alt" :width="m.width ?? undefined" :height="m.height ?? undefined" loading="lazy" class="size-full object-cover">
                <Icon v-else name="lucide:file-text" class="text-muted-400 size-8" />
              </span>
              <span class="flex flex-col gap-0.5 px-3 py-2">
                <span class="text-muted-900 truncate text-[12.5px] font-semibold dark:text-white">{{ m.filename }}</span>
                <span class="text-muted-500 text-[11px]">{{ fmtBytes(m.bytes) }}<template v-if="m.width"> · {{ m.width }}×{{ m.height }}</template> · {{ m.uses ? `${m.uses} use${m.uses === 1 ? '' : 's'}` : 'unused' }}</span>
                <span v-if="m.mime.startsWith('image/') && !m.alt" class="text-[11px] font-semibold text-[#F2C14E]">No alt text</span>
              </span>
            </button>
          </li>
        </ul>

        <AdminPager v-if="data && data.pageCount > 1" :page="data.page" :page-count="data.pageCount" :total="data.total" noun="files" @update:page="page = $event" />
      </div>

      <aside :class="CARD" class="h-fit p-5 lg:sticky lg:top-24">
        <p v-if="!selected" class="text-muted-500 text-sm">
          Choose a file to see where it is used and edit its alt text.
        </p>
        <template v-else>
          <div class="bg-muted-100 mb-4 flex max-h-56 items-center justify-center overflow-hidden rounded-xl dark:bg-white/5">
            <img v-if="selected.mime.startsWith('image/')" :src="selected.src" :alt="selected.alt" class="max-h-56 w-auto max-w-full">
            <Icon v-else name="lucide:file-text" class="text-muted-400 my-10 size-10" />
          </div>
          <p class="text-muted-900 break-all text-sm font-semibold dark:text-white">
            {{ selected.filename }}
          </p>
          <p class="text-muted-500 mt-1 text-xs">
            {{ selected.mime }} · {{ fmtBytes(selected.bytes) }}<template v-if="selected.width">
              · {{ selected.width }}×{{ selected.height }}
            </template> · v{{ selected.version }} · {{ fmtDate(selected.createdAt) }}
          </p>
          <div class="mt-4 flex flex-col gap-3">
            <div>
              <label for="media-alt" :class="LABEL">Alt text</label>
              <input id="media-alt" v-model="alt" maxlength="300" :disabled="!canEdit" placeholder="What the picture shows, for people who cannot see it" :class="INPUT">
            </div>
            <div>
              <label for="media-caption" :class="LABEL">Caption <span class="text-muted-500 font-normal">optional</span></label>
              <input id="media-caption" v-model="caption" maxlength="300" :disabled="!canEdit" :class="INPUT">
            </div>
            <BaseButton v-if="canEdit" size="sm" rounded="lg" variant="primary" :loading="saving" :disabled="saving || !detailDirty" @click="saveDetail">
              Save details
            </BaseButton>
          </div>
          <div class="mt-5 border-t border-muted-200 pt-4 dark:border-white/10">
            <p class="text-muted-500 text-[11px] font-extrabold uppercase tracking-[0.06em]">
              Used by
            </p>
            <p v-if="!selected.usage?.length" class="text-muted-500 mt-2 text-[12.5px]">
              No document uses this file.
            </p>
            <ul v-else class="mt-2 flex flex-col gap-1.5">
              <li v-for="u in selected.usage" :key="u.id" class="text-[12.5px]">
                <NuxtLink :to="`/admin/website/pages/${u.id}`" class="apex-focus text-primary-500 dark:text-primary-400 rounded font-semibold hover:underline">
                  {{ u.title }}
                </NuxtLink>
                <span class="text-muted-500"> · {{ u.slots.join(', ') }}</span>
              </li>
            </ul>
          </div>
          <div v-if="canEdit" class="mt-5 flex flex-wrap gap-2 border-t border-muted-200 pt-4 dark:border-white/10">
            <input ref="replaceInput" type="file" class="sr-only" :accept="selected.mime === 'application/pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/gif,image/webp'" @change="replaceFile(($event.target as HTMLInputElement).files)">
            <BaseButton size="sm" rounded="lg" variant="muted" :loading="replacing" :disabled="replacing" @click="replaceInput?.click()">
              Replace file
            </BaseButton>
            <BaseButton v-if="!confirmingDelete" size="sm" rounded="lg" variant="muted" class="text-[#EC6453]!" :disabled="Boolean(selected.usage?.length)" :title="selected.usage?.length ? 'Remove it from the pages that use it first' : undefined" @click="confirmingDelete = true">
              Delete
            </BaseButton>
            <template v-else>
              <BaseButton size="sm" rounded="lg" variant="primary" class="bg-[#EC6453]! border-[#EC6453]!" @click="remove">
                Confirm delete
              </BaseButton>
              <BaseButton size="sm" rounded="lg" variant="muted" @click="confirmingDelete = false">
                Keep
              </BaseButton>
            </template>
            <p v-if="selected.usage?.length" class="text-muted-500 w-full text-[12px]">
              A file in use cannot be deleted; replace it instead.
            </p>
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>
