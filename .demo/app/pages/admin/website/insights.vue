<script setup lang="ts">
/**
 * Admin console — Insights (`Admin Console.dc.html`): the articles on
 * /insights, as documents of the `article` template. View counts are not
 * shown: no analytics is connected.
 */
definePageMeta({
  title: 'Insights',
  layout: 'admin',
  middleware: 'admin',
})
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="Insights" accent="articles" subtitle="Articles on /insights. The panel edits their titles, leads and search listing; an article’s body is written in the site’s code." />
    <AdminWebsiteDocList template="article" noun="articles" />
  </AdminPage>
</template>
