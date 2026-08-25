<script setup lang="ts">
/**
 * Installs the drawer's keyboard and focus behaviour for both Apex shells.
 *
 * It exists as a component rather than a call in each layout's `<script setup>`
 * because `useLayoutSidenavContext()` reads a `provide()` made by
 * `TairoSidenavLayout` — which is the layout's *child*, so injection from the
 * layout itself never resolves. Anything that needs the live `isMobileOpen`
 * ref, rather than the unwrapped boolean the slot hands out, has to sit inside
 * the tree.
 *
 * Renders its slot untouched: no wrapper element, nothing to affect layout.
 */
const { isMobileOpen } = useLayoutSidenavContext()

useApexDrawer(isMobileOpen)
</script>

<template>
  <slot />
</template>
