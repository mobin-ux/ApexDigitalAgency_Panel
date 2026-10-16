<script setup lang="ts">
import type { ServicePageContent } from '~/data/service-pages/types'

defineProps<{ page: ServicePageContent }>()
</script>

<template>
  <section
    aria-labelledby="process-title"
    class="relative overflow-hidden bg-ink-900"
  >
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_100%_at_85%_8%,rgb(125_83_242/0.22),transparent_60%)]"
      aria-hidden="true"
    />
    <div class="relative container-page flex flex-col gap-13 py-20 lg:py-26">
      <ServiceIntro
        id="process-title"
        eyebrow="The process"
        :title="page.process.title"
        :intro="page.process.intro"
        tone="dark"
      />

      <ol class="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
        <li
          v-for="(step, i) in page.process.steps"
          :key="step.title"
          class="grid gap-3.5 lg:row-span-4 lg:grid-rows-subgrid"
        >
          <span class="font-display text-xs font-semibold tracking-[0.09em] text-violet-200 uppercase">{{ step.when }}</span>
          <span
            class="flex items-center gap-3"
            aria-hidden="true"
          >
            <span
              class="inline-flex size-7.5 flex-none items-center justify-center rounded-full font-display text-[0.8125rem] font-semibold text-white"
              :class="i === page.process.steps.length - 1 ? 'bg-success' : 'bg-violet-500'"
            >{{ i === page.process.steps.length - 1 ? '✓' : i + 1 }}</span>
            <span
              v-if="i < page.process.steps.length - 1"
              class="hidden h-px flex-1 bg-linear-to-r from-white/22 to-white/6 lg:block"
            />
          </span>
          <div class="flex flex-col gap-2">
            <h3 class="font-display text-[1.1875rem] font-semibold tracking-[-0.018em] text-white">
              {{ step.title }}
            </h3>
            <p class="text-[0.90625rem] leading-relaxed text-body-on-dark">
              {{ step.body }}
            </p>
          </div>
          <p class="flex gap-2 border-t border-white/8 pt-3 text-[0.8125rem] leading-normal text-muted-on-dark">
            <span class="flex-none text-violet-200">You</span>{{ step.you }}
          </p>
        </li>
      </ol>

      <div class="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/10 pt-6.5">
        <p class="text-[0.90625rem] leading-relaxed text-body-on-dark">
          {{ page.process.note }}
        </p>
        <a
          href="#plans"
          class="text-[0.90625rem] font-semibold text-violet-200 hover:underline sm:ml-auto"
        >See the plans <span aria-hidden="true">→</span></a>
      </div>
    </div>
  </section>
</template>
