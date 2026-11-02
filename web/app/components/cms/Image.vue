<script setup lang="ts">
import type { SectionFields } from '#shared/cms'

/**
 * An image from the media library, served by this site at `/media/…` (the
 * file passes through from the console). Until the section names a file
 * the library still holds, it renders nothing rather than an empty frame.
 * Width and height come from the file, so the page does not jump as it loads.
 */
const props = defineProps<{ fields: SectionFields<'image'> }>()

const media = useCmsMedia(() => props.fields.media)
const image = computed(() => (media.value?.mime.startsWith('image/') ? media.value : null))
</script>

<template>
  <figure
    v-if="image"
    class="container-page flex flex-col gap-3 py-10 lg:py-14"
  >
    <div class="overflow-hidden rounded-2xl border border-line">
      <img
        :src="image.src"
        :alt="image.alt"
        :width="image.width ?? undefined"
        :height="image.height ?? undefined"
        loading="lazy"
        decoding="async"
        class="h-auto w-full"
      >
    </div>
    <figcaption
      v-if="fields.caption"
      class="text-sm text-muted"
    >
      {{ fields.caption }}
    </figcaption>
  </figure>
</template>
