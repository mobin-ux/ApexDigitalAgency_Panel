<script setup lang="ts">
/** Website › Case studies › one document: the editor (ADR-026). */
definePageMeta({
  title: 'Case studies',
  layout: 'admin',
  middleware: 'admin',
})
</script>

<template>
  <AdminWebsiteEditor collection="work" />
</template>
