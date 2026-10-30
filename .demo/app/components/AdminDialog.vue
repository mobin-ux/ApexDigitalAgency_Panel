<script setup lang="ts">
/**
 * A centred console dialog for forms (create an order, assign owners,
 * invite a colleague): the confirmation's frame — 18px radius, Yellix
 * title, body sentence — with the form in the default slot and the
 * buttons in `#actions`. Built on reka's Dialog for the focus trap,
 * Escape, the scroll lock and focus return; entry-only keyframes.
 */
const { width = 'md' } = defineProps<{
  title: string
  description?: string
  width?: 'md' | 'lg'
}>()

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="apex-scrim-in fixed inset-0 z-[80] bg-[rgba(3,10,12,.6)]" />
      <DialogContent
        class="apex-rise-in border-line-strong bg-card fixed left-1/2 top-1/2 z-[81] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[18px] border shadow-[0_40px_90px_rgba(17,31,34,.4)] focus:outline-none"
        :class="width === 'lg' ? 'max-w-[680px]' : 'max-w-[560px]'"
      >
        <div class="flex items-start gap-3 px-6 pt-[22px]">
          <div class="min-w-0 flex-1">
            <DialogTitle class="font-heading text-fg-heading text-xl font-extrabold tracking-[-0.015em]">
              {{ title }}
            </DialogTitle>
            <DialogDescription v-if="description" class="text-fg-body mt-2 text-sm leading-[1.6]">
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose class="apex-ring border-line-subtle text-fg-heading inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] border" aria-label="Close">
            <Icon name="lucide:x" class="size-4" />
          </DialogClose>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 pt-4">
          <slot />
        </div>
        <div v-if="$slots.actions" class="flex flex-wrap justify-end gap-2.5 px-6 pb-[22px] pt-5">
          <slot name="actions" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
