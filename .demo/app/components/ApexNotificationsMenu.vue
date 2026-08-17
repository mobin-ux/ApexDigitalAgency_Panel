<script setup lang="ts">
/**
 * Notifications, in the place users look for them.
 *
 * Backed by the existing `useNotifications` composable and `/api/notifications`
 * — no new endpoint, no new model. The API soft-fails to an empty list for
 * anonymous sessions, so this is safe on every layout that mounts the toolbar.
 */
const { notifications, unreadCount, fetchNotifications, markAllAsRead } = useNotifications()

// Rows are links only when the notification carries one; otherwise a plain div,
// so nothing renders as clickable that does not navigate.
const NuxtLinkComponent = resolveComponent('NuxtLink')

const pending = ref(true)

onMounted(async () => {
  await fetchNotifications()
  pending.value = false
})

/**
 * Tone per notification type. `INFO` is the schema default, so anything
 * unrecognised lands there rather than rendering untinted.
 */
const TONES: Record<string, { icon: string, classes: string }> = {
  SUCCESS: { icon: 'lucide:check', classes: 'bg-success-500/15 text-success-500' },
  WARNING: { icon: 'lucide:alert-triangle', classes: 'bg-warning-500/15 text-warning-500' },
  ERROR: { icon: 'lucide:alert-circle', classes: 'bg-destructive-500/15 text-destructive-500' },
  INFO: { icon: 'lucide:bell', classes: 'bg-primary-500/15 text-primary-500 dark:text-primary-400' },
}

function toneFor(type?: string) {
  return TONES[String(type ?? 'INFO').toUpperCase()] ?? TONES.INFO!
}

const RELATIVE_UNITS: [limit: number, seconds: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [60, 1, 'second'],
  [3600, 60, 'minute'],
  [86400, 3600, 'hour'],
  [604800, 86400, 'day'],
  [2629800, 604800, 'week'],
  [31557600, 2629800, 'month'],
]

/**
 * Relative time, formatted on the client only.
 *
 * "8 minutes ago" is by definition different on the server than it is when the
 * page hydrates a moment later, so rendering it during SSR guarantees a
 * hydration mismatch. The dropdown's contents only exist after `onMounted`
 * anyway, which keeps this honest for free.
 */
function relativeTime(value: string | Date) {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) {
    return ''
  }

  const elapsed = (then - Date.now()) / 1000
  const absolute = Math.abs(elapsed)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  for (const [limit, seconds, unit] of RELATIVE_UNITS) {
    if (absolute < limit) {
      return formatter.format(Math.round(elapsed / seconds), unit)
    }
  }
  return formatter.format(Math.round(elapsed / 31557600), 'year')
}
</script>

<template>
  <BaseDropdown
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
      <button
        type="button"
        :aria-label="unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'"
        class="apex-focus border-muted-200 dark:border-muted-700 dark:bg-muted-950 text-muted-500 hover:border-muted-300 hover:text-muted-900 dark:hover:border-muted-600 relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border bg-white transition-colors dark:hover:text-white"
      >
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

    <!-- Loading -->
    <div v-if="pending" class="flex flex-col">
      <div v-for="n in 3" :key="n" class="border-muted-200 dark:border-muted-700 flex items-start gap-3 border-b px-4 py-3.5 last:border-b-0">
        <BasePlaceload class="size-[34px] shrink-0 rounded-[10px]" />
        <div class="grow space-y-2">
          <BasePlaceload class="h-3 w-full rounded" />
          <BasePlaceload class="h-2.5 w-2/5 rounded" />
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="notifications.length === 0" class="flex flex-col items-center gap-2 px-4 py-9 text-center">
      <span class="bg-muted-100 dark:bg-muted-700/50 text-muted-400 flex size-10 items-center justify-center rounded-full">
        <Icon name="lucide:bell-off" class="size-[18px]" />
      </span>
      <p class="text-muted-500 text-[13px]">
        You're all caught up.
      </p>
    </div>

    <!-- List -->
    <div v-else class="max-h-[380px] overflow-y-auto">
      <component
        :is="item.link ? NuxtLinkComponent : 'div'"
        v-for="item in notifications"
        :key="item.id"
        :to="item.link || undefined"
        class="border-muted-200 dark:border-muted-700 flex items-start gap-3 border-b px-4 py-3.5 last:border-b-0"
        :class="item.link ? 'hover:bg-muted-50 dark:hover:bg-muted-700/40 transition-colors' : ''"
      >
        <span
          class="flex size-[34px] shrink-0 items-center justify-center rounded-[10px]"
          :class="toneFor(item.type).classes"
        >
          <Icon :name="toneFor(item.type).icon" class="size-4" />
        </span>
        <span class="min-w-0 grow">
          <span class="text-muted-900 block text-[13px] font-semibold leading-[1.45] dark:text-white">
            {{ item.title }}
          </span>
          <span v-if="item.message" class="text-muted-500 mt-0.5 line-clamp-2 block text-[12.5px] leading-[1.45]">
            {{ item.message }}
          </span>
          <span class="text-muted-500 mt-1 block text-[11.5px]">{{ relativeTime(item.createdAt) }}</span>
        </span>
        <span
          v-if="!item.isRead"
          aria-hidden="true"
          class="bg-primary-500 dark:bg-primary-400 mt-1.5 size-[7px] shrink-0 rounded-full"
        />
      </component>
    </div>
  </BaseDropdown>
</template>
