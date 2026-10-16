<script setup lang="ts">
import type { ServicePageContent } from '~/data/service-pages/types'
import { company } from '~/data/site'

defineProps<{ page: ServicePageContent }>()
</script>

<template>
  <section
    id="faq"
    aria-labelledby="service-faq-title"
    class="container-page grid items-start gap-10 py-20 lg:grid-cols-[0.72fr_1.28fr] lg:gap-18 lg:py-26"
  >
    <div class="lg:sticky lg:top-29">
      <UiSectionHeader
        id="service-faq-title"
        eyebrow="Questions"
        :title="page.faq.title"
      >
        Anything else, ask us directly — <a
          :href="`mailto:${company.email}`"
          class="font-semibold text-violet-600 hover:underline"
        >{{ company.email }}</a>.
      </UiSectionHeader>
    </div>

    <UiFaqList
      name="service-faq"
      :items="page.faq.items"
    />
  </section>
</template>
