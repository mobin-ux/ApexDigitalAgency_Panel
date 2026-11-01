<script setup lang="ts">
import type { FieldDef, SectionType, TemplateKey } from '~~/shared/cms'
import type { WebsiteDocRow, WebsiteListCollection } from '~/composables/useWebsiteDocs'
import { BUILT_META_FIELDS, isBuiltTemplate, MAX_SECTIONS, SECTION_TYPE_KEYS, SECTION_TYPES, TEMPLATES } from '~~/shared/cms'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL, ADMIN_TEXTAREA } from '~/utils/adminUi'
import { emptyValue, errorsUnder, firstWords } from '~/utils/websiteFields'

const { collection } = defineProps<{ collection: WebsiteListCollection }>()

/**
 * The website editor (`Admin Console.dc.html` `v_30editor`, ADR-026):
 * sections on the left, the selected section's fields with SEO and
 * Revisions beside them, and the site's own rendering of the saved draft
 * on the right.
 *
 * - A page, article or case study built in the console is its sections:
 *   they can be added, removed, hidden and reordered.
 * - A page the site renders from code shows its template's parts as
 *   sections; their words change, their layout does not.
 * - Saving changes the draft only. Publishing (Owner, Admin) or submitting
 *   for review (everyone else who edits) is what reaches visitors, and the
 *   draft locks while it waits for review.
 *
 * The preview is the site's `/preview/:token` page in a frame, so it is
 * exactly what visitors would get; it shows the draft as last saved.
 */
/** The section types with their optional note, read uniformly. */
const SECTION_DEFS = SECTION_TYPES as Record<SectionType, { label: string, note?: string, fields: Record<string, FieldDef> }>

type Json = Record<string, any>
interface Revision { id: string, number: number, note: string | null, by: string, at: string, published: boolean, live: boolean }
interface Detail {
  document: WebsiteDocRow
  key: string
  kind: string
  draft: Json
  draftVersion: number
  live: Json | null
  liveRevision: number | null
  createdBy: string | null
  publishedBy: string | null
  changesRequested: { note: string, by: string, at: string } | null
  editor: string
  revisions: Revision[]
}

const LIST: Record<WebsiteListCollection, string> = { pages: '/admin/website/pages', insights: '/admin/website/insights', work: '/admin/website/case-studies' }
const NOUN: Record<WebsiteListCollection, string> = { pages: 'page', insights: 'article', work: 'case study' }

const route = useRoute()
const id = String(route.params.id)
const toaster = useNuiToasts()
const { ask } = useAdminConfirm()
const { can } = useStaffAccess()

const { data, error, refresh } = await useFetch<Detail>(`/api/admin/website/documents/${id}`, { key: `website-doc:${id}` })
// A document opened under another collection's address moves to its own.
if (data.value && data.value.editor !== route.path.replace(/\/$/, '')) {
  await navigateTo(data.value.editor, { replace: true })
}

const draft = ref<Json>({})
const version = ref(0)
const title = ref('')
const pathDraft = ref('')
const saved = ref('')
const fieldErrors = ref<Record<string, string[]>>({})
const snapshot = () => JSON.stringify({ c: draft.value, t: title.value })
function load(d: Detail) {
  draft.value = JSON.parse(JSON.stringify(d.draft ?? {}))
  version.value = d.draftVersion
  title.value = d.document.title
  pathDraft.value = d.key
  saved.value = snapshot()
}
watch(data, d => d && load(d), { immediate: true })
const unsaved = computed(() => Boolean(data.value) && snapshot() !== saved.value)

const doc = computed(() => data.value?.document)
const template = computed(() => doc.value?.template ?? '')
const built = computed(() => isBuiltTemplate(template.value))
const codedFields = computed<Record<string, FieldDef>>(() => (!built.value && template.value in TEMPLATES ? TEMPLATES[template.value as TemplateKey].fields as Record<string, FieldDef> : {}))
const metaFields = computed<Record<string, FieldDef>>(() => (built.value ? BUILT_META_FIELDS[template.value as keyof typeof BUILT_META_FIELDS] as Record<string, FieldDef> : {}))
const hasSeo = computed(() => built.value || 'seo' in codedFields.value)

const canEditRole = computed(() => can('website.edit'))
const canPublish = computed(() => can('website.publish'))
const inReview = computed(() => doc.value?.review === 'IN_REVIEW')
const lockedForReview = computed(() => inReview.value && !canPublish.value)
const canEdit = computed(() => canEditRole.value && !lockedForReview.value)
const readonly = computed(() => !canEdit.value)

useAdminCrumb(() => title.value, LIST[collection])

/* ------------------------------------------------------------ sections --- */

const tab = ref<'content' | 'seo' | 'rev'>('content')

interface Row { id: string, label: string, summary: string, hidden: boolean, index: number | null }
const sections = computed<Json[]>(() => (built.value && Array.isArray(draft.value.sections) ? draft.value.sections : []))
const generalKeys = computed(() => Object.keys(codedFields.value).filter(k => k !== 'seo' && codedFields.value[k]!.type !== 'object'))

