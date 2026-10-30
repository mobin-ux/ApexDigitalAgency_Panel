<script setup lang="ts">
/**
 * Website — SEO and redirects (ADR-021 §SEO). Two things a publisher owns:
 * the redirects the site answers before routing (old address → new, 301 or
 * 302, with live validation that refuses a loop and flattens a chain), and
 * an audit of the published pages — missing or long titles and
 * descriptions, duplicate titles, off-site canonicals, pages hidden from
 * search, redirect chains, links to addresses nothing serves, images with
 * no alt text. The audit is advice, not a gate: Google's limits, read from
 * what is published right now.
 *
 * `website.view` may look; `website.seo` may change.
 */
definePageMeta({
  title: 'Website SEO',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()
const { can } = useStaffAccess()
const allowed = computed(() => can('website.view'))
const canEdit = computed(() => can('website.seo'))

interface Redirect {
  id: string
  fromPath: string
  toPath: string
  statusCode: number
  enabled: boolean
  note: string | null
  updatedAt: string
}
interface Issue {
  severity: 'error' | 'warning' | 'info'
  kind: string
  message: string
  documentId?: string
  documentTitle?: string
  key?: string
  redirectId?: string
}

const { data: redirects, pending, refresh, error } = await useFetch<{ items: Redirect[] }>('/api/admin/website/redirects', { immediate: allowed.value })
const { data: audit, pending: auditPending, refresh: refreshAudit } = await useFetch<{ issues: Issue[], checked: { documents: number, redirects: number } }>('/api/admin/website/seo-audit', { immediate: canEdit.value })

/* ------------------------------------------------------------ redirect form */
const editing = ref<Redirect | null>(null)
const formOpen = ref(false)
const form = reactive({ fromPath: '', toPath: '', statusCode: 301 as 301 | 302, enabled: true, note: '' })
const saving = ref(false)
const check = ref<{ warnings: string[], error: string } | null>(null)
const fieldErrors = ref<Record<string, string>>({})

function openNew() {
  editing.value = null
  Object.assign(form, { fromPath: '', toPath: '', statusCode: 301, enabled: true, note: '' })
  check.value = null
  fieldErrors.value = {}
  formOpen.value = true
}
function openEdit(row: Redirect) {
  editing.value = row
  Object.assign(form, { fromPath: row.fromPath, toPath: row.toPath, statusCode: row.statusCode === 302 ? 302 : 301, enabled: row.enabled, note: row.note ?? '' })
  check.value = null
  fieldErrors.value = {}
  formOpen.value = true
}
function closeForm() {
  formOpen.value = false
}

/** What saving would do, asked of the server as the two addresses are typed. */
watchDebounced([() => form.fromPath, () => form.toPath], async ([from, to]) => {
  fieldErrors.value = {}
  if (!from.trim() || !to.trim()) {
    check.value = null
    return
  }
  try {
    const result = await $fetch<{ warnings: string[] }>('/api/admin/website/redirects/check', { method: 'POST', body: { fromPath: from, toPath: to, ...(editing.value ? { id: editing.value.id } : {}) } })
    check.value = { warnings: result.warnings, error: '' }
  }
  catch (e: any) {
    const errors = e?.data?.data?.fieldErrors as Record<string, string[]> | undefined
    if (errors) {
      fieldErrors.value = Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0] ?? '']))
      check.value = null
    }
    else {
      check.value = { warnings: [], error: errorMessage(e) }
    }
  }
}, { debounce: 350 })

async function save() {
  saving.value = true
  try {
    const body = { fromPath: form.fromPath, toPath: form.toPath, statusCode: form.statusCode, enabled: form.enabled, note: form.note || null }
    const result = editing.value
      ? await $fetch<{ warnings: string[] }>(`/api/admin/website/redirects/${editing.value.id}`, { method: 'PATCH', body })
      : await $fetch<{ warnings: string[] }>('/api/admin/website/redirects', { method: 'POST', body })
    toaster.add({ title: editing.value ? 'Redirect updated' : 'Redirect added', description: result.warnings[0], icon: 'lucide:check', progress: true })
    formOpen.value = false
    await Promise.all([refresh(), refreshAudit()])
  }
  catch (e: any) {
    const errors = e?.data?.data?.fieldErrors as Record<string, string[]> | undefined
    if (errors) {
      fieldErrors.value = Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0] ?? '']))
    }
    toaster.add({ title: 'Not saved', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    saving.value = false
  }
}

