import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateBody } from '../../../../utils/validate'

/**
 * POST /api/admin/projects/:id/notes — add a staff-only note (badge 8).
 *
 * `ProjectNote` is a separate model from `TicketMessage` rather than a
 * flag on it. Client-visible text and internal text are kept apart at
 * the storage level, so there is no code path — and no future bug — that
 * can put one of these in front of a customer. No customer endpoint
 * reads this table.
 *
 * Gated on `work.assign` rather than `work.view`: Read-only is a
 * reading role, and a note is a contribution to the work.
 */

const bodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
}).strict()

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'work.assign')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Project id is required' })
  }

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } })
  if (!project) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  const { body } = await validateBody(event, bodySchema)

  /*
   * No audit row. The note *is* its own record — author, time and text
   * are all on it — and mirroring every note into the audit trail would
   * copy internal commentary into a log that other screens render.
   */
  return prisma.projectNote.create({
    data: {
      projectId: id,
      body,
      authorId: admin.id,
      authorEmail: admin.email,
      authorRole: admin.staffRole,
    },
  })
})
