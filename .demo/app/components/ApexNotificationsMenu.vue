<script setup lang="ts">
/**
 * Notifications, in the place users look for them.
 *
 * Backed by the existing `useNotifications` composable and `/api/notifications`
 * — no new endpoint, no new model. The API soft-fails to an empty list for
 * anonymous sessions, so this is safe on every layout that mounts the toolbar.
 *
 * Two containers, one list (V2 Phase 1 mobile, §6): a dropdown on the desktop
 * rail, a bottom sheet below `lg`. A 340px dropdown anchored to the end of a
 * 393px viewport has nowhere to go — it either clips against the edge it is
 * aligned to or covers the bell that opened it.
 */
const { notifications, unreadCount, fetchNotifications, markAllAsRead } = useNotifications()

const isCompact = useIsCompact()
const sheetOpen = ref(false)

const pending = ref(true)

onMounted(async () => {
  await fetchNotifications()
  pending.value = false
})

const TRIGGER
  = 'apex-focus relative flex shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors size-11 text-muted-600 dark:text-muted-300 hover:bg-muted-100 dark:hover:bg-muted-800 lg:size-10 lg:border lg:border-muted-200 lg:bg-white lg:text-muted-500 lg:hover:border-muted-300 lg:hover:bg-transparent lg:hover:text-muted-900 dark:lg:border-muted-700 dark:lg:bg-muted-950 dark:lg:hover:border-muted-600 dark:lg:hover:bg-transparent dark:lg:hover:text-white'

const triggerLabel = computed(() =>
  unreadCount.value > 0 ? `Notifications, ${unreadCount.value} unread` : 'Notifications',
)
</script>

<template>
  <!--
    Below `lg`: a plain 44px icon that opens a sheet. The trigger is duplicated
    rather than shared because reka's dropdown owns its own trigger element and
    cannot be persuaded to hand it over; only one of the two is ever rendered.
  -->
  <template v-if="isCompact">
    <button
      type="button"
      :aria-label="triggerLabel"
      :aria-expanded="sheetOpen"
      :class="TRIGGER"
      @click="sheetOpen = true"
    >
      <Icon name="lucide:bell" class="size-[19px]" />
      <span
        v-if="unreadCount > 0"
        aria-hidden="true"
        class="bg-destructive-500 ring-white dark:ring-muted-950 absolute end-[9px] top-[9px] size-2 rounded-full ring-2"
      />
    </button>

    <ApexBottomSheet
      v-model:open="sheetOpen"
      title="Notifications"
      description="Recent activity on your projects, payments and tickets."
      scrollable
    >
      <template #header>
        <div class="border-muted-200 dark:border-muted-700 flex shrink-0 items-center gap-2.5 border-b px-4 pb-3 pt-2.5">
          <span class="font-heading text-muted-900 text-base font-bold dark:text-white">Notifications</span>
          <span class="grow" />
          <button
            v-if="unreadCount > 0"
            type="button"
            class="apex-focus text-primary-600 dark:text-primary-400 -me-2.5 flex min-h-11 cursor-pointer items-center rounded-xl px-2.5 text-[13.5px] font-semibold"
            @click="markAllAsRead()"
          >
            Mark all read
          </button>
        </div>
      </template>

      <ApexNotificationsList :notifications="notifications" :pending="pending" />
    </ApexBottomSheet>
  </template>

  <BaseDropdown
    v-else
    variant="default"
    rounded="lg"
    :bindings="{
      content: {
        align: 'end',
        sideOffset: 10,
      },
    }"
    :classes="{ content: 'w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl p-0 space-y-0 overflow-hidden' }"
  >
    <template #button>
      <button type="button" :aria-label="triggerLabel" :class="TRIGGER">
        <Icon name="lucide:bell" class="size-[18px]" />
        <span
          v-if="unreadCount > 0"
          aria-hidden="true"
          class="bg-destructive-500 ring-white dark:ring-muted-950 absolute end-[9px] top-[8px] size-2 rounded-full ring-2"
        />
      </button>
    </template>

    <div class="border-muted-200 dark:border-muted-700 flex items-center gap-2.5 border-b px-4 py-3.5">
      <span class="font-heading text-muted-900 text-sm font-bold dark:text-white">Notifications</span>
      <span class="grow" />
      <button
        v-if="unreadCount > 0"
        type="button"
        class="apex-focus text-primary-600 dark:text-primary-400 cursor-pointer rounded-md text-xs font-medium hover:underline"
        @click="markAllAsRead()"
      >
        Mark all read
      </button>
    </div>

    <div class="max-h-[380px] overflow-y-auto">
      <ApexNotificationsList :notifications="notifications" :pending="pending" />
    </div>
  </BaseDropdown>
</template>
