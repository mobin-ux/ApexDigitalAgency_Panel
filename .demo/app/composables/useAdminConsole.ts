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
 * The live counts on sidebar rows, from endpoints the role can already
 * read (no new route): open support requests from the Overview's stats,
 * credit applications waiting from the credit queue, and documents in
 * review from the website list. A count the role could not open is never
 * fetched. Client-only, so the first render is the same on both sides.
 */
export function useAdminNavCounts() {
  const counts = useState<Partial<Record<AdminCountKey, number>>>('admin-nav-counts', () => ({}))
  const { can } = useStaffAccess()
  const route = useRoute()

  async function refresh() {
    const next: Partial<Record<AdminCountKey, number>> = {}
    const jobs: Promise<unknown>[] = []
    if (can('support.answer') && can('work.view')) {
      jobs.push($fetch<{ openTickets: number }>('/api/admin/stats').then((s) => {
        next.support = s.openTickets ?? 0
      }).catch(() => {}))
    }
    if (can('money.view')) {
      jobs.push($fetch<{ waiting: unknown[] }>('/api/admin/credit/applications').then((c) => {
        next.credit = c.waiting?.length ?? 0
      }).catch(() => {}))
    }
    if (can('website.view')) {
      jobs.push($fetch<{ items: { template: string }[] }>('/api/admin/website/documents', { query: { state: 'in_review', pageSize: 100 } }).then((d) => {
        next.pages = d.items.filter(i => i.template !== 'article' && i.template !== 'case-study').length
        next.insights = d.items.filter(i => i.template === 'article').length
        next.work = d.items.filter(i => i.template === 'case-study').length
      }).catch(() => {}))
    }
    await Promise.all(jobs)
    counts.value = next
  }

  if (import.meta.client) {
    onMounted(refresh)
    // Counts move when someone acts, and acting means navigating or saving;
    // a route change is a cheap, honest moment to re-read them.
    watch(() => route.path, refresh)
  }

  return { counts, refresh }
}
