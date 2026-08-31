<script setup lang="ts">
import type { AuditKind } from '~~/shared/audit-kinds'
import { AUDIT_KIND_DEFS, AUDIT_KINDS, auditKindOf } from '~~/shared/audit-kinds'
import { isStaffRole, ROLES } from '~~/shared/permissions'

/**
 * Admin — Audit log (V2 Phase 9, `Admin - Team & Platform.dc.html` §6).
 *
 * Every action that changes access, money or a client's records. Two rules
 * from the design decide how it renders:
 *
 * - Append-only, with reasons (badge 30). Each row names the actor, the
 *   role they held *at the time*, the subject and the typed reason. There
 *   is no edit and no delete affordance here, and no endpoint behind one:
 *   an audit log you can amend is not an audit log.
 * - Absolute timestamps with the timezone (badge 31). "2 days ago" is
 *   unusable in a dispute about when access was cut or files handed over,
 *   so every row carries the full date, the time and the zone.
 */
definePageMeta({
  title: 'Audit log',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()
const { can } = useStaffAccess()
const allowed = computed(() => can('team.manage'))

const search = ref('')
const debouncedSearch = ref('')
const kind = ref<AuditKind | 'all'>('all')
const page = ref(1)

watchDebounced(search, (value) => {
  debouncedSearch.value = value.trim()
}, { debounce: 300 })

watch([debouncedSearch, kind], () => {
  page.value = 1
})

const query = computed(() => ({
  page: page.value,
  pageSize: 25,
  ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
  ...(kind.value === 'all' ? {} : { kind: kind.value }),
}))

const { data, pending } = await useFetch('/api/admin/audit', { query, immediate: allowed.value })

const rows = computed(() => data.value?.items ?? [])

/**
 * The local timezone abbreviation, resolved in `onMounted`.
 *
 * `Intl` reads the *browser's* zone, so rendering it during SSR prints the
 * server's and then corrects itself on hydration — the mismatch class this
 * project has hit twice (DemoToolbar's ⌘ hint, Phase 7 Mobile's bar title).
 * Until it resolves the rows show the date and time without the suffix,
 * which is incomplete rather than wrong.
 */
const zone = ref<string | null>(null)
onMounted(() => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZoneName: 'short' }).formatToParts(new Date())
  zone.value = parts.find(p => p.type === 'timeZoneName')?.value ?? null
})

function absoluteTime(iso: string | Date) {
  const stamp = new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(',', '')
  return zone.value ? `${stamp} ${zone.value}` : stamp
}

/**
 * A readable sentence for the row.
 *
 * Built from the action verb and whatever the metadata genuinely holds —
 * never from a template that assumes fields are there. An action with no
 * recognised shape falls back to its own dot-namespaced name, which is at
 * least honest about what was recorded.
 */
function detailOf(entry: { action: string, metadata: string | null }) {
  const meta = parseMeta(entry.metadata)
  switch (entry.action) {
    case 'admin.team.role':
      return meta?.from && meta?.to ? `Changed role from ${meta.from} to ${meta.to}` : 'Changed staff role'
    case 'admin.team.suspend':
      return 'Suspended panel access'
    case 'admin.team.restore':
      return 'Restored panel access'
    case 'admin.team.invite':
      return meta?.role ? `Invited as ${meta.role}` : 'Invited a team member'
    case 'admin.team.invite.resend':
      return 'Reissued an invitation link'
    case 'admin.team.invite.cancel':
      return 'Withdrew an invitation'
    case 'auth.invite.accept':
      return 'Accepted a staff invitation'
    case 'admin.settings.update':
      return settingsDetail(meta)
    case 'auth.login.failed':
      return 'Failed sign-in attempt'
    default:
      return humanise(entry.action)
  }
}

function settingsDetail(meta: Record<string, any> | null) {
  const changed = Array.isArray(meta?.changed) ? meta.changed : []
  if (!changed.length) {
    return 'Changed platform settings'
  }
  if (changed.length === 1) {
    return `Changed ${changed[0].key}`
  }
  return `Changed ${changed.length} platform settings`
}

