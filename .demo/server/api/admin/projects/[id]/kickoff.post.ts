import { createError, defineEventHandler, getRouterParam } from 'h3'
import { recordAudit } from '../../../../utils/audit'
import { collectKickoff } from '../../../../utils/finance'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'

/**
 * POST /api/admin/projects/:id/kickoff — the kickoff call happened: collect the
 * kickoff payment from the client's wallet and start the work (ADR-019).
 *
 * Gated on `work.assign`, the permission that already moves a project between
 * stages. The amount is never in the request: it was priced from the catalogue
 * when the order was signed and stored on the project.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'work.assign')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Project id is required' })
  }
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, serviceId: true, name: true } })
  if (!project) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }
  if (!project.serviceId) {
    throw createError({ statusCode: 400, message: 'This order predates kickoff payments. Start it from the stage control instead.' })
  }

  const result = await collectKickoff(id, { actorNote: 'after kickoff call' })
  if (!result.ok) {
    if (result.reason === 'already_paid') {
      throw createError({ statusCode: 409, message: 'The kickoff payment has already been collected.' })
    }
    if (result.reason === 'insufficient_funds') {
      throw createError({
        statusCode: 400,
        message: `The client's wallet is £${(result.shortBy ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })} short of the kickoff payment. Ask them to add funds, then try again.`,
      })
    }
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  await recordAudit(event, admin, {
    action: 'admin.project.kickoff',
    targetType: 'Project',
    targetId: id,
    metadata: { project: project.name, charged: result.charged },
  })
  return { ok: true, charged: result.charged }
})
