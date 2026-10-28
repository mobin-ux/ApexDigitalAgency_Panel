import { fetchSettings } from '../utils/cms'

/**
 * nuxt-site-config resolves the site's name and URL per request; this
 * pushes the panel's values on top of the build-time ones when they are
 * set (ADR-021), so canonical links, the sitemap and the title template
 * follow the settings.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('site-config:init', async ({ siteConfig }: { siteConfig: { push: (input: Record<string, unknown>) => void } }) => {
    const s = await fetchSettings()
    if (!s) {
      return
    }
    const input: Record<string, unknown> = { _context: 'cms' }
    if (s.name) {
      input.name = s.name
    }
    if (s.url) {
      input.url = s.url
    }
    if (s.seo?.defaultDescription) {
      input.description = s.seo.defaultDescription
    }
    if (Object.keys(input).length > 1) {
      siteConfig.push(input)
    }
  })
})
