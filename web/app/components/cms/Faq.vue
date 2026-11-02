<script setup lang="ts">
import type { SectionFields } from '#shared/cms'
import { faqItems } from '#shared/cms'

const props = defineProps<{
  fields: SectionFields<'faq'>
  anchor: string
}>()

// A line with no answer after its "?" is not a question the visitor can open.
const items = computed(() => faqItems(props.fields.items).filter(item => item.answer))
</script>

<template>
  <section
    v-if="items.length"
    :aria-labelledby="fields.heading ? `${anchor}-title` : undefined"
    :aria-label="fields.heading ? undefined : 'Questions'"
    class="container-page flex flex-col gap-8 py-12 lg:py-16"
  >
    <h2
      v-if="fields.heading"
      :id="`${anchor}-title`"
      class="font-display text-h2 text-heading"
    >
      {{ fields.heading }}
    </h2>
    <UiFaqList
      :name="`faq-${anchor}`"
      :items="items"
    />
  </section>
</template>
