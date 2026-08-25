<script setup lang="ts">
const { isMobileOpen } = useLayoutSidenavContext()
</script>

<template>
  <!--
    Drawer scrim. `lg:hidden` because `lg` is where the sidebar becomes a
    permanent rail — it used to say `xl`, left behind when the shell breakpoint
    moved to 1024px, which left a scrim that could cover the page between
    1024px and 1279px.

    A fixed colour rather than a token: this is the design's scrim over the
    page, not a surface, and it reads the same in both themes.
  -->
  <div
    aria-hidden="true"
    class="fixed start-0 top-0 z-40 block size-full bg-[rgba(3,10,12,.62)] transition-opacity duration-200 lg:hidden"
    :class="
      isMobileOpen
        ? 'opacity-100 pointer-events-auto'
        : 'opacity-0 pointer-events-none'
    "
    @click="isMobileOpen = false"
  />
</template>
