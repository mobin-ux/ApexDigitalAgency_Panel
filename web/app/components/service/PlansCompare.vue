<script setup lang="ts">
import type { InstalmentPlan, PlanId } from '~/data/plans'
import type { CompareRow } from '~/data/service-pages/types'

/**
 * The plan comparison table. On a phone it scrolls sideways inside a focusable
 * region; the region is `relative` so its `sr-only` cells cannot escape it and
 * widen the page.
 */
defineProps<{
  catalogue: readonly InstalmentPlan[]
  rows: readonly CompareRow[]
  featured: PlanId
  /** Order link per plan, for the footer row. */
  orders: Record<PlanId, string>
}>()
</script>

<template>
  <div
    role="region"
    aria-labelledby="compare-title"
    tabindex="0"
    class="relative overflow-x-auto rounded-2xl border border-line bg-white shadow-tile"
  >
    <table class="w-full min-w-150 border-collapse text-sm">
      <thead>
        <tr>
          <th
            id="compare-title"
            scope="col"
            class="w-[34%] p-5 text-left font-display text-base font-semibold tracking-[-0.015em] text-heading"
          >
            Compare the plans
          </th>
          <th
            v-for="plan in catalogue"
            :key="plan.id"
            scope="col"
            class="px-3.5 py-5 text-center font-display text-[0.9375rem] font-semibold"
            :class="plan.id === featured ? 'bg-violet-25 text-violet-700' : 'text-heading'"
          >
            {{ plan.name }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.label"
        >
          <th
            scope="row"
            class="border-t border-line-soft px-5 py-3.25 text-left font-normal text-body"
          >
            {{ row.label }}
          </th>
          <td
            v-for="plan in catalogue"
            :key="plan.id"
            class="border-t border-line-soft px-3.5 py-3.25 text-center text-heading"
            :class="plan.id === featured && 'bg-violet-25'"
          >
            <template v-if="row.values[plan.id] === true">
              <UiTick />
              <span class="sr-only">Included</span>
            </template>
            <template v-else-if="row.values[plan.id] === false">
              <span
                class="text-muted"
                aria-hidden="true"
              >—</span>
              <span class="sr-only">Not included</span>
            </template>
            <template v-else>
              {{ row.values[plan.id] }}
            </template>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td class="border-t border-line p-4.5" />
          <td
            v-for="plan in catalogue"
            :key="plan.id"
            class="border-t border-line px-3.5 py-4.5 text-center"
            :class="plan.id === featured && 'bg-violet-25'"
          >
            <a
              :href="orders[plan.id]"
              class="font-semibold text-violet-600 hover:underline"
            >Choose {{ plan.name }} <span aria-hidden="true">→</span></a>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
