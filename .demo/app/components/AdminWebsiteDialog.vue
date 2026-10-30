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
      <DialogOverlay class="apex-scrim-in fixed inset-0 z-[80] bg-[rgba(3,10,12,.6)]" />
      <DialogContent
        class="apex-rise-in bg-card border-line-strong fixed left-1/2 top-1/2 z-[81] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-[18px] border px-6 py-[22px] shadow-[0_40px_90px_rgba(17,31,34,.4)] focus:outline-none"
      >
        <DialogTitle class="font-heading text-fg-heading text-xl font-extrabold tracking-[-0.015em]">
          {{ title }}
        </DialogTitle>
        <DialogDescription class="text-fg-body text-sm leading-[1.6]">
          {{ description }}
        </DialogDescription>
        <slot />
        <div class="flex flex-wrap justify-end gap-2.5">
          <slot name="actions" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
