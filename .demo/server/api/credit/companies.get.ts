import { Buffer } from 'node:buffer'
import { createError, defineEventHandler, getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { createLogger } from '../../utils/logger'
import { rateLimit, RateLimits } from '../../utils/ratelimit'

/**
 * GET /api/credit/companies?q=northgate — search the Companies House register
 * by name or number for the credit application's "Find your company" step.
 * Read-only; the customer picks a result and the application stores its name
 * and number. Without `NUXT_COMPANIES_HOUSE_KEY` this answers 503 and the page
 * asks for the name and number by hand instead (`/api/config` says which).
 */
const log = createLogger('credit:companies')

function ukDate(iso: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.mutation, bucket: 'companies-house', identity: session.id })

  const q = String(getQuery(event).q ?? '').trim().slice(0, 100)
  if (q.length < 2) {
    throw createError({ statusCode: 400, message: 'Type at least two characters of the name or number.' })
  }
  const key = (useRuntimeConfig(event).companiesHouseKey as string | undefined) || ''
  if (!key) {
    throw createError({ statusCode: 503, message: 'Company search is not available right now. Enter the name and number by hand.' })
  }

  let res: any
  try {
    res = await $fetch('https://api.company-information.service.gov.uk/search/companies', {
      query: { q, items_per_page: 6 },
      headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` },
      timeout: 8000,
    })
  }
  catch (error: any) {
    log.warn('search failed', { status: error?.response?.status })
    throw createError({ statusCode: 502, message: 'Companies House did not answer. Try again in a minute.' })
  }

  return {
    items: (res?.items ?? []).map((c: any) => {
      const status = String(c.company_status ?? '')
      const closed = ['dissolved', 'liquidation', 'converted-closed', 'closed'].includes(status)
      return {
        number: String(c.company_number ?? ''),
        name: String(c.title ?? ''),
        status: status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ') : 'Unknown',
        closed,
        incorporated: ukDate(c.date_of_creation),
        ceased: ukDate(c.date_of_cessation),
        address: String(c.address_snippet ?? ''),
      }
    }),
  }
})
