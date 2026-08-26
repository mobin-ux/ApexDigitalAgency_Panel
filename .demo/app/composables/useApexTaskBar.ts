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

  const closeRequests = useState('apex-task-close', () => 0)

  return { isTask, closeRequests }
}
