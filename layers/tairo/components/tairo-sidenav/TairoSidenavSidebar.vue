<script setup lang="ts">
const { isMobileOpen } = useLayoutSidenavContext()
</script>

<template>
  <!--
    One element, two jobs: a permanently visible rail from `lg` up, and an
    off-canvas drawer below it.

    Drawer width is `100% - 68px` (325px at 393px) rather than a fixed figure:
    leaving a strip of the page visible is what tells a customer this is an
    overlay they can tap away, and it gives them a target to do it with.

    `invisible` when closed, not just translated off-screen. A transform moves
    the panel out of sight but leaves every link in the accessibility tree and
    in the tab order, so a screen-reader user walked the whole menu while it was
    shut. `lg:visible` restores the rail before first paint, and both the server
    and the hydration render agree on the closed state, so there is nothing for
    Vue to warn about.

    `visibility` is deliberately NOT in the transition list, which costs the
    slide-*out* — closing hides the panel at once and the transform finishes
    unseen. Transitioning it would defer the hide to the end of the animation,
    which reads better but makes an accessibility property depend on a
    transition completing. It does not always: in a background tab the document
    timeline is frozen, every transition sits at `currentTime: 0`, and the
    drawer stays pinned at the start value — permanently invisible while open.
    A 200ms flourish is not worth a menu that can fail open.
  -->
  <div
    id="apex-drawer"
    class="border-muted-200 dark:border-muted-800 dark:bg-muted-950 pointer-events-auto fixed start-0 top-0 z-50 flex h-svh w-[calc(100%-68px)] flex-col border-b bg-white transition-transform duration-200 lg:z-0 lg:w-[var(--tairo-sidenav-sidebar-width)] lg:border-b-0 lg:border-e"
    :class="isMobileOpen
      ? 'visible translate-x-0'
      : 'invisible -translate-x-full lg:visible lg:translate-x-0'"
  >
    <slot />
  </div>
</template>
