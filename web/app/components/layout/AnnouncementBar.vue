<script setup lang="ts">
/**
 * The site-wide announcement (ADR-021): one line above the header, from the
 * published `announcement` document. It renders only when the document is
 * on, has text and is inside its window; a reader can dismiss it for this
 * browser, and a different message shows again. The decision to show is
 * made on the server from the document alone, so the server and the first
 * client render agree; only the dismissal resolves after mount.
 */
const doc = useCmsContent('announcement')
const { linkAttrs } = useCmsLink()

const live = computed(() => {
  const a = doc.value
  if (!a.enabled || !a.text.trim()) {
    return null
  }
  const now = Date.now()
  if (a.startsAt && Date.parse(a.startsAt) > now) {
    return null
  }
  if (a.endsAt && Date.parse(a.endsAt) < now) {
    return null
  }
  return a
})

const dismissed = ref(false)
const key = computed(() => (live.value ? `apex:announcement:${hash(live.value.text)}` : ''))

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
    // Storage refused: the bar returns next visit, which is acceptable.
  }
}

const TONE = {
  info: 'bg-ink-900 text-white',
  success: 'bg-success-50 text-success-ink',
  warning: 'bg-amber-50 text-heading',
} as const
</script>

<template>
  <div
    v-if="live && !dismissed"
    role="status"
    class="px-4 py-2.5 text-[0.875rem] sm:px-6"
    :class="TONE[live.tone]"
  >
    <div class="container-page flex items-center gap-4">
      <p class="min-w-0 flex-1 text-center">
        {{ live.text }}
        <NuxtLink v-if="live.link" v-bind="linkAttrs(live.link.link)" class="ml-1 font-semibold underline underline-offset-4">
          {{ live.link.label }}
        </NuxtLink>
      </p>
      <button type="button" class="-m-1 shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100" aria-label="Dismiss announcement" @click="dismiss">
        <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 3.5 9 9m0-9-9 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
      </button>
    </div>
  </div>
</template>
