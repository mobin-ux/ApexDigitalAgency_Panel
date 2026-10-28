<script setup lang="ts">
import type { SectionProps } from '#shared/cms'

defineProps<{ id: string, props: SectionProps<'features'> }>()
</script>

<template>
  <section :id="id" class="bg-subtle px-4 py-16 sm:px-6 lg:py-24">
    <div class="container-page flex flex-col gap-10">
      <UiSectionHeader v-if="props.title" :id="`${id}-title`" eyebrow="" :title="props.title">
        <template v-if="props.text">
          {{ props.text }}
        </template>
      </UiSectionHeader>
      <ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="(item, i) in props.items" :key="i" class="flex flex-col gap-2 rounded-2xl border border-line bg-page p-6">
          <h3 class="font-display text-[1.125rem] font-semibold tracking-tight text-heading">
            {{ item.title }}
          </h3>
          <p v-if="item.text" class="text-[0.9375rem] leading-relaxed text-body">
            {{ item.text }}
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>
