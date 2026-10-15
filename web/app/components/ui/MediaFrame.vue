<script setup lang="ts">
import type { MediaImage } from '~/data/content'

/**
 * Image area for case studies and articles. Renders an optimised <NuxtImg>
 * when real artwork exists, and a quiet violet panel until then — so pages are
 * laid out and measured for the final aspect ratio before the photography
 * arrives, and swapping an image in is a data change, not a markup change.
 */
defineProps<{
  image?: MediaImage
  /** `true` for the first image on screen (sets eager loading + high priority). */
  priority?: boolean
  sizes?: string
}>()
</script>

<template>
  <div class="relative size-full overflow-hidden bg-violet-50">
    <NuxtImg
      v-if="image"
      :src="image.src"
      :alt="image.alt"
      :width="image.width"
      :height="image.height"
      :sizes="sizes"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : 'auto'"
      format="avif,webp"
      class="size-full object-cover"
    />
    <div
      v-else
      class="absolute inset-0 bg-[radial-gradient(60%_80%_at_70%_30%,var(--color-violet-100),transparent)]"
      aria-hidden="true"
    />
  </div>
</template>
