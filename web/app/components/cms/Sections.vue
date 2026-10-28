<script setup lang="ts">
import type { Section } from '../../../shared/cms'

/**
 * Renders a landing page's sections in order. Each type has its own
 * component on the site's own primitives; a type the site does not know
 * cannot reach here (the resolver drops it), and a hidden section is
 * filtered by the page.
 */
defineProps<{ sections: readonly Section[] }>()

const components = {
  hero: resolveComponent('CmsHero'),
  richText: resolveComponent('CmsRichText'),
  features: resolveComponent('CmsFeatures'),
  stats: resolveComponent('CmsStats'),
  testimonials: resolveComponent('CmsTestimonials'),
  faq: resolveComponent('CmsFaq'),
  cta: resolveComponent('CmsCta'),
  banner: resolveComponent('CmsBanner'),
  imageText: resolveComponent('CmsImageText'),
  services: resolveComponent('CmsServices'),
  logos: resolveComponent('CmsLogos'),
} as const
</script>

<template>
  <component
    :is="components[section.type]"
    v-for="section in sections"
    :id="section.id"
    :key="section.id"
    :props="section.props"
  />
</template>
