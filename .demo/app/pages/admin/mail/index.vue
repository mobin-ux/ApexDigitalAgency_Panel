<script setup lang="ts">
/**
 * System — Email (ADR-022).
 *
 * The outbox: whether sending is configured, how much is queued, failed or
 * went in the last day, and every message with its status and, when it did
 * not go, the provider's reason. A failed message can be retried unless its
 * link has died with its token (a reset or verification email), in which
 * case the row says so instead of offering a button that would send a dead
 * link. "Send a test email to me" goes through the real outbox and the real
 * provider, so a green result here means a customer's email would arrive.
 *
 * Nothing on this screen shows a message body: reset and invite emails
 * carry live tokens, and the endpoint never returns them.
 */
definePageMeta({
  title: 'Email',
  layout: 'admin',
  middleware: 'admin',
})

const { can } = useStaffAccess()
const allowed = computed(() => can('team.manage'))
const toaster = useNuiToasts()
const route = useRoute()

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'QUEUED', label: 'Queued' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'SENT', label: 'Sent' },
] as const

const status = ref<string>(typeof route.query.status === 'string' ? route.query.status : '')
const page = ref(1)
watch(status, () => {
  page.value = 1
})
const query = computed(() => ({ page: page.value, pageSize: 20, ...(status.value ? { status: status.value } : {}) }))

const { data, pending, error, refresh } = await useFetch('/api/admin/mail', { query, immediate: allowed.value })

const tiles = computed(() => [
  { label: 'Queued', value: data.value?.counts.queued ?? 0, icon: 'lucide:clock', accent: 'amber' as const, hint: 'Waiting for the next attempt' },
  { label: 'Failed', value: data.value?.counts.failed ?? 0, icon: 'lucide:circle-alert', accent: 'coral' as const, hint: 'Not sent; see the reason below' },
  { label: 'Sent today', value: data.value?.counts.sent24h ?? 0, icon: 'lucide:send', accent: 'green' as const, hint: 'Accepted by the provider in the last 24 hours' },
])

const KIND_LABEL: Record<string, string> = {
  'password-reset': 'Password reset',
  'verify-email': 'Email verification',
  'staff-invite': 'Staff invite',
  'notification': 'Notification',
  'cms-review': 'Website review',
  'test': 'Test',
}

const STATUS_TONE: Record<string, string> = {
  QUEUED: 'bg-[#D9A521]/14 text-[#F2C14E]',
  SENDING: 'bg-[#6EA8FE]/14 text-[#6EA8FE]',
  SENT: 'bg-[#22B07D]/14 text-[#22B07D]',
  FAILED: 'bg-[#EC6453]/14 text-[#EC6453]',
}

const STATUS_LABEL: Record<string, string> = { QUEUED: 'Queued', SENDING: 'Sending', SENT: 'Sent', FAILED: 'Failed' }

