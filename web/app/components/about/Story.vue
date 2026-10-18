<script setup lang="ts">
import { story } from '~/data/about'
</script>

<template>
  <section
    aria-labelledby="story-title"
    class="container-page pt-20 lg:pt-26"
  >
    <div class="mb-10 flex flex-col gap-4 lg:mb-12">
      <UiEyebrowChip>{{ story.eyebrow }}</UiEyebrowChip>
      <h2
        id="story-title"
        class="font-display text-h2 text-heading"
      >
        {{ story.title }}
      </h2>
    </div>

    <!-- A vertical line on phones, the design's horizontal rule from lg. -->
    <ol class="grid border-l-2 border-heading lg:grid-cols-4 lg:border-t-2 lg:border-l-0">
      <li
        v-for="milestone in story.milestones"
        :key="milestone.title"
        class="relative flex flex-col gap-2.5 pb-9 pl-7 last:pb-0 lg:pt-7.5 lg:pr-7 lg:pb-0 lg:pl-0"
      >
        <span
          class="absolute top-1 -left-1.75 size-3 rounded-full bg-violet-500 ring-4 ring-page lg:-top-1.75 lg:left-0"
          aria-hidden="true"
        />
        <p class="text-[0.8125rem] font-bold tracking-[0.06em] text-muted uppercase">
          {{ milestone.when }}
        </p>
        <h3 class="font-display text-[1.375rem] leading-[1.18] font-bold tracking-[-0.022em] text-heading">
          {{ milestone.title }}
        </h3>
        <p class="text-[0.90625rem] leading-[1.6] text-pretty text-body">
          {{ milestone.body }}
        </p>
      </li>
    </ol>
  </section>
</template>
