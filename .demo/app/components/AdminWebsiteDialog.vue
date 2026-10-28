<script setup lang="ts">
/**
 * A centred confirmation dialog for the website module (ADR-021, Gate 8),
 * built on reka's Dialog for the same reasons `ApexBottomSheet` is: the
 * focus trap, Escape, the body-scroll lock and returning focus to the
 * control that opened it are all easy to get subtly wrong by hand, and the
 * hand-rolled dialogs this replaces had none of them — a keyboard user who
 * pressed "Publish" was left with focus behind the scrim.
 *
 * Entry animation is a CSS keyframe (`apex-fade` / `apex-pop`), never a
 * `<Transition>` leave: reka unmounts the content on close, so nothing can
 * be stranded invisible over the page. The title and the body are the
 * dialog's accessible name and description.
 */
defineProps<{
  title: string
  description: string
}>()

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="apex-fade fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
      <DialogContent
        class="apex-pop fixed left-1/2 top-1/2 z-[61] flex w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border border-muted-200 bg-white p-6 shadow-[0_30px_60px_rgba(0,0,0,.5)] focus:outline-none dark:border-white/10 dark:bg-muted-800"
      >
        <DialogTitle class="font-heading text-muted-900 text-[18px] font-extrabold tracking-[-0.01em] dark:text-white">
          {{ title }}
        </DialogTitle>
        <DialogDescription class="text-muted-500 text-[13px] leading-[1.5]">
          {{ description }}
        </DialogDescription>
        <slot />
        <div class="flex justify-end gap-2">
          <slot name="actions" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
