<script setup lang="ts">
/**
 * Panel v2 dialog (Support's "Book a call" and file preview): centred at
 * `width` from 768px, a bottom sheet below that, as the design draws both.
 *
 * Built on reka's Dialog for the focus trap, Escape, scroll lock and focus
 * return, like `ApexBottomSheet`. Which of the two shapes to use is read with
 * a media query rather than CSS variants, because the entry keyframes are
 * plain classes (no `md:` variant). That is safe here: the content only ever
 * renders on the client, after the customer opens it.
 */
const { title, description, width = 480 } = defineProps<{
  /** Visible heading and accessible name. */
  title: string
  /** One sentence for `aria-describedby`; reka points at it either way. */
  description: string
  /** Width in px when centred. */
  width?: number
}>()

const open = defineModel<boolean>('open', { required: true })
const centred = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="apex-scrim-in bg-scrim fixed inset-0 z-[60]" />
      <DialogContent
        class="bg-card border-line-subtle shadow-pop fixed z-[61] grid max-h-[90vh] content-start overflow-y-auto border focus:outline-none"
        :class="centred
          ? 'apex-pop-in inset-0 m-auto h-fit max-w-[calc(100vw-32px)] rounded-[22px]'
          : 'apex-sheet-in inset-x-0 bottom-0 rounded-t-[24px] pb-[env(safe-area-inset-bottom)]'"
        :style="centred ? { width: `${width}px` } : undefined"
      >
        <div class="flex items-center justify-between gap-3 px-[22px] pt-[22px] max-md:px-[18px] max-md:pt-[18px]">
          <DialogTitle class="font-heading text-fg-heading m-0 min-w-0 text-[21px] font-bold tracking-[-0.02em]">
            <slot name="title">
              {{ title }}
            </slot>
          </DialogTitle>
          <DialogClose aria-label="Close" class="apex-ring text-fg-heading hover:bg-hover inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl">
            <Icon name="lucide:x" class="size-5" />
          </DialogClose>
        </div>
        <VisuallyHidden>
          <DialogDescription>{{ description }}</DialogDescription>
        </VisuallyHidden>
        <div class="grid content-start gap-[18px] p-[22px] pt-[18px] max-md:p-[18px]">
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
