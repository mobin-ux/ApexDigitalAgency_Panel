/**
 * Sub-views — a second level *inside* a page, where the shell's bar stops
 * naming the section and starts naming the record (V2 Phase 4 mobile, §1).
 *
 * My Orders is one page with two screens: the list, and one project. On
 * desktop the detail carries its own `← All projects` button because there is
 * room for it above the fold. On a phone that control scrolls away exactly
 * when it is wanted, so the back affordance moves to the top-left of the bar —
 * where every platform puts it — and the title becomes the project's own name.
 *
 * Membership is derived from the **route**, not pushed up from the page. A
 * page setting shared state in its own `setup()` runs after this component has
 * already rendered, so the bar would show the hamburger for a frame and then
 * swap. That is also why `orders.vue` keeps its open project in the URL
 * (`?project=<id>`) rather than in a local ref: the address bar is the one
 * place both halves of the shell can read the same answer at the same time,
 * and it makes the browser's own back button return to the list.
 *
 * The record's *name* is data, not route, so it does travel through
 * `useState` — with the section title as its fallback, which is what both the
 * server and the first client render use.
 */
interface SubView {
  /** Page that owns the sub-view. */
  path: string
  /** Query key whose presence means "a record is open". */
  key: string
  /** Accessible name for the bar's back control. */
  back: string
  /**
   * Resolves the bar's title from the query value alone, for sub-views whose
   * name *is* in the route rather than in fetched data.
   *
   * Settings is the one case: a section is called "Company" because the URL
   * says `?section=company`, not because a request came back. Letting the page
   * push that through `title` below produced a real hydration mismatch — the
   * toolbar renders before the page on the server, so the server emitted the
   * section fallback while the SSR payload already carried "Company", and the
   * client's first render disagreed with the HTML it was hydrating. A record
   * whose name needs a fetch (a project, a ticket) has no such shortcut and
   * still uses `title`, which is null on both renders until the data lands.
   */
  label?: (value: string) => string | null
}

/** Settings' four sections, named the same way the page names them. */
const SETTINGS_SECTIONS: Record<string, string> = {
  profile: 'Profile',
  company: 'Company',
  security: 'Security',
  billing: 'Billing',
}

const SUB_VIEWS: SubView[] = [
  { path: '/dashboards/orders', key: 'project', back: 'All projects' },
  { path: '/dashboards/wallet', key: 'plan', back: 'All plans' },
  { path: '/dashboards/support', key: 'ticket', back: 'All requests' },
  { path: '/dashboards/settings', key: 'section', back: 'All settings', label: v => SETTINGS_SECTIONS[v] ?? null },
]

export function useApexSubView() {
  const route = useRoute()
  const router = useRouter()

  const current = computed(() =>
    SUB_VIEWS.find(v => route.path === v.path && !!route.query[v.key]) ?? null,
  )
  const isSubView = computed(() => current.value !== null)

  /** Set by the page once its record has loaded; null until then. */
  const title = useState<string | null>('apex-subview-title', () => null)

  /**
   * What the bar actually prints: the route-derived name when the sub-view has
   * one, otherwise whatever the page has published. Route-derived wins because
   * both renders can compute it before the page has run.
   */
  const barTitle = computed(() => {
    const v = current.value
    if (v?.label) {
      const q = route.query[v.key]
      const derived = typeof q === 'string' ? v.label(q) : null
      if (derived) {
        return derived
      }
    }
    return title.value
  })

  /**
   * `replace`, not `push`: opening a project pushes, so the browser's back
   * button already returns to the list. Pushing here as well would stack a
   * third entry and make that back button go *forward* into the detail again.
   */
  function leave() {
    const v = current.value
    if (!v) {
      return
    }
    const query = { ...route.query }
    delete query[v.key]
    router.replace({ path: route.path, query })
  }

  return { isSubView, backLabel: computed(() => current.value?.back ?? 'Back'), title, barTitle, leave }
}
