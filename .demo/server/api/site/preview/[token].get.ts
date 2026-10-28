import { createError, getRouterParam, setHeader } from 'h3'
import { loadDocument, parseJson } from '../../../utils/website/documents'
import { readPreviewToken } from '../../../utils/website/preview'

/**
 * A document's current draft, for the site's preview page. The token is a
 * 30-minute purpose token minted by the panel for one document; anything
 * else is a 404 that does not say whether the document exists. Never cached.
 */
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const claims = readPreviewToken(event, getRouterParam(event, 'token') ?? '')
  if (!claims) {
    throw createError({ statusCode: 404, message: 'This preview link is not valid or has expired' })
  }
  const doc = await loadDocument(claims.doc)
  return {
    id: doc.id,
    kind: doc.kind,
    template: doc.template,
    key: doc.key,
    title: doc.title,
    draftVersion: doc.draftVersion,
    draftUpdatedAt: doc.draftUpdatedAt,
    content: parseJson(doc.draft),
  }
})
