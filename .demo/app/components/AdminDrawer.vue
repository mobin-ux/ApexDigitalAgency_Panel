<script setup lang="ts">
import type { ApexTone } from '~/utils/panel'

/**
 * The console's record drawer (`Admin Console.dc.html`): 480px from the
 * right on the card plane, an eyebrow, a Yellix title and the record's
 * status chip, a scrolling body, and a pinned footer (`#footer`) for the
 * composer or the record's actions. Full width on a phone.
 *
 * Built on reka's Dialog (focus trap, Escape, scroll lock, focus return);
 * entry-only keyframe so nothing can be left invisible over the page.
 */
defineProps<{
  title: string
  eyebrow?: string
  status?: string
  tone?: ApexTone
}>()

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="apex-scrim-in fixed inset-0 z-[70] bg-[rgba(3,10,12,.45)]" />
      <DialogContent
        class="apex-slide-in border-line-strong bg-card fixed inset-y-0 end-0 z-[71] flex w-full max-w-[480px] flex-col border-s shadow-[-30px_0_80px_rgba(17,31,34,.3)] focus:outline-none"
      >
        <div class="border-line-subtle flex shrink-0 items-start gap-3 border-b px-6 pb-4 pt-[22px]">
          <div class="min-w-0 flex-1">
            <DialogDescription v-if="eyebrow" class="text-fg-muted text-[12.5px]">
              {{ eyebrow }}
            </DialogDescription>
            <DialogTitle class="font-heading text-fg-heading mt-1 text-[21px] font-extrabold tracking-[-0.015em]">
              {{ title }}
            </DialogTitle>
          </div>
          <AdminStatusChip v-if="status" :tone="tone" :label="status" dot class="mt-1" />
          <DialogClose class="apex-ring border-line-subtle text-fg-heading inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] border" aria-label="Close">
            <Icon name="lucide:x" class="size-4" />
          </DialogClose>
        </div>
        <div class="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-5">
          <slot />
        </div>
        <div v-if="$slots.footer" class="border-line-subtle flex shrink-0 flex-col gap-2.5 border-t px-6 pb-[max(1.125rem,env(safe-area-inset-bottom))] pt-3.5">
          <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
