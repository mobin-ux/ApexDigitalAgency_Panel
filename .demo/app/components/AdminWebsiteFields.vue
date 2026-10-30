<script setup lang="ts">
/* eslint-disable vue/no-mutating-props -- the editor edits one document object in place; the page compares it with its saved copy to know it is dirty, and child controls write into the branch they were given (see AdminWebsiteFields) */
import type { FieldDef, FieldMap, MediaField } from '~~/shared/cms'
import { emptyValue } from '~/utils/cmsEditor'

/**
 * The generic editor form: one control per field in a template's field map
 * (shared/cms/fields.ts), recursing into objects, lists and optionals. The
 * same declaration that produces the server's zod schema produces this
 * form, so a field cannot be editable here and refused there.
 *
 * Values are edited in place on the document object the editor owns; the
 * editor compares it with the last saved copy to know it is dirty. Errors
 * arrive by dotted path from the server's 400 and sit under their field.
 */
const props = defineProps<{
  fields: FieldMap
  model: Record<string, unknown>
  errors: Record<string, string[]>
  path?: string
  /** Nested fieldsets draw a lighter border. */
  depth?: number
}>()

const depth = computed(() => props.depth ?? 0)

function pathOf(key: string) {
  return props.path ? `${props.path}.${key}` : key
}

function errorsAt(key: string): string[] {
  return props.errors[pathOf(key)] ?? []
}

function inner(def: FieldDef): FieldDef {
  return def.type === 'optional' ? def.inner : def
}

function isSet(key: string) {
  return props.model[key] !== undefined && props.model[key] !== null
}

function toggleOptional(key: string, def: FieldDef) {
  props.model[key] = isSet(key) ? undefined : emptyValue(inner(def))
}

function listOf(key: string): unknown[] {
  if (!Array.isArray(props.model[key])) {
    props.model[key] = []
  }
  return props.model[key] as unknown[]
}

function addItem(key: string, def: FieldDef) {
  const item = inner(def)
  if (item.type === 'list') {
    listOf(key).push(emptyValue(item.item))
  }
}

function removeItem(key: string, index: number) {
  listOf(key).splice(index, 1)
}

function moveItem(key: string, index: number, delta: number) {
  const list = listOf(key)
  const target = index + delta
  if (target < 0 || target >= list.length) {
    return
  }
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
}

function label(def: FieldDef): string {
  return 'label' in def ? def.label : ''
}

function hint(def: FieldDef): string | undefined {
  return 'hint' in def ? def.hint : undefined
}

function mediaValue(key: string): { mediaId: string, alt: string } | null {
  const value = props.model[key] as { mediaId?: string, alt?: string } | null | undefined
  return value && value.mediaId ? { mediaId: value.mediaId, alt: value.alt ?? '' } : null
}

function acceptOf(def: MediaField): 'image' | 'pdf' | undefined {
  const image = def.accept.includes('image')
  const pdf = def.accept.includes('pdf')
  return image && !pdf ? 'image' : pdf && !image ? 'pdf' : undefined
}

function setNumber(key: string, raw: string) {
  const n = Number(raw)
  props.model[key] = raw === '' || Number.isNaN(n) ? 0 : n
}

const INPUT = 'focus:border-primary-400 w-full rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-2.5 text-sm text-muted-900 outline-none placeholder:text-muted-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500'
const LABEL = 'text-muted-900 mb-1.5 block text-[13.5px] font-semibold dark:text-white'
const HINT = 'text-muted-500 mt-1.5 text-xs leading-[1.45]'
const ERROR = 'mt-1.5 text-xs font-semibold text-st-danger-fg'
const ICON_BTN = 'apex-focus text-muted-500 hover:bg-muted-100 hover:text-muted-900 dark:hover:bg-white/8 dark:hover:text-white inline-flex size-8 items-center justify-center rounded-lg transition disabled:opacity-40'
</script>

