import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'
import { createError, getRequestHeader, readBody } from 'h3'
import { cmsConfig, purgeCmsCache } from '../../utils/cms'

/**
 * The panel calls this after a publish so the next request re-reads the
 * content. Server to server: authenticated by a bearer secret compared in
 * constant time, 503 while no secret is configured (mirrors the contact
 * route's unconfigured answer), and the route rule caps the body at 8 KB
 * and exempts it from the per-IP limiter and the GET/HEAD restriction.
 */
class RevalidateRefused extends Error {}

function bearerMatches(header: string | undefined, secret: string): boolean {
  if (!header || !header.startsWith('Bearer ')) {
    return false
  }
  const given = Buffer.from(header.slice(7))
  const expected = Buffer.from(secret)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export default defineEventHandler(async (event) => {
  const { secret } = cmsConfig()
  if (!secret) {
    throw createError({ statusCode: 503, message: 'Revalidation is not configured on this site' })
  }
  if (!bearerMatches(getRequestHeader(event, 'authorization'), secret)) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  let paths: unknown = []
  try {
    const body = await readBody<{ paths?: unknown }>(event)
    paths = body?.paths ?? []
  }
  catch {
    throw new RevalidateRefused('Body must be JSON')
  }
  const purged = await purgeCmsCache()
  return { ok: true, purged, paths: Array.isArray(paths) ? paths.length : 0 }
})