const rows = computed<Row[]>(() => {
  if (built.value) {
    const listing: Row[] = Object.keys(metaFields.value).length ? [{ id: '_listing', label: 'Listing details', summary: String(draft.value.meta?.summary || 'Shown on the list of the site'), hidden: false, index: null }] : []
    return [...listing, ...sections.value.map((s, i) => {
      const def = SECTION_DEFS[s.type as SectionType]
      const f = s.fields ?? {}
      const words = f.title || f.heading || f.quote || (s.type === 'image' ? (f.caption || 'Image') : '') || (def?.note ? 'From the site' : '')
      return { id: s.id as string, label: def?.label ?? s.type, summary: `${s.hidden ? 'Hidden · ' : ''}${words}`, hidden: Boolean(s.hidden), index: i }
    })]
  }
  const objects = Object.entries(codedFields.value).filter(([k, d]) => k !== 'seo' && d.type === 'object')
  const general: Row[] = generalKeys.value.length ? [{ id: '_general', label: 'Page details', summary: firstWords(generalKeys.value.map(k => draft.value[k])), hidden: false, index: null }] : []
  return [...general, ...objects.map(([k, d]) => ({ id: k, label: 'label' in d ? d.label : k, summary: firstWords(draft.value[k]), hidden: false, index: null }))]
})

const sel = ref<string | null>(null)
watch(rows, (list) => {
  if (!list.some(r => r.id === sel.value)) {
    sel.value = list.find(r => r.index !== null)?.id ?? list[0]?.id ?? null
  }
}, { immediate: true })
const selRow = computed(() => rows.value.find(r => r.id === sel.value) ?? null)
const selSection = computed(() => (selRow.value?.index !== null && selRow.value?.index !== undefined ? sections.value[selRow.value.index] ?? null : null))
const selType = computed(() => (selSection.value ? SECTION_DEFS[selSection.value.type as SectionType] : null))

function errorPrefix(row: Row) {
  if (row.index !== null) {
    return `sections.${row.index}`
  }
  if (row.id === '_listing') {
    return 'meta'
  }
  return row.id === '_general' ? '' : row.id
}
function rowErrors(row: Row) {
  if (row.id === '_general') {
    return generalKeys.value.reduce((n, k) => n + errorsUnder(fieldErrors.value, k), 0)
  }
  return errorsUnder(fieldErrors.value, errorPrefix(row))
}

function move(from: number, to: number) {
  const list = draft.value.sections as Json[]
  if (to < 0 || to >= list.length || from === to) {
    return
  }
  const [item] = list.splice(from, 1)
  list.splice(to, 0, item!)
  fieldErrors.value = {}
}
function toggleHidden(index: number) {
  const s = (draft.value.sections as Json[])[index]!
  s.hidden = !s.hidden
}
const addOpen = ref(false)
function addSection(type: SectionType) {
  const list = draft.value.sections as Json[]
  const fields = Object.fromEntries(Object.entries(SECTION_DEFS[type].fields).map(([k, d]) => [k, emptyValue(d)]))
  const section = { id: `s${Date.now().toString(36)}`, type, hidden: false, fields }
  const at = selRow.value?.index !== null && selRow.value?.index !== undefined ? selRow.value.index + 1 : list.length
  list.splice(at, 0, section)
  sel.value = section.id
  addOpen.value = false
  tab.value = 'content'
  fieldErrors.value = {}
}
function removeSelected() {
  const list = draft.value.sections as Json[]
  const index = selRow.value?.index
  if (index === null || index === undefined || list.length < 2) {
    return
  }
  const label = selRow.value!.label
  list.splice(index, 1)
  sel.value = list[Math.max(0, index - 1)]?.id ?? null
  fieldErrors.value = {}
  toaster.add({ title: `${label} removed from the draft`, description: 'Save the draft to keep the change, or leave without saving to undo it.', icon: 'lucide:check', progress: true })
}
let dragFrom: number | null = null
function startDrag(index: number | null) {
  dragFrom = index
}
function onDrop(index: number | null) {
  if (dragFrom !== null && index !== null) {
    move(dragFrom, index)
  }
  dragFrom = null
}

/* ----------------------------------------------------------- the media --- */

// The image section names a media-library file by id. The library's list
// is read only when an image section is open.
const media = ref<{ id: string, name: string, alt: string | null }[] | null>(null)
watch(() => selSection.value?.type === 'image', async (needed) => {
  if (needed && media.value === null && import.meta.client) {
    media.value = await $fetch<{ items: { id: string, name: string, alt: string | null }[] }>('/api/admin/website/media', { query: { pageSize: 100, kind: 'image' } }).then(r => r.items).catch(() => [])
  }
}, { immediate: true })
const chosenMedia = computed(() => media.value?.find(m => m.id === selSection.value?.fields?.media) ?? null)

/* ----------------------------------------------------------------- tabs --- */

const seo = computed<Json | null>(() => (hasSeo.value ? draft.value.seo ?? null : null))
const indexed = computed(() => !String(seo.value?.robots ?? 'index,follow').startsWith('noindex'))
function toggleIndex() {
  if (seo.value && !readonly.value) {
    seo.value.robots = indexed.value ? 'noindex,follow' : 'index,follow'
  }
}
const isHome = computed(() => data.value?.key === '/')

/* -------------------------------------------------------------- actions --- */

const busy = ref(false)

function failed(title: string, err: any) {
  const errors = err?.data?.data?.fieldErrors as Record<string, string[]> | undefined
  if (err?.statusCode === 400 && errors) {
    fieldErrors.value = errors
    const first = rows.value.find(r => rowErrors(r) > 0)
    if (first) {
      sel.value = first.id
      tab.value = 'content'
    }
    else if (Object.keys(errors).some(k => k.startsWith('seo'))) {
      tab.value = 'seo'
    }
    toaster.add({ title: 'Some fields need attention', description: 'They are marked in red. Nothing was saved.', icon: 'lucide:alert-triangle', progress: true })
    return
  }
  toaster.add({ title, description: errorMessage(err), icon: 'lucide:alert-triangle', progress: true })
}

