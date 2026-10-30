<script setup lang="ts">
import type { DisplayStatus, FieldMap, TemplateKey, WorkflowAction } from '~~/shared/cms'
import { ACTION_LABEL, ACTION_PERMISSION, TEMPLATES } from '~~/shared/cms'
import { diffDocuments } from '~/utils/cmsEditor'

/**
 * Website — document editor (ADR-021).
 *
 * One screen for every template: the form is generated from the template's
 * field map, so what can be edited here is exactly what the server will
 * accept. Four tabs — Content, SEO, Revisions, Settings — and one action
 * row whose buttons come from the shared workflow (`availableActions`),
 * filtered by the signed-in role's permissions, so a button that would 403
 * is never drawn.
 *
 * Saving is optimistic: the save names the version it edited, and a 409
 * means someone else saved first; the screen says who and offers a reload
 * rather than silently overwriting their work. Leaving with unsaved changes
 * asks first.
 */
definePageMeta({
  title: 'Edit page',
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const toaster = useNuiToasts()
const { can } = useStaffAccess()
const allowed = computed(() => can('website.view'))
const canEdit = computed(() => can('website.edit'))
const id = String(route.params.id)

const { data: doc, pending, refresh, error } = await useFetch<any>(`/api/admin/website/documents/${id}`, { immediate: allowed.value })

// Admin console: the breadcrumb names the document, and the back arrow
// returns to the list it belongs to (articles and case studies have their own).
useAdminCrumb(() => doc.value?.title ?? null, doc.value?.template === 'article' ? '/admin/website/insights' : doc.value?.template === 'case-study' ? '/admin/website/case-studies' : '/admin/website/pages')

const template = computed<TemplateKey | null>(() => (doc.value?.template && doc.value.template in TEMPLATES ? doc.value.template : null))
const def = computed(() => (template.value ? TEMPLATES[template.value] : null))
const contentFields = computed<FieldMap>(() => {
  if (!def.value) {
    return {}
  }
  const { seo: _seo, ...rest } = def.value.fields as FieldMap
  return rest
})
const seoFields = computed<FieldMap>(() => {
  const out: FieldMap = {}
  const seo = def.value ? (def.value.fields as FieldMap).seo : undefined
  if (seo) {
    out.seo = seo
  }
  return out
})

/* ------------------------------------------------------------ working copy */
const draft = ref<Record<string, unknown>>({})
const title = ref('')
const savedSnapshot = ref('')
const fieldErrors = ref<Record<string, string[]>>({})

function adopt() {
  draft.value = structuredClone(toRaw(doc.value?.draft ?? {}))
  title.value = doc.value?.title ?? ''
  savedSnapshot.value = JSON.stringify({ title: title.value, draft: draft.value })
  fieldErrors.value = {}
}
watch(doc, adopt, { immediate: true })

const dirty = computed(() => JSON.stringify({ title: title.value, draft: draft.value }) !== savedSnapshot.value)

const tab = ref<'content' | 'seo' | 'revisions' | 'settings'>('content')
const tabs = computed(() => [
  { id: 'content' as const, label: 'Content' },
  ...(Object.keys(seoFields.value).length ? [{ id: 'seo' as const, label: 'SEO' }] : []),
  { id: 'revisions' as const, label: `Revisions${doc.value ? ` (${doc.value.revisions.length})` : ''}` },
  { id: 'settings' as const, label: 'Settings' },
])

/* ------------------------------------------------------------ save */
const saving = ref(false)
const conflict = ref<{ by: string, at: string } | null>(null)

async function save() {
  if (!doc.value || !dirty.value) {
    return
  }
  saving.value = true
  fieldErrors.value = {}
  try {
    doc.value = await $fetch<any>(`/api/admin/website/documents/${id}`, {
      method: 'PUT',
      body: { version: doc.value.draftVersion, content: draft.value, title: title.value.trim() },
    })
    conflict.value = null
    toaster.add({ title: 'Draft saved', description: 'Nothing changes on the site until it is published.', icon: 'lucide:check', progress: true })
  }
  catch (e: any) {
    if (e?.statusCode === 400 && e?.data?.data?.fieldErrors) {
      fieldErrors.value = e.data.data.fieldErrors
      const first = Object.keys(fieldErrors.value)[0]
      toaster.add({ title: 'Not saved', description: `Some fields need another look${first ? ` (${first})` : ''}.`, icon: 'lucide:circle-alert', progress: true })
      tab.value = first?.startsWith('seo') ? 'seo' : 'content'
    }
    else if (e?.statusCode === 409 && e?.data?.data?.currentVersion) {
      const by = doc.value?.people?.[e.data.data.updatedById] ?? 'someone else'
      conflict.value = { by, at: fmtDate(e.data.data.updatedAt) }
    }
    else {
      toaster.add({ title: 'Not saved', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
    }
  }
  finally {
    saving.value = false
  }
}

async function reloadAfterConflict() {
  conflict.value = null
  await refresh()
}

/* ------------------------------------------------------------ workflow */
const actions = computed<WorkflowAction[]>(() => (doc.value?.actions ?? []).filter((a: WorkflowAction) => can(ACTION_PERMISSION[a]) && a !== 'delete'))
const confirming = ref<WorkflowAction | null>(null)
const scheduleAt = ref('')
const acting = ref(false)

const CONFIRM_COPY: Partial<Record<WorkflowAction, { title: string, body: string, button: string }>> = {
  publish: { title: 'Publish this draft?', body: 'The site shows it on the next request. The previous version stays in the history.', button: 'Publish now' },
  unpublish: { title: 'Take this off the site?', body: 'A page answers 404 until it is published again; a core page falls back to the words in the site code.', button: 'Unpublish' },
  archive: { title: 'Archive this document?', body: 'It leaves the site and the list, and can be restored later.', button: 'Archive' },
  schedule: { title: 'Schedule the publish', body: 'The current draft is published at the time you choose (UK time). Later edits do not change what is scheduled unless you schedule again.', button: 'Schedule' },
}

function needsConfirm(action: WorkflowAction) {
  return action in CONFIRM_COPY
}

async function run(action: WorkflowAction) {
  if (dirty.value) {
    toaster.add({ title: 'Save first', description: 'Your unsaved changes are not part of what would be published.', icon: 'lucide:circle-alert', progress: true })
    return
  }
  if (needsConfirm(action) && confirming.value !== action) {
    confirming.value = action
    return
  }
  acting.value = true
  try {
    const body: Record<string, unknown> = { action }
    if (action === 'schedule') {
      body.scheduledFor = new Date(scheduleAt.value).toISOString()
    }
    const result = await $fetch<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', body })
    doc.value = result
    confirming.value = null
    toaster.add({
      title: ACTION_LABEL[action],
      description: action === 'publish'
        ? (result.revalidated === false ? 'Published. The site could not be told yet; it refreshes within a minute.' : 'Published. The site shows it on the next request.')
        : `Now ${statusLabel(result.state)}.`,
      icon: 'lucide:check',
      progress: true,
    })
  }
  catch (e) {
    toaster.add({ title: 'Not done', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    acting.value = false
  }
}

async function deleteDraft() {
  acting.value = true
  try {
    await $fetch(`/api/admin/website/documents/${id}`, { method: 'DELETE' })
    toaster.add({ title: 'Draft deleted', icon: 'lucide:check', progress: true })
    await navigateTo('/admin/website/pages')
  }
  catch (e) {
    toaster.add({ title: 'Not deleted', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    acting.value = false
    confirming.value = null
  }
}

/* ------------------------------------------------------------ preview */
const previewing = ref(false)
async function preview() {
  previewing.value = true
  try {
    const link = await $fetch<{ url: string | null, siteConfigured: boolean }>(`/api/admin/website/documents/${id}/preview-link`, { method: 'POST', body: {} })
    if (!link.url) {
      toaster.add({ title: 'No site attached', description: 'Previews need the site URL configured on the server (NUXT_WEBSITE_SITE_URL).', icon: 'lucide:circle-alert', progress: true })
      return
    }
    window.open(link.url, '_blank', 'noopener')
  }
  catch (e) {
    toaster.add({ title: 'No preview', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    previewing.value = false
  }
}

/* ------------------------------------------------------------ revisions */
const selectedRevision = ref<number | null>(null)
const revisionContent = ref<unknown>(null)
const loadingRevision = ref(false)
async function openRevision(number: number) {
  selectedRevision.value = number
  loadingRevision.value = true
  try {
    const rev = await $fetch<any>(`/api/admin/website/documents/${id}/revisions/${number}`)
    revisionContent.value = rev.content
  }
  catch (e) {
    toaster.add({ title: 'Could not load the revision', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    loadingRevision.value = false
  }
}
const revisionDiff = computed(() => (revisionContent.value ? diffDocuments(revisionContent.value, draft.value) : []))

async function restore(number: number) {
  acting.value = true
  try {
    doc.value = await $fetch<any>(`/api/admin/website/documents/${id}/revisions/${number}/restore`, { method: 'POST', body: {} })
    selectedRevision.value = null
    revisionContent.value = null
    tab.value = 'content'
    toaster.add({ title: `Revision ${number} restored`, description: 'It is the working draft now, as a new revision. Publish to put it on the site.', icon: 'lucide:check', progress: true })
  }
  catch (e) {
    toaster.add({ title: 'Not restored', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    acting.value = false
  }
}

/* ------------------------------------------------------------ guards and helpers */
// Leaving with unsaved changes asks in the panel's own dialog (no native confirm).
const pendingLeave = ref<string | null>(null)
const leaveConfirmed = ref(false)
// The dialogs are reka-based (focus trap, Escape, focus return); their open state is derived from the intent that opened them.
const leaveOpen = computed({
  get: () => pendingLeave.value !== null,
  set: (v: boolean) => {
    if (!v) {
      pendingLeave.value = null
    }
  },
})
const confirmOpen = computed({
  get: () => confirming.value !== null,
  set: (v: boolean) => {
    if (!v) {
      confirming.value = null
    }
  },
})
onBeforeRouteLeave((to) => {
  if (dirty.value && !leaveConfirmed.value) {
    pendingLeave.value = to.fullPath
    return false
  }
})
function leaveAnyway() {
  leaveConfirmed.value = true
  const target = pendingLeave.value
  pendingLeave.value = null
  if (target) {
    navigateTo(target)
  }
}
function beforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault()
  }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))

function fmtDate(iso: string | Date | null | undefined) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}
function statusLabel(state: DisplayStatus) {
  return ({ draft: 'a draft', in_review: 'in review', approved: 'approved', scheduled: 'scheduled', published: 'published', published_changes: 'published with draft changes', archived: 'archived' })[state]
}
const minSchedule = computed(() => new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16))

const CARD = 'bg-card border-line-subtle rounded-2xl border'
const INPUT = 'focus:border-primary-400 w-full rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-2.5 text-sm text-muted-900 outline-none placeholder:text-muted-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500'
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1180px] px-4 pt-5 sm:px-8 sm:pt-7 flex-col gap-6 pb-10">
    <AdminAccessWall
      v-if="!allowed"
      permission="website.view"
      title="Website content is not part of your role"
      body="The editor shows a document's words, history and state."
    />

    <AdminEmptyState v-else-if="error" icon="lucide:file-x" title="Document not found" subtitle="It may have been deleted. The pages list shows what exists." />

    <template v-else-if="doc">
      <!-- ========== HEADER (the design's editor bar) ========== -->
      <div class="bg-card border-line-subtle flex flex-col gap-3 rounded-2xl border px-[18px] py-3.5 sm:px-6">
        <div class="flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1 basis-[280px]">
            <div class="flex flex-wrap items-center gap-2.5">
              <label for="doc-title" class="sr-only">Document name</label>
              <input
                id="doc-title"
                v-model="title"
                :readonly="!canEdit"
                maxlength="120"
                class="apex-ring font-heading text-fg-heading min-w-0 flex-1 rounded-lg border-0 bg-transparent text-[19px] font-extrabold tracking-[-0.015em] outline-none"
              >
              <AdminWebsiteStatusChip :state="doc.state" :error="doc.lastPublishError" />
            </div>
            <p class="text-fg-muted mt-[3px] flex flex-wrap gap-x-2 text-[12.5px]">
              <span>{{ def?.label }}<template v-if="doc.kind === 'page'"> · apexdigi.co.uk{{ doc.key }}</template></span>
              <span>· {{ dirty ? 'Unsaved changes' : `Draft v${doc.draftVersion}, saved` }} <ClientOnly>{{ dirty ? '' : fmtDate(doc.draftUpdatedAt) }}</ClientOnly><template v-if="!dirty && doc.people?.[doc.draftUpdatedById]"> by {{ doc.people[doc.draftUpdatedById] }}</template></span>
              <span v-if="doc.scheduled">· Scheduled for <ClientOnly>{{ fmtDate(doc.scheduled.scheduledFor) }}</ClientOnly> (revision {{ doc.scheduled.number }})</span>
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <AdminButton :disabled="previewing" @click="preview">
              <Icon name="lucide:eye" class="size-[15px]" />Preview draft
            </AdminButton>
            <AdminButton v-if="canEdit" :variant="dirty ? 'primary' : 'light'" :disabled="saving || !dirty || doc.state === 'archived'" @click="save">
              {{ dirty ? 'Save draft' : 'Saved' }}
            </AdminButton>
          </div>
        </div>
        <div v-if="actions.length" class="border-line-soft flex flex-wrap items-center gap-2 border-t pt-3">
          <span class="text-fg-muted text-[11.5px] font-bold uppercase tracking-[0.06em]">Workflow</span>
          <AdminButton
            v-for="action in actions" :key="action"
            size="sm" :variant="action === 'publish' ? 'primary' : 'light'"
            :disabled="acting || dirty"
            :title="dirty ? 'Save your changes first' : undefined"
            @click="run(action)"
          >
            {{ ACTION_LABEL[action] }}
          </AdminButton>
          <span v-if="dirty" class="text-fg-muted text-[12.5px]">Save first: unsaved changes are not part of a publish.</span>
        </div>
      </div>

      <!-- The design's banner row: one state at a time, toned by what it asks of the reader. -->
      <div v-if="conflict" class="bg-st-warning-bg text-fg-heading flex flex-col gap-2 rounded-xl px-4 py-3 text-[13.5px] sm:flex-row sm:items-center" role="alert">
        <Icon name="lucide:git-merge" class="size-4 shrink-0" />
        <span class="flex-1">{{ conflict.by }} saved a newer draft at {{ conflict.at }}. Reload to see it; your changes stay in this screen until you leave.</span>
        <AdminButton size="sm" @click="reloadAfterConflict">
          Reload the latest draft
        </AdminButton>
      </div>
      <p v-if="doc.lastPublishError" class="bg-st-danger-bg text-fg-heading flex gap-2.5 rounded-xl px-4 py-3 text-[13.5px]" role="alert">
        <Icon name="lucide:circle-x" class="mt-0.5 size-4 shrink-0 text-st-danger-fg" />
        The last scheduled publish failed: {{ doc.lastPublishError }} ({{ doc.publishAttempts }} attempt{{ doc.publishAttempts === 1 ? '' : 's' }}). It is retried every minute.
      </p>
      <p v-else-if="doc.state === 'in_review'" class="bg-st-warning-bg text-fg-heading flex gap-2.5 rounded-xl px-4 py-3 text-[13.5px] leading-normal">
        <Icon name="lucide:clipboard-check" class="mt-0.5 size-4 shrink-0" />
        {{ can('website.publish') ? 'This was submitted for review. Preview the draft, then approve and publish, or send it back.' : 'Waiting for a Publisher, Admin or Owner to review it.' }}
      </p>
      <p v-else-if="doc.state === 'published_changes'" class="bg-st-info-bg text-fg-heading flex gap-2.5 rounded-xl px-4 py-3 text-[13.5px] leading-normal">
        <Icon name="lucide:info" class="mt-0.5 size-4 shrink-0" />
        The live page is the last published revision. Your edits stay in this draft until {{ can('website.publish') ? 'you publish them.' : 'they are approved and published.' }}
      </p>
      <p v-else-if="!canEdit" class="bg-chip text-fg-heading flex gap-2.5 rounded-xl px-4 py-3 text-[13.5px]">
        <Icon name="lucide:eye" class="mt-0.5 size-4 shrink-0" />You can view this document. Drafting needs Owner, Admin, Publisher or Editor.
      </p>

      <!-- ========== TABS ========== -->
      <div role="group" aria-label="Editor sections" class="border-line-subtle flex gap-6 overflow-x-auto border-b">
        <button
          v-for="t in tabs" :key="t.id" type="button"
          class="apex-ring -mb-px inline-flex h-10 shrink-0 cursor-pointer items-center border-b-2 text-sm"
          :class="tab === t.id ? 'border-accent text-fg-heading font-semibold' : 'text-fg-muted border-transparent font-medium'"
          :aria-pressed="tab === t.id"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- ========== CONTENT ========== -->
      <div v-show="tab === 'content'" :class="CARD" class="p-6">
        <fieldset :disabled="!canEdit || doc.state === 'archived'" class="min-w-0">
          <AdminWebsiteFields :fields="contentFields" :model="draft" :errors="fieldErrors" />
        </fieldset>
        <p v-if="!canEdit" class="text-muted-500 mt-4 text-[12.5px]">
          Your role can read this document but not change it.
        </p>
      </div>

      <!-- ========== SEO ========== -->
      <div v-show="tab === 'seo'" class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div :class="CARD" class="p-6">
          <fieldset :disabled="!canEdit || doc.state === 'archived'" class="min-w-0">
            <AdminWebsiteFields :fields="seoFields" :model="draft" :errors="fieldErrors" />
          </fieldset>
        </div>
        <aside :class="CARD" class="h-fit p-5">
          <ApexSectionLabel>Search preview</ApexSectionLabel>
          <div class="mt-3 rounded-xl bg-white p-4 text-[13px] text-[#202124] dark:bg-white">
            <p class="truncate text-[#1a0dab] text-[16px] leading-tight">
              {{ (draft.seo as any)?.title || title || 'Page title' }}
            </p>
            <p class="mt-1 text-[12px] text-[#006621]">
              apexdigi.co.uk{{ doc.kind === 'page' ? doc.key : '' }}
            </p>
            <p class="mt-1 line-clamp-2 text-[#4d5156]">
              {{ (draft.seo as any)?.description || 'The description shows here. Empty uses the site default.' }}
            </p>
          </div>
          <p class="text-muted-500 mt-3 text-xs">
            Google shows about 60 characters of a title and 155 of a description, and may rewrite either.
          </p>
        </aside>
      </div>

      <!-- ========== REVISIONS ========== -->
      <div v-show="tab === 'revisions'" class="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div :class="CARD" class="overflow-hidden">
          <ol class="divide-muted-200 flex flex-col divide-y dark:divide-white/5">
            <li v-for="rev in doc.revisions" :key="rev.id">
              <button type="button" class="apex-focus hover:bg-muted-50 flex w-full flex-col gap-0.5 px-4 py-3 text-start dark:hover:bg-white/[0.03]" :class="selectedRevision === rev.number ? 'bg-accent-tint' : ''" @click="openRevision(rev.number)">
                <span class="text-muted-900 flex items-center gap-2 text-sm font-semibold dark:text-white">
                  Revision {{ rev.number }}
                  <span v-if="doc.published?.number === rev.number" class="rounded-full bg-st-success-bg px-2 py-0.5 text-[10.5px] font-bold text-st-success-fg">Live</span>
                  <span v-else-if="rev.publishedAt" class="text-muted-500 text-[10.5px] font-bold uppercase">was live</span>
                </span>
                <span class="text-muted-500 text-xs">{{ fmtDate(rev.createdAt) }} · {{ rev.author }}</span>
                <span v-if="rev.note" class="text-muted-500 text-xs italic">{{ rev.note }}</span>
              </button>
            </li>
          </ol>
        </div>
        <div :class="CARD" class="p-6">
          <p v-if="selectedRevision === null" class="text-muted-500 text-sm">
            Choose a revision to compare it with the working draft.
          </p>
          <template v-else>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="text-muted-900 text-sm font-semibold dark:text-white">
                Revision {{ selectedRevision }} against the working draft
              </h2>
              <AdminButton v-if="canEdit && doc.state !== 'archived'" size="sm" :disabled="acting || dirty" @click="restore(selectedRevision!)">
                Restore into the draft
              </AdminButton>
            </div>
            <p v-if="loadingRevision" class="text-muted-500 mt-4 text-sm">
              Loading…
            </p>
            <p v-else-if="!revisionDiff.length" class="text-muted-500 mt-4 text-sm">
              No differences from the working draft.
            </p>
            <dl v-else class="mt-4 flex flex-col gap-3">
              <div v-for="row in revisionDiff" :key="row.path" class="border-muted-200 rounded-xl border p-3 text-[13px] dark:border-white/10">
                <dt class="text-muted-500 mb-1 font-mono text-xs">
                  {{ row.path }}
                </dt>
                <dd v-if="row.before !== null" class="text-st-danger-fg line-through decoration-[#EC6453]/60">
                  {{ row.before }}
                </dd>
                <dd v-if="row.after !== null" class="text-st-success-fg">
                  {{ row.after }}
                </dd>
              </div>
            </dl>
          </template>
        </div>
      </div>

      <!-- ========== SETTINGS ========== -->
      <div v-show="tab === 'settings'" :class="CARD" class="flex flex-col gap-5 p-6">
        <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
          <dt class="text-muted-500">
            Template
          </dt>
          <dd class="text-fg-heading">
            {{ def?.label }} <span class="text-muted-500">· {{ def?.detail }}</span>
          </dd>
          <dt class="text-muted-500">
            Address
          </dt>
          <dd class="text-muted-900 font-mono dark:text-white">
            {{ doc.key }}
          </dd>
          <dt class="text-muted-500">
            Created
          </dt>
          <dd class="text-fg-heading">
            {{ fmtDate(doc.createdAt) }}
          </dd>
          <dt class="text-muted-500">
            Published
          </dt>
          <dd class="text-fg-heading">
            {{ doc.published ? `Revision ${doc.published.number}, ${fmtDate(doc.published.publishedAt)}` : 'Not published' }}
          </dd>
        </dl>
        <div v-if="can('website.publish') && doc.actions.includes('delete')" class="border-t border-muted-200 pt-5 dark:border-white/10">
          <p class="text-muted-900 text-sm font-semibold dark:text-white">
            Delete this draft
          </p>
          <p class="text-muted-500 mt-1 text-[12.5px]">
            Only a draft that was never published can be deleted; everything else is archived so its history survives.
          </p>
          <AdminButton size="sm" class="mt-3 text-st-danger-fg!" :disabled="acting" @click="confirming = 'delete'">
            Delete draft
          </AdminButton>
        </div>
      </div>
    </template>

    <div v-else-if="pending" class="text-muted-500 text-sm">
      Loading…
    </div>

    <!-- ========== LEAVE WITH UNSAVED CHANGES ========== -->
    <AdminWebsiteDialog v-model:open="leaveOpen" title="Leave without saving?" description="Your unsaved changes to this draft will be lost.">
      <template #actions>
        <AdminButton @click="pendingLeave = null">
          Stay
        </AdminButton>
        <AdminButton variant="primary" @click="leaveAnyway">
          Leave
        </AdminButton>
      </template>
    </AdminWebsiteDialog>

    <!-- ========== CONFIRM ========== -->
    <AdminWebsiteDialog
      v-model:open="confirmOpen"
      :title="confirming === 'delete' ? 'Delete this draft?' : (confirming && CONFIRM_COPY[confirming]?.title) || ''"
      :description="confirming === 'delete' ? 'It has never been published, so nothing on the site changes. This cannot be undone.' : (confirming && CONFIRM_COPY[confirming]?.body) || ''"
    >
      <div v-if="confirming === 'schedule'">
        <label for="schedule-at" class="text-muted-900 mb-1.5 block text-[13.5px] font-semibold dark:text-white">Publish at</label>
        <input id="schedule-at" v-model="scheduleAt" type="datetime-local" :min="minSchedule" :class="INPUT">
      </div>
      <template #actions>
        <AdminButton @click="confirming = null">
          Cancel
        </AdminButton>
        <AdminButton
          variant="primary"
          :disabled="acting || (confirming === 'schedule' && !scheduleAt)"
          @click="confirming === 'delete' ? deleteDraft() : run(confirming!)"
        >
          {{ confirming === 'delete' ? 'Delete' : (confirming && CONFIRM_COPY[confirming]?.button) || 'Confirm' }}
        </AdminButton>
      </template>
    </AdminWebsiteDialog>
  </div>
</template>
