/**
 * Off-canvas drawer behaviour for the compact shell (V2 Phase 1 mobile, §3).
 *
 * The Tairo layer gives the sidebar its slide transition and locks body scroll;
 * everything a drawer additionally owes a keyboard or screen-reader user is
 * here, because the layer has no notion of one. Shared by the customer and
 * admin shells so the two cannot drift.
 *
 * All of it is gated on the compact breakpoint: from `lg` up the sidebar is a
 * permanently visible rail, and trapping focus inside a rail would make the
 * rest of the page unreachable. That state is real — open the drawer at 900px
 * and rotate to 1100px and `isMobileOpen` is still true.
 */
export function useApexDrawer(isMobileOpen: Ref<boolean>, panelId = 'apex-drawer') {
  const route = useRoute()
  const isCompact = useIsCompact()

  /** Focus is returned here on close, per WCAG 2.4.3 — usually the hamburger. */
  let restoreTo: HTMLElement | null = null

  function panel() {
    return import.meta.client ? document.getElementById(panelId) : null
  }

  function focusables() {
    const root = panel()
    if (!root) {
      return [] as HTMLElement[]
    }
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(element => element.offsetParent !== null)
  }

  function close() {
    isMobileOpen.value = false
  }

  /**
   * A drawer that survives the navigation it just triggered covers the page the
   * customer asked for. Watching `fullPath` rather than `path` also closes it
   * when only the query changes — the Orders and Support deep links do that.
   */
  watch(() => route.fullPath, () => {
    if (isMobileOpen.value) {
      close()
    }
  })

  function onKeydown(event: KeyboardEvent) {
    if (!isMobileOpen.value || !isCompact.value) {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const items = focusables()
    if (items.length === 0) {
      return
    }

    const first = items[0]!
    const last = items[items.length - 1]!
    const active = document.activeElement

    // Tabbing out of either end wraps to the other, and focus that has escaped
    // the drawer entirely (a click on the scrim, say) is pulled back in.
    if (event.shiftKey && (active === first || !panel()?.contains(active))) {
      event.preventDefault()
      last.focus()
    }
    else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  watch(isMobileOpen, async (open) => {
    if (!isCompact.value) {
      return
    }

    if (open) {
      restoreTo = document.activeElement as HTMLElement | null
      await nextTick()
      focusables()[0]?.focus()
    }
    else {
      restoreTo?.focus()
      restoreTo = null
    }
  })

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

  return { close }
}
