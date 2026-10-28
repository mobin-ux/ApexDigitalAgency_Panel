<script setup lang="ts">
import type { MediaRef } from '../../../shared/cms'

/**
 * A media-library reference rendered as an image. The file itself arrives
 * with the media gate; until a document's media index is served, a
 * reference renders nothing rather than a broken image, so a page never
 * shows a placeholder the business did not choose.
 */
const props = defineProps<{ media: MediaRef | undefined }>()
const src = computed(() => (props.media?.mediaId ? `/media/${props.media.mediaId}` : ''))
const resolved = useCmsMedia(src)
</script>

<template>
  <img
    v-if="resolved"
    :src="resolved.src"
    :alt="media?.alt ?? ''"
    :width="resolved.width"
    :height="resolved.height"
    loading="lazy"
    decoding="async"
    class="block max-w-full"
  >
</template>
