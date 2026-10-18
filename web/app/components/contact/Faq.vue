<script setup lang="ts">
import { contactFaq } from '~/data/contact'

/**
 * Questions on native <details name>: one open at a time, the first open, no
 * JavaScript, and every answer in the HTML. Same mechanism as `UiFaqList`, in
 * this page's outlined style.
 */
</script>

<template>
  <section
    aria-labelledby="contact-faq-title"
    class="container-page pt-20 pb-20 lg:pt-26 lg:pb-28"
  >
    <div class="grid gap-10 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-18">
      <div class="flex flex-col gap-4">
        <UiEyebrowChip>{{ contactFaq.eyebrow }}</UiEyebrowChip>
        <h2
          id="contact-faq-title"
          class="font-display text-h2 text-heading lg:text-[2.75rem]"
        >
          {{ contactFaq.title }}
        </h2>
        <p class="text-base leading-[1.62] text-body">
          {{ contactFaq.intro }}
        </p>
      </div>

      <div class="flex flex-col border-t border-line">
        <details
          v-for="(item, i) in contactFaq.items"
          :key="item.question"
          name="contact-faq"
          :open="i === 0"
          class="group border-b border-line"
        >
          <summary class="flex cursor-pointer items-center gap-5 py-6 font-display text-lg font-semibold tracking-[-0.018em] text-heading sm:text-xl">
            <span class="flex-1">{{ item.question }}</span>
            <span
              class="inline-flex size-8 flex-none items-center justify-center rounded-full border border-line-strong font-sans text-lg text-violet-600"
              aria-hidden="true"
            >
              <span class="group-open:hidden">+</span>
              <span class="hidden group-open:inline">−</span>
            </span>
          </summary>
          <p class="pb-6.5 text-[0.96875rem] leading-[1.65] text-body sm:pr-16">
            {{ item.answer }}
          </p>
        </details>
      </div>
    </div>
  </section>
</template>
