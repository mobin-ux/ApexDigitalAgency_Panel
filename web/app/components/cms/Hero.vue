<script setup lang="ts">
import type { SectionFields } from '#shared/cms'

const props = defineProps<{
  fields: SectionFields<'hero'>
  heading: 'h1' | 'h2'
  anchor: string
}>()

const { buttonAttrs } = useCmsButton()
const primary = computed(() => buttonAttrs(props.fields.primary, props.fields.primaryLink))
const secondary = computed(() => buttonAttrs(props.fields.secondary, props.fields.secondaryLink))
</script>

<template>
  <section
    :aria-labelledby="`${anchor}-title`"
    class="container-page flex flex-col gap-7 pt-14 pb-12 md:pt-20 lg:pt-24 lg:pb-16"
  >
    <UiEyebrowChip v-if="fields.eyebrow">
      {{ fields.eyebrow }}
    </UiEyebrowChip>
    <component
      :is="heading"
      :id="`${anchor}-title`"
      class="max-w-[20ch] font-display text-balance text-heading"
      :class="heading === 'h1' ? 'text-display' : 'text-h2'"
    >
      {{ fields.title }}
    </component>
    <p
      v-if="fields.body"
      class="max-w-[56ch] text-lead text-pretty text-body"
    >
      {{ fields.body }}
    </p>
    <div
      v-if="primary || secondary"
      class="mt-1 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap sm:items-center"
    >
      <UiButton
        v-if="primary"
        v-bind="primary.attrs"
        size="lg"
      >
        {{ primary.label }}
      </UiButton>
      <UiButton
        v-if="secondary"
        v-bind="secondary.attrs"
        variant="light"
        size="lg"
      >
        {{ secondary.label }}
      </UiButton>
    </div>
  </section>
</template>