async function saveDraft(quiet = false): Promise<boolean> {
  if (!data.value || busy.value) {
    return false
  }
  busy.value = true
  try {
    const result = await $fetch<{ draftVersion: number }>(`/api/admin/website/documents/${id}/draft`, {
      method: 'PUT',
      body: { content: draft.value, version: version.value, ...(title.value.trim() !== doc.value?.title ? { title: title.value.trim() } : {}) },
    })
    version.value = result.draftVersion
    fieldErrors.value = {}
    saved.value = snapshot()
    await refresh()
    refreshPreview()
    if (!quiet) {
      toaster.add({ title: 'Draft saved', description: 'The live page has not changed.', icon: 'lucide:check', progress: true })
    }
    return true
  }
  catch (err) {
    failed('Not saved', err)
    return false
  }
  finally {
    busy.value = false
  }
}

const where = computed(() => `apexdigi.co.uk${data.value?.key ?? ''}`)

async function publish(label: string) {
  if (unsaved.value && !(await saveDraft(true))) {
    return
  }
  const note = await ask({
    title: `${label}?`,
    body: `This replaces what visitors see at ${where.value}. The current live version stays in Revisions.`,
    reason: { required: false, label: 'Note for the publish history (optional)', placeholder: 'e.g. New FAQ and pricing wording', hint: 'Shown in Publish history and the audit log.' },
    confirmLabel: 'Publish now',
  })
  if (note === null) {
    return
  }
  busy.value = true
  try {
    const result = await $fetch<{ revision: number, revalidated: boolean }>(`/api/admin/website/documents/${id}/publish`, { method: 'POST', body: { version: version.value, ...(note ? { note } : {}) } })
    await refresh()
    refreshPreview()
    toaster.add({ title: `${title.value} is live`, description: result.revalidated ? `Revision ${result.revision} is on the site now.` : `Revision ${result.revision} is published; the site shows it within a minute.`, icon: 'lucide:check', progress: true })
  }
  catch (err) {
    failed('Not published', err)
  }
  finally {
    busy.value = false
  }
}

async function submit() {
  if (unsaved.value && !(await saveDraft(true))) {
    return
  }
  const note = await ask({
    title: 'Submit for review?',
    body: 'An Owner or Admin approves it before it goes live. You cannot edit it while it waits, unless you withdraw it.',
    reason: { required: false, label: 'Note for the reviewer (optional)', placeholder: 'e.g. Updated the timeline and added two FAQs', hint: 'Shown to the reviewer and in Publish history.' },
    confirmLabel: 'Submit for review',
  })
  if (note === null) {
    return
  }
  await act('submit', note ? { note } : {}, 'Submitted for review', 'Owners and Admins can see it in their queue.')
}

async function requestChanges() {
  const note = await ask({
    title: `Send back to ${doc.value?.submittedBy ?? 'the author'}?`,
    body: 'It returns to Draft with your note pinned at the top of the editor.',
    reason: { required: true, label: 'What needs changing', placeholder: 'e.g. The FAQ answer on cancelling needs to match the terms page', hint: 'The author sees this in the editor.' },
    confirmLabel: 'Request changes',
  })
  if (note === null) {
    return
  }
  await act('request-changes', { note }, 'Sent back with your note', 'The author has been told.')
}

async function act(action: 'submit' | 'withdraw' | 'request-changes', body: Json, done: string, detail: string) {
  busy.value = true
  try {
    await $fetch(`/api/admin/website/documents/${id}/${action}`, { method: 'POST', body })
    await refresh()
    toaster.add({ title: done, description: detail, icon: 'lucide:check', progress: true })
  }
  catch (err) {
    failed('That did not go through', err)
  }
  finally {
    busy.value = false
  }
}

async function restore(rev: Revision) {
  if (unsaved.value) {
    const go = await ask({ title: 'Discard your unsaved changes?', body: `Restoring revision ${rev.number} replaces the draft, including the edits you have not saved.`, confirmLabel: 'Discard and continue', danger: true })
    if (go === null) {
      return
    }
  }
  const confirmed = await ask({ title: `Restore revision ${rev.number}?`, body: 'Its content replaces the current draft. The live page stays as it is until someone publishes.', confirmLabel: 'Restore as draft' })
  if (confirmed === null) {
    return
  }
  busy.value = true
  try {
    await $fetch(`/api/admin/website/documents/${id}/restore`, { method: 'POST', body: { revision: rev.number } })
    await refresh()
    refreshPreview()
    tab.value = 'content'
    toaster.add({ title: `Revision ${rev.number} restored as a draft`, description: 'Publish it to put it back on the site.', icon: 'lucide:check', progress: true })
  }
  catch (err) {
    failed('Not restored', err)
  }
  finally {
    busy.value = false
  }
}

