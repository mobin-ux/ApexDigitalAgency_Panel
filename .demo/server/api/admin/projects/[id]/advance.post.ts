import { createError, defineEventHandler, getRouterParam } from 'h3'
import { recordAudit } from '../../../../utils/audit'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'

/**
 * POST /api/admin/projects/:id/advance — move the project on one stage.
 *
 * The design draws a five-node stage strip. This codebase has no stage
 * enum: what it has is the project's **milestones**, which are already
 * the timeline the customer sees on their own project page. So "the
 * stage" is the current milestone, and advancing completes it and lights
 * the next one — one action, one audit entry (badge 7), rather than the
 * two unrelated milestone PATCHes the client would otherwise have to
 * fire and hope both landed.
 *
 * `progress` is recomputed from the timeline in the same transaction.
 * The two were independently editable before, which let the bar say 80%
 * over a timeline showing two of six done — a total and its parts
 * disagreeing, on the customer's screen.
 */

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'work.assign')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Project id is required' })
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, progress: true, milestones: { orderBy: { date: { sort: 'asc', nulls: 'last' } } } },
  })
  if (!project) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  const milestones = project.milestones
  if (milestones.length === 0) {
    throw createError({ statusCode: 400, message: 'This project has no milestones to advance. Add one first.' })
  }

  // The stage in flight, or the first one not yet done if none is marked.
  const currentIndex = milestones.findIndex(m => m.status === 'CURRENT')
  const index = currentIndex >= 0 ? currentIndex : milestones.findIndex(m => m.status !== 'COMPLETED')
  if (index < 0) {
    throw createError({ statusCode: 400, message: 'Every stage on this project is already complete.' })
  }

  const completed = milestones[index]!
  const next = milestones[index + 1]
  const doneCount = milestones.filter((m, i) => i <= index || m.status === 'COMPLETED').length
  const progress = Math.round((doneCount / milestones.length) * 100)

  await prisma.$transaction([
    prisma.milestone.update({
      where: { id: completed.id },
      data: { status: 'COMPLETED', date: completed.date ?? new Date() },
    }),
    ...(next ? [prisma.milestone.update({ where: { id: next.id }, data: { status: 'CURRENT' } })] : []),
    prisma.project.update({ where: { id }, data: { progress } }),
  ])

  await recordAudit(event, admin, {
    action: 'admin.project.stage-advance',
    targetType: 'Project',
    targetId: id,
    subject: project.name,
    metadata: {
      completed: completed.title,
      next: next?.title ?? null,
      progress: { before: project.progress, after: progress },
    },
  })

  return { completed: completed.title, next: next?.title ?? null, progress }
})
