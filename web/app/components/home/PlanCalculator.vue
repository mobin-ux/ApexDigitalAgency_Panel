<script setup lang="ts">
import type { PaymentPlan } from '~/data/home'
import { paymentPlans, planTermMonths } from '~/data/home'
import { routes } from '~/data/routes'
import { formatGbp } from '~/utils/format'

/**
 * Example-plan explainer. It illustrates how a deposit plus twelve equal
 * payments adds up; it does not quote a price for this visitor. The total is
 * derived from deposit and monthly figure so the three numbers always agree.
 */
const selectedId = ref<PaymentPlan['id']>('starter')

const plan = computed(() => paymentPlans.find(p => p.id === selectedId.value) ?? paymentPlans[0]!)
const total = computed(() => plan.value.deposit + plan.value.monthly * planTermMonths)

const orderLink = computed(
  () => `${routes.contact}?service=website-design&plan=${plan.value.id}`,
)
</script>

<template>
  <div class="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-10">
    <fieldset class="mb-7.5 flex flex-wrap items-center gap-2.5">
      <legend class="float-left mr-2.5 text-[0.8125rem] font-bold tracking-wider text-muted uppercase">
        Example plan
      </legend>
      <label
        v-for="option in paymentPlans"
        :key="option.id"
        class="relative"
      >
        <input
          v-model="selectedId"
          type="radio"
          name="example-plan"
          :value="option.id"
          class="peer sr-only"
        >
        <span class="block cursor-pointer rounded-full border border-line-strong bg-white px-4.5 py-2.25 text-sm font-semibold text-body transition-colors peer-checked:border-heading peer-checked:bg-heading peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-violet-500">
          {{ option.label }}
        </span>
      </label>
    </fieldset>

    <div
      class="grid gap-8 border-b border-line pb-7 sm:grid-cols-2 sm:items-end"
      aria-live="polite"
    >
      <div class="flex flex-col gap-1.5">
        <span class="text-[0.84375rem] text-muted">Monthly payment</span>
        <span class="font-display text-[3.5rem] leading-none font-extrabold tracking-tight text-heading tabular-nums">{{ formatGbp(plan.monthly) }}</span>
        <span class="text-[0.84375rem] text-muted">for {{ planTermMonths }} months</span>
      </div>
      <dl class="flex flex-col gap-3.5">
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-[0.90625rem] text-body">
            Deposit today
          </dt>
          <dd class="font-display text-lg font-bold text-heading tabular-nums">
            {{ formatGbp(plan.deposit) }}
          </dd>
        </div>
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-[0.90625rem] text-body">
            Total, all in
          </dt>
          <dd class="font-display text-lg font-bold text-heading tabular-nums">
            {{ formatGbp(total) }}
          </dd>
        </div>
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-[0.90625rem] text-body">
            Interest
          </dt>
          <dd class="font-display text-lg font-bold text-success-ink">
            None
          </dd>
        </div>
      </dl>
    </div>

    <div class="flex flex-col gap-5 pt-7 sm:flex-row sm:items-center">
      <UiButton :to="orderLink">
        Start your order
      </UiButton>
      <p class="max-w-[40ch] text-[0.84375rem] leading-relaxed text-muted">
        Figures include VAT. Nothing is taken until you have reviewed every payment date in your dashboard.
      </p>
    </div>
  </div>
</template>
