<script setup lang="ts">
/* eslint-disable vue/no-mutating-props -- the editor edits one document object in place; the page compares it with its saved copy to know it is dirty, and child controls write into the branch they were given (see AdminWebsiteFields) */
import type { Block, BlockKind } from '~~/shared/cms'
import { BLOCK_KINDS, emptyBlock } from '~~/shared/cms'

/**
 * Structured text (shared/cms/blocks.ts): a list of typed blocks with the
 * controls each kind needs. There is no free-form HTML anywhere in this
 * control, which is the point: the site renders every string as text.
 */
const props = defineProps<{
  model: Record<string, unknown>
  field: string
  errors: Record<string, string[]>
  path: string
  max?: number
}>()

const KIND_LABEL: Record<BlockKind, string> = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  bullets: 'Bullet list',
  note: 'Note',
  quote: 'Quote',
  checklist: 'Checklist',
  costs: 'Cost pairs',
  table: 'Table',
}

if (!Array.isArray(props.model[props.field])) {
  props.model[props.field] = []
}
const blocks = computed<Block[]>(() => props.model[props.field] as Block[])

const adding = ref(false)

function add(kind: BlockKind) {
  blocks.value.push(emptyBlock(kind))
  adding.value = false
}

function remove(index: number) {
  blocks.value.splice(index, 1)
}

function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= blocks.value.length) {
    return
  }
  const [item] = blocks.value.splice(index, 1)
  blocks.value.splice(target, 0, item!)
}

function errorsFor(index: number): string[] {
  const prefix = `${props.path}.${index}`
  return Object.entries(props.errors).filter(([key]) => key === prefix || key.startsWith(`${prefix}.`)).flatMap(([key, list]) => list.map(m => `${key.slice(prefix.length + 1) || 'block'}: ${m}`))
}

function setItems(block: { items: unknown[] }, raw: string, map: (line: string) => unknown) {
  block.items = raw.split('\n').map(line => line.trim()).filter(Boolean).map(map)
}

