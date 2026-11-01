import { createError, defineEventHandler, getRouterParam } from 'h3'
import { signPurposeToken } from '../../../../../utils/auth'
import { requireStaffPermission } from '../../../../../utils/permissions'
import { loadDocument, PREVIEW_PURPOSE } from '../../../../../utils/website/content'

/**
 * POST /api/admin/website/documents/:id/preview — a link to the draft as the
 * site renders it, valid for 30 minutes (ADR-026). The token names the
 * document, not a revision: opening it shows the draft as saved at that
 * moment. The site page it opens is never cached and never indexed.
 */

const PREVIEW_TTL_SECONDS = 30 * 60

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Document id is required' })
  }
  const doc = await loadDocument(id)
  if (doc.kind !== 'page') {
    throw createError({ statusCode: 400, message: 'Menus and the footer show on every page; preview a page instead.' })
  }
  const token = signPurposeToken(event, PREVIEW_PURPOSE, { doc: doc.id }, PREVIEW_TTL_SECONDS)
  const base = ((useRuntimeConfig(event).website as { publicUrl?: string } | undefined)?.publicUrl ?? '').replace(/\/$/, '')
  return {
    token,
    url: base ? `${base}/preview/${token}` : null,
    expiresAt: new Date(Date.now() + PREVIEW_TTL_SECONDS * 1000).toISOString(),
  }
})
