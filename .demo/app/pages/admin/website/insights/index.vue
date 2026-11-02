<script setup lang="ts">
/** Website › Insights (`Admin Console.dc.html`, ADR-026): the shared document list. */
definePageMeta({
  title: 'Insights',
  layout: 'admin',
  middleware: 'admin',
})
</script>

<template>
  <AdminWebsiteDocList collection="insights" />
</template>