const INPUT = 'focus:border-primary-400 w-full rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-2.5 text-sm text-muted-900 outline-none placeholder:text-muted-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500'
const SMALL = 'text-muted-500 mb-1 block text-xs font-semibold'
const ICON_BTN = 'apex-focus text-muted-500 hover:bg-muted-100 hover:text-muted-900 dark:hover:bg-white/8 dark:hover:text-white inline-flex size-8 items-center justify-center rounded-lg transition disabled:opacity-40'
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-for="e in errors[path] ?? []" :key="e" class="text-xs font-semibold text-[#EC6453]" role="alert">
      {{ e }}
    </p>
    <ol class="flex flex-col gap-3">
      <li v-for="(block, index) in blocks" :key="index" class="border-muted-200 flex gap-2 rounded-xl border p-4 dark:border-white/10">
        <div class="min-w-0 flex-1">
          <p class="text-muted-500 mb-2 text-[11px] font-extrabold uppercase tracking-[0.06em]">
            {{ KIND_LABEL[block.kind] }}
          </p>

          <template v-if="block.kind === 'heading'">
            <div class="flex gap-2">
              <input v-model="block.text" maxlength="160" aria-label="Heading text" :class="INPUT">
              <BaseSelect :model-value="String(block.level)" rounded="lg" aria-label="Heading level" class="w-28 shrink-0" @update:model-value="block.level = Number($event) as 2 | 3">
                <BaseSelectItem value="2">
                  Large
                </BaseSelectItem>
                <BaseSelectItem value="3">
                  Small
                </BaseSelectItem>
              </BaseSelect>
            </div>
          </template>

          <textarea v-else-if="block.kind === 'paragraph'" v-model="block.text" rows="4" maxlength="4000" aria-label="Paragraph text" :class="INPUT" class="resize-y leading-[1.55]" />

          <textarea v-else-if="block.kind === 'note'" v-model="block.text" rows="3" maxlength="1200" aria-label="Note text" :class="INPUT" class="resize-y leading-[1.55]" />

          <template v-else-if="block.kind === 'bullets'">
            <label :class="SMALL" :for="`bullets-${path}-${index}`">One point per line</label>
            <textarea :id="`bullets-${path}-${index}`" :value="block.items.join('\n')" rows="4" :class="INPUT" class="resize-y leading-[1.55]" @input="setItems(block, ($event.target as HTMLTextAreaElement).value, line => line)" />
          </template>

          <template v-else-if="block.kind === 'quote'">
            <textarea v-model="block.text" rows="3" maxlength="1200" aria-label="Quote" :class="INPUT" class="resize-y leading-[1.55]" />
            <input v-model="block.by" maxlength="160" placeholder="Who said it (optional)" aria-label="Attribution" :class="INPUT" class="mt-2">
          </template>

          <template v-else-if="block.kind === 'checklist'">
            <label :class="SMALL" :for="`check-${path}-${index}`">One item per line; a bold lead goes before a colon, as in "Fast: live in six weeks"</label>
            <textarea :id="`check-${path}-${index}`" :value="block.items.map(i => (i.lead ? `${i.lead}: ${i.text}` : i.text)).join('\n')" rows="4" :class="INPUT" class="resize-y leading-[1.55]" @input="setItems(block, ($event.target as HTMLTextAreaElement).value, (line) => { const i = line.indexOf(': '); return i > 0 ? { lead: line.slice(0, i), text: line.slice(i + 2) } : { text: line } })" />
          </template>

          <template v-else-if="block.kind === 'costs'">
            <label :class="SMALL" :for="`costs-${path}-${index}`">One per line, as "Label = £value"</label>
            <textarea :id="`costs-${path}-${index}`" :value="block.items.map(i => `${i.label} = ${i.value}`).join('\n')" rows="4" :class="INPUT" class="resize-y leading-[1.55]" @input="setItems(block, ($event.target as HTMLTextAreaElement).value, (line) => { const i = line.lastIndexOf(' = '); return i > 0 ? { label: line.slice(0, i), value: line.slice(i + 3) } : { label: line, value: '' } })" />
          </template>

          <template v-else-if="block.kind === 'table'">
            <input v-model="block.caption" maxlength="200" placeholder="Caption" aria-label="Table caption" :class="INPUT">
            <div class="mt-2 grid grid-cols-3 gap-2">
              <input v-for="c in 3" :key="c" v-model="block.columns[c - 1]" maxlength="60" :aria-label="`Column ${c} heading`" :class="INPUT">
            </div>
            <label :class="SMALL" class="mt-2" :for="`rows-${path}-${index}`">One row per line, as "Label | low | high" (an optional detail after the label with a slash: "Label / detail | low | high")</label>
            <textarea :id="`rows-${path}-${index}`" :value="block.rows.map(r => `${r.label}${r.detail ? ` / ${r.detail}` : ''} | ${r.values[0]} | ${r.values[1]}`).join('\n')" rows="5" :class="INPUT" class="resize-y leading-[1.55] font-mono" @input="block.rows = ($event.target as HTMLTextAreaElement).value.split('\n').map(l => l.trim()).filter(Boolean).map((l) => { const [head = '', a = '', b = ''] = l.split('|').map(s => s.trim()); const slash = head.indexOf(' / '); return { label: slash > 0 ? head.slice(0, slash) : head, ...(slash > 0 ? { detail: head.slice(slash + 3) } : {}), values: [a, b] as [string, string] } })" />
          </template>

          <p v-for="e in errorsFor(index)" :key="e" class="mt-1.5 text-xs font-semibold text-[#EC6453]" role="alert">
            {{ e }}
          </p>
        </div>
        <div class="flex shrink-0 flex-col gap-1">
          <button type="button" :class="ICON_BTN" :disabled="index === 0" :aria-label="`Move block ${index + 1} up`" @click="move(index, -1)">
            <Icon name="lucide:chevron-up" class="size-4" />
          </button>
          <button type="button" :class="ICON_BTN" :disabled="index === blocks.length - 1" :aria-label="`Move block ${index + 1} down`" @click="move(index, 1)">
            <Icon name="lucide:chevron-down" class="size-4" />
          </button>
          <button type="button" :class="ICON_BTN" class="hover:text-[#EC6453]!" :aria-label="`Remove block ${index + 1}`" @click="remove(index)">
            <Icon name="lucide:x" class="size-4" />
          </button>
        </div>
      </li>
    </ol>

    <div v-if="max === undefined || blocks.length < max" class="relative">
      <AdminButton size="sm" :aria-expanded="adding" @click="adding = !adding">
        <Icon name="lucide:plus" class="size-3.5" />
        Add a block
      </AdminButton>
      <div v-if="adding" class="border-muted-200 mt-2 flex flex-wrap gap-2 rounded-xl border bg-white p-3 dark:border-white/10 dark:bg-muted-800">
        <button v-for="kind in BLOCK_KINDS" :key="kind" type="button" class="apex-focus bg-muted-100 text-muted-900 hover:bg-muted-200 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold" @click="add(kind)">
          {{ KIND_LABEL[kind] }}
        </button>
      </div>
    </div>
  </div>
</template>
