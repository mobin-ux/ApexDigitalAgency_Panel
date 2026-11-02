import { defineEventHandler } from 'h3'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { summariseAll } from '../../../../utils/website/enquiries'

/**
 * GET /api/admin/website/enquiries/summary — for the Overview and the
 * sidebar count: every enquiry nobody has contacted yet (oldest first, the
 * queue's order) and the three newest (the design's "Latest enquiries").
 */
export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'leads.handle')
  const [waiting, latest] = await Promise.all([
    prisma.enquiry.findMany({ where: { status: 'new' }, orderBy: { receivedAt: 'asc' }, take: 50 }),
    prisma.enquiry.findMany({ orderBy: { receivedAt: 'desc' }, take: 3 }),
  ])
  const newCount = waiting.length < 50 ? waiting.length : await prisma.enquiry.count({ where: { status: 'new' } })
  return { newCount, waiting: await summariseAll(waiting), latest: await summariseAll(latest) }
})
