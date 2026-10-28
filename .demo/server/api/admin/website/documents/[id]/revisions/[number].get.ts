import { createError, getRouterParam } from 'h3'
import { requireStaffPermission } from '../../../../../../utils/permissions'
import prisma from '../../../../../../utils/prisma'
import { parseJson } from '../../../../../../utils/website/documents'

/** One revision's content, for the diff view and the restore confirmation. */
export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const documentId = getRouterParam(event, 'id')!
  const number = Number(getRouterParam(event, 'number'))
  if (!Number.isInteger(number) || number < 1) {
    throw createError({ statusCode: 400, message: 'Revision numbers start at 1' })
  }
  const revision = await prisma.siteRevision.findUnique({ where: { documentId_number: { documentId, number } } })
  if (!revision) {
    throw createError({ statusCode: 404, message: 'Revision not found' })
  }
  return { ...revision, content: parseJson(revision.content) }
})
