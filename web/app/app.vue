<script setup lang="ts">
/**
 * The Organization identity for structured data, from the company facts in
 * `data/site.ts`. Only confirmed facts reach the markup: an empty phone,
 * address line or profile URL is left out.
 */
import { company as c } from '~/data/site'

const identity = computed(() => {
  const profiles = c.social.filter(p => p.url).map(p => p.url)
  return {
    name: c.name,
    legalName: c.legalName,
    logo: '/brand/apex-icon.svg',
    email: c.email,
    ...(c.phone ? { telephone: c.phone } : {}),
    ...(profiles.length ? { sameAs: profiles } : {}),
    address: {
      ...(c.address.street ? { streetAddress: c.address.street } : {}),
      ...(c.address.postcode ? { postalCode: c.address.postcode } : {}),
      addressLocality: c.address.locality,
      addressRegion: c.address.region,
      addressCountry: c.address.country,
    },
    areaServed: 'GB',
  }
})
useSchemaOrg([defineOrganization(identity.value)])
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
