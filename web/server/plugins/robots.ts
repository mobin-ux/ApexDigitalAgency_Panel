import { fetchSettings } from '../utils/cms'

/**
 * robots.txt follows the panel's settings (ADR-021): the paths a publisher
 * hid are added as Disallow, on top of the ones the site never wants
 * crawled (previews, the APIs). Everything else stays as the robots module
 * configures it.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('robots:config', async (ctx: { groups: { userAgent?: string[], disallow?: string[], allow?: string[] }[] }) => {
    const settings = await fetchSettings()
    const extra = ['/preview/', '/api/', ...(settings?.robotsDisallow ?? [])]
    const group = ctx.groups.find(g => !g.userAgent?.length || g.userAgent.includes('*')) ?? ctx.groups[0]
    if (group) {
      group.disallow = [...new Set([...(group.disallow ?? []), ...extra])]
    }
    else {
      ctx.groups.push({ userAgent: ['*'], disallow: extra })
    }
  })
})
