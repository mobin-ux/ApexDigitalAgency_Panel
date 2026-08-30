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
}

const SUB_VIEWS: SubView[] = [
  { path: '/dashboards/orders', key: 'project', back: 'All projects' },
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

  return { isSubView, backLabel: computed(() => current.value?.back ?? 'Back'), title, leave }
}
