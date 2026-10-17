<script setup lang="ts">
/**
 * The article's questions on native <details name>: one open at a time, no
 * JavaScript, and every answer in the HTML for crawlers and answer engines.
 * Same mechanism as `UiFaqList`, in the article's lighter style.
 */
defineProps<{
  items: readonly { question: string, answer: string }[]
}>()
</script>

<template>
  <div class="flex flex-col border-t border-line">
    <details
      v-for="(item, i) in items"
      :key="item.question"
      name="article-faq"
      :open="i === 0"
      class="group border-b border-line"
    >
      <summary class="flex cursor-pointer items-center gap-5 py-5.5 font-display text-lg font-semibold tracking-[-0.015em] text-heading">
        <span class="flex-1">{{ item.question }}</span>
        <span
          class="inline-flex size-8 flex-none items-center justify-center rounded-full bg-subtle text-lg font-medium text-heading transition-colors duration-200 group-open:bg-violet-500 group-open:text-white"
          aria-hidden="true"
        >
          <span class="group-open:hidden">+</span>
          <span class="hidden group-open:inline">−</span>
        </span>
      </summary>
      <p class="pr-0 pb-6 text-[1.03125rem] leading-[1.7] text-body sm:pr-13">
        {{ item.answer }}
      </p>
    </details>
  </div>
</template>
