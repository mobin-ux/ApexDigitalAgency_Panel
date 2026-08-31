import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../../utils/audit'
import { activeRelease, outstandingFor } from '../../../../../utils/deliverables'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { validateBody } from '../../../../../utils/validate'

/**
 * POST /api/admin/projects/:id/deliverables/release — hand the project's
 * files to the client (Phase 9 Admin, badges 6 and 7).
 *
 * The highest-consequence action in this module: it hands over source
 * files. Two rules are enforced here rather than only in the dialog,
 * because the dialog is convenience and this is the gate:
 *
 * - **An early release needs a stated reason.** If a balance is still
 *   outstanding the reason is required, and it is written to the audit
 *   trail against the actor's name and the role they held at the time.
 *   Where nothing is owed the hand-over is routine and no reason is asked
 *   for — requiring one everywhere trains people to type "n/a".
 * - **The outstanding balance is snapshotted.** Reading it back from the
 *   plan later would answer what is owed *now*, not what was owed when
 *   somebody decided to release.
 */

const bodySchema = z.object({
  reason: z.string().trim().max(1000).optional(),
}).strict()

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'work.release')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Project id is required' })
  }

  const { reason } = await validateBody(event, bodySchema)

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      amount: true,
      installmentPlan: { select: { total: true, paid: true } },
      _count: { select: { files: true } },
    },
  })
  if (!project) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  const existing = await activeRelease(id)
  if (existing) {
    throw createError({ statusCode: 409, message: 'These files are already released to the client.' })
  }

  const outstanding = outstandingFor(project)
  if (outstanding > 0.005 && !reason) {
    throw createError({
      statusCode: 400,
      message: 'This project still has a balance outstanding. State why the files are being released early.',
    })
  }

  const release = await prisma.deliverableRelease.create({
    data: {
      projectId: id,
      fileCount: project._count.files,
      outstandingAtRelease: outstanding,
      reason: reason || null,
      actorId: admin.id,
      actorEmail: admin.email,
      actorRole: admin.staffRole,
    },
  })

  await recordAudit(event, admin, {
    action: 'admin.project.deliverables.release',
    targetType: 'Project',
    targetId: id,
    subject: project.name,
    reason,
    metadata: { fileCount: project._count.files, outstandingAtRelease: outstanding, releaseId: release.id },
  })

  return release
})
