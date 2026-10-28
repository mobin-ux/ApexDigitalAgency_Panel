import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { REDIRECT_SELECT } from '../../../../utils/website/redirects'

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const items = await prisma.siteRedirect.findMany({ select: REDIRECT_SELECT, orderBy: { fromPath: 'asc' } })
  return { items }
})
