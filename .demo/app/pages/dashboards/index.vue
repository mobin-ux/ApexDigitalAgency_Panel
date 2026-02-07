<script setup lang="ts">
definePageMeta({
  middleware: [
    function (to, from) {
      // همیشه ریدایرکت کن به صفحه موجودی (یا هر صفحه اصلی که دوست دارید)
      return navigateTo('/dashboards/balance')
    }
  ]
})
</script>
<template>
  <div>Redirecting...</div>
</template>