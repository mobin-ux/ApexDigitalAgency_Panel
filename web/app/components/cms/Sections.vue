<script setup lang="ts">
import type { Section } from '#shared/cms'

/**
 * A page, article or case study built in the admin console (ADR-026):
 * its sections in order, each with its own component. Hidden sections are
 * skipped. When the first visible section is not a hero the document title
 * becomes a visually hidden h1, so every page keeps one.
 */
const props = defineProps<{
  sections: readonly Section[]
  title: string
}>()

const visible = computed(() => props.sections.filter(s => !s.hidden))
</script>

<template>
  <div>
    <h1
      v-if="visible[0]?.type !== 'hero'"
      class="sr-only"
    >
      {{ title }}
    </h1>
    <template
      v-for="(section, i) in visible"
      :key="section.id"
    >
      <CmsHero
        v-if="section.type === 'hero'"
        :fields="(section as Section<'hero'>).fields"
        :heading="i === 0 ? 'h1' : 'h2'"
        :anchor="section.id"
      />
      <CmsText
        v-else-if="section.type === 'text'"
        :fields="(section as Section<'text'>).fields"
        :anchor="section.id"
      />
      <CmsServices
        v-else-if="section.type === 'services'"
        :fields="(section as Section<'services'>).fields"
        :anchor="section.id"
      />
      <CmsSteps
        v-else-if="section.type === 'steps'"
        :fields="(section as Section<'steps'>).fields"
        :anchor="section.id"
      />
      <CmsCards
        v-else-if="section.type === 'cards'"
        :fields="(section as Section<'cards'>).fields"
        :anchor="section.id"
      />
      <CmsFaq
        v-else-if="section.type === 'faq'"
        :fields="(section as Section<'faq'>).fields"
        :anchor="section.id"
      />
      <CmsQuote
        v-else-if="section.type === 'quote'"
        :fields="(section as Section<'quote'>).fields"
      />
      <CmsImage
        v-else-if="section.type === 'image'"
        :fields="(section as Section<'image'>).fields"
      />
      <CmsCta
        v-else-if="section.type === 'cta'"
        :fields="(section as Section<'cta'>).fields"
        :anchor="section.id"
      />
    </template>
  </div>
</template>
