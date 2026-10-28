<script setup lang="ts">
import { paymentPlans, planTermMonths } from '~/data/home'
import { formatGbp } from '~/utils/format'

/** The comparison card is the Starter plan, so it can never disagree with the explainer above. */
const starter = paymentPlans[0]!
const starterTotal = starter.deposit + starter.monthly * planTermMonths
const home = useCmsContent('home')
</script>

<template>
  <section
    id="why"
    aria-labelledby="why-title"
    class="bg-page"
  >
    <div class="container-page flex flex-col gap-11 py-20 lg:py-26">
      <div class="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
        <div class="max-w-[44ch] lg:max-w-none">
          <UiSectionHeader
            id="why-title"
            :eyebrow="home.why.eyebrow"
            :title="home.why.title"
          >
            {{ home.why.text }}
          </UiSectionHeader>
        </div>

        <div
          class="flex flex-col gap-5 rounded-2xl border border-line bg-white px-6 py-7.5 shadow-card sm:px-8"
          aria-hidden="true"
        >
          <div class="flex items-baseline justify-between gap-4">
            <span class="text-[0.84375rem] text-muted">One big invoice</span>
            <span class="font-display text-[1.375rem] font-extrabold tracking-tight text-muted line-through decoration-violet-200 tabular-nums">{{ formatGbp(starterTotal) }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="h-px flex-1 bg-line" />
            <span class="text-xs text-violet-600">becomes</span>
            <span class="h-px flex-1 bg-line" />
          </div>
          <div class="flex items-baseline justify-between gap-4">
            <span class="text-[0.84375rem] text-body">Twelve small ones</span>
            <span class="font-display text-[2.125rem] leading-none font-extrabold tracking-tight text-heading tabular-nums">
              {{ formatGbp(starter.monthly) }}<span class="text-sm font-semibold text-muted"> /mo</span>
            </span>
          </div>
          <div class="flex items-center justify-between gap-1.5 pt-1">
            <span
              v-for="n in planTermMonths"
              :key="n"
              class="block size-3.25 rounded-full"
              :class="n <= 3 ? 'bg-violet-500' : 'bg-violet-100'"
            />
          </div>
          <span class="text-[0.78rem] text-muted">Three paid · nine to go · no interest</span>
        </div>
      </div>

      <ul class="grid gap-5 md:grid-cols-3">
        <li
          v-for="swap in home.why.swaps"
          :key="swap.after"
          class="flex flex-col gap-2.5 rounded-xl border border-line bg-white px-6 py-6.5 transition duration-200 ease-out-soft hover:shadow-lift motion-safe:hover:-translate-y-0.75"
        >
          <del class="text-sm text-muted decoration-violet-200">
            <span class="sr-only">Instead of: </span>{{ swap.before }}
          </del>
          <h3 class="font-display text-[1.5625rem] leading-tight font-semibold tracking-tight text-heading">
            {{ swap.after }}
          </h3>
          <p class="text-[0.84375rem] leading-normal text-body">
            {{ swap.note }}
          </p>
        </li>
      </ul>

      <ul class="grid gap-6 pt-2 sm:grid-cols-2 lg:flex lg:items-stretch lg:gap-0">
        <li
          v-for="(mark, i) in home.why.trust"
          :key="mark.title"
          class="flex flex-1 flex-col gap-1.25 lg:px-7 lg:first:pl-0 lg:last:pr-0"
          :class="i > 0 && 'lg:border-l lg:border-line-strong'"
        >
          <span class="font-display text-base font-semibold tracking-tight text-heading">{{ mark.title }}</span>
          <span class="text-[0.84375rem] leading-normal text-body">{{ mark.note }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