const testing = ref(false)
async function sendTest() {
  if (testing.value) {
    return
  }
  testing.value = true
  try {
    const result = await $fetch('/api/admin/mail/test', { method: 'POST' })
    if (result.mail.status === 'SENT') {
      toaster.add({ title: 'Test email sent', description: 'Check your inbox. The provider accepted it.', icon: 'lucide:check', progress: true })
    }
    else {
      toaster.add({ title: 'Test email did not go', description: result.mail.error || 'It is queued and will be retried.', icon: 'lucide:circle-alert', progress: true })
    }
    await refresh()
  }
  catch (e) {
    toaster.add({ title: 'Could not send a test', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    testing.value = false
  }
}

const retrying = ref<string | null>(null)
async function retry(id: string) {
  if (retrying.value) {
    return
  }
  retrying.value = id
  try {
    const result = await $fetch(`/api/admin/mail/${id}/retry`, { method: 'POST' })
    if (result.mail.status === 'SENT') {
      toaster.add({ title: 'Sent', description: 'The provider accepted it this time.', icon: 'lucide:check', progress: true })
    }
    else {
      toaster.add({ title: 'Still not sent', description: result.mail.error || 'Queued for another attempt.', icon: 'lucide:circle-alert', progress: true })
    }
    await refresh()
  }
  catch (e) {
    toaster.add({ title: 'Could not retry', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    retrying.value = null
  }
}

function fmtDate(iso: string | Date | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}

const CARD = 'bg-card border-line-subtle rounded-2xl border'
const PILL = 'apex-focus inline-flex min-h-[38px] items-center rounded-full border px-4 text-[13px] font-semibold transition'
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1180px] px-4 pt-5 sm:px-8 sm:pt-7 flex-col gap-8 pb-10">
    <AdminPageHeader
      title="Email"
      subtitle="Every email the panel sends: whether it went, and why not."
    >
      <AdminButton
        v-if="allowed && data"
        variant="primary"
        size="lg"
        :disabled="testing || !data.configured"
        @click="sendTest"
      >
        <Icon name="lucide:send" class="me-2 size-4" aria-hidden="true" />
        Send a test email to me
      </AdminButton>
    </AdminPageHeader>

    <AdminAccessWall
      v-if="!allowed"
      permission="team.manage"
      title="The outbox is not part of your role"
      body="This screen shows every email the panel sends and lets a failed one be retried."
    />

    <AdminWebsiteLoadError v-else-if="error" :error="error" title="Could not load the outbox" @retry="refresh()" />

    <template v-else>
      <section :class="CARD" class="p-6">
        <ApexSectionLabel>Sending</ApexSectionLabel>
        <div v-if="pending && !data" class="text-muted-500 mt-4 text-sm">
          Loading…
        </div>
        <div v-else-if="data?.configured" class="mt-4 flex items-start gap-3">
          <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#22B07D]/14 text-[#22B07D]"><Icon name="lucide:check" class="size-[18px]" aria-hidden="true" /></span>
          <div class="text-sm leading-[1.6]">
            <p class="text-muted-900 m-0 font-semibold dark:text-white">
              Configured
            </p>
            <p class="text-muted-600 dark:text-muted-300 m-0">
              Messages are sent from <strong class="text-fg-heading">{{ data.from }}</strong>. Replies go to the support address under Platform settings. The scheduler retries anything the provider does not accept, every minute with a growing wait, six times.
            </p>
          </div>
        </div>
        <div v-else class="mt-4 flex items-start gap-3">
          <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#D9A521]/14 text-[#F2C14E]"><Icon name="lucide:alert-triangle" class="size-[18px]" aria-hidden="true" /></span>
          <div class="text-sm leading-[1.6]">
            <p class="text-muted-900 m-0 font-semibold dark:text-white">
              Not configured
            </p>
            <p class="text-muted-600 dark:text-muted-300 m-0">
              Nothing is sent. Messages are still recorded here and marked failed until
              <template v-for="(key, i) in data?.envKeys ?? []" :key="key">
                <span v-if="i > 0"> and </span>
                <code class="bg-muted-100 text-muted-700 dark:text-muted-300 rounded px-1.5 py-0.5 font-mono text-[12px] dark:bg-black/30">{{ key }}</code>
              </template>
              are set in the panel's environment and it is restarted. Meanwhile invites hand over their link, password reset by email is unavailable, and notifications stay in the panel.
            </p>
          </div>
        </div>
      </section>

      <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <AdminStatTile
          v-for="tile in tiles"
          :key="tile.label"
          :label="tile.label"
          :value="pending && !data ? '…' : tile.value"
          :icon="tile.icon"
          :accent="tile.accent"
          :hint="tile.hint"
        />
      </div>

      <section :class="CARD" class="p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <ApexSectionLabel>Messages</ApexSectionLabel>
          <div role="group" aria-label="Filter by status" class="flex flex-wrap gap-2">
            <button
              v-for="f in STATUS_FILTERS"
              :key="f.key"
              type="button"
              :class="[PILL, status === f.key ? 'border-primary-500 bg-primary-500/10 text-primary-500' : 'border-muted-200 text-muted-700 hover:border-muted-300 dark:border-white/10 dark:text-muted-300']"
              :aria-pressed="status === f.key"
              @click="status = f.key"
            >
              {{ f.label }}
            </button>
          </div>
        </div>

        <AdminEmptyState
          v-if="!pending && data && data.items.length === 0"
          class="mt-6"
          icon="lucide:mail"
          :title="status ? `No ${STATUS_LABEL[status]?.toLowerCase()} emails` : 'No emails yet'"
          :subtitle="status ? 'Nothing matches this filter.' : 'Invites, password resets, verification links and notification emails appear here as they are queued.'"
        />

        <ul v-else role="list" class="mt-4 flex flex-col divide-y divide-muted-200 dark:divide-white/5">
          <li v-for="m in data?.items ?? []" :key="m.id" class="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-muted-900 text-sm font-semibold dark:text-white">{{ m.subject }}</span>
                <span class="bg-muted-100 text-muted-600 dark:text-muted-400 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold dark:bg-white/5">{{ KIND_LABEL[m.kind] ?? m.kind }}</span>
              </div>
              <p class="text-muted-500 m-0 mt-1 text-[13px]">
                To {{ m.to }} · {{ fmtDate(m.createdAt) }}<span v-if="m.sentAt"> · sent {{ fmtDate(m.sentAt) }}</span><span v-if="m.attempts"> · {{ m.attempts }} {{ m.attempts === 1 ? 'attempt' : 'attempts' }}</span>
              </p>
              <p v-if="m.lastError" class="m-0 mt-1 text-[13px] text-[#EC6453]">
                {{ m.lastError }}
              </p>
              <p v-else-if="m.status === 'QUEUED'" class="text-muted-500 m-0 mt-1 text-[13px]">
                Next attempt {{ fmtDate(m.nextAttemptAt) }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-3">
              <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-bold" :class="STATUS_TONE[m.status]">{{ STATUS_LABEL[m.status] ?? m.status }}</span>
              <AdminButton v-if="m.retryable" size="sm" :disabled="Boolean(retrying)" @click="retry(m.id)">
                Retry
              </AdminButton>
              <span v-else-if="m.status === 'FAILED'" class="text-muted-500 text-[12px]">Link expired; ask for a new one</span>
            </div>
          </li>
        </ul>

        <AdminPager
          v-if="data && data.pageCount > 1"
          class="mt-4"
          :page="data.page"
          :page-count="data.pageCount"
          :total="data.total"
          noun="emails"
          @update:page="page = $event"
        />
      </section>
    </template>
  </div>
</template>