<template>
  <div class="flex flex-col gap-5">
    <div v-for="(def, key) in fields" :id="`field-${pathOf(key)}`" :key="key">
      <!-- Optional wrapper: a checkbox that brings the inner field into being. -->
      <div v-if="def.type === 'optional'" class="flex flex-col gap-2">
        <label class="flex items-center gap-2.5 text-[13.5px] font-semibold text-muted-900 dark:text-white">
          <input type="checkbox" :checked="isSet(key)" class="size-4 accent-primary-500" @change="toggleOptional(key, def)">
          {{ label(def.inner) }}
          <span class="text-muted-500 text-xs font-normal">optional</span>
        </label>
        <p v-if="hint(def.inner) && !isSet(key)" :class="HINT">
          {{ hint(def.inner) }}
        </p>
        <div v-if="isSet(key)" class="border-muted-200 rounded-xl border p-4 dark:border-white/10">
          <AdminWebsiteFields
            v-if="def.inner.type === 'object'"
            :fields="def.inner.fields"
            :model="(model[key] as Record<string, unknown>)"
            :errors="errors"
            :path="pathOf(key)"
            :depth="depth + 1"
          />
          <AdminWebsiteFields
            v-else
            :fields="{ [key]: def.inner }"
            :model="model"
            :errors="errors"
            :path="path"
            :depth="depth + 1"
          />
        </div>
      </div>

      <!-- Text -->
      <div v-else-if="def.type === 'text'">
        <label :for="`in-${pathOf(key)}`" :class="LABEL">{{ def.label }}<span v-if="def.required" class="ml-0.5 text-st-danger-fg" aria-hidden="true">*</span></label>
        <input
          :id="`in-${pathOf(key)}`"
          :value="(model[key] as string) ?? ''"
          :maxlength="def.max"
          :required="def.required"
          :aria-invalid="errorsAt(key).length ? 'true' : undefined"
          :class="INPUT"
          @input="model[key] = ($event.target as HTMLInputElement).value"
        >
        <p v-if="def.hint" :class="HINT">
          {{ def.hint }}
        </p>
        <p v-for="e in errorsAt(key)" :key="e" :class="ERROR" role="alert">
          {{ e }}
        </p>
      </div>

      <!-- Textarea -->
      <div v-else-if="def.type === 'textarea'">
        <label :for="`in-${pathOf(key)}`" :class="LABEL">{{ def.label }}<span v-if="def.required" class="ml-0.5 text-st-danger-fg" aria-hidden="true">*</span></label>
        <textarea
          :id="`in-${pathOf(key)}`"
          :value="(model[key] as string) ?? ''"
          :maxlength="def.max"
          :required="def.required"
          :aria-invalid="errorsAt(key).length ? 'true' : undefined"
          rows="3"
          :class="INPUT"
          class="resize-y leading-[1.55]"
          @input="model[key] = ($event.target as HTMLTextAreaElement).value"
        />
        <p class="text-muted-500 mt-1.5 flex justify-between text-xs">
          <span>{{ def.hint ?? '' }}</span>
          <span class="tabular-nums">{{ ((model[key] as string) ?? '').length }} / {{ def.max }}</span>
        </p>
        <p v-for="e in errorsAt(key)" :key="e" :class="ERROR" role="alert">
          {{ e }}
        </p>
      </div>

      <!-- Number -->
      <div v-else-if="def.type === 'number'">
        <label :for="`in-${pathOf(key)}`" :class="LABEL">{{ def.label }}</label>
        <input
          :id="`in-${pathOf(key)}`"
          type="number"
          :value="(model[key] as number) ?? 0"
          :min="def.min"
          :max="def.max"
          :step="def.integer ? 1 : 'any'"
          :class="INPUT"
          class="max-w-[160px]"
          @input="setNumber(key, ($event.target as HTMLInputElement).value)"
        >
        <p v-if="def.hint" :class="HINT">
          {{ def.hint }}
        </p>
        <p v-for="e in errorsAt(key)" :key="e" :class="ERROR" role="alert">
          {{ e }}
        </p>
      </div>

      <!-- Boolean -->
      <div v-else-if="def.type === 'boolean'">
        <label class="flex items-center gap-2.5 text-[13.5px] font-semibold text-muted-900 dark:text-white">
          <input type="checkbox" :checked="Boolean(model[key])" class="size-4 accent-primary-500" @change="model[key] = ($event.target as HTMLInputElement).checked">
          {{ def.label }}
        </label>
        <p v-if="def.hint" :class="HINT">
          {{ def.hint }}
        </p>
      </div>

      <!-- Select -->
      <div v-else-if="def.type === 'select'">
        <span :class="LABEL">{{ def.label }}</span>
        <BaseSelect :model-value="(model[key] as string) ?? def.options[0]?.value" rounded="lg" :aria-label="def.label" @update:model-value="model[key] = $event">
          <BaseSelectItem v-for="option in def.options" :key="option.value" :value="option.value">
            {{ option.label }}
          </BaseSelectItem>
        </BaseSelect>
        <p v-if="def.hint" :class="HINT">
          {{ def.hint }}
        </p>
      </div>

      <!-- Link -->
      <div v-else-if="def.type === 'link'">
        <span :class="LABEL">{{ def.label }}</span>
        <AdminWebsiteLink :model="model" :field="key" :errors="errors" :path="pathOf(key)" />
        <p v-if="def.hint" :class="HINT">
          {{ def.hint }}
        </p>
      </div>

      <!-- Media: a reference into the library, chosen with the picker. -->
      <div v-else-if="def.type === 'media'">
        <span :class="LABEL">{{ def.label }}</span>
        <AdminWebsiteMediaPicker :model-value="mediaValue(key)" :accept="acceptOf(def)" @update:model-value="model[key] = $event ?? { mediaId: '', alt: '' }" />
        <p v-if="def.hint" :class="HINT">
          {{ def.hint }}
        </p>
        <p v-for="e in [...errorsAt(key), ...(errors[`${pathOf(key)}.mediaId`] ?? [])]" :key="e" :class="ERROR" role="alert">
          {{ e }}
        </p>
      </div>

      <!-- Blocks -->
      <div v-else-if="def.type === 'blocks'">
        <span :class="LABEL">{{ def.label }}</span>
        <AdminWebsiteBlocks :model="model" :field="key" :errors="errors" :path="pathOf(key)" :max="def.max" />
        <p v-if="def.hint" :class="HINT">
          {{ def.hint }}
        </p>
      </div>

      <!-- Sections -->
      <div v-else-if="def.type === 'custom' && def.kind === 'sections'">
        <span :class="LABEL">{{ def.label }}</span>
        <AdminWebsiteSections :model="model" :field="key" :errors="errors" :path="pathOf(key)" />
        <p v-if="def.hint" :class="HINT">
          {{ def.hint }}
        </p>
      </div>

      <!-- Object -->
      <fieldset v-else-if="def.type === 'object'" class="rounded-xl border p-4" :class="depth ? 'border-muted-200/70 dark:border-white/5' : 'border-muted-200 dark:border-white/10'">
        <legend class="text-muted-900 px-1 text-[13.5px] font-bold dark:text-white">
          {{ def.label }}
        </legend>
        <p v-if="def.hint" :class="HINT" class="mb-3 mt-0">
          {{ def.hint }}
        </p>
        <AdminWebsiteFields
          :fields="def.fields"
          :model="(model[key] ??= {}) as Record<string, unknown>"
          :errors="errors"
          :path="pathOf(key)"
          :depth="depth + 1"
        />
      </fieldset>

      <!-- List -->
      <fieldset v-else-if="def.type === 'list'" class="rounded-xl border p-4" :class="depth ? 'border-muted-200/70 dark:border-white/5' : 'border-muted-200 dark:border-white/10'">
        <legend class="text-muted-900 px-1 text-[13.5px] font-bold dark:text-white">
          {{ def.label }}
          <span class="text-muted-500 font-normal">{{ listOf(key).length }}{{ def.max ? ` of ${def.max}` : '' }}</span>
        </legend>
        <p v-if="def.hint" :class="HINT" class="mb-3 mt-0">
          {{ def.hint }}
        </p>
        <p v-for="e in errorsAt(key)" :key="e" :class="ERROR" class="mb-3" role="alert">
          {{ e }}
        </p>
        <ol class="flex flex-col gap-3">
          <li v-for="(item, index) in listOf(key)" :key="index" class="flex gap-2">
            <div class="min-w-0 flex-1">
              <AdminWebsiteFields
                v-if="def.item.type === 'object'"
                :fields="def.item.fields"
                :model="(item as Record<string, unknown>)"
                :errors="errors"
                :path="`${pathOf(key)}.${index}`"
                :depth="depth + 1"
              />
              <AdminWebsiteFields
                v-else
                :fields="{ [index]: def.item }"
                :model="(listOf(key) as unknown as Record<string, unknown>)"
                :errors="errors"
                :path="pathOf(key)"
                :depth="depth + 1"
              />
            </div>
            <div class="flex shrink-0 flex-col gap-1">
              <button type="button" :class="ICON_BTN" :disabled="index === 0" :aria-label="`Move item ${index + 1} up`" @click="moveItem(key, index, -1)">
                <Icon name="lucide:chevron-up" class="size-4" />
              </button>
              <button type="button" :class="ICON_BTN" :disabled="index === listOf(key).length - 1" :aria-label="`Move item ${index + 1} down`" @click="moveItem(key, index, 1)">
                <Icon name="lucide:chevron-down" class="size-4" />
              </button>
              <button type="button" :class="ICON_BTN" class="hover:text-st-danger-fg!" :disabled="def.min !== undefined && listOf(key).length <= def.min" :aria-label="`Remove item ${index + 1}`" @click="removeItem(key, index)">
                <Icon name="lucide:x" class="size-4" />
              </button>
            </div>
          </li>
        </ol>
        <AdminButton v-if="def.max === undefined || listOf(key).length < def.max" size="sm" class="mt-3" @click="addItem(key, def)">
          <Icon name="lucide:plus" class="size-3.5" />
          Add
        </AdminButton>
      </fieldset>
    </div>
  </div>
</template>
