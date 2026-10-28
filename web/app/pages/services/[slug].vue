<script setup lang="ts">
import { serviceBaseline } from '~/data/cms-baseline'
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
const loaded = await loader
// The CMS overlay covers the hero copy, the questions, the closing panel and
// the search listing; plans, prices, process and proof stay in the catalogue.
const cms = useCmsRecord('service', routes.service(loaded.slug), serviceBaseline(loaded))
const page = {
  ...loaded,
  hero: { ...loaded.hero, ...cms.value.hero },
  faq: cms.value.faq,
  cta: { ...loaded.cta, ...cms.value.cta },
  seo: { title: cms.value.seo.title, description: cms.value.seo.description },
}
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

// One offer per plan, priced from the same catalogue the plan cards render.
// Monthly plans are a unit price per month; a fixed number of payments adds a
// billing duration. Quoted work lists only the steps that have a price.
function planOffers() {
  const url = `${pageUrl}#plans`
  const monthlyOffer = (name: string, price: number, months?: number) => ({
    '@type': 'Offer',
    name,
    url,
    'priceCurrency': 'GBP',
    price,
    'priceSpecification': {
      '@type': 'UnitPriceSpecification',
      price,
      'priceCurrency': 'GBP',
      'unitCode': 'MON',
      ...(months ? { billingDuration: months } : {}),
      'valueAddedTaxIncluded': true,
    },
  })
  const plans = page.plans
  switch (plans.kind) {
    case 'terms':
      return plans.catalogue.map(plan => monthlyOffer(`${plan.name} plan`, plan.monthly[defaultPlanTerm], defaultPlanTerm))
    case 'monthly':
      return plans.items.map(plan => monthlyOffer(
        `${plan.name} plan`,
        plan.monthly,
        plan.billing.kind === 'instalments' ? plan.billing.months : undefined,
      ))
    case 'scoping':
      return plans.steps
        .filter(step => step.price !== null)
        .map(step => ({ '@type': 'Offer', 'name': step.name, url, 'priceCurrency': 'GBP', 'price': step.price }))
  }
}

// The page, its questions, and the service with its offers. The breadcrumb
// node comes from <UiBreadcrumbs> in the hero.
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
    'offers': planOffers(),
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
