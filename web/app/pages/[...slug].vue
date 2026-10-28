<script setup lang="ts">
import { CMS_MEDIA_KEY } from '~/composables/useCmsContent'

/**
 * A landing page published from the panel (ADR-021): an ordered list of
 * sections at an address no code page owns. Nothing here is prerendered;
 * the server reads the published document (cached 60 s) and renders it, so
 * a publish is visible on the next request. No document at this address is
 * the ordinary 404.
 */
const route = useRoute()
const path = route.path.replace(/\/+$/, '') || '/'
const { page, media } = await useCmsLanding(path)
provide(CMS_MEDIA_KEY, media)

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

useCmsSeo(page.value?.seo, { title: page.value?.title ?? '' })

const sections = computed(() => page.value?.sections.filter(section => !section.hidden) ?? [])
</script>

<template>
  <main v-if="page" id="main">
    <h1 class="sr-only">
      {{ page.title }}
    </h1>
    <CmsSections :sections="sections" />
  </main>
</template>
