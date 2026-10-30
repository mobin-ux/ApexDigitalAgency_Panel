<script setup lang="ts">
/* eslint-disable vue/no-mutating-props -- the editor edits one document object in place; the page compares it with its saved copy to know it is dirty, and child controls write into the branch they were given (see AdminWebsiteFields) */
import type { Section, SectionType } from '~~/shared/cms'
import { SECTION_DEFS, SECTION_TYPES } from '~~/shared/cms'
import { emptyMap } from '~/utils/cmsEditor'

/**
 * A landing page's sections: an ordered list, each of one type from
 * shared/cms/sections.ts, edited with the generic field form over that
 * type's props. Hidden sections stay in the draft and are left out of what
 * the site renders. Order is buttons, not drag and drop, so it works with
 * a keyboard and on a phone.
 */
const props = defineProps<{
  model: Record<string, unknown>
  field: string
  errors: Record<string, string[]>
  path: string
}>()

if (!Array.isArray(props.model[props.field])) {
  props.model[props.field] = []
}
const sections = computed<Section[]>(() => props.model[props.field] as Section[])

const adding = ref(false)
const open = ref<Record<string, boolean>>({})

function nextId(type: SectionType): string {
  let n = sections.value.filter(s => s.type === type).length + 1
  while (sections.value.some(s => s.id === `${type}-${n}`)) {
    n += 1
  }
  return `${type}-${n}`
}

function add(type: SectionType) {
  const id = nextId(type)
  sections.value.push({ id, type, hidden: false, props: emptyMap(SECTION_DEFS[type].fields) } as Section)
  open.value[id] = true
  adding.value = false
}

function remove(index: number) {
  sections.value.splice(index, 1)
}

function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= sections.value.length) {
    return
  }
  const [item] = sections.value.splice(index, 1)
  sections.value.splice(target, 0, item!)
}

function summary(section: Section): string {
  const p = section.props as Record<string, unknown>
  const text = (p.title ?? p.text ?? p.eyebrow) as string | undefined
  return text?.trim() ? text : 'Empty'
}

function hasErrors(index: number): boolean {
  const prefix = `${props.path}.${index}`
  return Object.keys(props.errors).some(key => key === prefix || key.startsWith(`${prefix}.`))
}

const ICON_BTN = 'apex-focus text-muted-500 hover:bg-muted-100 hover:text-muted-900 dark:hover:bg-white/8 dark:hover:text-white inline-flex size-8 items-center justify-center rounded-lg transition disabled:opacity-40'
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="!sections.length" class="text-muted-500 text-[13px]">
      No sections yet. The page is published empty until some are added.
    </p>
    <p v-for="e in errors[path] ?? []" :key="e" class="text-xs font-semibold text-st-danger-fg" role="alert">
      {{ e }}
    </p>
    <ol class="flex flex-col gap-3">
      <li v-for="(section, index) in sections" :key="section.id" class="border-muted-200 rounded-xl border dark:border-white/10" :class="section.hidden ? 'opacity-70' : ''">
        <div class="flex items-center gap-2 px-4 py-3">
          <button type="button" class="apex-focus flex min-w-0 flex-1 items-center gap-3 rounded text-start" :aria-expanded="Boolean(open[section.id])" @click="open[section.id] = !open[section.id]">
            <Icon :name="open[section.id] ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="text-muted-500 size-4 shrink-0" />
            <span class="min-w-0">
              <span class="text-muted-900 block text-sm font-semibold dark:text-white">{{ SECTION_DEFS[section.type].label }}<span v-if="hasErrors(index)" class="ml-2 text-st-danger-fg">needs attention</span></span>
              <span class="text-muted-500 block truncate text-xs">{{ summary(section) }}</span>
            </span>
          </button>
          <label class="text-muted-500 flex shrink-0 items-center gap-1.5 text-xs font-semibold">
            <input v-model="section.hidden" type="checkbox" class="size-3.5 accent-primary-500">
            Hidden
          </label>
          <button type="button" :class="ICON_BTN" :disabled="index === 0" :aria-label="`Move section ${index + 1} up`" @click="move(index, -1)">
            <Icon name="lucide:chevron-up" class="size-4" />
          </button>
          <button type="button" :class="ICON_BTN" :disabled="index === sections.length - 1" :aria-label="`Move section ${index + 1} down`" @click="move(index, 1)">
            <Icon name="lucide:chevron-down" class="size-4" />
          </button>
          <button type="button" :class="ICON_BTN" class="hover:text-st-danger-fg!" :aria-label="`Remove section ${index + 1}`" @click="remove(index)">
            <Icon name="lucide:x" class="size-4" />
          </button>
        </div>
        <div v-if="open[section.id]" class="border-muted-200 border-t p-4 dark:border-white/10">
          <AdminWebsiteFields
            :fields="SECTION_DEFS[section.type].fields"
            :model="(section.props as Record<string, unknown>)"
            :errors="errors"
            :path="`${path}.${index}.props`"
            :depth="1"
          />
        </div>
      </li>
    </ol>

    <div v-if="sections.length < 40" class="relative">
      <AdminButton size="sm" :aria-expanded="adding" @click="adding = !adding">
        <Icon name="lucide:plus" class="size-3.5" />
        Add a section
      </AdminButton>
      <div v-if="adding" class="border-muted-200 mt-2 grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2 dark:border-white/10 dark:bg-muted-800">
        <button v-for="type in SECTION_TYPES" :key="type" type="button" class="apex-focus hover:bg-muted-100 dark:hover:bg-white/5 flex flex-col items-start rounded-lg px-3 py-2 text-start" @click="add(type)">
          <span class="text-muted-900 text-[13px] font-semibold dark:text-white">{{ SECTION_DEFS[type].label }}</span>
          <span class="text-muted-500 text-xs">{{ SECTION_DEFS[type].detail }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
