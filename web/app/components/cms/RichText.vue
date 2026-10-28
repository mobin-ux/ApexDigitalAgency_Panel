<script setup lang="ts">
import type { SectionProps } from '../../../shared/cms'

defineProps<{ id: string, props: SectionProps<'richText'> }>()
</script>

<template>
  <section :id="id" class="bg-page px-4 py-12 sm:px-6 lg:py-16">
    <div class="container-page max-w-[70ch]">
      <CmsBlocks :blocks="props.blocks" />
    </div>
  </section>
</template>
