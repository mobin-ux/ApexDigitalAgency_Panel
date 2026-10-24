import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import { requireAuth } from '../../utils/auth'
import { rateLimit, RateLimits } from '../../utils/ratelimit'
import { MAX_FILES_PER_REQUEST, storeUpload } from '../../utils/uploads'

/**
 * POST /api/uploads — store up to five files (multipart, field `files`) and
 * return their ids. The files are attached to nothing yet: the order, the
 * project's Files tab or the support message that sends the ids claims them,
 * and only for the same uploader.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.support, bucket: 'uploads', identity: session.id })

  const parts = (await readMultipartFormData(event)) ?? []
  const files = parts.filter(p => p.name === 'files' && p.filename)
  if (files.length === 0) {
    throw createError({ statusCode: 400, message: 'Choose a file to upload.' })
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    throw createError({ statusCode: 400, message: `Upload up to ${MAX_FILES_PER_REQUEST} files at a time.` })
  }

  const stored = []
  for (const file of files) {
    stored.push(await storeUpload(session.id, file))
  }
  return { files: stored }
})
