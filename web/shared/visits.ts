import { createHmac } from 'node:crypto'
import { signEnquiry, verifyEnquirySignature } from './enquiry.ts'

/**
 * The site's own visit counts (ADR-026, phase F). The site's pages send a
 * beacon to their own server (`/api/hit`) with the page's path and, for the
 * first page of a load, the referring host and any `utm_source`. The server
 * adds it to a total for (London day, path, source) in memory and hands the
 * totals to the console once a minute over a signed call. No cookie or
 * browser storage is used, and no IP address, user agent or identifier is
 * kept: the totals are all that exists.
 *
 * The rules live here so both apps apply the same ones: the panel imports
 * this file by relative path through `.demo/shared/visits.ts`. Server code
 * only (node:crypto).
 */

/** Totals per call, bounded so a burst of odd paths cannot grow memory. */
export const VISITS_MAX_BUCKETS = 2000
export const VISITS_MAX_BYTES = 512 * 1024
/** Where hits on more distinct pages than that are counted. */
export const VISIT_OTHER_PATH = '(other)'
export const VISIT_TIME_ZONE = 'Europe/London'

export interface VisitBucket {
  /** YYYY-MM-DD in Europe/London. */
  day: string
  path: string
  /** Empty for a page reached from another page of the site. */
  source: string
  views: number
  visits: number
}

export interface VisitBatch {
  /** Unique per call, so a retried call is counted once. */
  id: string
  buckets: VisitBucket[]
}

/*
 * The batch is signed with a key derived from the enquiry secret, so the
 * one secret pair serves both calls and a signature made for one cannot be
 * replayed as the other.
 */
function visitsKey(secret: string): string {
  return secret ? createHmac('sha256', secret).update('apex-visits-v1').digest('hex') : ''
}

export function signVisits(secret: string, timestamp: string, body: string): string {
  return signEnquiry(visitsKey(secret), timestamp, body)
}

export function verifyVisitsSignature(secret: string, timestamp: string | undefined, signature: string | undefined, body: string, now = Date.now()): boolean {
  return Boolean(secret) && verifyEnquirySignature(visitsKey(secret), timestamp, signature, body, now)
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: VISIT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

/** The London calendar day of an instant, as YYYY-MM-DD. */
export function visitDay(at: Date = new Date()): string {
  return DAY_FORMAT.format(at)
}

/** `day` plus `n` calendar days (negative goes back). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Not pages: the site's APIs, build assets, images, files and staff previews.
const NOT_A_PAGE = /^\/(?:api|_nuxt|_ipx|_nitro|media|preview|fonts|brand|icons|img)(?:\/|$)/

/**
 * A page path worth counting, or null. The query and fragment are dropped
 * (a search box puts what someone typed there), as is a trailing slash.
 */
export function visitPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return null
  }
  let path = value.split(/[?#]/, 1)[0]!
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }
  if (path.length > 200 || !/^\/[\w\-./~%]*$/.test(path) || NOT_A_PAGE.test(path)) {
    return null
  }
  return path
}

const SEARCH_AND_SOCIAL: [RegExp, string][] = [
  [/(?:^|\.)google\./, 'Google search'],
  [/(?:^|\.)bing\.com$/, 'Bing'],
  [/(?:^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(?:^|\.)yahoo\.com$/, 'Yahoo'],
  [/(?:^|\.)ecosia\.org$/, 'Ecosia'],
  [/(?:^|\.)(?:facebook\.com|fb\.com)$/, 'Facebook'],
  [/(?:^|\.)instagram\.com$/, 'Instagram'],
  [/(?:^|\.)(?:linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
  [/^(?:t\.co|(?:.+\.)?twitter\.com|(?:.+\.)?x\.com)$/, 'X'],
  [/^(?:chatgpt\.com|chat\.openai\.com)$/, 'ChatGPT'],
  [/(?:^|\.)perplexity\.ai$/, 'Perplexity'],
  [/^claude\.ai$/, 'Claude'],
]

// What people put in `utm_source` for the places the business links from.
const TAGGED: Record<string, string> = {
  'gbp': 'Google Business Profile',
  'gmb': 'Google Business Profile',
  'google_business': 'Google Business Profile',
  'google-business-profile': 'Google Business Profile',
  'facebook': 'Facebook',
  'fb': 'Facebook',
  'instagram': 'Instagram',
  'ig': 'Instagram',
  'linkedin': 'LinkedIn',
  'email': 'Email',
  'newsletter': 'Email',
}

function lowerHost(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/^www\./, '') : ''
}

function bareHost(value: unknown): string {
  const host = lowerHost(value)
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) && host.length <= 80 ? host : ''
}

/**
 * Where a page load came from, or null when it came from this site itself
 * (then it is a page view but not a visit). A tagged link's `utm_source`
 * wins over the referrer; no referrer is "Direct". Only a host name or a
 * short tag is ever kept, never a full referring address.
 */
export function visitSource(referrerHost: unknown, utmSource: unknown, siteHost: string): string | null {
  const tag = typeof utmSource === 'string' ? utmSource.trim().toLowerCase() : ''
  if (/^[\w.-]{1,40}$/.test(tag)) {
    return TAGGED[tag] ?? tag
  }
  if (lowerHost(referrerHost) && lowerHost(referrerHost) === lowerHost(siteHost.split(':', 1)[0])) {
    return null
  }
  const host = bareHost(referrerHost)
  if (!host) {
    return lowerHost(referrerHost) ? 'Other' : 'Direct'
  }
  return SEARCH_AND_SOCIAL.find(([pattern]) => pattern.test(host))?.[1] ?? host
}

/** User agents that announce themselves as automated; never counted. */
export const AUTOMATED_AGENT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|monitor|uptime|curl|wget|python|httpclient|go-http|java\/|node-fetch|axios/i
