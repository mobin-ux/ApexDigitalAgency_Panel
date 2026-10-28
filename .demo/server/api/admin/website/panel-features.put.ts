import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'
import { getSetting } from '../../../utils/settings'
import { validateBody } from '../../../utils/validate'

const bodySchema = z.object({ creditApplications: z.boolean() })

/**
 * The one customer-facing feature switch the website module owns: whether
 * customers can apply for credit from their wallet. Stored as the Setting
 * `credit.applications-open`, read by POST /api/credit/application (which
 * refuses with 409 while it is off) and by /api/config (which hides the
 * buttons). Audited before/after.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.settings')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const { creditApplications } = await validateBody(event, bodySchema)
  const before = await getSetting('credit.applications-open', true)
  await prisma.setting.upsert({
    where: { key: 'credit.applications-open' },
    create: { key: 'credit.applications-open', value: JSON.stringify(creditApplications), group: 'credit', updatedBy: actor.id },
    update: { value: JSON.stringify(creditApplications), updatedBy: actor.id },
  })
  await recordAudit(event, actor, { action: 'admin.website.settings.update', targetType: 'Setting', targetId: 'credit.applications-open', subject: 'Credit applications', metadata: { changed: ['credit.applications-open'], before, after: creditApplications } })
  return { creditApplications }
})
