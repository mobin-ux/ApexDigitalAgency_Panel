<script setup lang="ts">
import type { SectionFields } from '#shared/cms'

const props = defineProps<{
  fields: SectionFields<'cta'>
  anchor: string
}>()

const { buttonAttrs } = useCmsButton()
const button = computed(() => buttonAttrs(props.fields.button, props.fields.buttonLink))
</script>

<template>
  <section
    :aria-labelledby="`${anchor}-title`"
    class="bg-page px-4 py-12 sm:px-6 lg:py-20"
  >
    <div class="relative mx-auto flex max-w-300 flex-col items-start gap-5.5 overflow-hidden rounded-4xl bg-ink-900 px-6 py-12 sm:px-10 sm:py-16 lg:rounded-5xl lg:px-16">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_120%_at_88%_26%,rgb(125_83_242/0.3),transparent_60%)]"
        aria-hidden="true"
      />
      <h2
        :id="`${anchor}-title`"
        class="relative max-w-[22ch] font-display text-h2 text-white"
      >
        {{ fields.title }}
      </h2>
      <p
        v-if="fields.body"
        class="relative max-w-[52ch] text-body-lg text-body-on-dark"
      >
        {{ fields.body }}
      </p>
      <UiButton
        v-if="button"
        v-bind="button.attrs"
        size="lg"
        class="relative mt-2"
      >
        {{ button.label }}
      </UiButton>
    </div>
  </section>
</template>
