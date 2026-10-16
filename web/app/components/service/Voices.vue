<script setup lang="ts">
import type { ServicePageContent } from '~/data/service-pages/types'

defineProps<{ page: ServicePageContent }>()
</script>

<template>
  <section
    aria-labelledby="voices-title"
    class="border-b border-line"
  >
    <div class="container-page flex flex-col gap-7 py-20 lg:py-26">
      <ServiceIntro
        id="voices-title"
        eyebrow="What clients say"
        :title="page.voices.title"
        :intro="page.voices.intro"
      />

      <ul class="grid gap-5.5 lg:grid-cols-3">
        <li
          v-for="item in page.voices.quotes"
          :key="item.name"
        >
          <figure class="flex h-full flex-col gap-4.5 rounded-[22px] border border-line bg-white p-7.5 shadow-tile">
            <blockquote class="text-[0.96875rem] leading-[1.62] text-heading">
              <p>{{ item.quote }}</p>
            </blockquote>
            <figcaption class="mt-auto flex flex-col gap-0.75 border-t border-line-soft pt-4">
              <span class="font-display text-[0.9375rem] font-semibold tracking-[-0.01em] text-heading">{{ item.name }}</span>
              <span class="text-[0.8125rem] text-muted">{{ item.role }}</span>
            </figcaption>
          </figure>
        </li>
      </ul>

      <ul
        v-if="page.voices.promises"
        class="grid border-t border-line-strong pt-3.5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <li
          v-for="(promise, i) in page.voices.promises"
          :key="promise.title"
          class="flex flex-col gap-1.5 pt-6.5 pr-7"
          :class="i > 0 && 'lg:border-l lg:border-line-strong lg:pl-7'"
        >
          <h3 class="font-display text-base font-semibold tracking-[-0.012em] text-heading">
            {{ promise.title }}
          </h3>
          <p class="text-[0.84375rem] leading-[1.55] text-muted">
            {{ promise.body }}
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>
