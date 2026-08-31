import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'

/**
 * GET /api/admin/projects/:id — full project detail for the admin panel:
 * owner, manager, milestone timeline, files, plus the staff directory
 * (admins/employees) so the manager picker doesn't need a second call.
 */

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'work.view')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Project id is required' })
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true, avatar: true, phone: true, walletBalance: true, company: { select: { name: true } } },
      },
      manager: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
      milestones: { orderBy: { date: 'asc' } },
      files: { orderBy: { createdAt: 'desc' } },
      // The signed financing agreement (legal record + e-signature) so the
      // project detail can surface it and deep-link to the full dossier.
      contract: {
        select: {
          id: true,
          reference: true,
          status: true,
          signature: true,
          signatureType: true,
          signerName: true,
          signedIp: true,
          signedUserAgent: true,
          documentVersion: true,
          documentHash: true,
          signedAt: true,
        },
      },
    },
  })

  if (!project) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  const staff = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'EMPLOYEE'] } },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
    orderBy: { email: 'asc' },
  })

  return { project, staff }
})
