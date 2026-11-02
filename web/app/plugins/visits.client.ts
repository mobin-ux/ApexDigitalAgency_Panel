/**
 * Each page shown tells this site's own server (ADR-026, phase F): one
 * same-origin beacon with the path; the first page of a load adds the
 * referring host name (never the full address) and any `utm_source`. No
 * cookie, no browser storage, no third party. Not sent from an error page,
 * a staff preview, inside a frame or by a browser under automation.
 */
export default defineNuxtPlugin((nuxtApp) => {
  if (navigator.webdriver || window.top !== window.self || typeof navigator.sendBeacon !== 'function') {
    return
  }
  let first = true
  nuxtApp.hook('page:finish', () => {
    const path = nuxtApp.$router.currentRoute.value.path
    if (nuxtApp.payload.error || path.startsWith('/preview/')) {
      first = false
      return
    }
    const hit: Record<string, unknown> = { p: path }
    if (first) {
      first = false
      hit.e = 1
      try {
        hit.r = document.referrer ? new URL(document.referrer).hostname : ''
      }
      catch {
        hit.r = ''
      }
      hit.u = new URLSearchParams(location.search).get('utm_source') ?? ''
    }
    navigator.sendBeacon('/api/hit', new Blob([JSON.stringify(hit)], { type: 'application/json' }))
  })
})
