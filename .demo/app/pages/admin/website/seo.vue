<script setup lang="ts">
import { ADMIN_INPUT, ADMIN_TEXTAREA, ADMIN_TH } from '~/utils/adminUi'

/**
 * Website › SEO & redirects (`Admin Console.dc.html` `v_42seo`, ADR-026):
 *
 * - Page SEO: every page's search title and description length, whether it
 *   is indexed and the first thing to fix; a row opens the page's SEO tab.
 * - Redirects: add (with a live check as the addresses are typed: loops
 *   refused, chains flattened, a live page at the old address warned
 *   about) and remove.
 * - Sitemap & robots: what the sitemap lists and leaves out, and the paths
 *   robots.txt hides. The rest of robots.txt is fixed by the site.
 */
definePageMeta({
  title: 'SEO & redirects',
  layout: 'admin',
  middleware: 'admin',
})

interface SeoRow { id: string, title: string, path: string, editor: string, published: boolean, titleLength: number, descriptionLength: number, indexed: boolean, check: string, tone: 'warning' | 'neutral' | 'success' }
interface Redirect { id: string, fromPath: string, toPath: string, statusCode: number, createdAt: string, createdBy: string }

const route = useRoute()
const toaster = useNuiToasts()
const { ask } = useAdminConfirm()
const { can } = useStaffAccess()
const canStructure = computed(() => can('website.seo'))

type Tab = 'pages' | 'redirects' | 'sitemap'
const tab = ref<Tab>((['redirects', 'sitemap'] as const).find(t => t === route.query.tab) ?? 'pages')
watch(tab, t => navigateTo({ query: { ...route.query, tab: t === 'pages' ? undefined : t } }, { replace: true }))

const { data: seo, error: seoError, refresh: refreshSeo } = await useFetch<{ rows: SeoRow[], limits: { title: number, description: number }, sitemap: { listed: number, excluded: { path: string, why: string }[] } }>('/api/admin/website/seo', { key: 'website-seo' })
const { data: redirects, error: rdError, refresh: refreshRedirects } = await useFetch<{ items: Redirect[] }>('/api/admin/website/redirects', { key: 'website-redirects' })
const { data: settings, refresh: refreshSettings } = await useFetch<{ values: Record<string, unknown> }>('/api/admin/website/settings', { key: 'website-settings' })

/* --------------------------------------------------------------- redirects --- */

