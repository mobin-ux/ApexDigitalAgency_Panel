<script setup lang="ts">
import { costAnswers as copy } from '~/data/insights'
import { routes } from '~/data/routes'
import { serviceBySlug } from '~/data/services'
import { formatGbp } from '~/utils/format'

// The Apex figure is the service's lowest monthly plan, or "Quoted" for work
// scoped on a call, so it always matches the service page it links to.
const rows = copy.items.map((item) => {
  const service = serviceBySlug(item.service)
  return {
    ...item,
    to: routes.service(service.slug),
    link: service.tag,
    apexLabel: service.fromMonthly ? copy.withApex : copy.quoted.label,
    apexValue: service.fromMonthly ? `${formatGbp(service.fromMonthly)}/mo` : copy.quoted.value,
  }
})
</script>

<template>
  <section
    aria-labelledby="insights-costs-title"
    class="border-y border-line bg-subtle"
  >
    <div class="container-page grid items-start gap-10 py-20 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-18 lg:py-26">
      <div class="flex flex-col gap-4.5 lg:sticky lg:top-26">
        <UiEyebrowChip>{{ copy.eyebrow }}</UiEyebrowChip>
        <h2
          id="insights-costs-title"
          class="font-display text-h2 text-pretty text-heading lg:text-[2.75rem]"
        >
          {{ copy.title }}
        </h2>
        <p class="max-w-[42ch] text-[1.03125rem] leading-[1.62] text-body">
          {{ copy.lead }}
        </p>
        <NuxtLink
          :to="routes.services"
          class="w-fit text-[0.9375rem] font-semibold whitespace-nowrap text-violet-600 hover:underline"
        >
          {{ copy.compare }} <span aria-hidden="true">→</span>
        </NuxtLink>
      </div>

      <ul class="rounded-2xl border border-line bg-white px-5 py-2 shadow-tile sm:px-7.5">
        <li
          v-for="row in rows"
          :key="row.question"
          class="border-t border-line-soft first:border-transparent"
        >
          <NuxtLink
            :to="row.to"
            class="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3 py-5.5 sm:grid-cols-[minmax(0,1fr)_150px_110px]"
          >
            <span class="col-span-2 flex flex-col gap-1 sm:col-span-1">
              <span class="font-display text-[1.0625rem] leading-[1.3] font-semibold tracking-[-0.015em] text-heading transition-colors group-hover:text-violet-600">{{ row.question }}</span>
              <span class="text-[0.8125rem] text-muted">{{ copy.market }} {{ row.market }}</span>
            </span>
            <span class="flex flex-col gap-0.5 sm:text-right">
              <span class="text-xs text-muted">{{ row.apexLabel }}</span>
              <span class="font-display text-[1.375rem] leading-[1.1] font-extrabold tracking-[-0.024em] whitespace-nowrap text-heading">{{ row.apexValue }}</span>
            </span>
            <span class="justify-self-end text-[0.84375rem] font-semibold whitespace-nowrap text-violet-600">{{ row.link }} <span aria-hidden="true">→</span></span>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </section>
</template>
