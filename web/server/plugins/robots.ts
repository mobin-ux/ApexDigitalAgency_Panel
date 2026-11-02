import { fetchSettings } from '../utils/cms'

/**
 * robots.txt follows SEO & redirects in the console (ADR-026): the paths
 * hidden there are added as Disallow, beside the ones the site never wants
 * crawled (previews and its APIs, set in nuxt.config).
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('robots:config', async (ctx: { groups: { userAgent?: string[], disallow?: string[] }[] }) => {
    const extra = (await fetchSettings())?.robotsDisallow ?? []
    if (!extra.length) {
      return
    }
    const group = ctx.groups.find(g => !g.userAgent?.length || g.userAgent.includes('*'))
    if (group) {
      group.disallow = [...new Set([...(group.disallow ?? []), ...extra])]
    }
    else {
      ctx.groups.push({ userAgent: ['*'], disallow: extra })
    }
  })
})
