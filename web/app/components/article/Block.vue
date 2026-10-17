<script setup lang="ts">
import type { ArticleBlock } from '~/data/articles'
import type { ServiceSlug } from '~/data/routes'
import { routes } from '~/data/routes'
import { serviceBySlug } from '~/data/services'

/**
 * One block of an article section; the block's `kind` picks the markup.
 * Tables are real tables: screen readers announce the headers, and answer
 * engines read the figures as data rather than as loose text.
 */
const props = defineProps<{ block: ArticleBlock, service: ServiceSlug }>()

const offer = serviceBySlug(props.service)
const fromLine = offer.fromMonthly ? `From ${formatGbp(offer.fromMonthly)}/month` : ''
</script>

<template>
  <p
    v-if="block.kind === 'paragraph'"
    class="text-[clamp(1.0625rem,1rem+0.25vw,1.125rem)] leading-[1.75] text-pretty text-body"
  >
    {{ block.text }}
  </p>

  <div
    v-else-if="block.kind === 'table'"
    class="overflow-hidden rounded-xl border border-line bg-white shadow-tile"
  >
    <table class="w-full table-fixed border-collapse text-left">
      <caption class="sr-only">
        {{ block.caption }}
      </caption>
      <colgroup>
        <col class="w-[42%]">
        <col class="w-[32%]">
        <col class="w-[26%]">
      </colgroup>
      <thead class="border-b border-line bg-subtle text-xs font-bold tracking-[0.06em] text-muted uppercase">
        <tr>
          <th
            scope="col"
            class="py-3.5 pr-2 pl-4 font-bold sm:pr-4 sm:pl-6"
          >
            {{ block.columns[0] }}
          </th>
          <th
            scope="col"
            class="px-2 py-3.5 font-bold sm:px-4"
          >
            {{ block.columns[1] }}
          </th>
          <th
            scope="col"
            class="py-3.5 pr-4 pl-2 text-right font-bold sm:pr-6 sm:pl-4"
          >
            {{ block.columns[2] }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in block.rows"
          :key="row.label"
          class="border-t border-line-soft first:border-t-0"
        >
          <th
            scope="row"
            class="py-4.5 pr-2 pl-4 text-left align-middle font-normal sm:pr-4 sm:pl-6"
          >
            <span class="flex flex-col gap-0.75">
              <span class="text-[0.96875rem] font-semibold text-heading">{{ row.label }}</span>
              <span
                v-if="row.detail"
                class="text-[0.8125rem] text-muted"
              >{{ row.detail }}</span>
            </span>
          </th>
          <td class="px-2 py-4.5 align-middle text-[0.9375rem] text-body sm:px-4 sm:text-[0.96875rem] sm:whitespace-nowrap">
            {{ row.values[0] }}
          </td>
          <td class="py-4.5 pr-4 pl-2 text-right align-middle font-display text-[0.9375rem] font-bold tracking-[-0.015em] text-heading sm:pr-6 sm:pl-4 sm:text-[1.0625rem] sm:whitespace-nowrap">
            {{ row.values[1] }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <p
    v-else-if="block.kind === 'note'"
    class="text-[0.84375rem] text-muted"
  >
    {{ block.text }}
  </p>

  <ul
    v-else-if="block.kind === 'checklist'"
    class="flex flex-col gap-3"
  >
    <li
      v-for="item in block.items"
      :key="item.text"
      class="flex gap-3.5 text-[clamp(1.03125rem,0.98rem+0.2vw,1.09375rem)] leading-[1.65] text-body"
    >
      <UiTick
        size="lg"
        class="mt-0.75"
      />
      <span><strong
        v-if="item.lead"
        class="font-semibold text-heading"
      >{{ item.lead }}</strong>{{ item.lead ? ' ' : '' }}{{ item.text }}</span>
    </li>
  </ul>

  <ul
    v-else-if="block.kind === 'costs'"
    class="grid gap-3 sm:grid-cols-2"
  >
    <li
      v-for="item in block.items"
      :key="item.label"
      class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-line-soft bg-subtle px-5 py-4.5"
    >
      <span class="text-[0.9375rem] font-semibold text-heading">{{ item.label }}</span>
      <span class="ml-auto text-[0.90625rem] whitespace-nowrap text-body">{{ item.value }}</span>
    </li>
  </ul>

  <figure
    v-else-if="block.kind === 'quote'"
    class="my-3 grid grid-cols-[4px_minmax(0,1fr)] gap-5 sm:gap-6.5"
  >
    <span
      class="rounded-[4px] bg-violet-500"
      aria-hidden="true"
    />
    <div class="flex flex-col gap-3.5 py-1">
      <blockquote class="font-display text-[clamp(1.3125rem,1.1rem+0.8vw,1.5625rem)] leading-[1.35] font-semibold tracking-[-0.018em] text-pretty text-heading">
        <p>“{{ block.text }}”</p>
      </blockquote>
      <figcaption class="text-sm text-muted">
        {{ block.by }}
      </figcaption>
    </div>
  </figure>

  <aside
    v-else-if="block.kind === 'service-cta'"
    :aria-label="block.title"
    class="grid items-center gap-6 rounded-2xl border border-line bg-white px-6 py-7 shadow-card sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-7 sm:px-7.5"
  >
    <div class="flex flex-col gap-2">
      <p class="font-display text-xl font-semibold tracking-[-0.018em] text-heading">
        {{ block.title }}
      </p>
      <ul class="flex flex-wrap gap-x-5 gap-y-2">
        <li
          v-for="point in [fromLine, ...block.points].filter(Boolean)"
          :key="point"
          class="flex items-center gap-2 text-[0.84375rem] whitespace-nowrap text-body"
        >
          <UiTick size="xs" />
          {{ point }}
        </li>
      </ul>
    </div>
    <UiButton :to="`${routes.service(service)}#plans`">
      {{ block.button }}
    </UiButton>
  </aside>
</template>
