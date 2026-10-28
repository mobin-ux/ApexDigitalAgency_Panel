<script setup lang="ts">
import type { Block } from '~~/shared/cms'

/**
 * Structured text from the CMS (shared/cms/blocks.ts) on the panel's dark
 * legal shell. Every string renders as text; nothing a document holds can
 * become markup.
 */
defineProps<{ blocks: readonly Block[] }>()
</script>

<template>
  <div class="flex flex-col gap-4 text-sm leading-[1.7] text-muted-400">
    <template v-for="(block, i) in blocks" :key="i">
      <h2 v-if="block.kind === 'heading' && block.level === 2" class="mt-3 text-[15px] font-bold text-muted-900 dark:text-white">
        {{ block.text }}
      </h2>
      <h3 v-else-if="block.kind === 'heading'" class="mt-1 text-[13.5px] font-semibold text-muted-900 dark:text-white">
        {{ block.text }}
      </h3>
      <p v-else-if="block.kind === 'paragraph'">
        {{ block.text }}
      </p>
      <ul v-else-if="block.kind === 'bullets'" class="flex list-disc flex-col gap-1.5 pl-5">
        <li v-for="(item, j) in block.items" :key="j">
          {{ item }}
        </li>
      </ul>
      <p v-else-if="block.kind === 'note'" class="rounded-xl border border-muted-200 px-4 py-3 text-[13px] dark:border-white/8">
        {{ block.text }}
      </p>
      <figure v-else-if="block.kind === 'quote'" class="border-l-2 border-primary-500 pl-4">
        <blockquote class="text-muted-900 dark:text-white">
          {{ block.text }}
        </blockquote>
        <figcaption v-if="block.by" class="mt-1 text-xs">
          {{ block.by }}
        </figcaption>
      </figure>
      <ul v-else-if="block.kind === 'checklist'" class="flex flex-col gap-2">
        <li v-for="(item, j) in block.items" :key="j" class="flex gap-2">
          <Icon name="lucide:check" class="mt-1 size-3.5 shrink-0 text-[#22B07D]" aria-hidden="true" />
          <span><strong v-if="item.lead" class="text-muted-900 dark:text-white">{{ item.lead }} </strong>{{ item.text }}</span>
        </li>
      </ul>
      <dl v-else-if="block.kind === 'costs'" class="grid gap-2 sm:grid-cols-2">
        <div v-for="(item, j) in block.items" :key="j" class="flex justify-between gap-3 rounded-xl border border-muted-200 px-4 py-2.5 dark:border-white/8">
          <dt>{{ item.label }}</dt>
          <dd class="font-semibold text-muted-900 dark:text-white">
            {{ item.value }}
          </dd>
        </div>
      </dl>
      <div v-else-if="block.kind === 'table'" class="relative overflow-x-auto">
        <table class="w-full border-collapse text-[13px]">
          <caption class="pb-2 text-start font-semibold text-muted-900 dark:text-white">
            {{ block.caption }}
          </caption>
          <thead>
            <tr class="border-b border-muted-200 text-[11px] font-bold uppercase tracking-wider dark:border-white/10">
              <th scope="col" class="py-2 pr-3 text-start">
                {{ block.columns[0] }}
              </th>
              <th scope="col" class="py-2 pr-3 text-start">
                {{ block.columns[1] }}
              </th>
              <th scope="col" class="py-2 text-end">
                {{ block.columns[2] }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, j) in block.rows" :key="j" class="border-b border-muted-200 dark:border-white/5">
              <th scope="row" class="py-2 pr-3 text-start font-semibold text-muted-900 dark:text-white">
                {{ row.label }}<span v-if="row.detail" class="block text-xs font-normal text-muted-400">{{ row.detail }}</span>
              </th>
              <td class="py-2 pr-3">
                {{ row.values[0] }}
              </td>
              <td class="py-2 text-end">
                {{ row.values[1] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
