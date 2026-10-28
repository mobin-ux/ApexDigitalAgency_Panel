<script setup lang="ts">
const page = useCmsContent('about')
const aboutSeo = page.value.seo

const siteUrl = useSiteConfig().url

useCmsSeo(page.value.seo, { title: aboutSeo.title, description: aboutSeo.description })

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
