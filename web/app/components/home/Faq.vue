<script setup lang="ts">
import { faqs } from '~/data/home'
import { company } from '~/data/site'
</script>

<template>
  <section
    id="faq"
    aria-labelledby="faq-title"
    class="bg-page"
  >
    <div class="container-page grid items-start gap-10 py-24 lg:grid-cols-[0.72fr_1.28fr] lg:gap-18 lg:py-32">
      <div class="lg:sticky lg:top-30">
        <UiSectionHeader
          id="faq-title"
          eyebrow="Questions"
          title="The things people ask before they start"
        >
          Anything else, ask us directly — <a
            :href="`mailto:${company.email}`"
            class="font-semibold text-violet-600 hover:underline"
          >{{ company.email }}</a>.
        </UiSectionHeader>
      </div>

      <UiFaqList
        name="faq"
        :items="faqs"
      />
    </div>
  </section>
</template>
