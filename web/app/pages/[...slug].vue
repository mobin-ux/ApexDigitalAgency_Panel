<script setup lang="ts">
import { seoDefaults } from '~/data/site'
import { resolveSeo } from '../../shared/cms'

/**
 * A landing page published from the panel (ADR-021): an ordered list of
 * sections at an address no code page owns. Nothing here is prerendered;
 * the server reads the published document (cached 60 s) and renders it, so
 * a publish is visible on the next request. No document at this address is
 * the ordinary 404.
 */
const route = useRoute()
const path = route.path.replace(/\/+$/, '') || '/'
const { page } = await useCmsLanding(path)

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

const siteUrl = useSiteConfig().url
const seo = computed(() => resolveSeo(page.value?.seo, { title: page.value?.title ?? '' }, { title: seoDefaults.title, description: seoDefaults.description }))
const ogImage = `${siteUrl}/og-default.png`

useSeoMeta({
  title: () => seo.value.title,
  description: () => seo.value.description,
  robots: () => seo.value.robots,
  ogTitle: () => seo.value.ogTitle,
  ogDescription: () => seo.value.ogDescription,
  ogType: 'website',
  ogLocale: 'en_GB',
  ogImage,
  twitterCard: 'summary_large_image',
  twitterImage: ogImage,
})

if (seo.value.canonical) {
  useHead({ link: [{ rel: 'canonical', href: seo.value.canonical.startsWith('/') ? `${siteUrl}${seo.value.canonical}` : seo.value.canonical }] })
}
if (seo.value.noindex) {
  const event = useRequestEvent()
  if (event) {
    setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  }
}

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
