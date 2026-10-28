<script setup lang="ts">
import type { SectionProps } from '#shared/cms'

defineProps<{ id: string, props: SectionProps<'imageText'> }>()
const { linkAttrs } = useCmsLink()
</script>

<template>
  <section :id="id" class="bg-page px-4 py-16 sm:px-6 lg:py-24">
    <div class="container-page grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div class="flex flex-col gap-5" :class="props.imageSide === 'left' ? 'lg:order-2' : ''">
        <h2 class="font-display text-h2 text-heading">
          {{ props.title }}
        </h2>
        <CmsBlocks :blocks="props.blocks" />
        <div v-if="props.button" class="mt-2">
          <UiButton v-bind="linkAttrs(props.button.link)" size="lg">
            {{ props.button.label }}
          </UiButton>
        </div>
      </div>
      <CmsMedia :media="props.image" class="rounded-3xl" />
    </div>
  </section>
</template>
