import prisma from '../../utils/prisma'
import { publicCacheHeaders } from '../../utils/website/content-api'
import { MEDIA_SELECT, mediaPath } from '../../utils/website/media'
import { getWebsiteSettings } from '../../utils/website/settings'

/**
 * The site's settings as the site reads them (public, cacheable): company
 * facts, social profiles, SEO defaults, robots disallows. Every value is
 * one the panel validated; an empty string means "not set", and the site
 * keeps its code baseline for that field.
 */
export default defineEventHandler(async (event) => {
  publicCacheHeaders(event)
  const s = await getWebsiteSettings()
  const og = s['site.seo.ogImage']
  const ogRow = og ? await prisma.siteMedia.findFirst({ where: { id: og.mediaId, deletedAt: null }, select: MEDIA_SELECT }) : null
  return {
    name: s['site.name'],
    url: s['site.url'],
    tagline: s['site.tagline'],
    email: s['site.email'],
    phone: s['site.phone'],
    openingHours: s['site.openingHours'],
    companyNumber: s['site.companyNumber'],
    vatNumber: s['site.vatNumber'],
    icoNumber: s['site.icoNumber'],
    address: { street: s['site.address.street'], locality: s['site.address.locality'], region: s['site.address.region'], postcode: s['site.address.postcode'] },
    social: { linkedin: s['site.social.linkedin'], instagram: s['site.social.instagram'], x: s['site.social.x'], youtube: s['site.social.youtube'] },
    seo: {
      defaultTitle: s['site.seo.defaultTitle'],
      defaultDescription: s['site.seo.defaultDescription'],
      ogImage: ogRow ? { src: mediaPath(ogRow), width: ogRow.width, height: ogRow.height, alt: og?.alt ?? ogRow.alt } : null,
    },
    robotsDisallow: s['site.robots.disallow'],
    timezone: s['site.timezone'],
  }
})
