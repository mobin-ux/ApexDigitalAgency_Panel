<script setup lang="ts">
/** Website › Insights › one document: the editor (ADR-026). */
definePageMeta({
  title: 'Insights',
  layout: 'admin',
  middleware: 'admin',
})
</script>

<template>
  <AdminWebsiteEditor collection="insights" />
</template>
