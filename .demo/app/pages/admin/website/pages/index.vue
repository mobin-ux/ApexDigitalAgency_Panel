<script setup lang="ts">
/** Website › Pages (`Admin Console.dc.html`, ADR-026): the shared document list. */
definePageMeta({
  title: 'Pages',
  layout: 'admin',
  middleware: 'admin',
})
</script>

<template>
  <AdminWebsiteDocList collection="pages" />
</template>
