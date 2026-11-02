<script setup lang="ts">
/** Website › Pages › one document: the editor (ADR-026). */
definePageMeta({
  title: 'Pages',
  layout: 'admin',
  middleware: 'admin',
})
</script>

<template>
  <AdminWebsiteEditor collection="pages" />
</template>
