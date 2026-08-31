<script setup lang="ts">
/**
 * Admin — Tools. Customer announcements and platform utilities.
 *
 * The audit trail used to live here as the left-hand column. Phase 9 gives
 * it its own screen at `/admin/audit`, because the design treats the log as
 * a first-class System destination with its own filters and export — not a
 * panel sharing a page with dev seed buttons.
 */
definePageMeta({
  title: 'Tools',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()
const { can } = useStaffAccess()

/**
 * A broadcast writes a notification into every customer's feed, which is
 * customer-facing content — the same permission that governs the service
 * catalogue and help articles.
 */
const allowed = computed(() => can('catalogue.edit'))

// --- Broadcast ---
const broadcast = reactive({ title: '', message: '', type: 'INFO', link: '' })
const showBroadcastConfirm = ref(false)
const broadcasting = ref(false)

async function sendBroadcast() {
  if (broadcasting.value) {
    return
  }
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
  if (seeding.value) {
    return
  }
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

const CARD = 'rounded-2xl border border-muted-200 bg-white p-6 dark:border-white/10 dark:bg-muted-800'
const INPUT = 'w-full rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-3 text-sm text-muted-900 outline-none placeholder:text-muted-400 focus:border-primary-400 sm:py-2.5 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500'
const LABEL = 'mb-2 block text-[12.5px] font-semibold text-muted-900 dark:text-white'
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-6 pb-10 font-sans">
    <AdminAccessWall
      v-if="!allowed"
      permission="catalogue.edit"
      title="Tools are restricted"
      body="An announcement is written into every client's notification feed, so sending one is limited to the roles that own client-facing content."
    />

    <template v-else>
      <AdminPageHeader
        dense
        title="Tools"
        subtitle="Customer announcements and platform utilities."
      />

      <div class="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-2">
        <!-- broadcast -->
        <section :class="CARD" aria-label="Announcement">
          <div class="font-heading text-muted-900 text-[16.5px] font-bold tracking-[-0.01em] dark:text-white">
            Announcement
          </div>
          <p class="text-muted-500 mb-5 mt-[7px] text-[13px] leading-[1.55]">
            Writes an in-app notification into every active customer's feed. No emails are sent — there is no mail provider wired up.
          </p>
          <form class="flex flex-col gap-3.5" @submit.prevent="showBroadcastConfirm = true">
            <div>
              <label for="bc-title" :class="LABEL">Title</label>
              <input id="bc-title" v-model="broadcast.title" required maxlength="150" placeholder="e.g. New: 24-month financing" :class="INPUT">
            </div>
            <div>
              <label for="bc-message" :class="LABEL">Message</label>
              <textarea
                id="bc-message"
                v-model="broadcast.message"
                rows="3"
                required
                maxlength="1000"
                placeholder="Keep it short and benefit-led…"
                class="border-muted-200 bg-muted-50 text-muted-900 placeholder:text-muted-400 focus:border-primary-400 dark:placeholder:text-muted-500 w-full resize-y rounded-xl border px-3.5 py-2.5 text-sm leading-[1.55] outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
            <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <!-- A span, not a label: `BaseSelect` does not forward `id`, so
                     `for="bc-type"` would point at nothing. The select is named
                     by its own aria-label. -->
                <span :class="LABEL" aria-hidden="true">Type</span>
                <!-- `BaseSelect`, not a native `<select>`: the OS popup renders
                     white-on-black on a dark surface and CSS cannot reach it. -->
                <BaseSelect
                  v-model="broadcast.type"
                  rounded="lg"
                  aria-label="Announcement type"
                  class="dark:bg-muted-700! h-11! w-full! rounded-xl! dark:border-white/10! dark:text-white!"
                  :classes="{ text: 'text-[13.5px]' }"
                >
                  <BaseSelectItem value="INFO">
                    Info
                  </BaseSelectItem>
                  <BaseSelectItem value="SUCCESS">
                    Success
                  </BaseSelectItem>
                  <BaseSelectItem value="WARNING">
                    Warning
                  </BaseSelectItem>
                </BaseSelect>
              </div>
              <div>
                <label for="bc-link" :class="LABEL">In-app link <span class="text-muted-500 font-normal">(optional)</span></label>
                <input id="bc-link" v-model="broadcast.link" placeholder="/dashboards/services" :class="INPUT">
              </div>
            </div>
            <BaseButton type="submit" rounded="lg" variant="primary" class="self-end" :disabled="!broadcast.title.trim() || !broadcast.message.trim()">
              <Icon name="lucide:megaphone" class="size-4" />Send announcement
            </BaseButton>
          </form>
        </section>

        <div class="flex flex-col gap-[18px]">
          <!-- pointer to the log's new home -->
          <section :class="CARD" aria-label="Audit trail">
            <div class="font-heading text-muted-900 text-[16.5px] font-bold tracking-[-0.01em] dark:text-white">
              Audit trail
            </div>
            <p class="text-muted-500 mb-4 mt-[7px] text-[13px] leading-[1.55]">
              Every action that changes access, money or a client's records now has its own screen, with filters by kind and a CSV export.
            </p>
            <BaseButton to="/admin/audit" rounded="lg">
              <Icon name="lucide:scroll-text" class="size-4" />Open the audit log
            </BaseButton>
          </section>

          <!-- dev utilities -->
          <section v-if="isDev" class="rounded-2xl border border-[#D9A521]/25 bg-[#D9A521]/[0.04] p-6" aria-label="Developer utilities">
            <div class="font-heading text-[16.5px] font-bold tracking-[-0.01em] text-[#F2C14E]">
              Dev utilities
            </div>
            <p class="text-muted-500 mb-4 mt-[7px] text-[13px] leading-[1.55]">
              Local development only — these endpoints return 404 in production builds.
            </p>
            <div class="flex flex-col gap-2">
              <div
                v-for="seed in devSeeds"
                :key="seed.path"
                class="border-muted-200 dark:bg-muted-800/70 flex items-center gap-3 rounded-xl border bg-white px-4 py-3 dark:border-white/10"
              >
                <div class="min-w-0 flex-1">
                  <div class="text-muted-900 text-[13px] font-semibold dark:text-white">
                    {{ seed.label }}
                  </div>
                  <div class="text-muted-500 truncate text-[11.5px]">
                    {{ seed.desc }}
                  </div>
                </div>
                <BaseButton
                  size="sm"
                  rounded="lg"
                  class="shrink-0"
                  :loading="seeding === seed.path"
                  :disabled="Boolean(seeding)"
                  @click="runSeed(seed.path)"
                >
                  Run
                </BaseButton>
              </div>
            </div>
          </section>
        </div>
      </div>
    </template>

    <!-- ========== BROADCAST CONFIRM MODAL ========== -->
    <div v-if="showBroadcastConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Confirm announcement">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showBroadcastConfirm = false" />
      <div class="apex-pop border-muted-200 dark:bg-muted-800 relative w-full max-w-[420px] rounded-2xl border bg-white p-6 shadow-[0_30px_60px_rgba(0,0,0,.5)] dark:border-white/10">
        <span aria-hidden="true" class="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#6EA8FE]/14 text-[#6EA8FE]">
          <Icon name="lucide:megaphone" class="size-5" />
        </span>
        <div class="font-heading text-muted-900 text-[19px] font-extrabold tracking-[-0.01em] dark:text-white">
          Send to every active customer?
        </div>
        <p class="text-muted-600 dark:text-muted-300 mt-2 text-[13.5px] leading-[1.55]">
          "<strong class="text-muted-900 dark:text-white">{{ broadcast.title }}</strong>" will appear in every active customer's notification feed. This can't be recalled.
        </p>
        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <BaseButton rounded="lg" @click="showBroadcastConfirm = false">
            Cancel
          </BaseButton>
          <BaseButton rounded="lg" variant="primary" :loading="broadcasting" :disabled="broadcasting" @click="sendBroadcast">
            <Icon name="lucide:send" class="size-4" />Send announcement
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Plain keyframes, not a Vue <Transition> — see MEMORY.md's wallet gotcha. */
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
