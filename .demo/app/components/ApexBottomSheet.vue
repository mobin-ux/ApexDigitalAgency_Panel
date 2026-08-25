<script setup lang="ts">
/**
 * Bottom sheet — the mobile form of every menu that is a dropdown on desktop
 * (V2 Phase 1 mobile, §5 and §6).
 *
 * A dropdown anchored to the edge of a 393px viewport has nowhere to go: it
 * either clips against the edge it is aligned to or covers the control that
 * opened it, so the customer cannot see what they are acting on. A sheet does
 * neither, and it is what every native app on the device already does.
 *
 * Built on reka's Dialog rather than by hand: the focus trap, the Escape
 * binding, the body-scroll lock and returning focus to the trigger on close are
 * all requirements of §Accessibility, and all four are easy to get subtly wrong.
 *
 * Entry animation is a CSS keyframe, not a `<Transition>`. Wrapping a modal in
 * `<Transition>` with an opacity leave is what left an invisible full-screen
 * overlay swallowing every click on Wallet — Vue animated the node out but never
 * unmounted it. reka unmounts its content on close, so a pure entry animation
 * cannot strand anything. Both keyframes are `prefers-reduced-motion` guarded in
 * `main.css`.
 */
defineProps<{
  /** Accessible name for the dialog. Required — a sheet with no name is a blank overlay to a screen reader. */
  title: string
  /**
   * One sentence naming what the sheet contains. Required because reka
   * generates an `aria-describedby` for every `DialogContent` and, with no
   * `DialogDescription` to point at, leaves it referencing an element that does
   * not exist — a broken reference is worse than none.
   */
  description: string
  /**
   * Cap the sheet's height so the page behind it stays partly visible; the body
   * scrolls inside. Notifications uses this, the account menu does not (it is
   * four rows and should size to them).
   */
  scrollable?: boolean
}>()

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="apex-scrim-in fixed inset-0 z-[60] bg-[rgba(3,10,12,.62)]" />
      <DialogContent
        class="apex-sheet-in border-muted-200 dark:border-muted-700 dark:bg-muted-800 fixed inset-x-0 bottom-0 z-[61] flex flex-col rounded-t-[20px] border-t bg-white focus:outline-none"
        :class="scrollable ? 'max-h-[72%]' : 'max-h-[85%]'"
      >
        <!--
          The grabber is decorative: the sheet is dismissed by the scrim, Escape
          or a row, and there is no drag gesture behind it. It stays because it
          is the platform's signal for "this panel came up from the bottom edge",
          which is what tells a customer the scrim is tappable.
        -->
        <div class="flex shrink-0 justify-center pb-0.5 pt-2">
          <span aria-hidden="true" class="bg-muted-300 dark:bg-white/[.18] block h-1 w-[38px] rounded-full" />
        </div>

        <!-- Named for assistive tech; the visible heading is the caller's own. -->
        <VisuallyHidden>
          <DialogTitle>{{ title }}</DialogTitle>
          <DialogDescription>{{ description }}</DialogDescription>
        </VisuallyHidden>

        <slot name="header" />

        <div class="min-h-0 grow overflow-y-auto overscroll-contain">
          <slot />
        </div>

        <!--
          The home-indicator inset as a flow element rather than padding on the
          last row: a scrolling list would otherwise scroll its own bottom
          padding away and end flush against the indicator.
        -->
        <div aria-hidden="true" class="h-[env(safe-area-inset-bottom)] shrink-0" />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
