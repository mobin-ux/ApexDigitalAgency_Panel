<script setup lang="ts">
import type { HeroVisual } from '~/data/service-pages/types'

/**
 * Decorative composition beside the service hero: a drawing of the product
 * the service delivers (a site, a search result, a campaign, a calendar …)
 * with a notification and a floating card. It illustrates the offer rather
 * than reporting anyone's data, so it is hidden from assistive tech, and
 * below `sm` the copy and calls to action own the first viewport.
 */
defineProps<{ visual: HeroVisual }>()
</script>

<template>
  <div
    class="relative mx-auto hidden h-140 w-120 sm:block"
    aria-hidden="true"
  >
    <div class="absolute top-11.5 left-26 size-84 rounded-full bg-[radial-gradient(circle_at_50%_38%,var(--color-violet-400)_0%,var(--color-violet-500)_55%,var(--color-violet-600)_100%)] shadow-blob motion-safe:animate-blob" />

    <ServiceVisualSite
      v-if="visual.kind === 'site'"
      :visual="visual"
    />
    <ServiceVisualSearch
      v-else-if="visual.kind === 'search'"
      :visual="visual"
    />
    <ServiceVisualAds
      v-else-if="visual.kind === 'ads'"
      :visual="visual"
    />
    <ServiceVisualMarketing
      v-else-if="visual.kind === 'marketing'"
      :visual="visual"
    />
    <ServiceVisualSoftware
      v-else-if="visual.kind === 'software'"
      :visual="visual"
    />
    <ServiceVisualUx
      v-else-if="visual.kind === 'ux'"
      :visual="visual"
    />
    <ServiceVisualBrand
      v-else
      :visual="visual"
    />
  </div>
</template>
