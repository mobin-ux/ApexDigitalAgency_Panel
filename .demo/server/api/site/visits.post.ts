import { createError, defineEventHandler, getRequestHeader, readRawBody } from 'h3'
import { ENQUIRY_SIGNATURE_HEADER, ENQUIRY_TIMESTAMP_HEADER } from '../../../shared/enquiry'
import { verifyVisitsSignature, VISITS_MAX_BYTES } from '../../../shared/visits'
import { recordVisitBatch, visitBatchSchema } from '../../utils/website/analytics'

/**
 * POST /api/site/visits — the site hands over a minute of visit totals
 * (ADR-026, phase F). No session: the signature is the authentication, an
 * HMAC over the timestamp and the raw body with a key derived from
 * NUXT_WEBSITE_ENQUIRY_SECRET, so an enquiry's signature does not pass
 * here. Unset secret: 503. A batch id seen in the last ten minutes is
 * counted once.
 */
export default defineEventHandler(async (event) => {
  const secret = (useRuntimeConfig(event).website as { enquirySecret?: string } | undefined)?.enquirySecret ?? ''
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: 'Visit counts are not configured' })
  }
  const declared = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (declared > VISITS_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Too large' })
  }
  const raw = (await readRawBody(event, 'utf8')) ?? ''
  if (raw.length > VISITS_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Too large' })
  }
  if (!verifyVisitsSignature(secret, getRequestHeader(event, ENQUIRY_TIMESTAMP_HEADER), getRequestHeader(event, ENQUIRY_SIGNATURE_HEADER), raw)) {
    throw createError({ statusCode: 401, statusMessage: 'Bad signature' })
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Send JSON' })
  }
  const parsed = visitBatchSchema.safeParse(json)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid batch', data: { fieldErrors: parsed.error.flatten().fieldErrors } })
  }
  return { ok: true, ...(await recordVisitBatch(parsed.data)) }
})
