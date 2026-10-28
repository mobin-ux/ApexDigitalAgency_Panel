import { createError, getRequestHeader, getRouterParam, readMultipartFormData } from 'h3'
import { requireStaffPermission } from '../../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../../utils/ratelimit'
import { MAX_MEDIA_BYTES, publicMedia, replaceMedia } from '../../../../../utils/website/media'

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.media')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  if (Number(getRequestHeader(event, 'content-length') ?? 0) > MAX_MEDIA_BYTES + 64 * 1024) {
    throw createError({ statusCode: 413, message: 'That file is over 10 MB.' })
  }
  const parts = (await readMultipartFormData(event)) ?? []
  const file = parts.find(p => p.name === 'file' && p.filename)
  if (!file) {
    throw createError({ statusCode: 400, message: 'Choose the replacement file.' })
  }
  return publicMedia(await replaceMedia(event, actor, getRouterParam(event, 'id')!, file))
})
