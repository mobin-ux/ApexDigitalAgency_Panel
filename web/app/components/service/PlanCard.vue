<script setup lang="ts">
import type { PlanCardView } from '~/data/service-pages/types'

/**
 * One plan card. Four rows (who it is for, price, features, order) sit on the
 * parent grid's subgrid from `lg`, so the order buttons line up across cards
 * whatever the length of the copy above them.
 */
defineProps<{ plan: PlanCardView }>()
</script>

<template>
  <li
    class="relative grid gap-5 overflow-hidden rounded-[26px] px-6 py-8 sm:px-8 sm:py-8.5 lg:row-span-4 lg:grid-rows-subgrid"
    :class="plan.featured ? 'bg-ink-900 shadow-dark' : 'border border-line bg-white shadow-tile'"
  >
    <div
      v-if="plan.featured"
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_120%_at_85%_10%,rgb(125_83_242/0.3),transparent_62%)]"
      aria-hidden="true"
    />

    <div class="relative flex flex-col gap-2">
      <div class="flex items-center justify-between gap-3">
        <h3
          class="font-display text-[1.3125rem] font-semibold tracking-[-0.02em]"
          :class="plan.featured ? 'text-white' : 'text-heading'"
        >
          {{ plan.name }}
        </h3>
        <span
          v-if="plan.flag"
          class="rounded-full bg-violet-500 px-2.75 py-1.25 text-[0.71875rem] font-bold text-white"
        >{{ plan.flag }}</span>
      </div>
      <p
        class="text-[0.90625rem] leading-[1.55]"
        :class="plan.featured ? 'text-body-on-dark' : 'text-body'"
      >
        {{ plan.fit }}
      </p>
    </div>

    <div
      class="relative flex flex-col border-b pb-5"
      :class="[plan.featured ? 'border-white/10' : 'border-line-soft', plan.detail ? 'gap-2' : 'gap-2.5']"
    >
      <p
        class="font-display text-[2.875rem] leading-none font-extrabold tracking-[-0.03em] tabular-nums"
        :class="plan.featured ? 'text-white' : 'text-heading'"
      >
        {{ plan.price }}<span
          class="text-[0.9375rem] font-semibold"
          :class="plan.featured ? 'text-body-on-dark' : 'text-muted'"
        > /month</span>
      </p>
      <p
        v-if="plan.detail"
        class="text-[0.84375rem] leading-normal"
        :class="plan.featured ? 'text-body-on-dark' : 'text-body'"
      >
        {{ plan.detail }}
      </p>
      <p
        class="inline-flex w-fit items-center rounded-full border px-3 py-1.25 text-[0.78125rem] font-semibold"
        :class="plan.featured ? 'border-white/10 bg-white/7 text-white' : 'border-line bg-subtle text-body'"
      >
        {{ plan.chip }}
      </p>
    </div>

    <div class="relative flex flex-col gap-3">
      <p
        class="text-xs font-bold tracking-[0.07em] uppercase"
        :class="plan.featured ? 'text-violet-200' : 'text-muted'"
      >
        {{ plan.featuresHeading }}
      </p>
      <ul class="flex flex-col gap-3">
        <li
          v-for="feature in plan.features"
          :key="feature"
          class="flex gap-2.75 text-[0.90625rem] leading-normal"
          :class="plan.featured ? 'text-white' : 'text-heading'"
        >
          <UiTick class="mt-0.5" />
          {{ feature }}
        </li>
      </ul>
    </div>

    <div class="relative flex flex-col gap-2.5 self-end">
      <UiButton
        v-bind="plan.order"
        :variant="plan.featured ? 'primary' : 'light'"
        size="lg"
        block
      >
        Start your order<span class="sr-only">: {{ plan.orderContext }}</span>
      </UiButton>
      <p
        class="text-center text-[0.78125rem] leading-normal"
        :class="plan.featured ? 'text-muted-on-dark' : 'text-muted'"
      >
        Nothing taken today · free to cancel before kickoff
      </p>
    </div>
  </li>
</template>
