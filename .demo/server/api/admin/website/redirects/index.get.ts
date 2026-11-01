import { defineEventHandler } from 'h3'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { namesOf } from '../../../../utils/website/content'
import { REDIRECT_SELECT } from '../../../../utils/website/redirects'

/**
 * GET /api/admin/website/redirects — SEO & redirects › Redirects: every
 * redirect, newest first, with who added it.
 */
export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const rows = await prisma.siteRedirect.findMany({ select: REDIRECT_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
  const names = await namesOf(rows.map(r => r.createdById))
  return { items: rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), createdBy: names.get(r.createdById) ?? 'Staff' })) }
})
