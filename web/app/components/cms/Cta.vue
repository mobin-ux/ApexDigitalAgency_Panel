<script setup lang="ts">
import type { SectionProps } from '#shared/cms'

defineProps<{ id: string, props: SectionProps<'cta'> }>()
const { linkAttrs } = useCmsLink()
</script>

<template>
  <section :id="id" class="bg-page px-4 py-16 sm:px-6 lg:py-24">
    <div class="relative container-page flex flex-col gap-6 overflow-hidden rounded-4xl bg-ink-900 px-6 py-12 sm:px-10 lg:flex-row lg:items-center lg:gap-14 lg:px-14 lg:py-16">
      <div class="relative flex max-w-[54ch] flex-col gap-4">
        <h2 class="font-display text-h2 text-white">
          {{ props.title }}
        </h2>
        <p v-if="props.text" class="text-[1.0625rem] leading-[1.62] text-body-on-dark">
          {{ props.text }}
        </p>
      </div>
      <div class="relative lg:ml-auto">
        <UiButton v-bind="linkAttrs(props.button.link)" size="lg">
          {{ props.button.label }}
        </UiButton>
      </div>
    </div>
  </section>
</template>
