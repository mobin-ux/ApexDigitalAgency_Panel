/**
 * Task routes — the screens that are a job in progress rather than a place in
 * the app (V2 Phase 3 mobile, §1).
 *
 * A wizard is a task, so below `lg` the shell stops offering ways to wander
 * off it: the hamburger becomes a close button, search and notifications leave
 * the bar, and the bottom tab bar is suppressed for the duration. Half a signed
 * contract is not somewhere to navigate away from by accident — exiting is a
 * deliberate action, and the page answers for it with a confirmation.
 *
 * The route list lives here rather than in each consumer because
 * `ApexBottomNav` and `DemoToolbar` were about to hold two copies of the same
 * literal, which is how one of them ends up stale.
 */
const TASK_ROUTES = ['/dashboards/services']

/**
 * Screens that pin a control of their own to the bottom edge — a reply
 * composer, a submit footer (V2 Phase 6 mobile, §4 and §8).
 *
 * Two bars stacked there is ~110px of chrome under the thumb, and the one the
 * customer needs is always the lower of the two: a reply field the tab bar is
 * sitting on top of is a reply field they cannot use. Unlike a task route this
 * says nothing about the *top* bar — the Support thread still wants the
 * sub-view back arrow and the search button, not a close button.
 *
 * Derived from the route, like the list above and for the same reason: the
 * shell renders before the page's `setup()` runs, so a page-pushed flag would
 * show the tab bar for a frame and then pull it out from under the composer.
 * That is what puts the open request in `?ticket=` and the open tab in `?tab=`.
 */
const BOTTOM_EDGE_ROUTES: { path: string, when: (query: Record<string, unknown>) => boolean }[] = [
  { path: '/dashboards/support', when: q => !!q.ticket || q.tab === 'new' },
]

/**
 * Closing is requested by the shell but answered by the page, which is the only
 * thing that knows whether there is anything to lose. A counter rather than a
 * boolean so a second press after "Keep going" still registers, and a counter
 * rather than a callback because `useState` is serialised into the SSR payload
 * and a function is not.
 */
export function useApexTaskBar() {
  const route = useRoute()

  const isTask = computed(() =>
    TASK_ROUTES.some(path => route.path === path || route.path.startsWith(`${path}/`)),
  )

  const ownsBottomEdge = computed(() =>
    BOTTOM_EDGE_ROUTES.some(r => route.path === r.path && r.when(route.query)),
  )

  const closeRequests = useState('apex-task-close', () => 0)

  return { isTask, ownsBottomEdge, closeRequests }
}