const pathError = ref('')
async function movePath() {
  if (unsaved.value) {
    toaster.add({ title: 'Save the draft first', description: 'Moving the page is saved straight away, so save or discard your edits before it.', icon: 'lucide:info', progress: true })
    return
  }
  const live = doc.value?.status === 'PUBLISHED' || (data.value?.revisions ?? []).some(r => r.published)
  const go = await ask({
    title: `Move to ${pathDraft.value}?`,
    body: live ? `Visitors and search engines at ${data.value?.key} are sent to the new address with a permanent (301) redirect.` : 'Nobody has seen this address yet, so no redirect is needed.',
    confirmLabel: 'Move it',
  })
  if (go === null) {
    return
  }
  busy.value = true
  pathError.value = ''
  try {
    const result = await $fetch<{ redirect: { from: string, to: string } | null }>(`/api/admin/website/documents/${id}/path`, { method: 'PATCH', body: { path: pathDraft.value } })
    await refresh()
    refreshPreview()
    toaster.add({ title: 'Address changed', description: result.redirect ? `${result.redirect.from} now redirects to ${result.redirect.to}.` : 'The page has its new address.', icon: 'lucide:check', progress: true })
  }
  catch (err: any) {
    pathError.value = err?.data?.data?.fieldErrors?.path?.[0] ?? errorMessage(err)
  }
  finally {
    busy.value = false
  }
}

function discard() {
  if (data.value) {
    load(data.value)
    fieldErrors.value = {}
  }
}

interface Action { label: string, primary?: boolean, disabled?: boolean, run: () => unknown }
const actions = computed<Action[]>(() => {
  const d = doc.value
  if (!d || !canEditRole.value) {
    return []
  }
  if (inReview.value) {
    return canPublish.value
      ? [{ label: 'Request changes', run: requestChanges }, { label: 'Approve and publish', primary: true, run: () => publish('Approve and publish') }]
      : [{ label: 'Withdraw from review', run: () => act('withdraw', {}, 'Back to draft', 'You can edit again.') }]
  }
  const list: Action[] = [{ label: 'Save draft', disabled: !unsaved.value, run: () => saveDraft() }]
  const needs = d.status === 'DRAFT' || d.dirty || unsaved.value
  if (needs) {
    list.push(canPublish.value
      ? { label: d.status === 'PUBLISHED' ? 'Publish changes' : 'Publish', primary: true, run: () => publish(d.status === 'PUBLISHED' ? 'Publish changes' : 'Publish') }
      : { label: 'Submit for review', primary: true, run: submit })
  }
  return list
})

const banner = computed<{ tone: 'neutral' | 'warning' | 'danger' | 'info', icon: string, text: string } | null>(() => {
  const d = doc.value
  if (!d) {
    return null
  }
  if (!canEditRole.value) {
    return { tone: 'neutral', icon: 'lucide:eye', text: `You can view this ${NOUN[collection]}. Drafting needs Owner, Admin, Project manager or Support.` }
  }
  if (inReview.value && canPublish.value) {
    return { tone: 'warning', icon: 'lucide:clipboard-check', text: `${d.submittedBy ?? 'A colleague'} submitted this for review. Check the preview, then approve and publish, or send it back with a note.` }
  }
  if (lockedForReview.value) {
    return { tone: 'warning', icon: 'lucide:clock', text: 'Waiting for an Owner or Admin to review. Fields are locked so the reviewer sees what you submitted. Withdraw it to keep editing.' }
  }
  if (data.value?.changesRequested) {
    return { tone: 'danger', icon: 'lucide:message-square', text: `${data.value.changesRequested.by} asked for changes: “${data.value.changesRequested.note}”` }
  }
  if (d.dirty) {
    return { tone: 'info', icon: 'lucide:info', text: `The live page is the last published revision. Your edits stay in this draft until ${canPublish.value ? 'you publish them.' : 'an Owner or Admin approves them.'}` }
  }
  return null
})
const BANNER_TONE = { neutral: 'bg-st-neutral-bg', warning: 'bg-st-warning-bg', danger: 'bg-st-danger-bg', info: 'bg-st-info-bg' } as const

const saveState = computed(() => {
  if (unsaved.value) {
    return 'Unsaved changes'
  }
  return doc.value ? `Saved ${ukDateTime(doc.value.updatedAt)}${doc.value.updatedBy ? ` by ${doc.value.updatedBy}` : ''}` : ''
})

/* -------------------------------------------------------------- leaving --- */

let leaving = false
onBeforeRouteLeave(async () => {
  if (!unsaved.value || leaving) {
    return true
  }
  const go = await ask({ title: 'Leave without saving?', body: 'Your changes to this draft have not been saved. The live page is not affected either way.', confirmLabel: 'Leave without saving', danger: true })
  leaving = go !== null
  return leaving
})
function beforeUnload(event: BeforeUnloadEvent) {
  if (unsaved.value) {
    event.preventDefault()
  }
}

/* -------------------------------------------------------------- preview --- */

