<script setup lang="ts">
/**
 * The bell in the Panel v2 bars. Same list and endpoint as the admin shell's
 * `ApexNotificationsMenu` (`ApexNotificationsList`, `/api/notifications`); only
 * the container is new: a popover under the 42px bordered button from 768px,
 * a bottom sheet from the 44px phone-bar button.
 */
const { variant } = defineProps<{ variant: 'bar' | 'phone' }>()

const { notifications, unreadCount, fetchNotifications, markAllAsRead } = useNotifications()
const pending = ref(true)
onMounted(async () => {
  await fetchNotifications()
  pending.value = false
})

const open = ref(false)
const root = ref<HTMLElement | null>(null)
onClickOutside(root, () => {
  if (variant === 'bar') {
    open.value = false
  }
})
onKeyStroke('Escape', () => {
  open.value = false
})

const label = computed(() => (unreadCount.value > 0 ? `Notifications, ${unreadCount.value} unread` : 'Notifications'))
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      :aria-label="label"
      :aria-expanded="open"
      class="apex-ring text-fg-heading relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl"
      :class="variant === 'bar' ? 'bg-card border-line-subtle hover:border-line-strong size-[42px] border' : 'size-11'"
      @click="open = !open"
    >
      <Icon name="solar:bell-linear" :class="variant === 'bar' ? 'size-[19px]' : 'size-[21px]'" />
      <span
        v-if="unreadCount > 0"
        aria-hidden="true"
        class="absolute size-2 rounded-full bg-[#EC6453]"
        :class="variant === 'bar' ? 'right-2.5 top-[9px] shadow-[0_0_0_2px_var(--panel-card)]' : 'right-3 top-[11px] shadow-[0_0_0_2px_var(--panel-page)]'"
      />
    </button>

    <div
      v-if="variant === 'bar' && open"
      role="dialog"
      aria-label="Notifications"
      class="apex-pop-in bg-card border-line-subtle shadow-pop absolute right-0 top-[calc(100%+10px)] z-40 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border"
    >
      <div class="border-line-soft flex items-center gap-2.5 border-b px-4 py-3.5">
        <span class="font-heading text-fg-heading text-sm font-bold">Notifications</span>
        <span class="grow" />
        <button v-if="unreadCount > 0" type="button" class="apex-ring text-accent-ink cursor-pointer rounded-md text-xs font-semibold hover:underline" @click="markAllAsRead()">
          Mark all read
        </button>
      </div>
      <div class="max-h-[380px] overflow-y-auto">
        <ApexNotificationsList :notifications="notifications" :pending="pending" />
      </div>
    </div>

    <ApexBottomSheet v-if="variant === 'phone'" v-model:open="open" surface="panel" title="Notifications" description="Recent activity on your projects, payments and requests." scrollable>
      <template #header>
        <div class="border-line-soft flex shrink-0 items-center gap-2.5 border-b px-4 pb-3 pt-2.5">
          <span class="font-heading text-fg-heading text-base font-bold">Notifications</span>
          <span class="grow" />
          <button v-if="unreadCount > 0" type="button" class="apex-ring text-accent-ink -me-2.5 flex min-h-11 cursor-pointer items-center rounded-xl px-2.5 text-[13.5px] font-semibold" @click="markAllAsRead()">
            Mark all read
          </button>
        </div>
      </template>
      <ApexNotificationsList :notifications="notifications" :pending="pending" />
    </ApexBottomSheet>
  </div>
</template>
