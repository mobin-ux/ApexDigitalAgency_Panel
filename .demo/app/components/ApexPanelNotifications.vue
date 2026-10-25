<script setup lang="ts">
/**
 * The bell in the Panel v2 bars (`Dashboard.dc.html`). A 400px popover under
 * the 42px bordered button from 768px; a bottom sheet from the 44px phone-bar
 * button. Both hold `ApexPanelNotificationsBody` over `/api/notifications`.
 * The admin shell keeps its own `ApexNotificationsMenu`.
 */
const { variant } = defineProps<{ variant: 'bar' | 'phone' }>()

const { unreadCount, fetchNotifications } = useNotifications()
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
      aria-haspopup="dialog"
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

    <!-- Fixed to the viewport as drawn: 84px down, level with the page gutter. -->
    <div
      v-if="variant === 'bar' && open"
      role="dialog"
      aria-label="Notifications"
      class="apex-pop-in bg-card border-line-subtle shadow-pop fixed right-[clamp(16px,3vw,40px)] top-[84px] z-[61] flex max-h-[min(620px,calc(100vh-110px))] w-[400px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[18px] border"
    >
      <ApexPanelNotificationsBody :pending="pending" @navigate="open = false" />
    </div>

    <ApexBottomSheet v-if="variant === 'phone'" v-model:open="open" surface="panel" title="Notifications" description="Recent activity on your projects, payments and requests.">
      <div class="flex max-h-[calc(82vh-30px)] min-h-0 flex-col">
        <ApexPanelNotificationsBody :pending="pending" @navigate="open = false" />
      </div>
    </ApexBottomSheet>
  </div>
</template>
