<script setup lang="ts">
/**
 * Admin console — Case studies (`Admin Console.dc.html`): the studies on
 * /our-work as cards, documents of the `case-study` template.
 */
definePageMeta({
  title: 'Case studies',
  layout: 'admin',
  middleware: 'admin',
})
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="Case" accent="studies" subtitle="Shown on /our-work. Figures in a case study must come from the client’s own reporting." />
    <AdminWebsiteDocList template="case-study" layout="cards" noun="case studies" />
  </AdminPage>
</template>
