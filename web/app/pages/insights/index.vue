<script setup lang="ts">
import { publishedArticles } from '~/data/articles'
import { routes } from '~/data/routes'

const page = useCmsContent('insights')
const insightsSeo = page.value.seo
const siteUrl = useSiteConfig().url

useCmsSeo(page.value.seo, { title: insightsSeo.title, description: insightsSeo.description })

// A collection page listing the written articles only: an unwritten one has no
// URL to list. The breadcrumb node comes from <UiBreadcrumbs> in the hero.
useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
    'name': insightsSeo.title,
    'description': insightsSeo.description,
  }),
  {
    '@type': 'ItemList',
    'name': 'Apex Digital Agency insights',
    'itemListElement': publishedArticles.map((article, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'name': article.title,
      'url': `${siteUrl}${routes.article(article.slug)}`,
    })),
  },
])

const filter = provideInsightsFilter()
</script>

<template>
  <div>
    <InsightsHero />
    <InsightsFeatured v-if="!filter.filtered.value" />
    <InsightsBrowse />
    <InsightsCosts />
    <InsightsCta />
  </div>
</template>
