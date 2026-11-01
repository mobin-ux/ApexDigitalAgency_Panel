/**
 * Keep a screen in step with what the other panel does (ADR-025, phase 4):
 * run `tick` when the tab comes back into view and then every `everyMs`
 * while it stays visible. A hidden tab makes no requests, and nothing runs
 * on the server render.
 */
export function useLiveRefresh(tick: () => unknown, everyMs = 60_000) {
  if (!import.meta.client) {
    return
  }
  const visibility = useDocumentVisibility()
  const { pause, resume } = useIntervalFn(() => tick(), everyMs, { immediate: false })
  watch(visibility, (state, before) => {
    if (state === 'visible') {
      if (before === 'hidden') {
        tick()
      }
      resume()
    }
    else {
      pause()
    }
  }, { immediate: true })
}

/** The customer pages' data, by `useFetch` key, that staff actions can change. */
const CLIENT_DATA_KEYS = ['orders', 'support-tickets', 'dashboard-overview', 'finance-dashboard', 'wallet-tx', 'credit-application']

/**
 * The customer panel's half: re-read the notifications, and when a new one
 * has arrived — staff moved an order, answered a request, decided credit —
 * reload the order, support and wallet data on screen, so the page shows the
 * change the notification describes without a reload.
 */
export function useClientLiveRefresh() {
  const { unreadCount, fetchNotifications } = useNotifications()
  useLiveRefresh(async () => {
    const before = unreadCount.value
    await fetchNotifications()
    if (unreadCount.value > before) {
      await refreshNuxtData(CLIENT_DATA_KEYS)
    }
  })
}
