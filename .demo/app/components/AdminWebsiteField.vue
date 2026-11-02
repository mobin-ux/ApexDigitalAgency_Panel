<script setup lang="ts">
import type { FieldDef } from '~~/shared/cms'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL, ADMIN_TEXTAREA } from '~/utils/adminUi'
import { emptyValue } from '~/utils/websiteFields'

/**
 * One field of a website document, generated from its declaration in the
 * shared contract (`web/shared/cms`, ADR-026), so a field cannot appear in
 * the editor without the rule the server checks it against, or the other
 * way round. Objects and lists render their parts with this same
 * component. Errors arrive from the server by dotted path (`hero.title`,
 * `sections.2.fields.body`) and land on the input they belong to.
 */
const props = defineProps<{
  def: FieldDef
  modelValue: unknown
  path: string
  errors?: Record<string, string[]>
  readonly?: boolean
  /** Render an object's fields without its own heading (a section's top level). */
  bare?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const id = computed(() => `f-${props.path.replace(/\W+/g, '-')}`)
const error = computed(() => props.errors?.[props.path]?.[0] ?? null)
const inner = computed(() => (props.def.type === 'optional' ? props.def.inner : props.def))
const label = computed(() => ('label' in inner.value ? inner.value.label : ''))
const hint = computed(() => ('hint' in inner.value ? inner.value.hint : undefined))

const text = computed(() => (typeof props.modelValue === 'string' ? props.modelValue : ''))
const max = computed(() => (inner.value.type === 'text' || inner.value.type === 'textarea' ? inner.value.max : 0))
const required = computed(() => (inner.value.type === 'text' || inner.value.type === 'textarea') && Boolean(inner.value.required))

function setKey(key: string, value: unknown) {
  emit('update:modelValue', { ...(props.modelValue as Record<string, unknown> ?? {}), [key]: value })
}

const list = computed(() => (Array.isArray(props.modelValue) ? props.modelValue as unknown[] : []))
function setItem(index: number, value: unknown) {
  const next = [...list.value]
  next[index] = value
  emit('update:modelValue', next)
}
function moveItem(index: number, to: number) {
  if (to < 0 || to >= list.value.length) {
    return
  }
  const next = [...list.value]
  const [item] = next.splice(index, 1)
  next.splice(to, 0, item)
  emit('update:modelValue', next)
}
function removeItem(index: number) {
  emit('update:modelValue', list.value.filter((_, i) => i !== index))
}
function addItem() {
  if (inner.value.type === 'list') {
    emit('update:modelValue', [...list.value, emptyValue(inner.value.item)])
  }
}

const link = computed(() => (props.modelValue ?? { kind: 'internal', path: '/' }) as { kind: 'internal', path: string } | { kind: 'external', url: string })
function setLinkKind(kind: string) {
  emit('update:modelValue', kind === 'external' ? { kind: 'external', url: 'https://' } : { kind: 'internal', path: '/' })
}
function setLinkTarget(value: string) {
  emit('update:modelValue', link.value.kind === 'external' ? { kind: 'external', url: value } : { kind: 'internal', path: value })
}

const ICON_BTN = 'apex-ring text-fg-muted hover:bg-chip hover:text-fg-heading inline-flex size-7 items-center justify-center rounded-lg disabled:opacity-40'
</script>

<template>
  <!-- An optional group: absent until someone switches it on. -->
  <div v-if="def.type === 'optional'" class="flex flex-col gap-3">
    <label class="text-fg-heading flex cursor-pointer items-center gap-2.5 text-[13px] font-semibold">
      <input
        type="checkbox" class="accent-[#7D53F2] size-4" :checked="modelValue !== undefined" :disabled="readonly"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked ? emptyValue(def.inner) : undefined)"
      >
      {{ label }}
    </label>
    <AdminWebsiteField
      v-if="modelValue !== undefined" :def="def.inner" :model-value="modelValue" :path="path" :errors="errors" :readonly="readonly" bare
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>

  <div v-else-if="def.type === 'object'" :class="bare ? 'flex flex-col gap-4' : 'border-line-subtle flex flex-col gap-4 rounded-xl border p-3.5'">
    <div v-if="!bare" class="text-fg-heading text-[13px] font-bold">
      {{ def.label }}
    </div>
    <p v-if="!bare && def.hint" :class="ADMIN_HINT" class="-mt-3">
      {{ def.hint }}
    </p>
    <AdminWebsiteField
      v-for="(child, key) in def.fields" :key="key"
      :def="child" :model-value="(modelValue as Record<string, unknown> | undefined)?.[key]" :path="`${path}.${key}`" :errors="errors" :readonly="readonly"
      @update:model-value="setKey(String(key), $event)"
    />
  </div>

  <div v-else-if="def.type === 'list'" class="flex flex-col gap-2.5">
    <div class="flex items-baseline gap-2">
      <span class="text-fg-heading flex-1 text-[13px] font-semibold">{{ def.label }}</span>
      <span class="text-fg-muted text-xs tabular-nums">{{ list.length }}{{ def.max ? ` of ${def.max}` : '' }}</span>
    </div>
    <p v-if="def.hint" :class="ADMIN_HINT" class="-mt-1.5">
      {{ def.hint }}
    </p>
    <p v-if="error" class="text-st-danger-fg text-xs" role="alert">
      {{ error }}
    </p>
    <div v-for="(item, i) in list" :key="i" class="border-line-subtle flex flex-col gap-3 rounded-xl border p-3">
      <div class="flex items-center gap-1">
        <span class="text-fg-muted flex-1 text-xs font-semibold uppercase tracking-[0.05em]">{{ 'label' in def.item ? def.item.label : 'Item' }} {{ i + 1 }}</span>
        <template v-if="!readonly">
          <button type="button" :class="ICON_BTN" :disabled="i === 0" :aria-label="`Move item ${i + 1} up`" @click="moveItem(i, i - 1)">
            <Icon name="lucide:chevron-up" class="size-3.5" />
          </button>
          <button type="button" :class="ICON_BTN" :disabled="i === list.length - 1" :aria-label="`Move item ${i + 1} down`" @click="moveItem(i, i + 1)">
            <Icon name="lucide:chevron-down" class="size-3.5" />
          </button>
          <button type="button" :class="ICON_BTN" :disabled="list.length <= (def.min ?? 0)" :aria-label="`Remove item ${i + 1}`" @click="removeItem(i)">
            <Icon name="lucide:x" class="size-3.5" />
          </button>
        </template>
      </div>
      <AdminWebsiteField
        :def="def.item" :model-value="item" :path="`${path}.${i}`" :errors="errors" :readonly="readonly" bare
        @update:model-value="setItem(i, $event)"
      />
    </div>
    <button
      v-if="!readonly && (def.max === undefined || list.length < def.max)" type="button"
      class="apex-ring border-line-strong text-fg-heading hover:bg-hover inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-dashed text-[13px] font-semibold"
      @click="addItem"
    >
      <Icon name="lucide:plus" class="size-3.5" /> Add {{ ('label' in def.item ? def.item.label : 'item').toLowerCase() }}
    </button>
  </div>

  <div v-else-if="def.type === 'boolean'" class="border-line-subtle flex items-center gap-3 rounded-xl border px-3.5 py-3">
    <span class="flex-1">
      <span :id="`${id}-l`" class="text-fg-heading block text-[13.5px] font-semibold">{{ def.label }}</span>
      <span v-if="def.hint" class="text-fg-muted mt-0.5 block text-xs">{{ def.hint }}</span>
    </span>
    <button
      type="button" role="switch" :aria-checked="modelValue === true" :aria-labelledby="`${id}-l`" :disabled="readonly"
      class="apex-ring relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:opacity-60"
      :class="modelValue === true ? 'bg-accent' : 'bg-line-strong'"
      @click="emit('update:modelValue', modelValue !== true)"
    >
      <span class="absolute top-[3px] size-5 rounded-full bg-white shadow transition-[left]" :class="modelValue === true ? 'left-[21px]' : 'left-[3px]'" />
    </button>
  </div>

  <div v-else-if="def.type === 'link'" class="flex flex-col">
    <span :class="ADMIN_LABEL">{{ def.label }}</span>
    <div class="flex gap-2">
      <select :aria-label="`${def.label}: kind`" :class="ADMIN_INPUT" class="w-[150px]! shrink-0" :disabled="readonly" @change="setLinkKind(($event.target as HTMLSelectElement).value)">
        <option value="internal" :selected="link.kind === 'internal'">
          On this site
        </option>
        <option value="external" :selected="link.kind === 'external'">
          Another website
        </option>
      </select>
      <input
        :id="id" :value="link.kind === 'external' ? link.url : link.path" :aria-label="def.label" :readonly="readonly" :class="ADMIN_INPUT"
        :aria-invalid="Boolean(errors?.[`${path}.path`] || errors?.[`${path}.url`] || error) || undefined"
        :placeholder="link.kind === 'external' ? 'https://' : '/contact'"
        @input="setLinkTarget(($event.target as HTMLInputElement).value)"
      >
    </div>
    <span v-if="errors?.[`${path}.path`] || errors?.[`${path}.url`] || error" class="text-st-danger-fg mt-1.5 text-xs" role="alert">{{ (errors?.[`${path}.path`] ?? errors?.[`${path}.url`])?.[0] ?? error }}</span>
    <span v-else-if="def.hint" :class="ADMIN_HINT">{{ def.hint }}</span>
  </div>

  <div v-else class="flex flex-col">
    <label :for="id" class="flex items-baseline gap-2" :class="ADMIN_LABEL">
      <span class="flex-1">{{ label }}<span v-if="required" class="text-st-danger-fg" aria-hidden="true"> *</span></span>
      <span v-if="max && text.length > max * 0.8" class="text-xs font-normal tabular-nums" :class="text.length > max ? 'text-st-danger-fg' : 'text-fg-muted'">{{ text.length }} / {{ max }}</span>
    </label>
    <select v-if="def.type === 'select'" :id="id" :class="ADMIN_INPUT" :disabled="readonly" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
      <option v-for="o in def.options" :key="o.value" :value="o.value" :selected="modelValue === o.value">
        {{ o.label }}
      </option>
    </select>
    <input
      v-else-if="def.type === 'number'" :id="id" type="number" inputmode="numeric" :min="def.min" :max="def.max" :value="modelValue" :readonly="readonly" :class="ADMIN_INPUT"
      :aria-invalid="Boolean(error) || undefined"
      @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
    >
    <textarea
      v-else-if="def.type === 'textarea'" :id="id" :value="text" :rows="max > 1000 ? 8 : 4" :readonly="readonly" :required="required" :class="ADMIN_TEXTAREA"
      :aria-invalid="Boolean(error) || undefined" :aria-describedby="error || hint ? `${id}-h` : undefined"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <input
      v-else :id="id" :value="text" :readonly="readonly" :required="required" :class="ADMIN_INPUT"
      :aria-invalid="Boolean(error) || undefined" :aria-describedby="error || hint ? `${id}-h` : undefined"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
    <span v-if="error" :id="`${id}-h`" class="text-st-danger-fg mt-1.5 text-xs" role="alert">{{ error }}</span>
    <span v-else-if="hint" :id="`${id}-h`" :class="ADMIN_HINT">{{ hint }}</span>
  </div>
</template>
