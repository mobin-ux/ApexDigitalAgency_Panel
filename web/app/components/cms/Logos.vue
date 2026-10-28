<script setup lang="ts">
import type { SectionProps } from '../../../shared/cms'

defineProps<{ id: string, props: SectionProps<'logos'> }>()
</script>

<template>
  <section :id="id" class="bg-page px-4 py-12 sm:px-6 lg:py-16">
    <div class="container-page flex flex-col gap-6">
      <p v-if="props.title" class="text-center text-[0.78rem] font-bold tracking-widest text-muted uppercase">
        {{ props.title }}
      </p>
      <ul class="flex flex-wrap items-center justify-center gap-8">
        <li v-for="(logo, i) in props.items" :key="i" class="h-10">
          <CmsMedia :media="logo" class="h-10 w-auto" />
        </li>
      </ul>
    </div>
  </section>
</template>
