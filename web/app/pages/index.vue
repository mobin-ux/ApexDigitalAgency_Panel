<script setup lang="ts">
const home = useCmsContent('home')

// Absolute URL: social crawlers do not resolve relative image paths.
const ogImage = `${useSiteConfig().url}/og-default.png`

useSeoMeta({
  title: home.value.seo.title,
  description: home.value.seo.description,
  ogTitle: home.value.seo.title,
  ogDescription: home.value.seo.description,
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
    'name': home.value.seo.title,
    'description': home.value.seo.description,
    'mainEntity': home.value.faq.items.map(item => ({
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
