<script setup lang="ts">
/**
 * The notification list itself, shared by the desktop dropdown and the mobile
 * sheet (V2 Phase 1 mobile, §6).
 *
 * One component rather than two because only one container is ever mounted at a
 * time: the sheet exists only below `lg` and the dropdown only above it, so a
 * `lg:` utility is an unambiguous "dropdown value" and the bare one is the
 * sheet's. That keeps the two renderings honest — a row cannot gain a field in
 * one and not the other.
 *
 * The differences §6 asks for are all size and wrapping: a phone gets a bigger
 * icon chip, a 64px minimum row and text that **wraps** rather than truncating,
 * because a notification whose second line is cut off is a notification the
 * customer has to open something else to read.
 */
const { notifications, pending } = defineProps<{
  notifications: any[]
  pending: boolean
}>()

const NuxtLinkComponent = resolveComponent('NuxtLink')

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
 * hydration mismatch. Both containers only render after a user opens them,
 * which keeps this honest for free.
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
  <!-- Loading -->
  <div v-if="pending" class="flex flex-col">
    <div v-for="n in 3" :key="n" class="border-muted-200 dark:border-muted-700 flex min-h-16 items-start gap-3 border-b px-4 py-3.5 last:border-b-0 lg:min-h-0">
      <BasePlaceload class="size-[38px] shrink-0 rounded-xl lg:size-[34px] lg:rounded-[10px]" />
      <div class="grow space-y-2">
        <BasePlaceload class="h-3 w-full rounded" />
        <BasePlaceload class="h-2.5 w-2/5 rounded" />
      </div>
    </div>
  </div>

  <!-- Empty -->
  <div v-else-if="notifications.length === 0" class="flex flex-col items-center gap-2 px-4 py-12 text-center lg:py-9">
    <span class="bg-muted-100 dark:bg-muted-700/50 text-muted-400 flex size-10 items-center justify-center rounded-full">
      <Icon name="lucide:bell-off" class="size-[18px]" />
    </span>
    <p class="text-muted-500 text-[13px]">
      You're all caught up.
    </p>
  </div>

  <!-- List -->
  <div v-else class="flex flex-col">
    <component
      :is="item.link ? NuxtLinkComponent : 'div'"
      v-for="item in notifications"
      :key="item.id"
      :to="item.link || undefined"
      class="border-muted-200 dark:border-muted-700 flex min-h-16 items-start gap-3 border-b px-4 py-3.5 last:border-b-0 lg:min-h-0"
      :class="item.link ? 'hover:bg-muted-50 dark:hover:bg-muted-700/40 transition-colors' : ''"
    >
      <span
        class="flex size-[38px] shrink-0 items-center justify-center rounded-xl lg:size-[34px] lg:rounded-[10px]"
        :class="toneFor(item.type).classes"
      >
        <Icon :name="toneFor(item.type).icon" class="size-[18px] lg:size-4" />
      </span>
      <span class="min-w-0 grow">
        <span class="text-muted-900 block text-sm font-semibold leading-[1.45] lg:text-[13px] dark:text-white">
          {{ item.title }}
        </span>
        <!--
          `line-clamp-none` on a phone: the body is the message. Truncating it
          to two lines in a panel with the whole viewport to spend just sends
          the customer somewhere else to read the rest.
        -->
        <span v-if="item.message" class="text-muted-500 mt-0.5 block text-[13px] leading-[1.45] lg:line-clamp-2 lg:text-[12.5px]">
          {{ item.message }}
        </span>
        <span class="text-muted-500 mt-1 block text-xs lg:text-[11.5px]">{{ relativeTime(item.createdAt) }}</span>
      </span>
      <span
        v-if="!item.isRead"
        aria-hidden="true"
        class="bg-primary-500 dark:bg-primary-400 mt-1.5 size-2 shrink-0 rounded-full lg:size-[7px]"
      />
    </component>
  </div>
</template>
