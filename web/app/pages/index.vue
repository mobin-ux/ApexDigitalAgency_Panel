<script setup lang="ts">
const home = useCmsContent('home')

useCmsSeo(home.value.seo, { title: home.value.seo.title, description: home.value.seo.description })

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
