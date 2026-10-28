<script setup lang="ts">
const page = useCmsContent('contact')
const contactSeo = page.value.seo
const contactFaq = page.value.faq

const siteUrl = useSiteConfig().url

useCmsSeo(page.value.seo, { title: contactSeo.title, description: contactSeo.description })

// A ContactPage about the agency, with its questions. The Organization node
// (nuxt.config.ts) carries the confirmed email and, once known, the phone and
// address. The breadcrumb node comes from <UiBreadcrumbs> in the hero.
useSchemaOrg([
  defineWebPage({
    '@type': ['ContactPage', 'FAQPage'],
    'name': contactSeo.title,
    'description': contactSeo.description,
    'about': { '@id': `${siteUrl}/#identity` },
    'mainEntity': contactFaq.items.map(item => ({
      '@type': 'Question',
      'name': item.question,
      'acceptedAnswer': { '@type': 'Answer', 'text': item.answer },
    })),
  }),
])
</script>

<template>
  <div>
    <ContactHero />
    <section
      aria-label="Message us"
      class="container-page pt-12 lg:pt-16"
    >
      <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <ContactForm />
        <ContactAside />
      </div>
    </section>
    <ContactStudio />
    <ContactFaq />
  </div>
</template>
