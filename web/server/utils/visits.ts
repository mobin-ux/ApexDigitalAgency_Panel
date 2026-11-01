import type { VisitBucket } from '#shared/visits'
import { randomUUID } from 'node:crypto'
import { ENQUIRY_SIGNATURE_HEADER, ENQUIRY_TIMESTAMP_HEADER } from '#shared/enquiry'
import { signVisits, VISIT_OTHER_PATH, visitDay, VISITS_MAX_BUCKETS } from '#shared/visits'
import { cmsConfig } from './cms'

/**
 * The site's running visit totals (ADR-026, phase F): `/api/hit` adds to
 * them, `flushVisits()` hands them to the console once a minute (the
 * `visits:flush` task, and once more when the server stops). Totals only:
 * no request detail is held. A restart loses at most a minute of counts,
 * which is the price of not writing anything to disk here.
 */

const totals = new Map<string, VisitBucket>()

function add(bucket: VisitBucket): void {
  let key = `${bucket.day}\n${bucket.path}\n${bucket.source}`
  let row = totals.get(key)
  if (!row && totals.size >= VISITS_MAX_BUCKETS - 1) {
    // More distinct pages than a call carries: count them together.
    key = `${bucket.day}\n${VISIT_OTHER_PATH}\n`
    row = totals.get(key)
    bucket = { ...bucket, path: VISIT_OTHER_PATH, source: '' }
  }
  if (row) {
    row.views += bucket.views
    row.visits += bucket.visits
  }
  else {
    totals.set(key, { ...bucket })
  }
}

/** One page shown; `source` set when it is the first page of a load from outside the site. */
export function recordVisit(path: string, source: string | null, at = new Date()): void {
  add({ day: visitDay(at), path, source: source ?? '', views: 1, visits: source === null ? 0 : 1 })
}

function visitsSecret(): string {
  return (useRuntimeConfig().cms as { enquirySecret?: string } | undefined)?.enquirySecret ?? ''
}

/** Sends the totals so far. Unsent totals are put back, so a console outage loses nothing until the cap. */
export async function flushVisits(): Promise<{ sent: number, kept: number, skipped?: string }> {
  if (!totals.size) {
    return { sent: 0, kept: 0 }
  }
  const secret = visitsSecret()
  if (!cmsConfig().url || !secret) {
    // Nowhere to send them: drop rather than grow.
    totals.clear()
    return { sent: 0, kept: 0, skipped: 'not configured' }
  }
  const buckets = [...totals.values()]
  totals.clear()
  const body = JSON.stringify({ id: randomUUID(), buckets })
  const timestamp = String(Math.floor(Date.now() / 1000))
  try {
    const res = await fetch(`${cmsConfig().url}/api/site/visits`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [ENQUIRY_TIMESTAMP_HEADER]: timestamp,
        [ENQUIRY_SIGNATURE_HEADER]: signVisits(secret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(8_000),
    })
    if (res.ok) {
      return { sent: buckets.length, kept: 0 }
    }
    // A refusal (bad signature, invalid body) will not change on a retry.
    if (res.status < 500) {
      return { sent: 0, kept: 0, skipped: `refused (${res.status})` }
    }
  }
  catch {}
  buckets.forEach(add)
  return { sent: 0, kept: totals.size }
}
