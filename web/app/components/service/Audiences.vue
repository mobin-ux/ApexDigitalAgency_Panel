<script setup lang="ts">
import type { ServicePageContent } from '~/data/service-pages/types'

defineProps<{ page: ServicePageContent }>()
</script>

<template>
  <div>
    <div class="border-y border-line">
      <ul
        aria-label="Key figures"
        class="container-page grid grid-cols-2 gap-x-6 gap-y-5 py-8.5 lg:grid-cols-4 lg:gap-8"
      >
        <li
          v-for="stat in page.stats"
          :key="stat.label"
          class="grid items-baseline gap-x-3.5 gap-y-1 sm:grid-cols-[92px_minmax(0,1fr)]"
        >
          <span class="font-display text-[1.75rem] leading-none font-extrabold tracking-[-0.026em] text-heading">{{ stat.value }}</span>
          <span class="text-[0.84375rem] leading-normal text-body">{{ stat.label }}</span>
        </li>
      </ul>
    </div>

    <section
      aria-labelledby="audiences-title"
      class="container-page flex flex-col gap-11 py-20 lg:py-26"
    >
      <ServiceIntro
        id="audiences-title"
        eyebrow="Who it is for"
        :title="page.audiences.title"
        :intro="page.audiences.intro"
        :aside="440"
      />
      <ul class="grid gap-5.5 lg:grid-cols-3">
        <li
          v-for="card in page.audiences.cards"
          :key="card.tag"
          class="flex flex-col gap-3.5 rounded-2xl border border-line bg-white p-6 shadow-tile sm:p-8"
        >
          <span class="w-fit rounded-full bg-violet-50 px-3 py-1.25 text-[0.71875rem] font-bold text-violet-600">{{ card.tag }}</span>
          <h3 class="font-display text-[1.4375rem] leading-[1.14] font-semibold tracking-[-0.022em] text-heading">
            {{ card.title }}
          </h3>
          <p class="text-[0.9375rem] leading-relaxed text-body">
            {{ card.body }}
          </p>
          <p class="mt-auto border-t border-line-soft pt-4 text-[0.84375rem] text-muted">
            {{ card.foot }}
          </p>
        </li>
      </ul>
    </section>
  </div>
</template>
