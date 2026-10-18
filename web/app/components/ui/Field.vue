<script setup lang="ts">
/**
 * A labelled text field in the design system's Input style: hairline border,
 * 14px radius, violet focus ring. The label is a real <label for>, a required
 * field carries `required` (the asterisk is for sighted users only), and an
 * error is tied to the control with `aria-describedby` and `aria-invalid`.
 */
withDefaults(defineProps<{
  id: string
  label: string
  type?: 'text' | 'email' | 'tel'
  placeholder?: string
  required?: boolean
  multiline?: boolean
  rows?: number
  autocomplete?: string
  inputmode?: 'text' | 'email' | 'tel'
  maxlength?: number
  error?: string
}>(), {
  type: 'text',
  rows: 5,
})

const emit = defineEmits<{ blur: [] }>()
const model = defineModel<string>({ required: true })

const fieldClass = 'w-full rounded-md border bg-white px-4 py-3.5 text-[0.9375rem] leading-[1.2] text-heading transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-muted focus:border-violet-500 focus:ring-3 focus:ring-violet-50'
</script>

<template>
  <div class="flex flex-col gap-2">
    <label
      :for="id"
      class="text-sm font-medium text-body"
    >
      {{ label }}<span
        v-if="required"
        aria-hidden="true"
      > *</span>
    </label>
    <textarea
      v-if="multiline"
      :id="id"
      v-model="model"
      :rows="rows"
      :placeholder="placeholder"
      :required="required"
      :maxlength="maxlength"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? `${id}-error` : undefined"
      class="resize-y"
      :class="[fieldClass, error ? 'border-danger' : 'border-line-strong']"
      @blur="emit('blur')"
    />
    <input
      v-else
      :id="id"
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      :required="required"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      :maxlength="maxlength"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? `${id}-error` : undefined"
      :class="[fieldClass, error ? 'border-danger' : 'border-line-strong']"
      @blur="emit('blur')"
    >
    <p
      v-if="error"
      :id="`${id}-error`"
      class="text-[0.8125rem] leading-snug text-danger-ink"
    >
      {{ error }}
    </p>
  </div>
</template>
