<script setup lang="ts">
import type { WebsiteDocRow } from '~/composables/useWebsiteDocs'
import { ADMIN_INPUT } from '~/utils/adminUi'

/**
 * Website › Navigation & footer (`Admin Console.dc.html` `v_41nav`,
 * ADR-026): the header menu, its button and the footer's link columns, as
 * the site's header and footer documents hold them. Edits stay here until
 * "Publish menus" saves and publishes both documents together.
 *
 * Real or absent: the design draws sub-items under a menu entry; the
 * site's only dropdown is Services, built from the service catalogue, so
 * entries here have none. A link to an address with no published page is
 * marked "No page", as drawn.
 */
definePageMeta({
  title: 'Navigation & footer',
  layout: 'admin',
  middleware: 'admin',
})

type Link = { kind: 'internal', path: string } | { kind: 'external', url: string }
interface NavItem { label: string, link: Link }
interface Detail { document: WebsiteDocRow, draft: Record<string, any>, draftVersion: number }

const toaster = useNuiToasts()
const { ask } = useAdminConfirm()
const { can } = useStaffAccess()
const canEdit = computed(() => can('website.seo') && can('website.publish'))

const { data: list, error, refresh: refreshList } = await useFetch<{ items: WebsiteDocRow[] }>('/api/admin/website/documents', { query: { collection: 'chrome', pageSize: 50 }, key: 'website-chrome' })
const headerId = computed(() => list.value?.items.find(d => d.template === 'header')?.id ?? null)
const footerId = computed(() => list.value?.items.find(d => d.template === 'footer')?.id ?? null)

const header = ref<Detail | null>(null)
const footer = ref<Detail | null>(null)
const nav = ref<NavItem[]>([])
const start = ref('')
const groups = ref<{ label: string, links: NavItem[] }[]>([])
const saved = ref('')
const snapshot = () => JSON.stringify({ nav: nav.value, start: start.value, groups: groups.value })
const dirty = computed(() => Boolean(header.value) && snapshot() !== saved.value)

async function load() {
  const [h, f] = await Promise.all([
    headerId.value ? $fetch<Detail>(`/api/admin/website/documents/${headerId.value}`) : null,
    footerId.value ? $fetch<Detail>(`/api/admin/website/documents/${footerId.value}`) : null,
  ])
  header.value = h
  footer.value = f
  nav.value = JSON.parse(JSON.stringify(h?.draft.nav ?? []))
  start.value = h?.draft.start ?? ''
  groups.value = JSON.parse(JSON.stringify(f?.draft.groups ?? []))
  saved.value = snapshot()
}
const loading = ref(true)
const loadError = ref<unknown>(null)
async function reload() {
  loading.value = true
  loadError.value = null
  try {
    await refreshList()
    await load()
  }
  catch (err) {
    loadError.value = err
  }
  finally {
    loading.value = false
  }
}
onMounted(reload)

