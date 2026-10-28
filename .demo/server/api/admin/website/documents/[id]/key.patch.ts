import { getRouterParam } from 'h3'
import { z } from 'zod'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../../../utils/ratelimit'
import { validateBody } from '../../../../../utils/validate'
import { changeKey, documentDetail } from '../../../../../utils/website/documents'
import { revalidateSite } from '../../../../../utils/website/publish'

const bodySchema = z.object({ key: z.string().trim().min(1).max(200) })

/** Move a page to a new address; a page that was live gets a 301 from the old one. */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.publish')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const id = getRouterParam(event, 'id')!
  const { key } = await validateBody(event, bodySchema)
  const before = await documentDetail(id)
  const { doc, redirect } = await changeKey(event, actor, id, key)
  if (doc.status === 'PUBLISHED' && await revalidateSite([before.key, doc.key])) {
    await prisma.siteDocument.update({ where: { id }, data: { revalidatePending: false } })
  }
  return { ...(await documentDetail(id)), redirect }
})
