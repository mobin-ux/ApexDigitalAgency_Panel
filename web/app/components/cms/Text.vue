<script setup lang="ts">
import type { SectionFields } from '#shared/cms'
import { paragraphs } from '#shared/cms'

const props = defineProps<{
  fields: SectionFields<'text'>
  anchor: string
}>()

const paras = computed(() => paragraphs(props.fields.body))
</script>

<template>
  <section
    v-if="fields.heading || paras.length"
    :aria-labelledby="fields.heading ? `${anchor}-title` : undefined"
    class="container-page py-10 lg:py-14"
  >
    <div class="flex max-w-[68ch] flex-col gap-5">
      <h2
        v-if="fields.heading"
        :id="`${anchor}-title`"
        class="font-display text-h3 text-heading"
      >
        {{ fields.heading }}
      </h2>
      <p
        v-for="(para, i) in paras"
        :key="i"
        class="text-base leading-[1.7] whitespace-pre-line text-body"
      >
        {{ para }}
      </p>
    </div>
  </section>
</template>