async function toggle(row: Redirect) {
  try {
    await $fetch(`/api/admin/website/redirects/${row.id}`, { method: 'PATCH', body: { enabled: !row.enabled } })
    await Promise.all([refresh(), refreshAudit()])
  }
  catch (e) {
    toaster.add({ title: 'Not changed', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
}

const confirmingDelete = ref<string | null>(null)
async function remove(row: Redirect) {
  try {
    await $fetch(`/api/admin/website/redirects/${row.id}`, { method: 'DELETE' })
    confirmingDelete.value = null
    toaster.add({ title: 'Redirect removed', description: `${row.fromPath} answers as a normal address again.`, icon: 'lucide:check', progress: true })
    await Promise.all([refresh(), refreshAudit()])
  }
  catch (e) {
    toaster.add({ title: 'Not removed', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
}

/* ------------------------------------------------------------ audit */
const SEVERITY: Record<Issue['severity'], { label: string, cls: string }> = {
  error: { label: 'Fix', cls: 'bg-[#EC6453]/15 text-[#EC6453]' },
  warning: { label: 'Check', cls: 'bg-[#F2C14E]/15 text-[#D9A521] dark:text-[#F2C14E]' },
  info: { label: 'Note', cls: 'bg-primary-500/10 text-primary-600 dark:text-primary-400' },
}
const counts = computed(() => {
  const out = { error: 0, warning: 0, info: 0 }
  for (const i of audit.value?.issues ?? []) {
    out[i.severity] += 1
  }
  return out
})

function fmtDate(iso: string | Date | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}

const CARD = 'border-muted-200 bg-white dark:border-muted-800 dark:bg-muted-900 rounded-2xl border'
const INPUT = 'focus:border-primary-400 w-full rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-2.5 text-sm text-muted-900 outline-none placeholder:text-muted-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500'
const LABEL = 'text-muted-900 mb-1.5 block text-[13.5px] font-semibold dark:text-white'
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1180px] px-4 pt-5 sm:px-8 sm:pt-7 flex-col gap-8 pb-10">
    <AdminPageHeader
      title="SEO and redirects"
      subtitle="Old addresses that should send visitors somewhere else, and what search engines will see on the published pages."
    >
      <template v-if="allowed && canEdit">
        <BaseButton variant="primary" rounded="full" @click="openNew">
          <Icon name="lucide:plus" class="size-4" />
          Add redirect
        </BaseButton>
      </template>
    </AdminPageHeader>

    <AdminAccessWall
      v-if="!allowed"
      permission="website.view"
      title="Website content is not part of your role"
      body="Redirects and the SEO audit are part of the website module."
    />

    <AdminWebsiteLoadError v-else-if="error" :error="error" title="Could not load the redirects" @retry="refresh()" />

    <template v-else>
      <!-- ========== Redirects ========== -->
      <section :class="CARD" aria-labelledby="redirects-heading">
        <div class="border-muted-200 flex flex-col gap-1 border-b px-6 py-5 dark:border-white/5">
          <h2 id="redirects-heading" class="text-muted-900 font-heading text-lg font-extrabold tracking-[-0.02em] dark:text-white">
            Redirects
          </h2>
          <p class="text-muted-500 text-[12.5px]">
            Answered before any page, on the site's next request. A moved page gets one of these automatically; add your own for an old campaign address or a printed URL.
          </p>
        </div>

        <div v-if="formOpen" class="border-muted-200 bg-muted-50 border-b px-6 py-5 dark:border-white/5 dark:bg-white/[0.03]">
          <form class="grid gap-4 md:grid-cols-2" @submit.prevent="save">
            <div>
              <label :class="LABEL" for="rd-from">Old address</label>
              <input id="rd-from" v-model="form.fromPath" :class="INPUT" placeholder="/old-page" autocomplete="off" :aria-invalid="Boolean(fieldErrors.fromPath)" :aria-describedby="fieldErrors.fromPath ? 'rd-from-err' : undefined">
              <p v-if="fieldErrors.fromPath" id="rd-from-err" class="mt-1 text-[12px] text-[#EC6453]">
                {{ fieldErrors.fromPath }}
              </p>
              <p v-else class="text-muted-500 mt-1 text-[12px]">
                A path on this site, lower case, no query string.
              </p>
            </div>
            <div>
              <label :class="LABEL" for="rd-to">New address</label>
              <input id="rd-to" v-model="form.toPath" :class="INPUT" placeholder="/services/website-design or https://…" autocomplete="off" :aria-invalid="Boolean(fieldErrors.toPath)" :aria-describedby="fieldErrors.toPath ? 'rd-to-err' : undefined">
              <p v-if="fieldErrors.toPath" id="rd-to-err" class="mt-1 text-[12px] text-[#EC6453]">
                {{ fieldErrors.toPath }}
              </p>
              <p v-else class="text-muted-500 mt-1 text-[12px]">
                A path on this site or a full https:// address.
              </p>
            </div>
            <div>
              <span :class="LABEL">Kind</span>
              <div class="flex gap-2" role="group" aria-label="Redirect kind">
                <button
                  v-for="code in [301, 302] as const" :key="code" type="button"
                  class="rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition"
                  :class="form.statusCode === code ? 'border-primary-500 bg-primary-500/10 text-muted-900 dark:text-white' : 'border-muted-200 text-muted-500 hover:text-muted-900 dark:border-white/10 dark:hover:text-white'"
                  :aria-pressed="form.statusCode === code"
                  @click="form.statusCode = code"
                >
                  {{ code === 301 ? '301 · Permanent' : '302 · Temporary' }}
                </button>
              </div>
              <p class="text-muted-500 mt-1 text-[12px]">
                Permanent passes the old address's search ranking on. Temporary keeps it where it is.
              </p>
            </div>
            <div>
              <label :class="LABEL" for="rd-note">Note (optional)</label>
              <input id="rd-note" v-model="form.note" :class="INPUT" placeholder="Why this exists" maxlength="200">
            </div>
            <div v-if="check" class="md:col-span-2" aria-live="polite">
              <p v-if="check.error" class="text-[12.5px] text-[#EC6453]">
                {{ check.error }}
              </p>
              <p v-for="w in check.warnings" :key="w" class="flex items-start gap-2 text-[12.5px] text-[#D9A521] dark:text-[#F2C14E]">
                <Icon name="lucide:info" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>{{ w }}</span>
              </p>
              <p v-if="!check.error && !check.warnings.length" class="flex items-center gap-2 text-[12.5px] text-[#137050] dark:text-[#2BC48D]">
                <Icon name="lucide:check" class="size-3.5" aria-hidden="true" />
                No loop, no chain, nothing in the way.
              </p>
            </div>
            <div class="flex items-center gap-3 md:col-span-2">
              <BaseButton type="submit" variant="primary" rounded="lg" size="sm" :loading="saving" :disabled="saving || !form.fromPath.trim() || !form.toPath.trim() || Boolean(check?.error)">
                {{ editing ? 'Save changes' : 'Add redirect' }}
              </BaseButton>
              <BaseButton type="button" variant="muted" rounded="lg" size="sm" @click="closeForm">
                Cancel
              </BaseButton>
              <label v-if="editing" class="text-muted-500 ms-auto flex items-center gap-2 text-[12.5px]">
                <input v-model="form.enabled" type="checkbox" class="accent-primary-500 size-4">
                Enabled
              </label>
            </div>
          </form>
        </div>

        <AdminEmptyState v-if="!pending && !redirects?.items.length" icon="lucide:corner-down-right" title="No redirects" :subtitle="canEdit ? 'Add one when an address changes or an old link is still in circulation.' : 'Nothing has been redirected yet.'" />
        <div v-else class="divide-muted-200 flex flex-col divide-y dark:divide-white/5">
          <div v-for="row in redirects?.items ?? []" :key="row.id" class="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center">
            <div class="min-w-0 flex-1">
              <p class="text-muted-900 flex flex-wrap items-center gap-x-2 text-sm font-semibold dark:text-white">
                <code class="font-mono text-[13px]">{{ row.fromPath }}</code>
                <Icon name="lucide:arrow-right" class="text-muted-400 size-3.5" aria-hidden="true" />
                <code class="font-mono text-[13px] break-all">{{ row.toPath }}</code>
              </p>
              <p class="text-muted-500 mt-0.5 text-[12px]">
                {{ row.statusCode === 302 ? 'Temporary' : 'Permanent' }}<template v-if="row.note">
                  · {{ row.note }}
                </template> · changed {{ fmtDate(row.updatedAt) }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <span class="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" :class="row.enabled ? 'bg-[#22B07D]/15 text-[#137050] dark:text-[#2BC48D]' : 'bg-muted-500/15 text-muted-500'">
                {{ row.enabled ? 'On' : 'Off' }}
              </span>
              <template v-if="canEdit">
                <BaseButton size="sm" rounded="lg" variant="muted" @click="toggle(row)">
                  {{ row.enabled ? 'Turn off' : 'Turn on' }}
                </BaseButton>
                <BaseButton size="sm" rounded="lg" variant="muted" @click="openEdit(row)">
                  Edit
                </BaseButton>
                <template v-if="confirmingDelete === row.id">
                  <BaseButton size="sm" rounded="lg" variant="primary" class="bg-[#EC6453]! border-[#EC6453]!" @click="remove(row)">
                    Confirm remove
                  </BaseButton>
                  <BaseButton size="sm" rounded="lg" variant="muted" @click="confirmingDelete = null">
                    Keep
                  </BaseButton>
                </template>
                <BaseButton v-else size="sm" rounded="lg" variant="muted" class="text-[#EC6453]!" @click="confirmingDelete = row.id">
                  Remove
                </BaseButton>
              </template>
            </div>
          </div>
        </div>
      </section>

      <!-- ========== SEO audit ========== -->
      <section v-if="canEdit" :class="CARD" aria-labelledby="audit-heading">
        <div class="border-muted-200 flex flex-col gap-3 border-b px-6 py-5 sm:flex-row sm:items-center dark:border-white/5">
          <div class="min-w-0 flex-1">
            <h2 id="audit-heading" class="text-muted-900 font-heading text-lg font-extrabold tracking-[-0.02em] dark:text-white">
              SEO audit
            </h2>
            <p class="text-muted-500 text-[12.5px]">
              <template v-if="audit">
                {{ audit.checked.documents }} published page{{ audit.checked.documents === 1 ? '' : 's' }} and {{ audit.checked.redirects }} redirect{{ audit.checked.redirects === 1 ? '' : 's' }} checked against what Google documents. Advice, not a gate.
              </template>
              <template v-else>
                Checking the published pages…
              </template>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span v-for="(meta, sev) in SEVERITY" :key="sev" class="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" :class="meta.cls">
              {{ counts[sev] }} {{ meta.label.toLowerCase() }}
            </span>
            <BaseButton size="sm" rounded="lg" variant="muted" :loading="auditPending" @click="refreshAudit()">
              Re-run
            </BaseButton>
          </div>
        </div>
        <AdminEmptyState v-if="audit && !audit.issues.length" icon="lucide:badge-check" title="Nothing to report" subtitle="Every published page has a title and a description within Google's limits, no two share a title, and every redirect lands in one hop." />
        <ul v-else-if="audit" class="divide-muted-200 flex flex-col divide-y dark:divide-white/5">
          <li v-for="(issue, i) in audit.issues" :key="i" class="flex items-start gap-3 px-6 py-3.5">
            <span class="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="SEVERITY[issue.severity].cls">{{ SEVERITY[issue.severity].label }}</span>
            <div class="min-w-0 flex-1">
              <p class="text-muted-900 text-[13.5px] dark:text-white">
                {{ issue.message }}
              </p>
              <p v-if="issue.documentId || issue.key" class="text-muted-500 mt-0.5 text-[12px]">
                <NuxtLink v-if="issue.documentId" :to="`/admin/website/pages/${issue.documentId}`" class="text-primary-500 hover:underline">
                  {{ issue.documentTitle }} · {{ issue.key }}
                </NuxtLink>
                <code v-else class="font-mono">{{ issue.key }}</code>
              </p>
            </div>
          </li>
        </ul>
      </section>
      <p v-else class="text-muted-500 text-[12.5px]">
        The SEO audit is shown to roles that hold <code>website.seo</code> (Owner, Admin and Publisher).
      </p>
    </template>
  </div>
</template>
