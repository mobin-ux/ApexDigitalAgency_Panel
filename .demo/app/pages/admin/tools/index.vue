<script setup lang="ts">
/**
 * Admin — Tools. Platform utilities: the full audit trail (filterable,
 * with expandable metadata), an announcement broadcaster (in-app
 * notifications — there is no mail provider) and dev-only seed helpers.
 */
definePageMeta({
  title: 'Tools',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()

// --- Audit trail ---
const search = ref('')
const debouncedSearch = ref('')
const targetType = ref('')
const page = ref(1)

watchDebounced(search, (value) => {
  debouncedSearch.value = value.trim()
}, { debounce: 300 })

watch([debouncedSearch, targetType], () => {
  page.value = 1
})

const auditQuery = computed(() => ({
  page: page.value,
  pageSize: 20,
  ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
  ...(targetType.value ? { targetType: targetType.value } : {}),
}))

const { data: auditData, pending: auditPending } = await useFetch('/api/admin/audit', { query: auditQuery })

const expanded = ref<string | null>(null)

function prettyMetadata(raw: string | null) {
  if (!raw)
    return null
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  }
  catch {
    return raw
  }
}

function fmtDateTime(iso: string | Date) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// --- Broadcast ---
const broadcast = reactive({ title: '', message: '', type: 'INFO', link: '' })
const showBroadcastConfirm = ref(false)
const broadcasting = ref(false)

async function sendBroadcast() {
  if (broadcasting.value)
    return
  broadcasting.value = true
  try {
    const result = await $fetch('/api/admin/notifications/broadcast', {
      method: 'POST',
      body: {
        title: broadcast.title,
        message: broadcast.message,
        type: broadcast.type,
        link: broadcast.link || null,
      },
    })
    toaster.add({ title: 'Announcement sent', description: `Delivered to ${result.recipientCount} customer account(s).`, icon: 'lucide:check', progress: true })
    Object.assign(broadcast, { title: '', message: '', type: 'INFO', link: '' })
    showBroadcastConfirm.value = false
  }
  catch (error: any) {
    toaster.add({ title: 'Broadcast failed', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
    showBroadcastConfirm.value = false
  }
  finally {
    broadcasting.value = false
  }
}

// --- Dev utilities (the endpoints themselves 404 in production builds) ---
const isDev = import.meta.dev
const seeding = ref<string | null>(null)

const devSeeds = [
  { path: '/api/create-admin', label: 'Ensure dev accounts', desc: 'user@apex.com / admin@apex.com' },
  { path: '/api/seed-orders', label: 'Seed orders', desc: 'Sample projects + milestones' },
  { path: '/api/seed-support', label: 'Seed support', desc: 'Sample tickets + threads' },
  { path: '/api/seed-notifs', label: 'Seed notifications', desc: 'Sample notification feed' },
]

async function runSeed(path: string) {
  if (seeding.value)
    return
  seeding.value = path
  try {
    await $fetch(path)
    toaster.add({ title: 'Seed complete', description: path, icon: 'lucide:check', progress: true })
  }
  catch (error: any) {
    toaster.add({ title: 'Seed failed', description: error?.data?.message || path, icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    seeding.value = null
  }
}

const inputClass = 'w-full rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 sm:py-2.5 text-sm text-white outline-none placeholder:text-muted-500 focus:border-primary-400'
const labelClass = 'mb-2 block text-[12.5px] font-semibold text-white'
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-7 pb-8 font-sans text-muted-400">
    <AdminPageHeader
      eyebrow="ADMIN · TOOLS"
      title="Tools"
      subtitle="The audit trail, customer announcements and platform utilities."
    />

    <div class="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.45fr_1fr]">
      <!-- ========== AUDIT TRAIL ========== -->
      <section class="flex flex-col gap-4" aria-label="Audit trail">
        <h2 class="flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
          <span class="h-[18px] w-1.5 rounded-full bg-primary-500" />Audit trail
        </h2>

        <div class="grid grid-cols-1 gap-3 rounded-[20px] border border-white/10 bg-muted-800 p-4 sm:grid-cols-[1.6fr_1fr]">
          <label class="flex items-center gap-2.5 rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 focus-within:border-primary-400">
            <Icon name="lucide:search" class="size-4 shrink-0 text-muted-500" />
            <input v-model="search" placeholder="Search actor, action or target id…" class="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-white outline-none placeholder:text-muted-500">
          </label>
          <select v-model="targetType" aria-label="Filter by record type" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 sm:py-2.5 text-[13px] text-white outline-none focus:border-primary-400">
            <option value="">
              All record types
            </option>
            <option v-for="t in ['User', 'Project', 'Milestone', 'Transaction', 'WithdrawalRequest', 'Ticket', 'Company', 'Setting', 'Notification']" :key="t" :value="t">
              {{ t }}
            </option>
          </select>
        </div>

        <div v-if="auditPending" class="flex flex-col gap-2" aria-hidden="true">
          <div v-for="i in 6" :key="i" class="h-[64px] animate-pulse rounded-[16px] border border-white/5 bg-muted-800/60" />
        </div>

        <div v-else-if="auditData?.items?.length" class="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.02]" role="list">
          <template v-for="(entry, idx) in auditData.items" :key="entry.id">
            <div v-if="idx > 0" class="h-px bg-white/10" />
            <div role="listitem">
              <button
                type="button"
                class="flex w-full items-center gap-3.5 px-[22px] py-3.5 text-left transition hover:bg-white/[0.03]"
                :aria-expanded="expanded === entry.id"
                @click="expanded = expanded === entry.id ? null : entry.id"
              >
                <span class="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-white/5 text-muted-500">
                  <Icon name="lucide:activity" class="size-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-[13.5px] font-semibold text-white">
                    <span class="font-mono text-[12.5px] text-primary-200">{{ entry.action }}</span>
                    <span v-if="entry.targetId" class="ms-2 font-mono text-[11px] text-muted-500">{{ entry.targetId.slice(0, 8) }}</span>
                  </div>
                  <div class="mt-0.5 truncate text-[12px] text-muted-500">
                    {{ entry.actorEmail }} · {{ fmtDateTime(entry.createdAt) }}<span v-if="entry.ip"> · {{ entry.ip }}</span>
                  </div>
                </div>
                <Icon :name="expanded === entry.id ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="size-4 shrink-0 text-muted-500" />
              </button>
              <pre
                v-if="expanded === entry.id && prettyMetadata(entry.metadata)"
                class="mx-[22px] mb-4 overflow-x-auto rounded-[12px] border border-white/8 bg-muted-950 p-4 font-mono text-[11.5px] leading-[1.6] text-muted-300"
              >{{ prettyMetadata(entry.metadata) }}</pre>
            </div>
          </template>
        </div>

        <AdminEmptyState v-else icon="lucide:scroll-text" title="No audit entries" subtitle="Privileged actions are recorded here automatically." />

        <AdminPager
          v-if="auditData" :page="auditData.page" :page-count="auditData.pageCount" :total="auditData.total" noun="entries"
          @update:page="page = $event"
        />
      </section>

      <!-- ========== RIGHT RAIL ========== -->
      <div class="flex flex-col gap-6">
        <!-- broadcast -->
        <section class="rounded-[20px] border border-white/10 bg-muted-800 p-6" aria-label="Announcement">
          <h2 class="mb-2 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
            <span class="h-[18px] w-1.5 rounded-full bg-[#6EA8FE]" />Announcement
          </h2>
          <p class="mb-5 text-[13px] leading-[1.5] text-muted-400">
            Sends an in-app notification to every active customer. No emails are sent — there's no mail provider wired up.
          </p>
          <form class="flex flex-col gap-3.5" @submit.prevent="showBroadcastConfirm = true">
            <div>
              <label for="bc-title" :class="labelClass">Title</label>
              <input id="bc-title" v-model="broadcast.title" required maxlength="150" placeholder="e.g. New: 24-month financing" :class="inputClass">
            </div>
            <div>
              <label for="bc-message" :class="labelClass">Message</label>
              <textarea id="bc-message" v-model="broadcast.message" rows="3" required maxlength="1000" placeholder="Keep it short and benefit-led…" class="w-full resize-y rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm leading-[1.55] text-white outline-none placeholder:text-muted-500 focus:border-primary-400" />
            </div>
            <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label for="bc-type" :class="labelClass">Type</label>
                <select id="bc-type" v-model="broadcast.type" class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 sm:py-2.5 text-sm text-white outline-none focus:border-primary-400">
                  <option value="INFO">
                    Info
                  </option>
                  <option value="SUCCESS">
                    Success
                  </option>
                  <option value="WARNING">
                    Warning
                  </option>
                </select>
              </div>
              <div>
                <label for="bc-link" :class="labelClass">In-app link <span class="font-normal text-muted-500">(optional)</span></label>
                <input id="bc-link" v-model="broadcast.link" placeholder="/dashboards/services" :class="inputClass">
              </div>
            </div>
            <BaseButton type="submit" rounded="full" variant="primary" class="self-end" :disabled="!broadcast.title.trim() || !broadcast.message.trim()">
              <Icon name="lucide:megaphone" class="size-4" />Send announcement
            </BaseButton>
          </form>
        </section>

        <!-- dev utilities -->
        <section v-if="isDev" class="rounded-[20px] border border-[#D9A521]/25 bg-[#D9A521]/[0.04] p-6" aria-label="Developer utilities">
          <h2 class="mb-2 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-[#F2C14E]">
            <span class="h-[18px] w-1.5 rounded-full bg-[#F2C14E]" />Dev utilities
          </h2>
          <p class="mb-4 text-[13px] leading-[1.5] text-muted-400">
            Local development only — these endpoints return 404 in production builds.
          </p>
          <div class="flex flex-col gap-2">
            <div v-for="seed in devSeeds" :key="seed.path" class="flex items-center gap-3 rounded-[12px] border border-white/8 bg-muted-800/70 px-4 py-3">
              <div class="min-w-0 flex-1">
                <div class="text-[13px] font-semibold text-white">
                  {{ seed.label }}
                </div>
                <div class="truncate text-[11.5px] text-muted-500">
                  {{ seed.desc }}
                </div>
              </div>
              <BaseButton size="sm" rounded="full" class="shrink-0 border border-white/10 bg-muted-700 !text-white hover:bg-muted-600" :loading="seeding === seed.path" :disabled="Boolean(seeding)" @click="runSeed(seed.path)">
                Run
              </BaseButton>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- ========== BROADCAST CONFIRM MODAL ========== -->
    <div v-if="showBroadcastConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Confirm announcement">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showBroadcastConfirm = false" />
      <div class="apex-pop relative w-full max-w-[420px] rounded-[20px] border border-white/10 bg-muted-800 p-6 shadow-[0_30px_60px_rgba(0,0,0,.5)]">
        <span class="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#6EA8FE]/14 text-[#6EA8FE]">
          <Icon name="lucide:megaphone" class="size-5" />
        </span>
        <div class="font-heading text-[19px] font-extrabold tracking-[-0.01em] text-white">
          Send to every active customer?
        </div>
        <p class="mt-2 text-[13.5px] leading-[1.55] text-muted-400">
          "<strong class="text-white">{{ broadcast.title }}</strong>" will appear in every active customer's notification feed. This can't be recalled.
        </p>
        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <BaseButton rounded="full" class="border border-white/10 bg-muted-700 !text-white hover:bg-muted-600" @click="showBroadcastConfirm = false">
            Cancel
          </BaseButton>
          <BaseButton rounded="full" variant="primary" :loading="broadcasting" :disabled="broadcasting" @click="sendBroadcast">
            <Icon name="lucide:send" class="size-4" />Send announcement
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes apex-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes apex-pop {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.apex-fade {
  animation: apex-fade 0.2s ease-out both;
}
.apex-pop {
  animation: apex-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  .apex-fade,
  .apex-pop {
    animation: none;
  }
}
</style>
