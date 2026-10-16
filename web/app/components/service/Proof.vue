<script setup lang="ts">
import type { ServicePageContent } from '~/data/service-pages/types'
import { routes } from '~/data/routes'

defineProps<{ page: ServicePageContent }>()
</script>

<template>
  <section
    id="proof"
    aria-labelledby="proof-title"
    class="border-y border-line bg-subtle"
  >
    <div class="container-page grid items-center gap-12 py-20 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14 lg:py-26">
      <div class="flex flex-col gap-5.5">
        <UiSectionHeader
          id="proof-title"
          eyebrow="Proof"
          :title="page.proof.title"
        />
        <p class="max-w-[52ch] text-body-lg text-body">
          {{ page.proof.body }}
        </p>
        <figure class="mt-1 max-w-[52ch] border-l-2 border-violet-200 pl-5.5">
          <blockquote class="text-body-lg text-heading">
            <p>{{ page.proof.quote }}</p>
          </blockquote>
          <figcaption class="mt-3 text-[0.84375rem] text-muted">
            {{ page.proof.quoteBy }}
          </figcaption>
        </figure>
        <NuxtLink
          :to="routes.caseStudy(page.proof.caseStudySlug)"
          class="w-fit text-[0.90625rem] font-semibold text-violet-600 hover:underline"
        >
          Read the full case study <span aria-hidden="true">→</span>
        </NuxtLink>
      </div>

      <ul class="flex flex-col gap-3.5">
        <li
          v-for="stat in page.proof.stats"
          :key="stat.label"
          class="grid grid-cols-[104px_minmax(0,1fr)] items-baseline gap-4 rounded-xl border border-line bg-white px-6.5 py-6 shadow-tile"
        >
          <span class="font-display text-[2rem] leading-none font-extrabold tracking-[-0.028em] text-violet-600">{{ stat.value }}</span>
          <span class="text-sm leading-normal text-body">{{ stat.label }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
