<script setup lang="ts">
import { ADMIN_HINT, ADMIN_TEXTAREA } from '~/utils/adminUi'

/**
 * Website › Media library (`Admin Console.dc.html` `v_40media`, ADR-026):
 * the images and PDFs pages use, with the design's filters, a tile per
 * file and a detail panel for the one selected. Alt text is what screen
 * readers say wherever the image appears, so a missing one is flagged on
 * the tile. A file a page uses cannot be deleted; the panel says where.
 */
definePageMeta({
  title: 'Media library',
  layout: 'admin',
  middleware: 'admin',
})

interface MediaItem {
  id: string
  name: string
  mime: string
  kind: 'image' | 'document'
  bytes: number
  width: number | null
  height: number | null
  alt: string
  src: string
  stored: boolean
  link: string | null
  uploadedAt: string
  uploadedBy: string
  used: { id: string, title: string, path: string, template: string }[]
}
type Filter = 'all' | 'image' | 'document' | 'noalt' | 'unused'

const toaster = useNuiToasts()
const { ask } = useAdminConfirm()
const { can } = useStaffAccess()
const canMedia = computed(() => can('website.media'))

// A page of files at a time, with Show more below the grid: the screen used
// to ask for the first 100 and had no way to reach the 101st (AUD-13).
const PAGE_SIZE = 60
const filter = ref<Filter>('all')
const page = ref(1)
const { data, error, refresh } = await useFetch<{ items: MediaItem[], counts: Record<Filter, number>, total: number, page: number }>('/api/admin/website/media', {
  query: computed(() => ({ filter: filter.value, pageSize: PAGE_SIZE, page: page.value })),
  key: 'website-media',
})
watch(filter, () => {
  page.value = 1
})
const loaded = ref<MediaItem[]>([])
watch(data, (d) => {
  if (!d) {
    return
  }
  const seen = new Set(d.page === 1 ? [] : loaded.value.map(m => m.id))
  loaded.value = d.page === 1 ? d.items : [...loaded.value, ...d.items.filter(m => !seen.has(m.id))]
}, { immediate: true })
const more = computed(() => (data.value?.total ?? 0) - loaded.value.length)
/** After an upload, a delete or an edit: the list from the top again. */
async function reload() {
  if (page.value === 1) {
    await refresh()
  }
  else {
    page.value = 1
  }
}
const FILTERS: { key: Filter, label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'image', label: 'Images' },
  { key: 'document', label: 'Documents' },
  { key: 'noalt', label: 'Missing alt text' },
  { key: 'unused', label: 'Unused' },
]

const selId = ref<string | null>(null)
const sel = computed(() => loaded.value.find(m => m.id === selId.value) ?? loaded.value[0] ?? null)
const alt = ref('')
watch(sel, m => (alt.value = m?.alt ?? ''), { immediate: true })
const altDirty = computed(() => Boolean(sel.value) && alt.value.trim() !== sel.value!.alt)

