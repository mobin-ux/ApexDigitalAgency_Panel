import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../utils/audit'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../../utils/ratelimit'
import { validateBody } from '../../../../utils/validate'
import { loadMedia, revalidateIfUsed } from '../../../../utils/website/media'

/**
 * PATCH /api/admin/website/media/:id — the alt text: what screen readers
 * say wherever the image appears. Pages that use the image show the new
 * words once the site's cache is purged, which happens here.
 */
const bodySchema = z.object({ alt: z.string().trim().max(300) }).strict()

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.media')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Media id is required' })
  }
  const { alt } = await validateBody(event, bodySchema)
  const before = await loadMedia(id)
  if (before.alt === alt) {
    return { id, alt }
  }
  await prisma.siteMedia.update({ where: { id }, data: { alt } })
  await recordAudit(event, actor, { action: 'admin.website.media.update', targetType: 'SiteMedia', targetId: id, subject: before.filename, metadata: { before: { alt: before.alt }, after: { alt } } })
  await revalidateIfUsed(event, id)
  return { id, alt }
})
