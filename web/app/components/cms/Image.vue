<script setup lang="ts">
import type { SectionFields } from '#shared/cms'

/**
 * An image from the media library. Until the image resolves to a library
 * file (the Media library screen arrives in phase D), the section renders
 * nothing rather than an empty frame on the live site.
 */
const props = defineProps<{ fields: SectionFields<'image'> }>()

const media = useCmsMedia(() => props.fields.media)
</script>

<template>
  <figure
    v-if="media"
    class="container-page flex flex-col gap-3 py-10 lg:py-14"
  >
    <div class="overflow-hidden rounded-2xl border border-line">
      <NuxtImg
        :src="media.src"
        :alt="media.alt"
        :width="media.width ?? undefined"
        :height="media.height ?? undefined"
        sizes="100vw lg:1200px"
        loading="lazy"
        class="h-auto w-full"
      />
    </div>
    <figcaption
      v-if="fields.caption"
      class="text-sm text-muted"
    >
      {{ fields.caption }}
    </figcaption>
  </figure>
</template>
