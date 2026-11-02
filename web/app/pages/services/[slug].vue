<script setup lang="ts">
import { loadServicePage } from '~/data/service-pages'

/**
 * One page per service (`<ServicePage>`). A service without content is a
 * 404, not an empty template.
 */
const route = useRoute()
const slug = String(route.params.slug)
if (!loadServicePage(slug)) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}
</script>

<template>
  <ServicePage :slug="slug" />
</template>
