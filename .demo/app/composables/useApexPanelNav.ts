/**
 * Customer panel navigation (Panel v2), one list for the three shells.
 *
 * The design draws the same destinations three ways — a 260px sidebar with a
 * Services group from 1200px, an 88px labelled rail from 768px, and a five-tab
 * bar below that — and each drops or renames something. They are all derived
 * here so a renamed route cannot be renamed in one shell and not the others.
 */
export interface PanelDestination {
  id: 'dashboard' | 'new' | 'orders' | 'wallet' | 'support' | 'settings'
  to: string
  label: string
  short: string
  icon: string
  crumb: 'Account' | 'Services'
}

export const PANEL_DESTINATIONS: PanelDestination[] = [
  { id: 'dashboard', to: '/dashboards/balance', label: 'Dashboard', short: 'Home', icon: 'solar:widget-2-linear', crumb: 'Account' },
  { id: 'new', to: '/dashboards/services', label: 'New order', short: 'New order', icon: 'solar:add-square-linear', crumb: 'Services' },
  { id: 'orders', to: '/dashboards/orders', label: 'My orders', short: 'Orders', icon: 'solar:suitcase-linear', crumb: 'Services' },
  { id: 'wallet', to: '/dashboards/wallet', label: 'Wallet & credit', short: 'Wallet', icon: 'solar:wallet-2-linear', crumb: 'Account' },
  { id: 'support', to: '/dashboards/support', label: 'Support', short: 'Support', icon: 'solar:headphones-round-linear', crumb: 'Account' },
  { id: 'settings', to: '/dashboards/settings', label: 'Settings', short: 'Settings', icon: 'solar:settings-linear', crumb: 'Account' },
]

export function useApexPanelNav() {
  const route = useRoute()

  const current = computed<PanelDestination | undefined>(() => {
    const path = route.path.replace(/\/$/, '')
    if (path === '/dashboards') {
      return PANEL_DESTINATIONS[0]
    }
    return PANEL_DESTINATIONS.find(d => path === d.to || path.startsWith(`${d.to}/`))
  })

  const isCurrent = (id: PanelDestination['id']) => current.value?.id === id

  const byId = (id: PanelDestination['id']) => PANEL_DESTINATIONS.find(d => d.id === id)!

  /** Sidebar order, with the design's Services group around New order + My orders. */
  const sidebar = computed(() => ({
    before: [byId('dashboard')],
    group: [byId('new'), byId('orders')],
    after: [byId('wallet'), byId('support'), byId('settings')],
  }))

  /** Rail: all six, short labels. */
  const rail = computed(() => (['dashboard', 'new', 'orders', 'wallet', 'support', 'settings'] as const).map(byId))

  /** Bottom tabs: Settings moves to the account sheet on a phone. */
  const tabs = computed(() => (['dashboard', 'orders', 'new', 'wallet', 'support'] as const).map(byId))

  return { current, isCurrent, sidebar, rail, tabs }
}
