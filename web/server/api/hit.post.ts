import { AUTOMATED_AGENT, visitPath, visitSource } from '#shared/visits'
import { defineEventHandler, getRequestHeader, getRequestHost, readBody, setResponseStatus } from 'h3'
import { recordVisit } from '../utils/visits'

/**
 * POST /api/hit — a page of this site counting itself (ADR-026, phase F).
 * Sent by `plugins/visits.client.ts` with the path, and for the first page
 * of a load the referring host and `utm_source`. Always answers 204 and
 * never says whether it counted, so it is no use for probing. Nothing about
 * the request is kept: not the IP address, not the user agent (read once,
 * here, to leave out self-declared bots), not the referring address.
 */
export default defineEventHandler(async (event) => {
  setResponseStatus(event, 204)
  // Only this site's own pages: a beacon from elsewhere is cross-site.
  if (getRequestHeader(event, 'sec-fetch-site') !== 'same-origin') {
    return null
  }
  const agent = getRequestHeader(event, 'user-agent') ?? ''
  if (!agent || AUTOMATED_AGENT.test(agent)) {
    return null
  }
  const body = await readBody<{ p?: unknown, e?: unknown, r?: unknown, u?: unknown } | null>(event).catch(() => null)
  const path = visitPath(body?.p)
  if (!path) {
    return null
  }
  const source = body?.e === 1 ? visitSource(body.r, body.u, getRequestHost(event, { xForwardedHost: true })) : null
  recordVisit(path, source)
  return null
})
