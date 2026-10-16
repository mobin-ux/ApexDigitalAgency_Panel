<script setup lang="ts">
import { defaultPlanTerm } from '~/data/plans'
import { routes } from '~/data/routes'
import { loadServicePage } from '~/data/service-pages'
import { services } from '~/data/services'

/**
 * One page per service, rendered from its content file in
 * `data/service-pages/`. A service without content is a 404, not an empty
 * template.
 */
const route = useRoute()
const loader = loadServicePage(String(route.params.slug))
if (!loader) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}
const page = await loader
const service = services.find(s => s.slug === page.slug)!

const siteUrl = useSiteConfig().url
const pageUrl = `${siteUrl}${routes.service(page.slug)}`
const ogImage = `${siteUrl}/og-default.png`

useSeoMeta({
  title: page.seo.title,
  description: page.seo.description,
  ogTitle: page.seo.title,
  ogDescription: page.seo.description,
  ogType: 'website',
  ogLocale: 'en_GB',
  ogImage,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'Apex Digital Agency — Grow online. Pay monthly.',
  twitterCard: 'summary_large_image',
  twitterImage: ogImage,
})

// The page, its questions, and the service with one offer per plan. Prices
// are the same catalogue figures the plan cards render. The breadcrumb node
// comes from <UiBreadcrumbs> in the hero.
useSchemaOrg([
  defineWebPage({
    '@type': ['WebPage', 'FAQPage'],
    'name': page.seo.title,
    'description': page.seo.description,
    'mainEntity': page.faq.items.map(item => ({
      '@type': 'Question',
      'name': item.question,
      'acceptedAnswer': { '@type': 'Answer', 'text': item.answer },
    })),
  }),
  {
    '@type': 'Service',
    'name': service.name,
    'serviceType': service.shortName,
    'description': page.seo.description,
    'url': pageUrl,
    'provider': { '@id': `${siteUrl}/#identity` },
    'areaServed': { '@type': 'Country', 'name': 'United Kingdom' },
    'offers': page.plans.catalogue.map(plan => ({
      '@type': 'Offer',
      'name': `${plan.name} plan`,
      'url': `${pageUrl}#plans`,
      'priceCurrency': 'GBP',
      'price': plan.monthly[defaultPlanTerm],
      'priceSpecification': {
        '@type': 'UnitPriceSpecification',
        'price': plan.monthly[defaultPlanTerm],
        'priceCurrency': 'GBP',
        'unitCode': 'MON',
        'billingDuration': defaultPlanTerm,
        'valueAddedTaxIncluded': true,
      },
    })),
  },
])
</script>

<template>
  <div>
    <ServiceHero :page="page" />
    <ServiceAudiences :page="page" />
    <ServiceOffering :page="page" />
    <ServiceTechnology :page="page" />
    <ServiceProcess :page="page" />
    <ServiceWork :page="page" />
    <ServicePlans :page="page" />
    <ServiceProof :page="page" />
    <ServiceVoices :page="page" />
    <ServiceFaq :page="page" />
    <ServiceCta :page="page" />
  </div>
</template>
