<script setup lang="ts">
/**
 * The inside of the bell's panel (Panel v2, `Dashboard.dc.html`): header with
 * "Mark all as read" and a shortcut to notification settings, an All / Unread
 * filter, and the rows. Rendered once in the desktop popover and once in the
 * phone sheet, so the two cannot drift apart.
 *
 * A row is typed by where it links (`notifKind`), opening it marks it read,
 * and the empty state says so plainly. The design's "See all notifications"
 * footer is left out: there is no notifications page to send it to yet.
 */
const { pending } = defineProps<{ pending: boolean }>()
const emit = defineEmits<{ navigate: [] }>()

const { notifications, unreadCount, markAllAsRead, markRead } = useNotifications()
const NuxtLink = resolveComponent('NuxtLink')

const tab = ref<'all' | 'unread'>('all')
const tabs = computed(() => [
  { id: 'all' as const, label: 'All' },
  { id: 'unread' as const, label: unreadCount.value ? `Unread · ${unreadCount.value}` : 'Unread' },
])

const rows = computed(() => notifications.value
  .filter(n => tab.value === 'all' || !n.isRead)
  .map(n => ({ ...n, meta: notifKind(n.link), when: notifWhen(n.createdAt) })))

function open(id: string) {
  markRead(id)
  emit('navigate')
}
</script>

<template>
  <div class="flex min-h-0 grow flex-col">
    <div class="flex shrink-0 items-center gap-1.5 pb-2.5 pl-5 pr-3 pt-3.5">
      <span class="font-heading text-fg-heading grow text-lg font-bold tracking-[-0.02em]">Notifications</span>
      <button v-if="unreadCount > 0" type="button" class="apex-ring text-accent-ink hover:bg-accent-tint min-h-9 cursor-pointer rounded-[10px] px-2.5 text-[13px] font-semibold" @click="markAllAsRead()">
        Mark all as read
      </button>
      <NuxtLink
        to="/dashboards/settings?section=notify"
        aria-label="Notification settings"
        title="Notification settings"
        class="apex-ring text-fg-muted hover:bg-hover hover:text-fg-heading inline-flex size-[38px] shrink-0 items-center justify-center rounded-[10px]"
        @click="emit('navigate')"
      >
        <Icon name="solar:settings-linear" class="size-[19px]" />
      </NuxtLink>
    </div>

    <div role="group" aria-label="Filter" class="border-line-soft flex shrink-0 gap-1 border-b px-4 pb-3">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        :aria-pressed="tab === t.id"
        class="apex-ring h-8 cursor-pointer rounded-full px-3 text-[13px] font-semibold"
        :class="tab === t.id ? 'bg-fg-heading text-card' : 'text-fg-body hover:bg-hover'"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>

    <div class="min-h-0 grow overflow-y-auto overscroll-contain">
      <template v-if="pending && !notifications.length">
        <div v-for="i in 3" :key="i" class="border-line-soft flex gap-3 border-b py-3.5 pl-5 pr-[18px]">
          <BasePlaceload class="size-9 shrink-0 rounded-[10px]" />
          <div class="flex grow flex-col gap-2 pt-1">
            <BasePlaceload class="h-3 w-3/4 rounded" />
            <BasePlaceload class="h-3 w-1/2 rounded" />
          </div>
        </div>
      </template>
      <template v-else>
        <component
          :is="n.link ? NuxtLink : 'button'"
          v-for="n in rows"
          :key="n.id"
          :to="n.link || undefined"
          :type="n.link ? undefined : 'button'"
          class="apex-ring border-line-soft hover:bg-hover flex w-full cursor-pointer items-start gap-3 border-b py-3.5 pl-5 pr-[18px] text-left"
          :class="n.isRead ? '' : 'bg-accent/5'"
          @click="open(n.id)"
        >
          <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]" :class="n.meta.tile">
            <Icon :name="n.meta.icon" class="size-[18px]" />
          </span>
          <span class="flex min-w-0 grow flex-col gap-[3px]">
            <span class="flex items-baseline gap-2.5">
              <span class="text-fg-heading min-w-0 grow text-sm leading-[1.4]" :class="n.isRead ? 'font-medium' : 'font-bold'">{{ n.title }}</span>
              <span class="text-fg-muted shrink-0 text-xs">{{ n.when }}</span>
            </span>
            <span class="text-fg-body text-[13px] leading-normal">{{ n.message }}</span>
            <span v-if="n.link" class="text-accent-ink mt-0.5 text-[12.5px] font-semibold">{{ n.meta.cta }} →</span>
          </span>
          <span class="mt-1.5 block size-2 shrink-0 rounded-full" :class="n.isRead ? 'bg-transparent' : 'bg-accent'">
            <span v-if="!n.isRead" class="sr-only">Unread</span>
          </span>
        </component>
        <div v-if="!rows.length" class="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
          <span aria-hidden="true" class="inline-flex size-11 items-center justify-center rounded-full bg-[#22B07D] text-lg text-white">✓</span>
          <span class="text-fg-heading text-[15px] font-semibold">You are all caught up</span>
          <span class="text-fg-muted text-[13.5px]">New updates on your projects and payments show here.</span>
        </div>
      </template>
    </div>
  </div>
</template>
