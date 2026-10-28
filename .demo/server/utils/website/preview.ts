import type { H3Event } from 'h3'
import { readPurposeToken, signPurposeToken } from '../auth'

/**
 * Preview links (ADR-021 §2): a short-lived purpose token that lets the site
 * fetch one document's *draft* and render it with a preview banner. Thirty
 * minutes, read-only, names the document and who asked; `readAuthToken`
 * refuses it as a session. It travels in the URL, which is why it is short
 * and grants nothing but one read.
 */

export const PREVIEW_PURPOSE = 'site-preview'
export const PREVIEW_TTL_SECONDS = 30 * 60

export type PreviewClaims = Record<'doc' | 'uid', string>

export function signPreviewToken(event: H3Event, claims: PreviewClaims): string {
  return signPurposeToken(event, PREVIEW_PURPOSE, claims, PREVIEW_TTL_SECONDS)
}

export function readPreviewToken(event: H3Event, token: string): PreviewClaims | null {
  const claims = readPurposeToken(event, token, PREVIEW_PURPOSE)
  return claims && typeof claims.doc === 'string' && typeof claims.uid === 'string' ? { doc: claims.doc, uid: claims.uid } : null
}
