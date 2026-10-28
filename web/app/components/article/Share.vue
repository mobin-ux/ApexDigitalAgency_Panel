<script setup lang="ts">
import { articleChrome as shareData } from '~/data/article-page'

/**
 * Share row. The two networks are plain links to their share pages (no
 * third-party script or widget reaches the page); copying the address is the
 * one control that needs JavaScript, and it says when the copy fails.
 */
const props = defineProps<{ title: string }>()
const chrome = useCmsContent('article-chrome')
const articleChrome = computed(() => ({ share: { label: chrome.value.share } }))

const route = useRoute()
const pageUrl = `${useSiteConfig().url}${route.path}`

const networks = [
  {
    label: shareData.share.linkedin,
    glyph: 'in',
    href: `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url: pageUrl })}`,
  },
  {
    label: shareData.share.x,
    glyph: 'x',
    href: `https://x.com/intent/post?${new URLSearchParams({ url: pageUrl, text: props.title })}`,
  },
]

const state = ref<'idle' | 'copied' | 'failed'>('idle')
const label = computed(() => ({
  idle: chrome.value.copy,
  copied: chrome.value.copied,
  failed: chrome.value.copyFailed,
})[state.value])

const { start: reset } = useTimeoutFn(() => {
  state.value = 'idle'
}, 1800, { immediate: false })

async function copy() {
  try {
    await navigator.clipboard.writeText(pageUrl)
    state.value = 'copied'
  }
  catch {
    state.value = 'failed'
  }
  reset()
}
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="mr-1 text-[0.8125rem] text-muted">{{ articleChrome.share.label }}</span>
    <a
      v-for="network in networks"
      :key="network.glyph"
      :href="network.href"
      :aria-label="network.label"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex size-9.5 items-center justify-center rounded-[11px] border border-line-strong bg-white font-display text-[0.78125rem] font-semibold text-body transition-colors hover:border-violet-500 hover:text-violet-600"
    >{{ network.glyph }}</a>
    <button
      type="button"
      class="h-9.5 rounded-[11px] border border-line-strong bg-white px-3.5 text-[0.8125rem] font-semibold whitespace-nowrap transition-colors hover:border-violet-500"
      :class="state === 'copied' ? 'text-success-ink' : 'text-body'"
      @click="copy"
    >
      <span aria-live="polite">{{ label }}</span>
    </button>
  </div>
</template>
