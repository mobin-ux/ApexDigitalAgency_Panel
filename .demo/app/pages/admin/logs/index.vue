<script setup lang="ts">
/**
 * System — Logs.
 *
 * The platform log (shared/log.ts) read back: what both apps wrote over the
 * last few days, with a summary on top (lines by level, the warnings and
 * errors that recur, the routes that fail) and every line below, newest
 * first, filtered by level, category, app, status, request id or text.
 * A line opens to show its whole record; a request id narrows the list to
 * everything that one request did.
 *
 * Owner only (`platform.settings`): lines carry request paths, account ids
 * and masked addresses. Nothing here can carry a password, a token or a
 * message body; the log redacts them before they are written.
 */
definePageMeta({
  title: 'Logs',
  layout: 'admin',
  middleware: 'admin',
})

interface LogLine {
  ts: string
  level: 'debug' | 'info' | 'warn' | 'error'
  app: string
  category: string
  event: string
  message: string
  outcome?: string
  requestId?: string
  actor?: { id?: string, kind: string, role?: string, staffRole?: string }
  http?: { method?: string, path?: string, status?: number }
  durationMs?: number
  error?: { name: string, message: string }
}

const { can } = useStaffAccess()
const allowed = computed(() => can('platform.settings'))
const route = useRoute()

const DAYS = [1, 3, 7] as const
const LEVELS = [
  { key: '', label: 'All' },
  { key: 'info', label: 'Info and up' },
  { key: 'warn', label: 'Warnings' },
  { key: 'error', label: 'Errors' },
] as const
const STATUSES = [
  { key: '', label: 'Any status' },
  { key: '4xx', label: '4xx' },
  { key: '5xx', label: '5xx' },
] as const
const CATEGORIES = ['http', 'auth', 'authz', 'admin', 'customer', 'content', 'db', 'payment', 'mail', 'task', 'security', 'system'] as const

const days = ref<number>(1)
const level = ref<string>(typeof route.query.level === 'string' ? route.query.level : 'info')
const status = ref<string>('')
const category = ref<string>('')
const app = ref<'all' | 'panel' | 'site'>('all')
const text = ref('')
const requestId = ref<string>(typeof route.query.requestId === 'string' ? route.query.requestId : '')
const debouncedText = refDebounced(text, 350)

const query = computed(() => ({
  days: days.value,
  app: app.value,
  limit: 200,
  ...(level.value ? { level: level.value } : {}),
  ...(status.value ? { status: status.value } : {}),
  ...(category.value ? { category: category.value } : {}),
  ...(debouncedText.value.trim() ? { q: debouncedText.value.trim() } : {}),
  ...(requestId.value ? { requestId: requestId.value } : {}),
}))

const { data, pending, error, refresh } = await useFetch('/api/admin/logs', { query, immediate: allowed.value })
const { data: summary, refresh: refreshSummary } = await useFetch('/api/admin/logs/summary', { query: computed(() => ({ days: days.value })), immediate: allowed.value })

/** Older lines appended by "Load older"; reset whenever the filters change. */
const older = ref<LogLine[]>([])
const olderMore = ref<boolean | null>(null)
const loadingOlder = ref(false)
watch(query, () => {
  older.value = []
  olderMore.value = null
})
const lines = computed<LogLine[]>(() => [...((data.value?.items ?? []) as LogLine[]), ...older.value])
const more = computed(() => olderMore.value ?? data.value?.more ?? false)

async function loadOlder() {
  const last = lines.value.at(-1)
  if (!last || loadingOlder.value) {
    return
  }
  loadingOlder.value = true
  try {
    const next = await $fetch('/api/admin/logs', { query: { ...query.value, before: last.ts } })
    older.value = [...older.value, ...(next.items as LogLine[])]
    olderMore.value = next.more
  }
  finally {
    loadingOlder.value = false
  }
}

function refreshAll() {
  refresh()
  refreshSummary()
}

function showRequest(id: string | undefined) {
  if (!id) {
    return
  }
  requestId.value = id
  level.value = ''
  status.value = ''
  category.value = ''
  text.value = ''
}

