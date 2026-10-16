<script setup lang="ts">
/**
 * Accordion built on native <details name>: no JavaScript, keyboard and
 * screen-reader support from the browser, one panel open at a time, and every
 * answer is in the HTML for crawlers and AI answer engines.
 */
defineProps<{
  /** Groups the panels so opening one closes the others. */
  name: string
  items: readonly { question: string, answer: string }[]
}>()
</script>

<template>
  <div class="border-b border-line-strong">
    <details
      v-for="(item, i) in items"
      :key="item.question"
      :name="name"
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
</template>
