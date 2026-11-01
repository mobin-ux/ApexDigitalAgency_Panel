import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireStaffPermission } from '../../../../utils/permissions'
import { validateBody } from '../../../../utils/validate'
import { checkRedirect } from '../../../../utils/website/redirects'

/**
 * POST /api/admin/website/redirects/check — what saving a redirect would do,
 * without saving, so the form can say it as the addresses are typed: the
 * cleaned addresses and any warning, or the reason it would be refused.
 */
const bodySchema = z.object({ fromPath: z.string().trim().min(1).max(512), toPath: z.string().trim().min(1).max(2048) }).strict()

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.seo')
  const body = await validateBody(event, bodySchema)
  try {
    return { ok: true, ...(await checkRedirect(body)) }
  }
  catch (error) {
    return { ok: false, message: (error as { message?: string }).message ?? 'That redirect cannot be saved.' }
  }
})
