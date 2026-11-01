import { defineEventHandler } from 'h3'
import { can } from '../../../../shared/permissions'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { MEDIA_SELECT, mediaPath } from '../../../utils/website/media'
import { getWebsiteSettings, WEBSITE_SETTING_KEYS, WEBSITE_SETTINGS } from '../../../utils/website/settings'

/**
 * GET /api/admin/website/settings — the website's settings with, for each
 * key, whether the signed-in role may change it (Site settings is Owner
 * only; the robots.txt additions belong to SEO & redirects), and the
 * library's images for the default social image.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.view')
  const values = await getWebsiteSettings()
  const images = await prisma.siteMedia.findMany({ where: { deletedAt: null, mime: { startsWith: 'image/' } }, select: MEDIA_SELECT, orderBy: { createdAt: 'desc' } })
  return {
    values,
    editable: Object.fromEntries(WEBSITE_SETTING_KEYS.map(key => [key, can(actor.staffRole, WEBSITE_SETTINGS[key].permission)])),
    images: images.map(m => ({ id: m.id, name: m.filename, src: mediaPath(m), width: m.width, height: m.height, alt: m.alt })),
  }
})
