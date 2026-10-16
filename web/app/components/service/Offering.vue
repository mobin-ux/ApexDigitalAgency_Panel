<script setup lang="ts">
import type { ServicePageContent } from '~/data/service-pages/types'
import { routes } from '~/data/routes'

defineProps<{ page: ServicePageContent }>()
</script>

<template>
  <section
    aria-labelledby="offering-title"
    class="border-b border-line"
  >
    <div class="container-page flex flex-col gap-10 py-20 lg:py-26">
      <ServiceIntro
        id="offering-title"
        :eyebrow="page.offering.eyebrow"
        :title="page.offering.title"
        :intro="page.offering.intro"
        :aside="400"
      />

      <ul class="overflow-hidden rounded-2xl border border-line bg-white shadow-tile">
        <li
          v-for="row in page.offering.rows"
          :key="row.title"
          class="border-b border-line-soft last:border-b-0"
        >
          <a
            href="#plans"
            class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 px-5 py-4 transition-colors hover:bg-violet-25 sm:px-6.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_108px] md:py-3.75"
          >
            <span class="font-display text-[1.03125rem] font-semibold tracking-[-0.02em] text-heading">{{ row.title }}</span>
            <span class="col-start-1 text-sm leading-[1.45] text-body md:col-start-auto">{{ row.detail }}</span>
            <span class="col-start-2 row-span-2 row-start-1 flex items-center justify-end gap-3 text-[0.84375rem] text-muted md:col-start-auto md:row-span-1 md:row-start-auto">
              {{ row.time }}<span
                class="text-violet-500"
                aria-hidden="true"
              >→</span>
            </span>
          </a>
        </li>
      </ul>

      <div
        v-if="page.offering.industries"
        class="flex flex-col gap-5.5 border-t border-line pt-10"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
          <h3 class="font-display text-2xl leading-[1.14] font-bold tracking-[-0.025em] text-heading">
            {{ page.offering.industries.title }}
          </h3>
          <p class="text-[0.90625rem] text-muted">
            {{ page.offering.industries.note }}
          </p>
        </div>
        <ul class="grid gap-x-9 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          <li
            v-for="item in page.offering.industries.items"
            :key="item.name"
            class="grid grid-cols-[28px_minmax(0,1fr)] gap-x-2.5 gap-y-1"
          >
            <ServiceIndustryGlyph :name="item.glyph" />
            <h4 class="self-center font-display text-[0.90625rem] font-semibold tracking-[-0.01em] text-heading">
              {{ item.name }}
            </h4>
            <p class="col-start-2 text-[0.8125rem] leading-[1.45] text-muted">
              {{ item.examples }}
            </p>
          </li>
        </ul>
        <p class="mt-1.5 text-[0.90625rem] text-muted">
          {{ page.offering.industries.cta.lead }}
          <NuxtLink
            :to="`${routes.contact}?service=${page.slug}`"
            class="font-semibold text-violet-600 hover:underline"
          >
            {{ page.offering.industries.cta.link }}
          </NuxtLink>
          {{ page.offering.industries.cta.tail }}
        </p>
      </div>
    </div>
  </section>
</template>
