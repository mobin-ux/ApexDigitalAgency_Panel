import type { AdminCountKey } from '~/utils/adminNav'

/**
 * Shared state for the admin console shell (`Admin Console.dc.html`).
 *
 * The shell renders before the page, on the server as well as the client,
 * so anything a page tells it has to arrive after hydration or the two
 * renders disagree (the Phase 7 Mobile gotcha). Pages therefore set their
 * record's breadcrumb in `onMounted` through `useAdminCrumb()`; the route
 * alone decides everything the first render shows.
 */

export interface AdminCrumb {
  /** The record's name, e.g. "AP-1058 · Website rebuild". */
  title: string | null
  /** Where the back arrow goes; defaults to the nav row's list. */
  back: string | null
}

export function useAdminCrumb(title?: MaybeRefOrGetter<string | null | undefined>, back?: string) {
  const crumb = useState<AdminCrumb>('admin-crumb', () => ({ title: null, back: null }))
  if (title !== undefined && import.meta.client) {
    onMounted(() => {
      watch(() => toValue(title), (value) => {
        crumb.value = { title: value || null, back: back ?? null }
      }, { immediate: true })
    })
    onBeforeUnmount(() => {
      crumb.value = { title: null, back: null }
    })
  }
  return crumb
}

/* ------------------------------------------------------------ confirm --- */

export interface AdminConfirmPoint {
  tone: 'success' | 'danger' | 'warning' | 'info' | 'accent'
  text: string
}

export interface AdminConfirmOptions {
  title: string
  body: string
  points?: AdminConfirmPoint[]
  /** Ask for a typed reason; `required` blocks confirm until 3+ characters. */
  reason?: { required: boolean, label: string, placeholder?: string, hint?: string }
  confirmLabel: string
  danger?: boolean
}

interface ConfirmState extends AdminConfirmOptions {
  resolve: (reason: string | null) => void
}

/**
 * The design's one confirmation: a title, what happens, the consequences as
 * ticked/crossed points and, where the action is recorded, a reason. It
 * resolves with the reason ('' when none was asked for) or null on cancel,
 * so a caller reads `const reason = await ask(...); if (reason === null) return`.
 */
export function useAdminConfirm() {
  const state = useState<ConfirmState | null>('admin-confirm', () => null)

  function ask(options: AdminConfirmOptions): Promise<string | null> {
    return new Promise((resolve) => {
      state.value?.resolve(null)
      state.value = { ...options, resolve }
    })
  }

  function settle(reason: string | null) {
    const current = state.value
    state.value = null
    current?.resolve(reason)
  }

  return { state, ask, settle }
}

/* ------------------------------------------------------------ palette --- */

export function useAdminPalette() {
  const open = useState('admin-palette', () => false)
  return { open, show: () => (open.value = true), hide: () => (open.value = false) }
}

/* ------------------------------------------------------------- counts --- */

/**
 * The live counts on sidebar rows (open support requests, credit
 * applications to decide, website documents in review, enquiries not yet
 * contacted), in one call to `/api/admin/nav-counts`, which leaves out any
 * count the role could not open. Client-only, so the first render is the
 * same on both sides.
 */
export function useAdminNavCounts() {
  const counts = useState<Partial<Record<AdminCountKey, number>>>('admin-nav-counts', () => ({}))
  const route = useRoute()

  async function refresh() {
    try {
      counts.value = await $fetch<Partial<Record<AdminCountKey, number>>>('/api/admin/nav-counts')
    }
    catch {
      // A count is a hint; the screen it points at says the same thing.
    }
  }

  if (import.meta.client) {
    onMounted(refresh)
    // Counts move when someone acts, and acting means navigating or saving;
    // a route change is a cheap, honest moment to re-read them.
    watch(() => route.path, refresh)
    // And clients act while staff sit on one screen: re-read on return to
    // the tab and every two minutes while it is in view.
    useLiveRefresh(refresh, 120_000)
  }

  return { counts, refresh }
}
