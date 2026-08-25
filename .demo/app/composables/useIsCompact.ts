/**
 * "Is the shell in its compact (below-`lg`) form?" — resolved on the client only.
 *
 * Phase 1 mobile turns three desktop dropdowns into bottom sheets and the search
 * dialog into a full-screen view. Which one opens is a property of the viewport,
 * which the server cannot know, so this is deliberately `false` during SSR and
 * during the hydration render — the same rule the toolbar's `⌘`/`Ctrl` hint
 * follows, and for the same reason (see `DemoToolbar`).
 *
 * That costs nothing here because every consumer gates an **overlay**, and every
 * overlay is closed at first paint: the server renders neither variant, so there
 * is no markup to disagree about. By the time a customer can tap the bell, the
 * listener below has long since reported the truth.
 *
 * Do NOT use this to pick between two things that are both visible on load —
 * that is a mismatch. Use a `lg:` utility for those; CSS resolves before paint.
 */
export function useIsCompact() {
  // Shared state, so N consumers still answer with one value.
  const isCompact = useState('apex-is-compact', () => false)

  if (import.meta.client) {
    let media: MediaQueryList | undefined
    const sync = () => {
      isCompact.value = media?.matches ?? false
    }

    onMounted(() => {
      // 1023.98px rather than 1023px: viewport widths are fractional on
      // zoomed/HiDPI displays, and an integer bound leaves a dead band where
      // neither this nor the `lg:` utilities apply.
      media = window.matchMedia('(max-width: 1023.98px)')
      sync()
      media.addEventListener('change', sync)
    })

    onBeforeUnmount(() => {
      media?.removeEventListener('change', sync)
    })
  }

  return isCompact
}