const from = ref('')
const to = ref('')
const type = ref<301 | 302>(301)
const check = ref<{ ok: boolean, message?: string, warnings?: string[], fromPath?: string, toPath?: string } | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
watch([from, to], () => {
  clearTimeout(timer)
  check.value = null
  if (!from.value.trim() || !to.value.trim()) {
    return
  }
  timer = setTimeout(async () => {
    check.value = await $fetch<typeof check.value>('/api/admin/website/redirects/check', { method: 'POST', body: { fromPath: from.value, toPath: to.value } }).catch(err => ({ ok: false, message: errorMessage(err) }))
  }, 300)
})
const hint = computed(() => {
  if (!from.value.trim() && !to.value.trim()) {
    return { text: 'Start the old address with /. The new one can be a page here or a full https:// address. A 301 tells search engines the move is permanent.', warn: false }
  }
  if (!check.value) {
    return { text: 'Checking…', warn: false }
  }
  if (!check.value.ok) {
    return { text: check.value.message ?? 'That redirect cannot be saved.', warn: true }
  }
  if (check.value.warnings?.length) {
    return { text: check.value.warnings.join(' '), warn: true }
  }
  return { text: `Visitors to ${check.value.fromPath} will land on ${check.value.toPath}.`, warn: false }
})
const busy = ref(false)
async function addRedirect() {
  if (!check.value?.ok) {
    return
  }
  busy.value = true
  try {
    await $fetch('/api/admin/website/redirects', { method: 'POST', body: { fromPath: from.value, toPath: to.value, statusCode: type.value } })
    toaster.add({ title: 'Redirect added', description: `${check.value.fromPath} → ${check.value.toPath}`, icon: 'lucide:check', progress: true })
    from.value = ''
    to.value = ''
    await refreshRedirects()
  }
  catch (err) {
    toaster.add({ title: 'Not added', description: errorMessage(err), icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    busy.value = false
  }
}
async function removeRedirect(r: Redirect) {
  const go = await ask({ title: `Remove the redirect from ${r.fromPath}?`, body: `Visitors to ${r.fromPath} will get a 404 unless a page exists there.`, confirmLabel: 'Remove redirect', danger: true })
  if (go === null) {
    return
  }
  try {
    await $fetch(`/api/admin/website/redirects/${r.id}`, { method: 'DELETE' })
    await refreshRedirects()
    toaster.add({ title: 'Redirect removed', description: r.fromPath, icon: 'lucide:check', progress: true })
  }
  catch (err) {
    toaster.add({ title: 'Not removed', description: errorMessage(err), icon: 'lucide:alert-triangle', progress: true })
  }
}

/* ---------------------------------------------------------------- robots --- */

const hidden = ref('')
const storedHidden = computed(() => ((settings.value?.values['site.robots.disallow'] as string[] | undefined) ?? []).join('\n'))
watch(storedHidden, v => (hidden.value = v), { immediate: true })
const hiddenLines = computed(() => hidden.value.split('\n').map(l => l.trim()).filter(Boolean))
const robotsError = ref('')
async function saveRobots() {
  busy.value = true
  robotsError.value = ''
  try {
    await $fetch('/api/admin/website/settings', { method: 'PUT', body: { 'site.robots.disallow': hiddenLines.value } })
    await refreshSettings()
    toaster.add({ title: 'robots.txt saved', description: 'Search engines read it on their next visit.', icon: 'lucide:check', progress: true })
  }
  catch (err: any) {
    robotsError.value = err?.data?.data?.fieldErrors?.['site.robots.disallow']?.[0] ?? errorMessage(err)
  }
  finally {
    busy.value = false
  }
}
const robotsPreview = computed(() => ['User-agent: *', 'Disallow: /api/', 'Disallow: /preview/', ...hiddenLines.value.map(p => `Disallow: ${p}`), '', 'Sitemap: https://apexdigi.co.uk/sitemap.xml'].join('\n'))

const TAB_CLS = 'apex-ring -mb-px inline-flex h-10 shrink-0 cursor-pointer items-center border-b-2 text-sm'
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="SEO &" accent="redirects" subtitle="Search titles, descriptions, redirects and the sitemap for apexdigi.co.uk." />

    <div class="border-line-subtle flex gap-6 overflow-x-auto border-b" role="tablist" aria-label="SEO">
      <button
        v-for="t in [{ key: 'pages', label: 'Page SEO' }, { key: 'redirects', label: `Redirects · ${redirects?.items.length ?? 0}` }, { key: 'sitemap', label: 'Sitemap & robots' }] as const" :key="t.key"
        type="button" role="tab" :aria-selected="tab === t.key"
        :class="[TAB_CLS, tab === t.key ? 'border-accent text-fg-heading font-semibold' : 'text-fg-muted border-transparent font-medium']"
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- Page SEO -->
    <template v-if="tab === 'pages'">
      <AdminLoadError v-if="seoError" :error="seoError" title="Could not load the pages" @retry="refreshSeo" />
      <section v-else class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
        <div class="hidden gap-3.5 px-[22px] py-3.5 xl:grid xl:grid-cols-[minmax(0,1fr)_110px_120px_120px_170px]" :class="ADMIN_TH">
          <span>Page</span><span class="text-end">Title</span><span class="text-end">Description</span><span>Indexed</span><span>Checks</span>
        </div>
        <p v-if="seo && !seo.rows.length" class="border-line-soft text-fg-muted border-t px-[22px] py-6 text-[13.5px]">
          No pages yet. Import the site's pages on the Pages screen.
        </p>
        <NuxtLink
          v-for="r in seo?.rows ?? []" :key="r.id" :to="`${r.editor}?tab=seo`"
          class="apex-ring border-line-soft hover:bg-raised grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 border-t px-[18px] py-3 sm:px-[22px] xl:grid-cols-[minmax(0,1fr)_110px_120px_120px_170px]"
        >
          <span class="min-w-0">
            <span class="text-fg-heading block truncate text-sm font-semibold">{{ r.title }}</span>
            <span class="text-fg-muted mt-0.5 block truncate text-[12.5px]">{{ r.path }}</span>
          </span>
          <span class="text-[13px] tabular-nums xl:text-end" :class="r.titleLength > (seo?.limits.title ?? 60) ? 'text-st-warning-fg font-semibold' : 'text-fg-body'">
            <span class="text-fg-muted xl:hidden">Title </span>{{ r.titleLength }} / {{ seo?.limits.title }}
          </span>
          <span class="text-[13px] tabular-nums xl:text-end" :class="!r.descriptionLength || r.descriptionLength > (seo?.limits.description ?? 160) ? 'text-st-warning-fg font-semibold' : 'text-fg-body'">
            <span class="text-fg-muted xl:hidden">Description </span>{{ r.descriptionLength ? `${r.descriptionLength} / ${seo?.limits.description}` : 'Missing' }}
          </span>
          <span class="text-fg-body text-[13px]">{{ r.indexed ? 'Yes' : 'No · noindex' }}</span>
          <AdminStatusChip :tone="r.tone" :label="r.check" />
        </NuxtLink>
      </section>
      <p class="text-fg-muted text-[12.5px]">
        Character counts: titles up to 60, descriptions up to 160. Open a row to edit it on the page's SEO tab.
      </p>
    </template>

    <!-- Redirects -->
    <template v-else-if="tab === 'redirects'">
      <section v-if="canStructure" class="bg-card border-line-subtle grid gap-3 rounded-2xl border p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px_auto] md:items-end" aria-label="Add a redirect">
        <label class="flex flex-col">
          <span class="text-fg-heading mb-[7px] text-[13px] font-semibold">From</span>
          <input v-model="from" placeholder="/old-address" spellcheck="false" autocomplete="off" :class="ADMIN_INPUT">
        </label>
        <label class="flex flex-col">
          <span class="text-fg-heading mb-[7px] text-[13px] font-semibold">To</span>
          <input v-model="to" placeholder="/new-address" spellcheck="false" autocomplete="off" :class="ADMIN_INPUT">
        </label>
        <label class="flex flex-col">
          <span class="text-fg-heading mb-[7px] text-[13px] font-semibold">Type</span>
          <select :class="ADMIN_INPUT" @change="type = Number(($event.target as HTMLSelectElement).value) as 301 | 302">
            <option value="301" :selected="type === 301">301 · permanent</option>
            <option value="302" :selected="type === 302">302 · temporary</option>
          </select>
        </label>
        <AdminButton variant="primary" :disabled="busy || !check?.ok" @click="addRedirect">
          Add redirect
        </AdminButton>
        <p class="text-xs md:col-span-4" :class="hint.warn ? 'text-st-warning-fg' : 'text-fg-muted'" aria-live="polite">
          {{ hint.text }}
        </p>
      </section>
      <p v-else class="bg-chip border-line-subtle text-fg-body rounded-xl border px-4 py-3 text-[13.5px]">
        You can view redirects. Adding or removing them needs Owner or Admin.
      </p>

      <AdminLoadError v-if="rdError" :error="rdError" title="Could not load the redirects" @retry="refreshRedirects" />
      <section v-else class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
        <div class="hidden gap-3.5 px-[22px] py-3.5 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_70px_220px_80px]" :class="ADMIN_TH">
          <span>From</span><span>To</span><span>Type</span><span>Added</span><span />
        </div>
        <p v-if="redirects && !redirects.items.length" class="border-line-soft text-fg-muted border-t px-[22px] py-6 text-[13.5px]">
          No redirects. Moving a published page adds one automatically.
        </p>
        <div
          v-for="r in redirects?.items ?? []" :key="r.id"
          class="border-line-soft grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 border-t px-[18px] py-3 sm:px-[22px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_70px_220px_80px]"
        >
          <span class="text-fg-heading truncate font-mono text-[13px]">{{ r.fromPath }}</span>
          <span class="text-fg-body col-span-2 truncate font-mono text-[13px] xl:col-auto">→ {{ r.toPath }}</span>
          <span class="text-fg-body text-[13px] tabular-nums">{{ r.statusCode }}</span>
          <span class="text-fg-muted text-[12.5px]">{{ ukDateTime(r.createdAt).slice(0, 10) }} · {{ r.createdBy }}</span>
          <button v-if="canStructure" type="button" class="apex-ring text-st-danger-fg justify-self-start rounded text-[12.5px] font-semibold xl:justify-self-end" @click="removeRedirect(r)">
            Remove
          </button>
        </div>
      </section>
    </template>

    <!-- Sitemap & robots -->
    <div v-else class="grid items-start gap-5 xl:grid-cols-2">
      <AdminCard label="sitemap.xml" padded>
        <p class="text-fg-body text-[13.5px] leading-normal">
          {{ seo?.sitemap.listed ?? 0 }} published addresses are listed. The file rebuilds every time something is published, so there is nothing to submit by hand.
        </p>
        <div class="text-fg-muted text-[11.5px] font-bold uppercase tracking-[0.06em]">
          Left out
        </div>
        <p v-if="!seo?.sitemap.excluded.length" class="text-fg-muted text-[13px]">
          Nothing left out.
        </p>
        <ul v-else class="flex flex-col">
          <li v-for="x in seo.sitemap.excluded" :key="x.path" class="border-line-soft flex items-center gap-3 border-t py-2 text-[13px]">
            <span class="text-fg-heading min-w-0 flex-1 truncate font-mono">{{ x.path }}</span>
            <span class="text-fg-muted">{{ x.why }}</span>
          </li>
        </ul>
      </AdminCard>
      <AdminCard label="robots.txt" padded>
        <label class="flex flex-col">
          <span class="text-fg-heading mb-[7px] text-[13px] font-semibold">Hidden from search engines</span>
          <textarea v-model="hidden" rows="5" :readonly="!canStructure" spellcheck="false" placeholder="/landing/old-offer" :class="ADMIN_TEXTAREA" class="font-mono" aria-describedby="robots-h" />
          <span v-if="robotsError" id="robots-h" class="text-st-danger-fg mt-1.5 text-xs" role="alert">{{ robotsError }}</span>
          <span v-else id="robots-h" class="text-fg-muted mt-1.5 text-xs">One path per line. To hide a single page, switch off "Show in search engines" on its SEO tab instead.</span>
        </label>
        <AdminButton v-if="canStructure && hidden !== storedHidden" variant="primary" size="sm" class="self-start" :disabled="busy" @click="saveRobots">
          Save robots.txt
        </AdminButton>
        <pre class="bg-raised text-fg-body overflow-x-auto rounded-xl p-3.5 text-[12.5px] leading-relaxed">{{ robotsPreview }}</pre>
        <p class="text-fg-muted text-xs">
          Served at apexdigi.co.uk/robots.txt. Saved changes apply within a minute.
        </p>
      </AdminCard>
    </div>
  </AdminPage>
</template>
