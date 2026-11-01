<script setup lang="ts">
import type { SectionFields } from '#shared/cms'
import { lines } from '#shared/cms'

const props = defineProps<{
  fields: SectionFields<'steps'>
  anchor: string
}>()

const steps = computed(() => lines(props.fields.items))
</script>

<template>
  <section
    :aria-labelledby="fields.heading ? `${anchor}-title` : undefined"
    :aria-label="fields.heading ? undefined : 'Steps'"
    class="container-page flex flex-col gap-10 py-12 lg:py-16"
  >
    <h2
      v-if="fields.heading"
      :id="`${anchor}-title`"
      class="font-display text-h2 text-heading"
    >
      {{ fields.heading }}
    </h2>
    <ol class="grid gap-5 md:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
      <li
        v-for="(step, i) in steps"
        :key="i"
        class="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6 shadow-tile"
      >
        <span
          class="inline-flex size-10 items-center justify-center rounded-full font-bold text-white"
          :class="i === steps.length - 1 ? 'bg-success-ink' : 'bg-violet-500'"
          aria-hidden="true"
        >{{ i === steps.length - 1 ? '✓' : i + 1 }}</span>
        <p class="text-base leading-[1.6] text-heading">
          {{ step }}
        </p>
      </li>
    </ol>
  </section>
</template>
