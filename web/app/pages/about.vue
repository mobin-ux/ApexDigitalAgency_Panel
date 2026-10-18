<script setup lang="ts">
import { aboutSeo } from '~/data/about'

const siteUrl = useSiteConfig().url
const ogImage = `${siteUrl}/og-default.png`

useSeoMeta({
  title: aboutSeo.title,
  description: aboutSeo.description,
  ogTitle: aboutSeo.title,
  ogDescription: aboutSeo.description,
  ogType: 'website',
  ogLocale: 'en_GB',
  ogImage,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'Apex Digital Agency — Grow online. Pay monthly.',
  twitterCard: 'summary_large_image',
  twitterImage: ogImage,
})

// An AboutPage about the agency. The Organization node is the site identity
// (nuxt.config.ts), which carries only confirmed company facts. The team is
// not marked up as Person nodes until the people and their consent are confirmed.
// The breadcrumb node comes from <UiBreadcrumbs> in the hero.
useSchemaOrg([
  defineWebPage({
    '@type': 'AboutPage',
    'name': aboutSeo.title,
    'description': aboutSeo.description,
    'about': { '@id': `${siteUrl}/#identity` },
  }),
])
</script>

<template>
  <div>
    <AboutHero />
    <AboutPromises />
    <AboutTeam />
    <AboutPaperwork />
    <AboutStory />
    <AboutVisit />
    <AboutCta />
  </div>
</template>
