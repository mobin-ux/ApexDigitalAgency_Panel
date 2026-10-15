<script setup lang="ts">
import { faqs } from '~/data/home'
import { seoDefaults } from '~/data/site'

// Absolute URL: social crawlers do not resolve relative image paths.
const ogImage = `${useSiteConfig().url}/og-default.png`

useSeoMeta({
  title: seoDefaults.title,
  description: seoDefaults.description,
  ogTitle: seoDefaults.title,
  ogDescription: seoDefaults.description,
  ogType: 'website',
  ogLocale: 'en_GB',
  ogImage,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'Apex Digital Agency — Grow online. Pay monthly.',
  twitterCard: 'summary_large_image',
  twitterImage: ogImage,
})

// The Organization identity comes from nuxt.config (`schemaOrg.identity`).
// The page-level node describes this page and the questions answered on it.
useSchemaOrg([
  defineWebPage({
    '@type': ['WebPage', 'FAQPage'],
    'name': seoDefaults.title,
    'description': seoDefaults.description,
    'mainEntity': faqs.map(item => ({
      '@type': 'Question',
      'name': item.question,
      'acceptedAnswer': { '@type': 'Answer', 'text': item.answer },
    })),
  }),
])
</script>

<template>
  <div>
    <HomeHero />
    <HomeClients />
    <HomeServices />
    <HomeMonthly />
    <HomeWork />
    <HomeWhy />
    <HomeInsights />
    <HomeFaq />
    <HomeCta />
  </div>
</template>
