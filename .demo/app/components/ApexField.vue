<script setup lang="ts">
/**
 * Labelled text field for the Panel v2 pages (design system `Input`): a 14px
 * label with a red asterisk when required, a 48px control at 15px (16px on a
 * phone, where iOS zooms into anything smaller), then the hint — replaced by
 * the error when there is one, tied to the control with `aria-describedby`.
 */
const {
  label,
  required = false,
  hint = '',
  error = '',
  multiline = false,
  rows = 4,
  type = 'text',
  placeholder = '',
  autocomplete,
  inputmode,
  readonly = false,
} = defineProps<{
  label: string
  required?: boolean
  hint?: string
  error?: string
  multiline?: boolean
  rows?: number
  type?: string
  placeholder?: string
  autocomplete?: string
  inputmode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal' | 'url'
  readonly?: boolean
}>()

const emit = defineEmits<{ blur: [] }>()
const model = defineModel<string>({ default: '' })

const id = useId()
const noteId = `${id}-note`

const CONTROL = 'apex-ring bg-card text-fg-heading placeholder:text-fg-muted w-full rounded-xl border px-3.5 text-base outline-none transition-colors md:text-[15px] read-only:bg-raised'
</script>

<template>
  <div class="flex flex-col gap-2">
    <label :for="id" class="text-fg-heading text-sm font-semibold">
      {{ label }}<span v-if="required" class="ml-0.5 text-[#EC6453]" aria-hidden="true">*</span>
    </label>
    <textarea
      v-if="multiline"
      :id="id"
      v-model="model"
      :rows="rows"
      :placeholder="placeholder"
      :required="required"
      :readonly="readonly"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="hint || error ? noteId : undefined"
      class="resize-y py-3 leading-normal"
      :class="[CONTROL, error ? 'border-[#EC6453]' : 'border-line-rule focus:border-accent']"
      @blur="emit('blur')"
    />
    <input
      v-else
      :id="id"
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      :required="required"
      :readonly="readonly"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="hint || error ? noteId : undefined"
      class="h-12"
      :class="[CONTROL, error ? 'border-[#EC6453]' : 'border-line-rule focus:border-accent']"
      @blur="emit('blur')"
    >
    <span v-if="error" :id="noteId" class="text-st-danger-fg flex items-center gap-1.5 text-[12.5px] font-medium">
      <Icon name="lucide:circle-alert" class="size-3.5 shrink-0 text-[#EC6453]" />{{ error }}
    </span>
    <span v-else-if="hint" :id="noteId" class="text-fg-muted text-[12.5px]">{{ hint }}</span>
  </div>
</template>