// Addresses that have a published page, for the "No page" marks.
const { data: seo } = await useFetch<{ rows: { path: string, published: boolean }[] }>('/api/admin/website/seo', { key: 'website-seo-paths' })
const livePaths = computed(() => new Set((seo.value?.rows ?? []).filter(r => r.published).map(r => r.path)))
function target(link: Link) {
  return link.kind === 'external' ? link.url : link.path
}
function broken(link: Link) {
  if (link.kind === 'external') {
    return false
  }
  const path = link.path.split(/[?#]/)[0]!.replace(/\/$/, '') || '/'
  return !livePaths.value.has(path)
}
function setTarget(item: NavItem, value: string) {
  const v = value.trim()
  item.link = v.startsWith('https://') ? { kind: 'external', url: v } : { kind: 'internal', path: v.startsWith('/') ? v : `/${v}` }
}
function move(items: NavItem[], i: number, to: number) {
  if (to >= 0 && to < items.length) {
    const [x] = items.splice(i, 1)
    items.splice(to, 0, x!)
  }
}

function discard() {
  const s = JSON.parse(saved.value)
  nav.value = s.nav
  start.value = s.start
  groups.value = s.groups
}

const busy = ref(false)
async function publish() {
  if (!header.value || !footer.value) {
    return
  }
  const brokenLinks = [...nav.value, ...groups.value.flatMap(g => g.links)].filter(i => broken(i.link)).length
  const go = await ask({
    title: 'Publish menu changes?',
    body: 'The header and footer update on every page of apexdigi.co.uk.',
    points: brokenLinks ? [{ tone: 'warning', text: `${brokenLinks} link${brokenLinks === 1 ? ' points' : 's point'} to an address with no published page. Visitors will see a 404 there.` }] : [],
    confirmLabel: 'Publish menus',
  })
  if (go === null) {
    return
  }
  busy.value = true
  try {
    for (const [doc, content] of [[header.value, { ...header.value.draft, nav: nav.value, start: start.value }], [footer.value, { ...footer.value.draft, groups: groups.value }]] as const) {
      const savedDraft = await $fetch<{ draftVersion: number }>(`/api/admin/website/documents/${doc.document.id}/draft`, { method: 'PUT', body: { content, version: doc.draftVersion } })
      const needs = doc.document.status === 'DRAFT' || JSON.stringify(content) !== JSON.stringify(doc.draft) || doc.document.dirty
      if (needs) {
        await $fetch(`/api/admin/website/documents/${doc.document.id}/publish`, { method: 'POST', body: { version: savedDraft.draftVersion, note: 'Menus' } })
      }
    }
    await load()
    toaster.add({ title: 'Menus are live', description: 'The header and footer changed on every page.', icon: 'lucide:check', progress: true })
  }
  catch (err: any) {
    const fieldErrors = err?.data?.data?.fieldErrors as Record<string, string[]> | undefined
    toaster.add({ title: 'Not published', description: (fieldErrors && Object.entries(fieldErrors)[0] ? `${Object.entries(fieldErrors)[0]![0]}: ${Object.entries(fieldErrors)[0]![1][0]}` : null) ?? errorMessage(err), icon: 'lucide:alert-triangle', progress: true })
    await load().catch(() => {})
  }
  finally {
    busy.value = false
  }
}

const ICON_BTN = 'apex-ring text-fg-muted hover:bg-chip hover:text-fg-heading inline-flex size-8 shrink-0 items-center justify-center rounded-lg disabled:opacity-40'
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="Navigation &" accent="footer" subtitle="Menus on every page of apexdigi.co.uk. Changes go live when published.">
      <template v-if="dirty && canEdit">
        <AdminButton :disabled="busy" @click="discard">
          Discard
        </AdminButton>
        <AdminButton variant="primary" :disabled="busy" @click="publish">
          Publish menus
        </AdminButton>
      </template>
    </AdminPageHeader>

    <p v-if="!canEdit" class="bg-chip border-line-subtle text-fg-body rounded-xl border px-4 py-3 text-[13.5px]">
      You can view the menus. Changing them needs Owner or Admin.
    </p>

    <AdminLoadError v-if="error || loadError" :error="error || loadError" title="Could not load the menus" @retry="reload" />
    <AdminEmptyState
      v-else-if="!loading && (!headerId || !footerId)"
      icon="solar:list-linear"
      title="The menus are not in the console yet"
      subtitle="Import the site's pages on the Pages screen; the header and footer come in with them."
    >
      <AdminButton to="/admin/website/pages">
        Go to Pages
      </AdminButton>
    </AdminEmptyState>
    <template v-else-if="header && footer">
      <!-- The header as visitors see it. -->
      <div class="border-line-subtle flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border bg-white px-6 py-4 text-[#101828]" aria-label="Header preview">
        <img src="/brand/apex-icon.svg" alt="Apex" class="h-7 w-auto">
        <span class="flex-1" />
        <span class="text-sm font-medium text-[rgba(16,24,40,.62)]">Services ▾</span>
        <span v-for="(n, i) in nav" :key="i" class="text-sm font-medium text-[rgba(16,24,40,.62)]">{{ n.label }}</span>
        <span class="inline-flex h-9 items-center rounded-full bg-[#7D53F2] px-4 text-[13.5px] font-semibold text-white">{{ start }}</span>
      </div>

      <div class="grid items-start gap-5 xl:grid-cols-2">
        <AdminCard label="Header menu" padded>
          <p class="text-fg-muted -mt-1 text-xs">
            Services keeps its own menu, built from Services & pricing; these sit beside it.
          </p>
          <div v-for="(n, i) in nav" :key="i" class="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <Icon name="lucide:grip-vertical" class="text-fg-muted size-3.5 shrink-0" aria-hidden="true" />
            <input v-model="n.label" :readonly="!canEdit" :aria-label="`Menu item ${i + 1}: label`" maxlength="40" :class="ADMIN_INPUT" class="min-w-0 flex-1">
            <input :value="target(n.link)" :readonly="!canEdit" :aria-label="`Menu item ${i + 1}: link`" :class="ADMIN_INPUT" class="min-w-0 flex-1" spellcheck="false" @change="setTarget(n, ($event.target as HTMLInputElement).value)">
            <AdminStatusChip v-if="broken(n.link)" tone="warning" label="No page" title="No published page at this address" />
            <template v-if="canEdit">
              <button type="button" :class="ICON_BTN" :disabled="i === 0" :aria-label="`Move ${n.label} up`" @click="move(nav, i, i - 1)">
                <Icon name="lucide:chevron-up" class="size-3.5" />
              </button>
              <button type="button" :class="ICON_BTN" :disabled="nav.length <= 1" :aria-label="`Remove ${n.label}`" @click="nav.splice(i, 1)">
                <Icon name="lucide:x" class="size-3.5" />
              </button>
            </template>
          </div>
          <button
            v-if="canEdit && nav.length < 6" type="button"
            class="apex-ring border-line-strong text-fg-heading hover:bg-hover inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-dashed text-[13px] font-semibold"
            @click="nav.push({ label: 'New item', link: { kind: 'internal', path: '/' } })"
          >
            <Icon name="lucide:plus" class="size-3.5" /> Add menu item
          </button>
          <label class="flex flex-col">
            <span class="text-fg-heading mb-[7px] text-[13px] font-semibold">Header button</span>
            <input v-model="start" :readonly="!canEdit" maxlength="30" :class="ADMIN_INPUT">
          </label>
        </AdminCard>

        <AdminCard label="Footer" padded>
          <div v-for="(g, gi) in groups" :key="gi" class="flex flex-col gap-2">
            <input v-model="g.label" :readonly="!canEdit" :aria-label="`Column ${gi + 1}: heading`" maxlength="40" :class="ADMIN_INPUT" class="font-semibold">
            <div v-for="(l, li) in g.links" :key="li" class="flex flex-wrap items-center gap-2 ps-4 sm:flex-nowrap">
              <input v-model="l.label" :readonly="!canEdit" :aria-label="`${g.label}: link ${li + 1} label`" maxlength="40" :class="ADMIN_INPUT" class="min-w-0 flex-1">
              <input :value="target(l.link)" :readonly="!canEdit" :aria-label="`${g.label}: link ${li + 1} address`" :class="ADMIN_INPUT" class="min-w-0 flex-1" spellcheck="false" @change="setTarget(l, ($event.target as HTMLInputElement).value)">
              <AdminStatusChip v-if="broken(l.link)" tone="warning" label="No page" title="No published page at this address" />
            </div>
          </div>
          <p class="text-fg-muted text-xs">
            Company name, address and legal lines in the footer come from Site settings.
          </p>
        </AdminCard>
      </div>
    </template>
  </AdminPage>
</template>