const preview = ref<{ url: string | null } | null>(null)
const previewError = ref('')
const frameKey = ref(0)
const frameLoading = ref(true)
async function refreshPreview() {
  if (!import.meta.client) {
    return
  }
  try {
    preview.value = await $fetch<{ url: string | null }>(`/api/admin/website/documents/${id}/preview`, { method: 'POST' })
    previewError.value = ''
    frameLoading.value = true
    frameKey.value += 1
  }
  catch (err) {
    previewError.value = errorMessage(err)
  }
}
const device = ref<'desktop' | 'mobile'>('desktop')
const pane = ref<HTMLElement | null>(null)
const paneSize = ref({ w: 0, h: 0 })
let observer: ResizeObserver | null = null
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  refreshPreview()
  if (pane.value) {
    // Measured now as well: an observer reports only once the page draws,
    // which a background tab may not do for a while. 32 = the pane's padding.
    paneSize.value = { w: Math.max(0, pane.value.clientWidth - 32), h: Math.max(0, pane.value.clientHeight - 32) }
    observer = new ResizeObserver(([entry]) => {
      paneSize.value = { w: entry!.contentRect.width, h: entry!.contentRect.height }
    })
    observer.observe(pane.value)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  observer?.disconnect()
})
const frame = computed(() => {
  const width = device.value === 'desktop' ? 1200 : 390
  const scale = paneSize.value.w ? Math.min(1, paneSize.value.w / width) : 1
  const height = Math.max(320, paneSize.value.h || 600)
  return { width, scale, outer: { width: `${width * scale}px`, height: `${height}px` }, inner: { width: `${width}px`, height: `${height / scale}px`, transform: `scale(${scale})` } }
})
const previewNote = computed(() => {
  if (unsaved.value) {
    return 'Save to see your latest edits'
  }
  return doc.value?.status !== 'PUBLISHED' || doc.value?.dirty ? 'Showing your draft' : 'Matches the live page'
})

const TAB_CLS = 'apex-ring -mb-px inline-flex h-11 shrink-0 cursor-pointer items-center border-b-2 text-[13.5px]'
const ICON_BTN = 'apex-ring text-fg-muted hover:bg-chip hover:text-fg-heading inline-flex size-6 items-center justify-center rounded-[7px] disabled:opacity-40'
const SEARCH_TITLE_MAX = 60
const SEARCH_DESCRIPTION_MAX = 160
</script>

