<script setup lang="ts">
/**
 * The panel-wide announcement (ADR-021): one line above every customer
 * page, published from the website module. It renders only when
 * /api/config carries a live announcement (on, with text, inside its
 * window), and a reader can dismiss it for this browser; a different
 * message shows again. The bar reserves no space when there is nothing to
 * say, and the dismissal resolves after mount so the server and the first
 * client render agree.
 */
const props = defineProps<{ announcement: { text: string, tone: 'info' | 'success' | 'warning', link: { label: string, link: { kind: string, path?: string, url?: string, key?: string } } | null } | null }>()

const dismissed = ref(false)
const key = computed(() => (props.announcement ? `apex:announcement:${hash(props.announcement.text)}` : ''))

function hash(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

onMounted(() => {
  try {
    dismissed.value = Boolean(key.value && localStorage.getItem(key.value))
  }
  catch {
    dismissed.value = false
  }
})

function dismiss() {
  dismissed.value = true
  try {
    localStorage.setItem(key.value, '1')
  }
  catch {
    // Private mode: it comes back next visit, which is acceptable.
  }
}

const href = computed(() => {
  const link = props.announcement?.link?.link
  if (!link) {
    return ''
  }
  if (link.kind === 'internal') {
    return link.path ?? ''
  }
  if (link.kind === 'external') {
    return link.url ?? ''
  }
  // Panel destinations inside the panel itself.
  return ({ login: '/auth/login-1', signup: '/auth/signup-2', dashboard: '/dashboards/balance', newOrder: '/dashboards/services' } as Record<string, string>)[link.key ?? ''] ?? ''
})

const TONE = {
  info: 'bg-st-info-bg text-st-info-fg',
  success: 'bg-st-success-bg text-st-success-fg',
  warning: 'bg-st-warning-bg text-st-warning-fg',
} as const
</script>

<template>
  <div
    v-if="announcement && !dismissed"
    role="status"
    class="mx-[clamp(16px,3vw,40px)] mt-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-[13px] leading-normal"
    :class="TONE[announcement.tone] ?? TONE.info"
  >
    <span class="min-w-0 flex-1">
      {{ announcement.text }}
      <NuxtLink v-if="announcement.link && href" :to="href" class="ml-1 font-semibold underline underline-offset-2">
        {{ announcement.link.label }}
      </NuxtLink>
    </span>
    <button type="button" class="apex-focus -m-1 shrink-0 rounded-lg p-1 opacity-70 hover:opacity-100" aria-label="Dismiss announcement" @click="dismiss">
      <Icon name="lucide:x" class="size-4" />
    </button>
  </div>
</template>
