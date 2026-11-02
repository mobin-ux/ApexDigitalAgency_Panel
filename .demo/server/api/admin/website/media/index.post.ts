import { createError, defineEventHandler, getRequestHeader, readMultipartFormData } from 'h3'
import { requireStaffPermission } from '../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../utils/ratelimit'
import { MAX_MEDIA_BYTES, MAX_MEDIA_FILES, storeMedia } from '../../../../utils/website/media'

/**
 * POST /api/admin/website/media — Upload: up to ten files (JPEG, PNG, GIF,
 * WebP, PDF; 10 MB each) as multipart `files`. The declared Content-Length
 * is checked before the body is read, because the multipart reader buffers
 * the whole request. Every file is checked by its bytes before any is kept.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.media')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const declared = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (declared > MAX_MEDIA_BYTES * MAX_MEDIA_FILES + 64 * 1024) {
    throw createError({ statusCode: 413, message: 'That upload is too large. Ten files of up to 10 MB each at a time.' })
  }
  const parts = (await readMultipartFormData(event)) ?? []
  const files = parts.filter(p => p.name === 'files' && p.filename)
  if (!files.length) {
    throw createError({ statusCode: 400, message: 'Choose a file to upload.' })
  }
  if (files.length > MAX_MEDIA_FILES) {
    throw createError({ statusCode: 400, message: `Upload up to ${MAX_MEDIA_FILES} files at a time.` })
  }
  const stored = []
  for (const file of files) {
    const row = await storeMedia(event, actor, file)
    stored.push({ id: row.id, name: row.filename })
  }
  return { files: stored }
})
