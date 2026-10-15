<script setup lang="ts">
import { faqs } from '~/data/home'
import { company } from '~/data/site'

/**
 * Accordion built on native <details name="faq">: no JavaScript, keyboard and
 * screen-reader support from the browser, one panel open at a time, and every
 * answer is in the HTML for crawlers and AI answer engines.
 */
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

      <div class="border-b border-line-strong">
        <details
          v-for="(item, i) in faqs"
          :key="item.question"
          name="faq"
          :open="i === 0"
          class="group border-t border-line-strong"
        >
          <summary class="flex min-h-14 cursor-pointer items-center gap-5 px-1 py-6 font-display text-lg font-bold tracking-tight text-heading sm:text-xl">
            {{ item.question }}
            <span
              class="ml-auto text-[1.375rem] font-normal text-violet-600"
              aria-hidden="true"
            >
              <span class="group-open:hidden">+</span>
              <span class="hidden group-open:inline">−</span>
            </span>
          </summary>
          <p class="max-w-[68ch] px-1 pb-7.5 text-base leading-[1.7] text-body">
            {{ item.answer }}
          </p>
        </details>
      </div>
    </div>
  </section>
</template>
