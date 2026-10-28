<script setup lang="ts">
import type { SectionProps } from '../../../shared/cms'

defineProps<{ id: string, props: SectionProps<'faq'> }>()
</script>

<template>
  <section :id="id" class="bg-subtle px-4 py-16 sm:px-6 lg:py-24">
    <div class="container-page flex max-w-[76ch] flex-col gap-8">
      <h2 v-if="props.title" class="font-display text-h2 text-heading">
        {{ props.title }}
      </h2>
      <UiFaqList :name="`cms-${id}`" :items="props.items" />
    </div>
  </section>
</template>
