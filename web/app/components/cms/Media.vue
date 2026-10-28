<script setup lang="ts">
import type { MediaRef } from '../../../shared/cms'

/**
 * A media-library reference rendered as an optimised image (or a link, for
 * a PDF). The document's own alt text wins over the library's; an unknown
 * reference renders nothing rather than a broken image.
 */
const props = defineProps<{ media: MediaRef | undefined, sizes?: string }>()
const src = computed(() => (props.media?.mediaId ? `/media/${props.media.mediaId}` : ''))
const resolved = useCmsMedia(src)
const alt = computed(() => props.media?.alt || resolved.value?.alt || '')
</script>

<template>
  <NuxtImg
    v-if="resolved?.image"
    :src="resolved.src"
    :alt="alt"
    :width="resolved.width"
    :height="resolved.height"
    :sizes="sizes ?? '100vw sm:50vw lg:600px'"
    format="avif,webp"
    loading="lazy"
    class="block max-w-full"
  />
  <a v-else-if="resolved" :href="resolved.src" class="font-semibold text-violet-600 underline underline-offset-4">
    {{ alt || 'Download' }}
  </a>
</template>
