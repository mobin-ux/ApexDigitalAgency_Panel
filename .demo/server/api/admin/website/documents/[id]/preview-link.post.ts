import { getRouterParam } from 'h3'
import { requireStaffPermission } from '../../../../../utils/permissions'
import { loadDocument } from '../../../../../utils/website/documents'
import { PREVIEW_TTL_SECONDS, signPreviewToken } from '../../../../../utils/website/preview'
import { websiteRuntime } from '../../../../../utils/website/publish'

/**
 * A preview link for the current draft: the site renders it with the
 * draft's content and a banner. Thirty minutes. Needs a configured site
 * URL; without one the answer says so rather than handing out a link to
 * nowhere.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.view')
  const doc = await loadDocument(getRouterParam(event, 'id')!)
  const { siteUrl } = websiteRuntime()
  const token = signPreviewToken(event, { doc: doc.id, uid: actor.id })
  return {
    url: siteUrl ? `${siteUrl}/preview/${token}` : null,
    token,
    expiresAt: new Date(Date.now() + PREVIEW_TTL_SECONDS * 1000).toISOString(),
    siteConfigured: Boolean(siteUrl),
  }
})