const tiles = computed(() => {
  const s = summary.value
  return [
    { label: 'Lines', value: s?.lines ?? 0, icon: 'lucide:list', accent: 'violet' as const, hint: `${s?.from ?? ''} to ${s?.to ?? ''}` },
    { label: 'Warnings', value: s?.byLevel.warn ?? 0, icon: 'lucide:alert-triangle', accent: 'amber' as const, hint: 'Refusals, slow work, recoverable failures' },
    { label: 'Errors', value: s?.byLevel.error ?? 0, icon: 'lucide:circle-alert', accent: 'coral' as const, hint: 'Server errors and failed operations' },
    { label: 'Denied', value: s?.byOutcome.denied ?? 0, icon: 'lucide:shield-x', accent: 'blue' as const, hint: 'Sign-ins and permissions refused' },
  ]
})

const LEVEL_TONE: Record<string, string> = {
  debug: 'bg-chip text-fg-muted',
  info: 'bg-st-info-bg text-st-info-fg',
  warn: 'bg-st-warning-bg text-st-warning-fg',
  error: 'bg-st-danger-bg text-st-danger-fg',
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function actorLabel(a: LogLine['actor']) {
  if (!a) {
    return ''
  }
  if (a.kind === 'anonymous') {
    return 'anonymous'
  }
  return [a.staffRole ?? a.kind, a.id ? a.id.slice(0, 8) : ''].filter(Boolean).join(' ')
}

const CARD = 'bg-card border-line-subtle rounded-2xl border'
const PILL = 'apex-focus inline-flex min-h-[38px] items-center rounded-full border px-4 text-[13px] font-semibold transition'
const INPUT = 'apex-focus bg-card border-line-subtle text-fg-heading h-10 rounded-xl border px-3 text-[14px]'
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1180px] px-4 pt-5 sm:px-8 sm:pt-7 flex-col gap-8 pb-10">
    <AdminPageHeader
      title="Logs"
      subtitle="What the console and the website recorded: requests, sign-ins, changes, tasks and failures."
    >
      <AdminButton v-if="allowed" size="lg" :disabled="pending" @click="refreshAll">
        <Icon name="lucide:refresh-cw" class="me-2 size-4" aria-hidden="true" />
        Refresh
      </AdminButton>
    </AdminPageHeader>

    <AdminAccessWall
      v-if="!allowed"
      permission="platform.settings"
      title="The platform log is not part of your role"
      body="This screen shows every request and operation the console and the website recorded, with account ids and request paths."
    />

    <AdminLoadError v-else-if="error" :error="error" title="Could not read the log" @retry="refreshAll()" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Period">
        <button
          v-for="d in DAYS"
          :key="d"
          type="button"
          :class="[PILL, days === d ? 'bg-accent border-transparent text-white' : 'border-line-subtle text-fg-heading hover:bg-hover']"
          :aria-pressed="days === d"
          @click="days = d"
        >
          {{ d === 1 ? 'Today' : `Last ${d} days` }}
        </button>
        <span v-if="summary?.truncated" class="text-fg-muted text-[13px]">Summary covers the newest {{ summary.lines.toLocaleString('en-GB') }} lines.</span>
      </div>

      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatTile
          v-for="tile in tiles"
          :key="tile.label"
          :label="tile.label"
          :value="summary ? tile.value : '…'"
          :icon="tile.icon"
          :accent="tile.accent"
          :hint="tile.hint"
        />
      </div>

      <section v-if="summary?.problems.length" :class="CARD" class="p-6">
        <ApexSectionLabel>Recurring warnings and errors</ApexSectionLabel>
        <ul role="list" class="mt-4 flex flex-col divide-y divide-muted-200 dark:divide-white/5">
          <li v-for="p in summary.problems.slice(0, 12)" :key="`${p.event}|${p.message}`" class="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
            <span class="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11.5px] font-bold" :class="LEVEL_TONE[p.level]">{{ p.count }}×</span>
            <div class="min-w-0 flex-1">
              <p class="text-fg-heading m-0 truncate text-sm font-semibold">
                {{ p.message }}
              </p>
              <p class="text-fg-muted m-0 text-[12.5px]">
                <code class="font-mono">{{ p.event }}</code> · last {{ fmtTime(p.last) }}
              </p>
            </div>
            <AdminButton v-if="p.requestId" size="sm" @click="showRequest(p.requestId)">
              Latest request
            </AdminButton>
          </li>
        </ul>
      </section>

      <section :class="CARD" class="p-6">
        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <ApexSectionLabel>Lines</ApexSectionLabel>
            <div role="group" aria-label="Filter by level" class="flex flex-wrap gap-2">
              <button
                v-for="l in LEVELS"
                :key="l.key"
                type="button"
                :class="[PILL, level === l.key ? 'bg-accent border-transparent text-white' : 'border-line-subtle text-fg-heading hover:bg-hover']"
                :aria-pressed="level === l.key"
                @click="level = l.key"
              >
                {{ l.label }}
              </button>
            </div>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label class="flex flex-col gap-1 text-[12.5px] font-semibold text-fg-muted">
              Search
              <input v-model="text" type="search" :class="INPUT" placeholder="Path, event or message">
            </label>
            <label class="flex flex-col gap-1 text-[12.5px] font-semibold text-fg-muted">
              Category
              <select v-model="category" :class="INPUT">
                <option value="" :selected="category === ''">All categories</option>
                <option v-for="c in CATEGORIES" :key="c" :value="c" :selected="category === c">{{ c }}</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-[12.5px] font-semibold text-fg-muted">
              App
              <select v-model="app" :class="INPUT">
                <option value="all" :selected="app === 'all'">Console and website</option>
                <option value="panel" :selected="app === 'panel'">Console only</option>
                <option value="site" :selected="app === 'site'">Website only</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-[12.5px] font-semibold text-fg-muted">
              Status
              <select v-model="status" :class="INPUT">
                <option v-for="s in STATUSES" :key="s.key" :value="s.key" :selected="status === s.key">{{ s.label }}</option>
              </select>
            </label>
          </div>
          <div v-if="requestId" class="flex flex-wrap items-center gap-2 text-[13px]">
            <span class="text-fg-muted">Showing one request:</span>
            <code class="bg-chip text-fg-heading rounded px-2 py-0.5 font-mono text-[12px]">{{ requestId }}</code>
            <AdminButton size="sm" @click="requestId = ''">
              Show all
            </AdminButton>
          </div>
        </div>

        <div v-if="pending && !data" class="text-fg-muted mt-6 text-sm">
          Reading the log…
        </div>
        <AdminEmptyState
          v-else-if="lines.length === 0"
          class="mt-6"
          icon="lucide:scroll-text"
          title="No lines match"
          subtitle="Try a longer period, a lower level or fewer filters."
        />
        <ul v-else role="list" class="mt-4 flex flex-col divide-y divide-muted-200 dark:divide-white/5">
          <li v-for="(line, i) in lines" :key="`${line.ts}-${i}`" class="py-2">
            <details class="group">
              <summary class="apex-focus flex cursor-pointer list-none flex-col gap-1 rounded-xl px-2 py-1.5 hover:bg-hover sm:flex-row sm:items-center sm:gap-3">
                <span class="text-fg-muted w-[150px] shrink-0 font-mono text-[12px] tabular-nums">{{ fmtTime(line.ts) }}</span>
                <span class="inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase" :class="LEVEL_TONE[line.level]">{{ line.level }}</span>
                <span class="text-fg-muted w-[44px] shrink-0 text-[12px]">{{ line.app === 'site' ? 'site' : 'console' }}</span>
                <span class="text-fg-heading min-w-0 flex-1 truncate text-[13.5px]">
                  <code class="text-accent-ink me-2 font-mono text-[12px]">{{ line.event }}</code>{{ line.message }}
                </span>
                <span class="text-fg-muted shrink-0 text-[12px] tabular-nums">
                  <template v-if="line.durationMs !== undefined">{{ line.durationMs }} ms</template>
                  <template v-if="actorLabel(line.actor)"> · {{ actorLabel(line.actor) }}</template>
                </span>
              </summary>
              <div class="mt-2 flex flex-col gap-2 px-2">
                <p v-if="line.error" class="m-0 text-[13px] text-st-danger-fg">
                  {{ line.error.name }}: {{ line.error.message }}
                </p>
                <div v-if="line.requestId" class="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span class="text-fg-muted">Request</span>
                  <code class="font-mono">{{ line.requestId }}</code>
                  <AdminButton v-if="line.requestId !== requestId" size="sm" @click="showRequest(line.requestId)">
                    Everything this request did
                  </AdminButton>
                </div>
                <pre class="bg-desk text-fg-body m-0 max-h-[360px] overflow-auto rounded-xl p-3 font-mono text-[12px] leading-[1.5]">{{ JSON.stringify(line, null, 2) }}</pre>
              </div>
            </details>
          </li>
        </ul>

        <div v-if="more" class="mt-4 flex justify-center">
          <AdminButton :disabled="loadingOlder" @click="loadOlder">
            {{ loadingOlder ? 'Loading…' : 'Load older lines' }}
          </AdminButton>
        </div>
      </section>
    </template>
  </div>
</template>
