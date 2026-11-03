import type { ServiceSlug } from '~/data/routes'
import { panelOrderPath, panelOrigin, panelPaths } from '~/data/panel'

/**
 * Links into the client panel. `enabled` is false when NUXT_PUBLIC_PANEL_URL
 * is unset, and every link is then '' so its UI can be left out.
 */
export function usePanelLinks() {
  const origin = panelOrigin(useRuntimeConfig().public.panelUrl)
  const at = (path: string) => (origin ? `${origin}${path}` : '')

  return {
    enabled: Boolean(origin),
    logIn: at(panelPaths.logIn),
    signUp: at(panelPaths.signUp),
    newOrder: at(panelPaths.newOrder),
    order: (service: ServiceSlug, plan?: string) => at(panelOrderPath(service, plan)),
  }
}
