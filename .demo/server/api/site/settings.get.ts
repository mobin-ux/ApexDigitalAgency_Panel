import { defineEventHandler, setResponseHeader } from 'h3'
import prisma from '../../utils/prisma'
import { MEDIA_SELECT, siteMediaPath } from '../../utils/website/media'
import { getWebsiteSettings } from '../../utils/website/settings'

/**
 * GET /api/site/settings — what the public site reads from Site settings
 * (ADR-026): company facts, social profiles, the default social image,
 * maintenance mode and the robots.txt additions. Every value was validated
 * when it was saved; an empty string means "not set", and the site keeps
 * its code baseline for that fact.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'public, max-age=30')
  const s = await getWebsiteSettings()
  const og = s['site.seo.ogImage'] ? await prisma.siteMedia.findFirst({ where: { id: s['site.seo.ogImage'], deletedAt: null }, select: MEDIA_SELECT }) : null
  return {
    name: s['site.name'],
    legalName: s['site.legalName'],
    email: s['site.email'],
    phone: s['site.phone'],
    companyNumber: s['site.companyNumber'],
    vatNumber: s['site.vatNumber'],
    icoNumber: s['site.icoNumber'],
    address: { street: s['site.address.street'], locality: s['site.address.locality'], region: s['site.address.region'], postcode: s['site.address.postcode'] },
    social: { linkedin: s['site.social.linkedin'], instagram: s['site.social.instagram'], x: s['site.social.x'], youtube: s['site.social.youtube'] },
    ogImage: og ? { src: siteMediaPath(og), width: og.width, height: og.height, alt: og.alt } : null,
    maintenance: s['site.maintenance'],
    robotsDisallow: s['site.robots.disallow'],
  }
})
