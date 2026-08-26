<script setup lang="ts">
/**
 * The order summary — one definition, two containers (V2 Phase 3 mobile, §8).
 *
 * On desktop it is the wizard's 340px sticky rail. At 393px that rail cannot
 * exist, and putting it above the form buries the fields, so it collapses to a
 * 52px footer strip that opens this as a bottom sheet.
 *
 * It lives in a component rather than being written twice because the figures
 * here are the ones Phase 3 §2 spent a fix on: the plan card, the strip and this
 * summary must never quote different monthlies for the same plan. Two copies of
 * the markup is how they start to drift.
 */
defineProps<{
  serviceName: string
  planName: string | null
  /** Total project value — the one figure no payment term can change. */
  base: number
  /** True from step 3, where a term has actually been chosen. */
  termChosen: boolean
  termLabel: string
  showInterest: boolean
  interest: number
  /** `From` until a term is chosen, `Your monthly` after. */
  railLabel: string
  railAmount: number
  monthsText: string
  total: number
  firstDueDays: number
}>()

const { formatCurrency: money } = useCurrency()
</script>

<template>
  <div>
    <div class="px-[22px] py-5">
      <div class="flex items-center justify-between gap-3 border-b border-white/10 py-2.5">
        <span class="text-[13px] text-muted-500">Service</span>
        <span v-if="serviceName" class="text-right text-[13.5px] font-semibold text-white">{{ serviceName }}</span>
        <span v-else class="text-[13px] text-muted-500/60">Not selected</span>
      </div>
      <div class="flex items-center justify-between gap-3 border-b border-white/10 py-2.5">
        <span class="text-[13px] text-muted-500">Plan</span>
        <span v-if="planName" class="text-right text-[13.5px] font-semibold text-white">{{ planName }}</span>
        <span v-else class="text-[13px] text-muted-500/60">—</span>
      </div>
      <div v-if="planName" class="flex items-center justify-between gap-3 border-b border-white/10 py-2.5">
        <span class="text-[13px] text-muted-500">Project value</span>
        <span class="text-[13.5px] font-semibold text-white tabular-nums">{{ money(base) }}</span>
      </div>
      <template v-if="termChosen && planName">
        <div class="flex items-center justify-between gap-3 border-b border-white/10 py-2.5">
          <span class="text-[13px] text-muted-500">Payment plan</span>
          <span class="text-[13.5px] font-semibold text-white">{{ termLabel }}</span>
        </div>
        <div v-if="showInterest" class="flex items-center justify-between gap-3 border-b border-white/10 py-2.5">
          <span class="text-[13px] text-muted-500">Interest (1%/mo)</span>
          <span class="text-[13.5px] font-semibold text-white tabular-nums">{{ money(interest) }}</span>
        </div>
      </template>
    </div>

    <!--
      Before a term is chosen this reads FROM and quotes exactly the same floor
      as the plan cards. It used to say YOUR MONTHLY from step 1 while quoting a
      term-specific figure off the default `term`, so the rail and the card could
      show two different monthlies for the same plan.
    -->
    <div v-if="planName" class="mx-[22px] rounded-xl border border-primary-500/28 px-[18px] py-4" style="background: linear-gradient(135deg, rgba(125,83,242,.22), rgba(125,83,242,.06));">
      <div class="flex items-end justify-between gap-3">
        <div>
          <div class="text-[11.5px] font-bold uppercase tracking-[0.05em] text-primary-200">
            {{ railLabel }}
          </div>
          <div class="mt-0.5 font-heading text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white tabular-nums">
            {{ money(railAmount) }}<span class="text-[13px] font-medium text-primary-200">/mo</span>
          </div>
        </div>
        <div v-if="termChosen" class="text-right text-[11.5px] leading-[1.5] text-primary-200">
          {{ monthsText }}<br>total {{ money(total) }}
        </div>
        <div v-else class="max-w-[130px] text-right text-[11.5px] leading-[1.5] text-primary-200">
          Choose a payment plan in step 3
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2.5 px-[22px] pb-[22px] pt-[18px]">
      <div class="flex items-center justify-between rounded-xl border border-[#22B07D]/24 bg-[#22B07D]/10 px-3.5 py-3">
        <span class="text-[13px] font-semibold text-white">Due today</span>
        <span class="font-heading text-[18px] font-extrabold text-[#22B07D]">{{ money(0) }}</span>
      </div>
      <div class="flex items-center gap-2 text-xs text-muted-500">
        <Icon name="lucide:zap" class="size-3.5 shrink-0 text-[#22B07D]" />No deposit — first payment {{ firstDueDays }} days after kickoff.
      </div>
    </div>
  </div>
</template>
