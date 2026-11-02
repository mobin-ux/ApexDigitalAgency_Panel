import { createError, defineEventHandler, getRequestHeader, readRawBody } from 'h3'
import { ENQUIRY_MAX_BYTES, ENQUIRY_SIGNATURE_HEADER, ENQUIRY_TIMESTAMP_HEADER, verifyEnquirySignature } from '../../../shared/enquiry'
import prisma from '../../utils/prisma'
import { forwardedEnquirySchema } from '../../utils/website/enquiries'

/**
 * POST /api/site/enquiries — the site hands over a contact message
 * (ADR-026, phase E). No session: the signature is the authentication, an
 * HMAC over the timestamp and the raw body with NUXT_WEBSITE_ENQUIRY_SECRET,
 * checked in constant time, within five minutes. Unset secret: 503, so a
 * misconfigured pair fails loudly rather than storing unsigned text.
 *
 * Idempotent on the site's id: a retried forward answers 200 and stores
 * nothing new. No IP address or other request metadata is kept.
 */
export default defineEventHandler(async (event) => {
  const secret = (useRuntimeConfig(event).website as { enquirySecret?: string } | undefined)?.enquirySecret ?? ''
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: 'Enquiries are not configured' })
  }
  const declared = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (declared > ENQUIRY_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Too large' })
  }
  const raw = (await readRawBody(event, 'utf8')) ?? ''
  if (raw.length > ENQUIRY_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Too large' })
  }
  if (!verifyEnquirySignature(secret, getRequestHeader(event, ENQUIRY_TIMESTAMP_HEADER), getRequestHeader(event, ENQUIRY_SIGNATURE_HEADER), raw)) {
    throw createError({ statusCode: 401, statusMessage: 'Bad signature' })
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Send JSON' })
  }
  const parsed = forwardedEnquirySchema.safeParse(json)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid enquiry', data: { fieldErrors: parsed.error.flatten().fieldErrors } })
  }
  const { id, services, ...fields } = parsed.data

  const existing = await prisma.enquiry.findUnique({ where: { externalId: id }, select: { id: true } })
  if (existing) {
    return { ok: true, id: existing.id, duplicate: true }
  }
  try {
    const row = await prisma.enquiry.create({ data: { ...fields, externalId: id, services: JSON.stringify(services) }, select: { id: true } })
    return { ok: true, id: row.id }
  }
  catch (error) {
    // Two copies of one retry racing: the unique id let one in.
    if ((error as { code?: string }).code === 'P2002') {
      return { ok: true, duplicate: true }
    }
    throw error
  }
})