/** "admin.project.update" → "Project update". */
function humanise(action: string) {
  const parts = action.split('.').filter(p => p !== 'admin')
  const words = parts.join(' ').replaceAll('-', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function parseMeta(raw: string | null): Record<string, any> | null {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  }
  catch {
    return null
  }
}

/** The record acted on: the stored subject, else the short id, else the type. */
function subjectOf(entry: { metadata: string | null, targetType: string, targetId: string | null }) {
  const meta = parseMeta(entry.metadata)
  if (typeof meta?.subject === 'string' && meta.subject) {
    return meta.subject
  }
  if (entry.targetId) {
    return `${entry.targetType} ${entry.targetId.slice(0, 8).toUpperCase()}`
  }
  return entry.targetType
}

function roleLabel(roleAtTime: string | null) {
  return isStaffRole(roleAtTime) ? ROLES[roleAtTime].label : null
}

function initials(entry: { actorName: string | null, actorEmail: string | null }) {
  const source = entry.actorName || entry.actorEmail || '?'
  return source.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('')
}

const KIND_TONE: Record<AuditKind, string> = {
  access: 'bg-[#D9A521]/16 text-[#F2C14E]',
  team: 'bg-[#6EA8FE]/14 text-[#6EA8FE]',
  money: 'bg-[#22B07D]/14 text-[#22B07D]',
  work: 'bg-primary-500/14 text-primary-400',
  config: 'bg-muted-200 text-muted-600 dark:bg-white/5 dark:text-muted-400',
}

const footer = computed(() => {
  if (!data.value) {
    return ''
  }
  const shown = rows.value.length
  const { total } = data.value
  return `Showing ${shown} of ${total} ${total === 1 ? 'entry' : 'entries'} · never edited, never deleted`
})

// ------------------------------------------------------------- CSV export

const exporting = ref(false)

/**
 * Exports the rows matching the current filter, not just the page on
 * screen — a log export that silently stops at 25 rows is worse than no
 * export. Paged through in blocks so a large trail cannot be requested as
 * one unbounded query.
 */
async function exportCsv() {
  if (exporting.value) {
    return
  }
  exporting.value = true
  try {
    const collected: any[] = []
    let current = 1
    let pageCount = 1
    do {
      const chunk = await $fetch('/api/admin/audit', {
        query: { ...query.value, page: current, pageSize: 100 },
      })
      collected.push(...chunk.items)
      pageCount = chunk.pageCount
      current += 1
    } while (current <= pageCount && current <= 50)

    const header = ['Timestamp', 'Actor', 'Email', 'Role at time', 'Kind', 'Action', 'Detail', 'Reason', 'Subject', 'IP']
    const lines = collected.map(entry => [
      new Date(entry.createdAt).toISOString(),
      entry.actorName ?? '',
      entry.actorEmail ?? '',
      roleLabel(entry.roleAtTime) ?? '',
      AUDIT_KIND_DEFS[auditKindOf(entry.action)].label,
      entry.action,
      detailOf(entry),
      entry.reason ?? '',
      subjectOf(entry),
      entry.ip ?? '',
    ])

    const csv = [header, ...lines]
      .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\r\n')

    // A literal BOM (escaped, not typed) so Excel opens the file as UTF-8.
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `apex-audit-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)

    toaster.add({ title: 'Export ready', description: `${collected.length} entries written to CSV.`, icon: 'lucide:download', progress: true })
  }
  catch (error: any) {
    toaster.add({ title: 'Export failed', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    exporting.value = false
  }
}

const FILTER_BASE = 'apex-focus inline-flex min-h-[38px] cursor-pointer items-center rounded-full border px-[15px] text-[13px] transition-colors'
const FILTER_ON = 'border-primary-500 bg-primary-500 font-bold text-white'
const FILTER_OFF = 'border-muted-200 bg-white font-semibold text-muted-700 hover:bg-muted-100 dark:border-white/10 dark:bg-muted-800 dark:text-muted-300 dark:hover:bg-white/5'
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-5 pb-10 font-sans">
    <AdminAccessWall
      v-if="!allowed"
      permission="team.manage"
      title="The audit log is restricted"
      body="The log records who changed access, money and client records, so reading it is limited to the roles that are accountable for those changes."
    />

    <template v-else>
      <AdminPageHeader
        dense
        title="Audit log"
        subtitle="Every action that changes access, money or a client's records. Read-only and append-only."
      >
        <BaseButton rounded="lg" size="lg" :loading="exporting" :disabled="exporting || !rows.length" @click="exportCsv">
          <Icon name="lucide:download" class="size-4" />
          <span>Export CSV</span>
        </BaseButton>
      </AdminPageHeader>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          :aria-pressed="kind === 'all'"
          :class="[FILTER_BASE, kind === 'all' ? FILTER_ON : FILTER_OFF]"
          @click="kind = 'all'"
        >
          All
        </button>
        <button
          v-for="key in AUDIT_KINDS"
          :key="key"
          type="button"
          :aria-pressed="kind === key"
          :class="[FILTER_BASE, kind === key ? FILTER_ON : FILTER_OFF]"
          @click="kind = key"
        >
          {{ AUDIT_KIND_DEFS[key].label }}
        </button>

        <label class="border-muted-200 focus-within:border-primary-400 dark:bg-muted-800 ms-auto flex min-w-[240px] items-center gap-2.5 rounded-xl border bg-white px-3.5 py-2 dark:border-white/10">
          <Icon name="lucide:search" class="text-muted-400 size-4 shrink-0" />
          <input
            v-model="search"
            aria-label="Search the log"
            placeholder="Search the log"
            class="text-muted-900 placeholder:text-muted-400 dark:placeholder:text-muted-500 min-w-0 flex-1 border-none bg-transparent text-[13.5px] outline-none dark:text-white"
          >
        </label>
      </div>

      <div class="border-muted-200 dark:bg-muted-800 overflow-x-auto rounded-2xl border bg-white dark:border-white/10">
        <table class="w-full min-w-[1000px] border-collapse">
          <caption class="sr-only">
            Audit entries, newest first. Timestamps are absolute and include the timezone.
          </caption>
          <thead>
            <tr class="border-muted-200 bg-muted-50 text-muted-500 border-b text-[11px] font-extrabold uppercase tracking-[0.06em] dark:border-white/10 dark:bg-white/[0.02]">
              <th scope="col" class="w-[190px] px-[18px] py-3 text-start font-extrabold">
                When
              </th>
              <th scope="col" class="w-[190px] px-3 py-3 text-start font-extrabold">
                Who
              </th>
              <th scope="col" class="w-[110px] px-3 py-3 text-start font-extrabold">
                Action
              </th>
              <th scope="col" class="px-3 py-3 text-start font-extrabold">
                Detail
              </th>
              <th scope="col" class="w-[170px] px-[18px] py-3 text-start font-extrabold">
                Subject
              </th>
            </tr>
          </thead>

          <tbody v-if="pending" aria-hidden="true">
            <tr v-for="i in 6" :key="i" class="border-muted-200 border-b last:border-b-0 dark:border-white/5">
              <td colspan="5" class="p-0">
                <div class="bg-muted-100/60 h-[62px] animate-pulse dark:bg-white/[0.02]" />
              </td>
            </tr>
          </tbody>

          <tbody v-else-if="rows.length">
            <tr
              v-for="(entry, index) in rows"
              :key="entry.id"
              :class="index < rows.length - 1 ? 'border-muted-200 border-b dark:border-white/5' : ''"
            >
              <!-- Badge 31: absolute, with the timezone. -->
              <td class="text-muted-500 px-[18px] py-3.5 align-top text-[12.5px] tabular-nums">
                {{ absoluteTime(entry.createdAt) }}
              </td>

              <td class="px-3 py-3.5 align-top">
                <div class="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    class="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#9B79F6] to-[#6C40E8] text-[10px] font-bold text-white"
                  >{{ initials(entry) }}</span>
                  <span class="min-w-0">
                    <span class="text-muted-900 block truncate text-[13px] font-semibold dark:text-white">
                      {{ entry.actorName || entry.actorEmail || 'Unknown' }}
                    </span>
                    <!--
                      The role held at the time. Absent on entries written
                      before this phase — shown as a dash rather than
                      back-filled from the account's role today, which would
                      state something the log never recorded.
                    -->
                    <span class="text-muted-500 mt-0.5 block text-[11.5px]">{{ roleLabel(entry.roleAtTime) || '—' }}</span>
                  </span>
                </div>
              </td>

              <td class="px-3 py-3.5 align-top">
                <span
                  class="inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-[5px] text-[10.5px] font-extrabold uppercase tracking-[0.04em]"
                  :class="KIND_TONE[auditKindOf(entry.action)]"
                >{{ AUDIT_KIND_DEFS[auditKindOf(entry.action)].label }}</span>
              </td>

              <td class="px-3 py-3.5 align-top">
                <span class="text-muted-900 block text-[13.5px] leading-[1.45] dark:text-white">{{ detailOf(entry) }}</span>
                <span v-if="entry.reason" class="text-muted-500 mt-1 block text-[12.5px] leading-[1.45]">
                  Reason: {{ entry.reason }}
                </span>
              </td>

              <td class="text-muted-600 dark:text-muted-300 px-[18px] py-3.5 align-top text-[13px]">
                <span class="block truncate">{{ subjectOf(entry) }}</span>
              </td>
            </tr>
          </tbody>
        </table>

        <AdminEmptyState
          v-if="!pending && !rows.length"
          icon="lucide:scroll-text"
          title="No entries match"
          subtitle="Privileged actions are recorded here automatically as they happen."
        />
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <span class="text-muted-500 text-[12.5px]">{{ footer }}</span>
        <span class="grow" />
        <AdminPager
          v-if="data"
          :page="data.page"
          :page-count="data.pageCount"
          :total="data.total"
          noun="entries"
          @update:page="page = $event"
        />
      </div>
    </template>
  </div>
</template>
