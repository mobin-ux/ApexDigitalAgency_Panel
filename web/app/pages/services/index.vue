<script setup lang="ts">
import { routes } from '~/data/routes'
import { catalogueServices } from '~/data/services'

const page = useCmsContent('services')
const servicesSeo = page.value.seo

const siteUrl = useSiteConfig().url

useCmsSeo(page.value.seo, { title: servicesSeo.title, description: servicesSeo.description })

// A collection page listing every service, in the order the page shows them.
// The breadcrumb node comes from <UiBreadcrumbs> in the hero.
useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
    'name': servicesSeo.title,
    'description': servicesSeo.description,
  }),
  {
    '@type': 'ItemList',
    'name': 'Apex Digital Agency services',
    'itemListElement': catalogueServices.map((service, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'name': service.shortName,
      'url': `${siteUrl}${routes.service(service.slug)}`,
    })),
  },
])
</script>

<template>
  <div>
    <ServicesHero />
    <ServicesFinder />
    <ServicesCombinations />
    <ServicesOrdering />
    <ServicesCta />
  </div>
</template>
