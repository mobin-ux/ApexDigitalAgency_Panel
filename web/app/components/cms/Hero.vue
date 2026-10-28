<script setup lang="ts">
import type { SectionProps } from '../../../shared/cms'

defineProps<{ id: string, props: SectionProps<'hero'> }>()
const { linkAttrs } = useCmsLink()
</script>

<template>
  <section :id="id" class="bg-page px-4 pt-14 pb-16 sm:px-6 lg:pt-20 lg:pb-24">
    <div class="container-page flex max-w-[64ch] flex-col items-start gap-5">
      <UiEyebrowChip v-if="props.eyebrow">
        {{ props.eyebrow }}
      </UiEyebrowChip>
      <h2 class="font-display text-h1 text-heading">
        {{ props.title }}
      </h2>
      <p v-if="props.text" class="text-body-lg text-body">
        {{ props.text }}
      </p>
      <div v-if="props.primary || props.secondary" class="mt-2 flex flex-wrap gap-3">
        <UiButton v-if="props.primary" v-bind="linkAttrs(props.primary.link)" size="lg">
          {{ props.primary.label }}
        </UiButton>
        <UiButton v-if="props.secondary" v-bind="linkAttrs(props.secondary.link)" variant="light" size="lg">
          {{ props.secondary.label }}
        </UiButton>
      </div>
    </div>
  </section>
</template>