function ext(name: string) {
  return (name.split('.').pop() ?? '').toUpperCase()
}
function size(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
function meta(m: MediaItem) {
  return [m.width && m.height ? `${m.width} × ${m.height}` : null, size(m.bytes)].filter(Boolean).join(' · ')
}

const busy = ref(false)
const picker = ref<HTMLInputElement | null>(null)
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (!files.length) {
    return
  }
  const body = new FormData()
  for (const file of files) {
    body.append('files', file)
  }
  busy.value = true
  try {
    const result = await $fetch<{ files: { id: string, name: string }[] }>('/api/admin/website/media', { method: 'POST', body })
    filter.value = 'all'
    await reload()
    selId.value = result.files[0]?.id ?? null
    toaster.add({ title: result.files.length === 1 ? 'Uploaded' : `${result.files.length} files uploaded`, description: 'Add alt text before using an image on a page.', icon: 'lucide:check', progress: true })
  }
  catch (err) {
    toaster.add({ title: 'Not uploaded', description: errorMessage(err), icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    busy.value = false
  }
}

async function saveAlt() {
  if (!sel.value || !altDirty.value) {
    return
  }
  busy.value = true
  try {
    await $fetch(`/api/admin/website/media/${sel.value.id}`, { method: 'PATCH', body: { alt: alt.value.trim() } })
    await reload()
    toaster.add({ title: 'Alt text saved', description: 'Pages using this image read it out from now on.', icon: 'lucide:check', progress: true })
  }
  catch (err) {
    toaster.add({ title: 'Not saved', description: errorMessage(err), icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    busy.value = false
  }
}

async function copyLink() {
  if (!sel.value?.link) {
    return
  }
  try {
    await navigator.clipboard.writeText(sel.value.link)
    toaster.add({ title: 'Link copied', description: sel.value.link, icon: 'lucide:check', progress: true })
  }
  catch {
    toaster.add({ title: 'Could not copy', description: sel.value.link, icon: 'lucide:info', progress: true })
  }
}

async function remove() {
  const m = sel.value
  if (!m || m.used.length) {
    return
  }
  const go = await ask({ title: `Delete ${m.name}?`, body: 'It is not used on any page. The file is removed from the library and its link stops working.', confirmLabel: 'Delete file', danger: true })
  if (go === null) {
    return
  }
  busy.value = true
  try {
    await $fetch(`/api/admin/website/media/${m.id}`, { method: 'DELETE' })
    selId.value = null
    await reload()
    toaster.add({ title: 'File deleted', description: m.name, icon: 'lucide:check', progress: true })
  }
  catch (err) {
    toaster.add({ title: 'Not deleted', description: errorMessage(err), icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    busy.value = false
  }
}

const PILL = 'apex-ring inline-flex h-8 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-full border px-[13px] text-[13px]'
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="Media" accent="library" subtitle="Images and files used on apexdigi.co.uk. Every image on a page needs alt text.">
      <template v-if="canMedia">
        <input ref="picker" type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" class="sr-only" tabindex="-1" aria-hidden="true" @change="upload">
        <AdminButton variant="primary" :disabled="busy" @click="picker?.click()">
          <Icon name="lucide:upload" class="size-[15px]" /> Upload
        </AdminButton>
      </template>
    </AdminPageHeader>

    <div class="flex flex-wrap gap-2" role="group" aria-label="Filter files">
      <button
        v-for="f in FILTERS" :key="f.key" type="button" :aria-pressed="filter === f.key"
        :class="[PILL, filter === f.key ? 'bg-accent border-transparent font-semibold text-white' : 'border-line-subtle text-fg-heading hover:bg-hover font-medium']"
        @click="filter = f.key"
      >
        {{ f.label }} <span class="tabular-nums opacity-70">{{ data?.counts?.[f.key] ?? 0 }}</span>
      </button>
    </div>

    <AdminLoadError v-if="error" :error="error" title="Could not load the media library" @retry="refresh" />
    <AdminEmptyState
      v-else-if="data && data.counts.all === 0"
      icon="solar:gallery-linear"
      title="The library is empty"
      subtitle="Upload JPEG, PNG, GIF or WebP images and PDFs, up to 10 MB each. They can then be used in image sections."
    >
      <AdminButton v-if="canMedia" variant="primary" :disabled="busy" @click="picker?.click()">
        Upload
      </AdminButton>
    </AdminEmptyState>
    <div v-else class="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <p v-if="data && !loaded.length" class="text-fg-muted text-[13.5px]">
        Nothing matches this filter.
      </p>
      <div v-else class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-3.5 md:grid-cols-3 2xl:grid-cols-4">
          <button
            v-for="m in loaded" :key="m.id" type="button" :aria-pressed="sel?.id === m.id"
            class="apex-ring bg-card flex flex-col overflow-hidden rounded-[14px] text-start"
            :class="sel?.id === m.id ? 'border-accent border-2' : 'border-line-subtle border'"
            @click="selId = m.id"
          >
            <span class="bg-raised border-line-subtle relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b">
              <span v-if="!m.stored" class="text-st-danger-fg px-2 text-center text-xs font-semibold">File missing</span>
              <img v-else-if="m.kind === 'image'" :src="m.src" alt="" loading="lazy" class="size-full object-cover">
              <span v-else class="bg-card text-fg-muted rounded-md px-2 py-1 text-xs font-bold tracking-[0.06em]">{{ ext(m.name) }}</span>
              <AdminStatusChip v-if="m.kind === 'image' && !m.alt" tone="warning" label="No alt text" class="absolute end-2 top-2" />
            </span>
            <span class="flex flex-col gap-0.5 px-3 py-2.5">
              <span class="text-fg-heading truncate text-[13px] font-semibold">{{ m.name }}</span>
              <span class="text-fg-muted text-xs tabular-nums">{{ meta(m) }}</span>
            </span>
          </button>
        </div>
        <div v-if="more > 0" class="flex flex-wrap items-center gap-3">
          <AdminButton variant="light" @click="page++">
            Show {{ Math.min(more, PAGE_SIZE) }} more
          </AdminButton>
          <span class="text-fg-muted text-[13px] tabular-nums">Showing {{ loaded.length }} of {{ data?.total }}</span>
        </div>
      </div>

      <section v-if="sel" class="bg-card border-line-subtle flex flex-col gap-4 rounded-2xl border p-5 xl:sticky xl:top-[88px]" aria-label="Selected file">
        <div class="bg-raised border-line-subtle flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border">
          <span v-if="!sel.stored" class="text-st-danger-fg px-4 text-center text-[13px] font-semibold">The file is missing from storage. Upload it again and delete this entry.</span>
          <img v-else-if="sel.kind === 'image'" :src="sel.src" :alt="sel.alt" class="size-full object-contain">
          <span v-else class="text-fg-muted text-base font-bold tracking-[0.06em]">{{ ext(sel.name) }}</span>
        </div>
        <div class="text-fg-heading break-all text-[15px] font-semibold">
          {{ sel.name }}
        </div>
        <dl class="grid grid-cols-[86px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
          <dt class="text-fg-muted">
            Size
          </dt><dd class="text-fg-heading tabular-nums">
            {{ meta(sel) }}
          </dd>
          <dt class="text-fg-muted">
            Uploaded
          </dt><dd class="text-fg-heading">
            {{ ukDateTime(sel.uploadedAt).slice(0, 10) }} · {{ sel.uploadedBy }}
          </dd>
          <dt class="text-fg-muted">
            Used on
          </dt><dd class="text-fg-heading">
            <template v-if="sel.used.length">
              <NuxtLink v-for="(d, i) in sel.used" :key="d.id" :to="`/admin/website/${d.template.includes('article') ? 'insights' : d.template.includes('case-study') ? 'case-studies' : 'pages'}/${d.id}`" class="apex-ring text-accent-ink rounded font-semibold">
                {{ d.path }}{{ i < sel.used.length - 1 ? ', ' : '' }}
              </NuxtLink>
            </template>
            <span v-else>Not used anywhere</span>
          </dd>
        </dl>
        <div v-if="sel.kind === 'image'" class="flex flex-col">
          <label for="media-alt" class="text-fg-heading mb-[7px] text-[13px] font-semibold">Alt text</label>
          <textarea
            id="media-alt" v-model="alt" rows="3" maxlength="300" :readonly="!canMedia" :class="ADMIN_TEXTAREA"
            placeholder="Describe what the image shows for people using screen readers" aria-describedby="media-alt-h"
          />
          <span id="media-alt-h" :class="sel.alt ? ADMIN_HINT : 'text-st-warning-fg mt-1.5 block text-xs'">
            {{ sel.alt ? 'Read aloud by screen readers wherever this image appears.' : 'Missing. Pages using this image will fail the accessibility check.' }}
          </span>
          <AdminButton v-if="canMedia && altDirty" size="sm" variant="primary" class="mt-2.5 self-start" :disabled="busy" @click="saveAlt">
            Save alt text
          </AdminButton>
        </div>
        <div class="flex flex-wrap gap-2">
          <AdminButton size="sm" :disabled="!sel.link" @click="copyLink">
            Copy link
          </AdminButton>
          <AdminButton v-if="canMedia" size="sm" variant="danger-text" :disabled="busy || sel.used.length > 0" @click="remove">
            Delete
          </AdminButton>
        </div>
        <p v-if="canMedia && sel.used.length" class="text-fg-muted text-xs">
          Used on {{ sel.used.length }} {{ sel.used.length === 1 ? 'page' : 'pages' }}. Remove it there before deleting.
        </p>
      </section>
    </div>
  </AdminPage>
</template>
