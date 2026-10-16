<script setup lang="ts">
import type { WorkCase } from '~/data/service-pages/types'

/**
 * Abstract browser-window sketch for a case-study card: one layout per kind
 * of site. A stand-in until real screenshots exist, so it is decorative.
 */
defineProps<{
  kind: WorkCase['thumb']
  tint: WorkCase['tint']
}>()

const tints = {
  violet: 'bg-violet-50',
  periwinkle: 'bg-periwinkle-50',
  lilac: 'bg-lilac-50',
} as const
</script>

<template>
  <span
    class="block px-5.5 pt-5.5"
    :class="tints[tint]"
    aria-hidden="true"
  >
    <span class="block h-41 overflow-hidden rounded-t-md border border-b-0 border-line bg-white">
      <span class="flex gap-1 border-b border-line-soft px-3 py-2.25">
        <span
          v-for="n in 3"
          :key="n"
          class="block size-1.25 rounded-full bg-skeleton-strong"
        />
      </span>

      <span class="block p-4">
        <!-- Lead site: headline, button, hero image, three tiles -->
        <template v-if="kind === 'lead'">
          <span class="grid grid-cols-[1fr_54px] items-center gap-3">
            <span class="flex flex-col gap-1.5">
              <span class="block h-2.25 w-[86%] rounded-[3px] bg-heading" />
              <span class="block h-2.25 w-[58%] rounded-[3px] bg-heading" />
              <span class="block h-1.25 w-[72%] rounded-[3px] bg-skeleton" />
              <span class="mt-1 block h-3.75 w-11.5 rounded-[5px] bg-violet-500" />
            </span>
            <span class="block h-13.5 rounded-[10px] bg-violet-500/85" />
          </span>
          <span class="mt-3.5 grid grid-cols-3 gap-2">
            <span
              v-for="n in 3"
              :key="n"
              class="block h-6.5 rounded-[7px] bg-chip"
            />
          </span>
        </template>

        <!-- Booking: title, a row of time slots, confirm bar -->
        <template v-else-if="kind === 'booking'">
          <span class="flex flex-col gap-1.5">
            <span class="block h-2.25 w-[54%] rounded-[3px] bg-heading" />
            <span class="block h-1.25 w-[34%] rounded-[3px] bg-skeleton" />
          </span>
          <span class="mt-3.25 grid grid-cols-5 gap-1.5">
            <span
              v-for="n in 5"
              :key="n"
              class="block h-7.5 rounded-[7px]"
              :class="n === 3 ? 'bg-violet-600' : 'bg-chip'"
            />
          </span>
          <span class="mt-3 grid grid-cols-[1fr_62px] items-center gap-2.5">
            <span class="block h-1.75 rounded-[3px] bg-line" />
            <span class="block h-4.5 rounded-[6px] bg-violet-600" />
          </span>
        </template>

        <!-- Shop: three products, add-to-basket bar -->
        <template v-else-if="kind === 'shop'">
          <span class="grid grid-cols-3 gap-2">
            <span
              v-for="(w, n) in ['w-[80%]', 'w-[66%]', 'w-[72%]']"
              :key="w"
              class="flex flex-col gap-1.25"
            >
              <span
                class="block h-11 rounded-sm"
                :class="n === 1 ? 'bg-violet-400/80' : 'bg-violet-50'"
              />
              <span
                class="block h-1.25 rounded-[3px] bg-skeleton"
                :class="w"
              />
            </span>
          </span>
          <span class="mt-3.5 grid grid-cols-[1fr_54px] items-center gap-2.5">
            <span class="block h-1.75 rounded-[3px] bg-line" />
            <span class="block h-4.5 rounded-[6px] bg-violet-400" />
          </span>
        </template>

        <!-- Portal: side navigation and a list of records -->
        <template v-else-if="kind === 'portal'">
          <span class="grid grid-cols-[44px_1fr] gap-2.5">
            <span class="flex flex-col gap-1.25">
              <span class="block h-3 rounded-[4px] bg-violet-500" />
              <span
                v-for="n in 3"
                :key="n"
                class="block h-2 rounded-[3px] bg-line"
              />
            </span>
            <span class="flex flex-col gap-1.75">
              <span class="block h-2.25 w-[60%] rounded-[3px] bg-heading" />
              <span
                v-for="n in 3"
                :key="n"
                class="block h-5.5 rounded-[6px] bg-chip"
              />
            </span>
          </span>
        </template>

        <!-- Calendar: a fortnight of days with one chosen -->
        <template v-else-if="kind === 'calendar'">
          <span class="block h-2.25 w-[46%] rounded-[3px] bg-heading" />
          <span class="mt-3 grid grid-cols-7 gap-1.25">
            <span
              v-for="n in 14"
              :key="n"
              class="block h-4 rounded-[5px]"
              :class="n === 10 ? 'bg-violet-600' : 'bg-chip'"
            />
          </span>
          <span class="mt-3 grid grid-cols-[1fr_58px] items-center gap-2.5">
            <span class="block h-1.75 rounded-[3px] bg-line" />
            <span class="block h-4.5 rounded-[6px] bg-violet-600" />
          </span>
        </template>

        <!-- Rebuild: before and after bars, three tiles -->
        <template v-else>
          <span class="flex flex-col gap-2.5">
            <span class="grid grid-cols-[42px_1fr] items-center gap-2.5">
              <span class="block h-1.5 rounded-[3px] bg-skeleton" />
              <span class="block h-3.5 w-[38%] rounded-[5px] bg-skeleton-strong" />
            </span>
            <span class="grid grid-cols-[42px_1fr] items-center gap-2.5">
              <span class="block h-1.5 rounded-[3px] bg-skeleton" />
              <span class="block h-3.5 w-[88%] rounded-[5px] bg-violet-400" />
            </span>
            <span class="mt-1 grid grid-cols-3 gap-2">
              <span
                v-for="n in 3"
                :key="n"
                class="block h-6 rounded-[7px] bg-chip"
              />
            </span>
          </span>
        </template>
      </span>
    </span>
  </span>
</template>
