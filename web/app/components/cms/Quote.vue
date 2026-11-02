<script setup lang="ts">
import type { SectionFields } from '#shared/cms'

defineProps<{ fields: SectionFields<'quote'> }>()
</script>

<template>
  <figure class="container-page py-12 lg:py-16">
    <div class="flex max-w-[60ch] flex-col gap-5 border-l-4 border-violet-500 pl-6">
      <blockquote class="font-display text-[1.5rem] leading-[1.35] font-semibold tracking-tight text-pretty text-heading sm:text-[1.75rem]">
        <p>“{{ fields.quote }}”</p>
      </blockquote>
      <figcaption
        v-if="fields.name"
        class="text-[0.9375rem] text-muted"
      >
        {{ fields.name }}
      </figcaption>
    </div>
  </figure>
</template>
