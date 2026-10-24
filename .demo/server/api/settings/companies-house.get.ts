import { Buffer } from 'node:buffer'
import { createError, defineEventHandler, getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { createLogger } from '../../utils/logger'
import { rateLimit, RateLimits } from '../../utils/ratelimit'

/**
 * GET /api/settings/companies-house?number=12345678 — look a company up on
 * the Companies House public data API, so Settings › Business can fill in the
 * registered name and office address from the number (Panel v2).
 *
 * Read-only and advisory: nothing is saved here; the customer sees what the
 * register says and saves it themselves. Without `NUXT_COMPANIES_HOUSE_KEY`
 * this answers 503 and `/api/config` reports the lookup as unavailable, so the
 * page does not offer a button that cannot work.
 */
const log = createLogger('settings:companies-house')

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.mutation, bucket: 'companies-house', identity: session.id })

  const number = String(getQuery(event).number ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9]{8}$/.test(number)) {
    throw createError({ statusCode: 400, message: 'Companies House numbers are eight characters.' })
  }

  const key = (useRuntimeConfig(event).companiesHouseKey as string | undefined) || ''
  if (!key) {
    throw createError({ statusCode: 503, message: 'Company lookup is not available right now. Enter the details by hand.' })
  }

  let profile: any
  try {
    profile = await $fetch(`https://api.company-information.service.gov.uk/company/${encodeURIComponent(number)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` },
      timeout: 8000,
    })
  }
  catch (error: any) {
    if (error?.response?.status === 404) {
      throw createError({ statusCode: 404, message: `No company found with number ${number}.` })
    }
    log.warn('lookup failed', { status: error?.response?.status })
    throw createError({ statusCode: 502, message: 'Companies House did not answer. Try again in a minute.' })
  }

  const a = profile?.registered_office_address ?? {}
  const address = [a.premises, a.address_line_1, a.address_line_2, a.locality, a.region, a.postal_code]
    .filter((part: unknown) => typeof part === 'string' && part.trim())
    .join(', ')

  return {
    number,
    name: String(profile?.company_name ?? ''),
    status: String(profile?.company_status ?? ''),
    type: String(profile?.type ?? ''),
    address,
  }
})
