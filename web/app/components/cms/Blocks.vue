<script setup lang="ts">
import type { Block } from '../../../shared/cms'

/**
 * Structured text blocks (shared/cms/blocks.ts): every string is rendered
 * as text, never as HTML, so nothing a document holds can inject markup.
 */
defineProps<{ blocks: readonly Block[] }>()
</script>

<template>
  <div class="flex flex-col gap-5 text-[1.0625rem] leading-[1.7] text-body">
    <template v-for="(block, i) in blocks" :key="i">
      <h2 v-if="block.kind === 'heading' && block.level === 2" class="mt-4 font-display text-h3 text-heading">
        {{ block.text }}
      </h2>
      <h3 v-else-if="block.kind === 'heading'" class="mt-2 font-display text-[1.25rem] font-semibold tracking-tight text-heading">
        {{ block.text }}
      </h3>
      <p v-else-if="block.kind === 'paragraph'">
        {{ block.text }}
      </p>
      <ul v-else-if="block.kind === 'bullets'" class="flex list-disc flex-col gap-2 pl-6">
        <li v-for="(item, j) in block.items" :key="j">
          {{ item }}
        </li>
      </ul>
      <p v-else-if="block.kind === 'note'" class="rounded-xl border border-line bg-subtle px-5 py-4 text-[0.9688rem]">
        {{ block.text }}
      </p>
      <figure v-else-if="block.kind === 'quote'" class="border-l-4 border-violet-500 pl-5">
        <blockquote class="font-display text-[1.25rem] font-semibold tracking-tight text-heading">
          {{ block.text }}
        </blockquote>
        <figcaption v-if="block.by" class="mt-2 text-[0.9063rem] text-muted">
          {{ block.by }}
        </figcaption>
      </figure>
      <ul v-else-if="block.kind === 'checklist'" class="flex flex-col gap-2.5">
        <li v-for="(item, j) in block.items" :key="j" class="flex gap-3">
          <UiTick class="mt-1.5 shrink-0" />
          <span><strong v-if="item.lead" class="text-heading">{{ item.lead }} </strong>{{ item.text }}</span>
        </li>
      </ul>
      <dl v-else-if="block.kind === 'costs'" class="grid gap-3 sm:grid-cols-2">
        <div v-for="(item, j) in block.items" :key="j" class="flex items-baseline justify-between gap-4 rounded-xl border border-line px-5 py-4">
          <dt class="text-[0.9375rem]">
            {{ item.label }}
          </dt>
          <dd class="font-display text-[1.0625rem] font-semibold text-heading">
            {{ item.value }}
          </dd>
        </div>
      </dl>
      <div v-else-if="block.kind === 'table'" class="relative overflow-x-auto">
        <table class="w-full border-collapse text-[0.9375rem]">
          <caption class="pb-3 text-start font-display text-[1.0625rem] font-semibold text-heading">
            {{ block.caption }}
          </caption>
          <thead>
            <tr class="border-b border-line-strong text-start text-[0.78rem] font-bold tracking-wider text-muted uppercase">
              <th scope="col" class="py-2 pr-4 text-start">
                {{ block.columns[0] }}
              </th>
              <th scope="col" class="py-2 pr-4 text-start">
                {{ block.columns[1] }}
              </th>
              <th scope="col" class="py-2 text-end">
                {{ block.columns[2] }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, j) in block.rows" :key="j" class="border-b border-line">
              <th scope="row" class="py-3 pr-4 text-start font-semibold text-heading">
                {{ row.label }}
                <span v-if="row.detail" class="block text-[0.8125rem] font-normal text-muted">{{ row.detail }}</span>
              </th>
              <td class="py-3 pr-4">
                {{ row.values[0] }}
              </td>
              <td class="py-3 text-end">
                {{ row.values[1] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
