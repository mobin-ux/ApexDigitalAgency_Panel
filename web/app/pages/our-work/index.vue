<script setup lang="ts">
import { caseStudies, featuredCaseStudy } from '~/data/case-studies'
import { routes } from '~/data/routes'

const page = useCmsContent('our-work')
const ourWorkSeo = page.value.seo
const siteUrl = useSiteConfig().url
const ogImage = `${siteUrl}/og-default.png`

useSeoMeta({
  title: ourWorkSeo.title,
  description: ourWorkSeo.description,
  ogTitle: ourWorkSeo.title,
  ogDescription: ourWorkSeo.description,
  ogType: 'website',
  ogLocale: 'en_GB',
  ogImage,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'Apex Digital Agency — Grow online. Pay monthly.',
  twitterCard: 'summary_large_image',
  twitterImage: ogImage,
})

// A collection page listing every case study, featured one first, in page
// order. The breadcrumb node comes from <UiBreadcrumbs> in the hero. The
// client quotes are deliberately not marked up as Review: Google does not
// show self-served reviews of a business on its own site.
const listed = [
  { name: featuredCaseStudy.client, slug: featuredCaseStudy.slug },
  ...caseStudies.map(study => ({ name: study.client, slug: study.slug })),
]

useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
    'name': ourWorkSeo.title,
    'description': ourWorkSeo.description,
  }),
  {
    '@type': 'ItemList',
    'name': 'Apex Digital Agency case studies',
    'itemListElement': listed.map((item, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'name': item.name,
      'url': `${siteUrl}${routes.caseStudy(item.slug)}`,
    })),
  },
])
</script>

<template>
  <div>
    <WorkHero />
    <WorkFeatured />
    <WorkProjects />
    <WorkVoices />
    <WorkCta />
  </div>
</template>
