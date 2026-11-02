/**
 * Console origins allowed to frame `/preview/**`, added when the server
 * starts (AUD-09). The route rule in nuxt.config.ts holds the hosts known at
 * build time; `NUXT_CMS_PANEL_ORIGINS` (comma separated) adds more without a
 * rebuild, so a new console host or a staging copy needs only a restart.
 *
 * nuxt-security builds its per-route options once, in its own plugin, and
 * hands them to `nuxt-security:routeRules` on `nuxt-security:ready`. Calling
 * `ready` again after registering covers both plugin orders: if this plugin
 * ran first, nuxt-security's own call reaches the hook; if it ran second,
 * this call does.
 */
const PREVIEW = '/preview/**'

export default defineNitroPlugin(async (nitroApp) => {
  const extra = String((useRuntimeConfig().cms as { panelOrigins?: string } | undefined)?.panelOrigins ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => /^https?:\/\/[^/\s'";]+$/.test(origin))
  if (extra.length === 0) {
    return
  }
  nitroApp.hooks.hook('nuxt-security:routeRules', (rules) => {
    const headers = rules[PREVIEW]?.headers
    const csp = headers ? headers.contentSecurityPolicy : undefined
    if (!csp || typeof csp !== 'object') {
      return
    }
    const current = csp['frame-ancestors']
    const list = Array.isArray(current) ? current : []
    csp['frame-ancestors'] = [...new Set([...list.filter(origin => origin !== '\'none\''), ...extra])]
  })
  await nitroApp.hooks.callHook('nuxt-security:ready')
})