<template>
  <div v-if="error" class="mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-8">
    <AdminLoadError :error="error" :title="`Could not open this ${NOUN[collection]}`" @retry="refresh" />
  </div>
  <div v-else-if="data && doc" class="flex flex-col xl:h-[calc(100dvh-64px)]">
    <!-- Title, state and the workflow buttons. -->
    <div class="border-line-subtle bg-card flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2.5">
          <h1 class="font-heading text-fg-heading truncate text-[19px] font-extrabold tracking-[-0.015em]">
            {{ title || doc.title }}
          </h1>
          <AdminStatusChip :tone="doc.chip.tone" :label="doc.chip.label" />
        </div>
        <p class="text-fg-muted mt-[3px] truncate text-[12.5px]">
          {{ where }} · <span :class="unsaved && 'text-st-warning-fg font-semibold'">{{ saveState }}</span>
        </p>
      </div>
      <AdminButton v-if="unsaved && canEdit" variant="light" :disabled="busy" @click="discard">
        Discard
      </AdminButton>
      <AdminButton v-for="a in actions" :key="a.label" :variant="a.primary ? 'primary' : 'light'" :disabled="busy || a.disabled" @click="a.run()">
        {{ a.label }}
      </AdminButton>
    </div>

    <div v-if="banner" class="border-line-subtle text-fg-heading flex shrink-0 items-start gap-2.5 border-b px-4 py-[11px] text-[13.5px] leading-normal sm:px-6" :class="BANNER_TONE[banner.tone]" role="status">
      <Icon :name="banner.icon" class="mt-px size-4 shrink-0" aria-hidden="true" />
      <span class="flex-1">{{ banner.text }}</span>
    </div>

    <div class="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[252px_372px_minmax(0,1fr)]">
      <!-- Sections. -->
      <div class="border-line-subtle bg-shell flex min-h-0 flex-col gap-1.5 border-b px-3 py-4 xl:overflow-y-auto xl:border-b-0 xl:border-e">
        <div class="text-fg-muted px-1.5 pb-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em]">
          Sections · {{ built ? sections.length : rows.length }}
        </div>
        <p v-if="!built" class="text-fg-muted px-1.5 pb-1.5 text-xs leading-normal">
          This page is built by the site's code: its sections are fixed, and their words are yours to change.
        </p>
        <div
          v-for="r in rows" :key="r.id"
          class="flex cursor-pointer items-center gap-2 rounded-xl border py-[9px] pe-2 ps-1.5"
          :class="[sel === r.id ? 'border-accent/55 bg-accent-tint' : 'border-transparent hover:bg-hover', r.hidden && 'opacity-55']"
          :draggable="canEdit && r.index !== null"
          @dragstart="startDrag(r.index)"
          @dragover.prevent
          @drop.prevent="onDrop(r.index)"
          @click="sel = r.id; tab = 'content'"
        >
          <Icon :name="r.index !== null && canEdit ? 'lucide:grip-vertical' : 'lucide:square-pen'" class="text-fg-muted size-3.5 shrink-0" :class="r.index !== null && canEdit && 'cursor-grab'" aria-hidden="true" />
          <button type="button" class="apex-ring min-w-0 flex-1 rounded text-start" :aria-current="sel === r.id || undefined">
            <span class="text-fg-heading flex items-center gap-1.5 text-[13px] font-semibold">
              {{ r.label }}
              <span v-if="rowErrors(r)" class="bg-st-danger-fg size-1.5 rounded-full" :aria-label="`${rowErrors(r)} to fix`" />
            </span>
            <span class="text-fg-muted mt-0.5 block truncate text-[11.5px]">{{ r.summary }}</span>
          </button>
          <span v-if="canEdit && r.index !== null" class="flex shrink-0 gap-0.5">
            <button type="button" :class="ICON_BTN" :disabled="r.index === 0" aria-label="Move up" title="Move up" @click.stop="move(r.index, r.index - 1)">
              <Icon name="lucide:chevron-up" class="size-3.5" />
            </button>
            <button type="button" :class="ICON_BTN" :disabled="r.index === sections.length - 1" aria-label="Move down" title="Move down" @click.stop="move(r.index, r.index + 1)">
              <Icon name="lucide:chevron-down" class="size-3.5" />
            </button>
            <button type="button" :class="ICON_BTN" :aria-label="r.hidden ? 'Show section' : 'Hide section'" :title="r.hidden ? 'Show section' : 'Hide section'" @click.stop="toggleHidden(r.index)">
              <Icon :name="r.hidden ? 'lucide:eye-off' : 'lucide:eye'" class="size-3.5" />
            </button>
          </span>
        </div>
        <template v-if="built && canEdit">
          <button
            type="button" class="apex-ring border-line-strong text-fg-heading hover:bg-hover mt-1.5 inline-flex h-[38px] items-center justify-center gap-[7px] rounded-xl border border-dashed text-[13px] font-semibold disabled:opacity-45"
            :aria-expanded="addOpen" :disabled="sections.length >= MAX_SECTIONS" @click="addOpen = !addOpen"
          >
            <Icon name="lucide:plus" class="size-3.5" /> Add section
          </button>
          <div v-if="addOpen" class="border-line-subtle bg-card grid grid-cols-2 gap-1.5 rounded-xl border p-2">
            <button v-for="t in SECTION_TYPE_KEYS" :key="t" type="button" class="apex-ring border-line-subtle text-fg-heading hover:bg-raised h-8 rounded-lg border text-[12.5px]" @click="addSection(t)">
              {{ SECTION_DEFS[t].label }}
            </button>
          </div>
        </template>
      </div>

      <!-- Fields: Content · SEO · Revisions. -->
      <div class="border-line-subtle bg-card flex min-h-0 flex-col border-b xl:border-b-0 xl:border-e">
        <div class="border-line-subtle flex shrink-0 gap-5 border-b px-5" role="tablist" aria-label="Editor">
          <button
            v-for="t in [{ key: 'content', label: 'Content' }, { key: 'seo', label: 'SEO' }, { key: 'rev', label: `Revisions · ${data.revisions.length}` }] as const" :key="t.key"
            type="button" role="tab" :aria-selected="tab === t.key"
            :class="[TAB_CLS, tab === t.key ? 'border-accent text-fg-heading font-semibold' : 'text-fg-muted border-transparent font-medium']"
            @click="tab = t.key"
          >
            {{ t.label }}
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col gap-4 px-5 pb-6 pt-[18px] xl:overflow-y-auto" role="tabpanel">
          <!-- Content. -->
          <template v-if="tab === 'content'">
            <template v-if="selRow">
              <div class="flex items-center gap-2.5">
                <span class="font-heading text-fg-heading flex-1 text-base font-bold">{{ selRow.label }}</span>
                <button v-if="canEdit && selSection && sections.length > 1" type="button" class="apex-ring text-st-danger-fg rounded text-[12.5px] font-semibold" @click="removeSelected">
                  Remove section
                </button>
              </div>
              <div v-if="selType?.note" class="bg-accent-tint text-fg-heading flex gap-2.5 rounded-xl px-[13px] py-[11px] text-[13px] leading-normal">
                <Icon name="lucide:link" class="text-accent-ink mt-0.5 size-[15px] shrink-0" aria-hidden="true" />
                <span class="flex-1">{{ selType.note }}</span>
              </div>

              <!-- A built section's fields. -->
              <template v-if="selSection && selType">
                <template v-for="(def, key) in selType.fields" :key="`${selSection.id}-${key}`">
                  <div v-if="selSection.type === 'image' && key === 'media'" class="flex flex-col">
                    <label :for="`media-${selSection.id}`" :class="ADMIN_LABEL">Image</label>
                    <select :id="`media-${selSection.id}`" :class="ADMIN_INPUT" :disabled="readonly || !media?.length" @change="selSection.fields.media = ($event.target as HTMLSelectElement).value">
                      <option value="" :selected="!selSection.fields.media">
                        {{ media?.length ? 'Choose an image' : 'No images in the media library yet' }}
                      </option>
                      <option v-for="m in media ?? []" :key="m.id" :value="m.id" :selected="selSection.fields.media === m.id">
                        {{ m.name }}
                      </option>
                    </select>
                    <span v-if="chosenMedia && !chosenMedia.alt" class="text-st-warning-fg mt-1.5 text-xs">This image has no alt text. Add it in Media library.</span>
                    <span v-else-if="chosenMedia" :class="ADMIN_HINT">Alt text: {{ chosenMedia.alt }}</span>
                    <span v-else :class="ADMIN_HINT">An image section shows nothing until an image is chosen.</span>
                  </div>
                  <AdminWebsiteField
                    v-else :def="def" :model-value="selSection.fields[key]" :path="`sections.${selRow.index}.fields.${key}`" :errors="fieldErrors" :readonly="readonly"
                    @update:model-value="selSection.fields[key] = $event"
                  />
                </template>
              </template>

              <!-- A built article's or case study's listing. -->
              <template v-else-if="selRow.id === '_listing'">
                <AdminWebsiteField
                  v-for="(def, key) in metaFields" :key="key" :def="def" :model-value="draft.meta?.[key]" :path="`meta.${key}`" :errors="fieldErrors" :readonly="readonly"
                  @update:model-value="draft.meta = { ...draft.meta, [key]: $event }"
                />
              </template>

              <!-- A coded page's loose fields. -->
              <template v-else-if="selRow.id === '_general'">
                <AdminWebsiteField
                  v-for="key in generalKeys" :key="key" :def="codedFields[key]!" :model-value="draft[key]" :path="key" :errors="fieldErrors" :readonly="readonly"
                  @update:model-value="draft[key] = $event"
                />
              </template>

              <!-- A coded page's part. -->
              <AdminWebsiteField
                v-else-if="codedFields[selRow.id]" :key="selRow.id" :def="codedFields[selRow.id]!" :model-value="draft[selRow.id]" :path="selRow.id" :errors="fieldErrors" :readonly="readonly" bare
                @update:model-value="draft[selRow.id] = $event"
              />
            </template>
            <p v-else class="text-fg-muted text-[13.5px]">
              This document has nothing to edit here.
            </p>
          </template>

          <!-- SEO. -->
          <template v-else-if="tab === 'seo'">
            <div class="flex flex-col">
              <label for="ed-title" :class="ADMIN_LABEL">{{ NOUN[collection] === 'page' ? 'Page' : NOUN[collection] === 'article' ? 'Article' : 'Case study' }} name in admin</label>
              <input id="ed-title" v-model="title" :readonly="readonly" maxlength="120" :class="ADMIN_INPUT">
              <span :class="ADMIN_HINT">Saved with the draft. Built pages also use it as their headline until you change the hero.</span>
            </div>
            <div class="flex flex-col">
              <label for="ed-path" :class="ADMIN_LABEL">Address</label>
              <div class="flex gap-2">
                <input
                  id="ed-path" v-model="pathDraft" :readonly="readonly || !built || isHome" :class="ADMIN_INPUT" spellcheck="false" autocomplete="off"
                  :aria-invalid="Boolean(pathError) || undefined" aria-describedby="ed-path-h"
                  @input="pathError = ''"
                >
                <AdminButton v-if="built && canEdit && pathDraft.trim() !== data.key" :disabled="busy" @click="movePath">
                  Move
                </AdminButton>
              </div>
              <span v-if="pathError" id="ed-path-h" class="text-st-danger-fg mt-1.5 text-xs" role="alert">{{ pathError }}</span>
              <span v-else id="ed-path-h" :class="ADMIN_HINT">{{ isHome ? 'The homepage address cannot change.' : !built ? 'Set by the site\'s code.' : 'Changing a published address adds a 301 redirect from the old one.' }}</span>
            </div>

            <template v-if="seo">
              <div class="flex flex-col">
                <label for="ed-seo-title" class="flex items-baseline gap-2" :class="ADMIN_LABEL">
                  <span class="flex-1">Search title</span>
                  <span class="text-xs font-normal tabular-nums" :class="(seo.title ?? '').length > SEARCH_TITLE_MAX ? 'text-st-danger-fg' : 'text-fg-muted'">{{ (seo.title ?? '').length }} / {{ SEARCH_TITLE_MAX }}</span>
                </label>
                <input id="ed-seo-title" v-model="seo.title" :readonly="readonly" maxlength="70" :class="ADMIN_INPUT" :aria-invalid="Boolean(fieldErrors['seo.title']) || undefined">
                <span v-if="fieldErrors['seo.title']" class="text-st-danger-fg mt-1.5 text-xs" role="alert">{{ fieldErrors['seo.title'][0] }}</span>
                <span v-else-if="(seo.title ?? '').length > SEARCH_TITLE_MAX" class="text-st-warning-fg mt-1.5 text-xs">Search engines cut titles after about 60 characters.</span>
                <span v-else-if="!seo.title" :class="ADMIN_HINT">Empty uses the page's own title.</span>
              </div>
              <div class="flex flex-col">
                <label for="ed-seo-desc" class="flex items-baseline gap-2" :class="ADMIN_LABEL">
                  <span class="flex-1">Meta description</span>
                  <span class="text-xs font-normal tabular-nums" :class="(seo.description ?? '').length > SEARCH_DESCRIPTION_MAX ? 'text-st-danger-fg' : 'text-fg-muted'">{{ (seo.description ?? '').length }} / {{ SEARCH_DESCRIPTION_MAX }}</span>
                </label>
                <textarea id="ed-seo-desc" v-model="seo.description" rows="3" :readonly="readonly" maxlength="200" :class="ADMIN_TEXTAREA" :aria-invalid="Boolean(fieldErrors['seo.description']) || undefined" />
                <span v-if="fieldErrors['seo.description']" class="text-st-danger-fg mt-1.5 text-xs" role="alert">{{ fieldErrors['seo.description'][0] }}</span>
                <span v-else-if="!seo.description" class="text-st-warning-fg mt-1.5 text-xs">Missing. Search engines will pick text from the page.</span>
              </div>
              <div class="border-line-subtle flex items-center gap-3 rounded-xl border px-3.5 py-3">
                <span class="flex-1">
                  <span id="ed-index-l" class="text-fg-heading block text-[13.5px] font-semibold">Show in search engines</span>
                  <span class="text-fg-muted mt-0.5 block text-xs">{{ indexed ? 'Listed in the sitemap and open to search engines.' : 'Adds noindex and leaves the page out of the sitemap.' }}</span>
                </span>
                <button
                  type="button" role="switch" :aria-checked="indexed" aria-labelledby="ed-index-l" :disabled="readonly"
                  class="apex-ring relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:opacity-60"
                  :class="indexed ? 'bg-accent' : 'bg-line-strong'"
                  @click="toggleIndex"
                >
                  <span class="absolute top-[3px] size-5 rounded-full bg-white shadow transition-[left]" :class="indexed ? 'left-[21px]' : 'left-[3px]'" />
                </button>
              </div>
              <div class="text-fg-muted text-[11.5px] font-bold uppercase tracking-[0.06em]">
                Search result preview
              </div>
              <!-- Drawn as a search engine shows it, so its colours are the result page's, not the console's. -->
              <div class="rounded-xl border border-[#EDEFF1] bg-white px-4 py-3.5 font-[Arial,sans-serif]">
                <div class="text-xs text-[#4d5156]">
                  {{ where }}
                </div>
                <div class="mt-1 text-lg leading-[1.3] text-[#1a0dab]">
                  {{ seo.title || title }}
                </div>
                <div class="mt-1 text-[13px] leading-normal text-[#4d5156]">
                  {{ seo.description || 'No description. Search engines will choose text from the page.' }}
                </div>
              </div>
            </template>
            <p v-else class="text-fg-muted text-[13.5px]">
              This document is not a page of its own, so it has no search settings.
            </p>
          </template>

          <!-- Revisions. -->
          <template v-else>
            <p class="text-fg-muted text-[13px] leading-normal">
              Restoring copies a revision into the draft. The live page does not change until it is published again.
            </p>
            <p v-if="!data.revisions.length" class="text-fg-muted text-[13.5px]">
              Nothing has been published yet. Each publish keeps a revision here.
            </p>
            <div v-for="r in data.revisions" :key="r.id" class="border-line-subtle flex items-start gap-3 rounded-xl border px-3.5 py-3">
              <span class="bg-accent-tint text-accent-ink inline-flex size-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums">{{ r.number }}</span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="text-fg-heading text-[13.5px] font-semibold">{{ r.published ? 'Published' : 'Saved' }}</span>
                  <AdminStatusChip v-if="r.live" tone="success" label="Live" />
                </span>
                <span class="text-fg-muted mt-[3px] block text-xs">{{ r.by }} · {{ ukDateTime(r.at) }}</span>
                <span v-if="r.note" class="text-fg-body mt-1 block text-[12.5px]">“{{ r.note }}”</span>
              </span>
              <button v-if="canEdit && !r.live" type="button" class="apex-ring text-accent-ink rounded text-[12.5px] font-semibold" :disabled="busy" @click="restore(r)">
                Restore
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- The site's own rendering of the saved draft. -->
      <div class="bg-desk flex min-h-0 flex-col">
        <div class="border-line-subtle flex shrink-0 items-center gap-2.5 border-b px-4 py-2.5">
          <span class="text-fg-muted text-xs font-bold uppercase tracking-[0.06em]">Live preview</span>
          <span class="text-fg-muted flex-1 truncate text-xs" aria-live="polite">{{ previewNote }}</span>
          <a v-if="preview?.url" :href="preview.url" target="_blank" rel="noopener" class="apex-ring text-accent-ink hidden rounded text-xs font-semibold sm:inline">
            Open in a new tab<span class="sr-only"> (opens in a new tab)</span>
          </a>
          <div class="border-line-subtle bg-card flex gap-1 rounded-full border p-[3px]" role="group" aria-label="Preview size">
            <button
              v-for="d in [{ key: 'desktop', label: 'Desktop', icon: 'lucide:monitor' }, { key: 'mobile', label: 'Mobile', icon: 'lucide:smartphone' }] as const" :key="d.key"
              type="button" :aria-label="d.label" :title="d.label" :aria-pressed="device === d.key"
              class="apex-ring inline-flex h-7 items-center rounded-full px-2.5"
              :class="device === d.key ? 'bg-accent text-white' : 'text-fg-heading hover:bg-hover'"
              @click="device = d.key"
            >
              <Icon :name="d.icon" class="size-[15px]" />
            </button>
          </div>
        </div>
        <div ref="pane" class="flex h-[70vh] min-h-0 flex-1 items-start justify-center overflow-hidden p-4 xl:h-auto">
          <p v-if="previewError" class="text-fg-muted max-w-[42ch] pt-10 text-center text-[13.5px]" role="alert">
            The preview could not be made: {{ previewError }}
          </p>
          <p v-else-if="preview && !preview.url" class="text-fg-muted max-w-[42ch] pt-10 text-center text-[13.5px]">
            The public site's address is not configured (NUXT_WEBSITE_PUBLIC_URL), so the draft cannot be shown here.
          </p>
          <div v-else-if="preview?.url" class="border-line-subtle relative shrink-0 overflow-hidden border bg-white shadow-[0_20px_48px_rgba(17,31,34,.18)]" :class="device === 'desktop' ? 'rounded-[10px]' : 'rounded-[28px]'" :style="frame.outer">
            <iframe
              :key="frameKey" :src="preview.url" :title="`Preview of ${title}`" sandbox="allow-scripts allow-same-origin"
              class="origin-top-left border-0" :style="frame.inner"
              @load="frameLoading = false"
            />
            <div v-if="frameLoading" class="text-fg-muted absolute inset-0 flex items-start justify-center bg-white pt-10 text-[13px]">
              Loading the preview…
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
