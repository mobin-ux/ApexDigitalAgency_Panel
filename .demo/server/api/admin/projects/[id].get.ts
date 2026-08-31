import { createError, defineEventHandler, getRouterParam } from 'h3'
import { can, isStaffRole } from '../../../../shared/permissions'
import { deliverableState } from '../../../utils/deliverables'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'

/**
 * GET /api/admin/projects/:id — full project detail for the admin panel:
 * owner, manager, milestone timeline, files, plus the staff directory
 * (admins/employees) so the manager picker doesn't need a second call.
 *
 * Phase 9 (Overview & work) adds, without changing anything an existing
 * caller reads:
 *
 * - `deliverables`, the release state from `utils/deliverables.ts` — the
 *   same function the customer's own project page answers from, so the
 *   two screens cannot disagree about whether files are downloadable;
 * - `activity`, the project's audit entries merged with the events the
 *   database already records (the order being placed, each instalment
 *   collected), because badge 7 asks for a feed the audit log also reads
 *   rather than a second store written alongside it;
 * - `notes`, the staff-only notes (badge 8);
 * - `assignable`, the staff who may own project work, with their current
 *   load — the design's assign dialog says "only staff whose role can own
 *   project work are listed", and that list is the permission matrix's
 *   `work.assign` row.
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
      manager: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true, staffRole: true, role: true } },
      /*
       * `nulls: 'last'` is load-bearing, not tidying. SQLite sorts NULL
       * first in an ASC order, and only *completed* milestones carry a
       * date — so a plain `date: 'asc'` put the finished stages at the
       * end and rendered the timeline backwards, on this page and on the
       * customer's own project page. It also broke the progress figure
       * `advance` derives from the order.
       */
      milestones: { orderBy: { date: { sort: 'asc', nulls: 'last' } } },
      files: { orderBy: { createdAt: 'desc' } },
      installmentPlan: true,
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

  const [staff, deliverables, notes, auditRows, releases] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'EMPLOYEE'] } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        staffRole: true,
        _count: { select: { managedProjects: true } },
      },
      orderBy: { email: 'asc' },
    }),
    deliverableState(project),
    prisma.projectNote.findMany({ where: { projectId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { targetType: 'Project', targetId: id },
          // Milestone rows carry the milestone's own id, so they are found
          // by the set of ids this project owns rather than by target.
          { targetType: 'Milestone', targetId: { in: project.milestones.map(m => m.id) } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    prisma.deliverableRelease.findMany({ where: { projectId: id }, orderBy: { releasedAt: 'desc' }, take: 10 }),
  ])

  // Instalment collections are money events the ledger already holds; the
  // audit trail never sees them because no admin performs them.
  const charges = project.installmentPlan
    ? await prisma.transaction.findMany({
        where: { installmentId: project.installmentPlan.id },
        orderBy: { createdAt: 'desc' },
        take: 24,
        select: { id: true, amount: true, createdAt: true, description: true },
      })
    : []

  return {
    project,
    staff,
    /*
     * `EMPLOYEE` accounts have no staff role — ADR-016 keeps that enum as
     * the project-assignment label — so they are assignable by definition.
     * An ADMIN is assignable when their staff role holds `work.assign`,
     * which is the same row the assign endpoint is gated on.
     */
    assignable: staff
      .filter(s => s.role === 'EMPLOYEE' || can(isStaffRole(s.staffRole) ? s.staffRole : 'owner', 'work.assign'))
      .map(s => ({
        id: s.id,
        email: s.email,
        firstName: s.firstName,
        lastName: s.lastName,
        staffRole: s.staffRole,
        role: s.role,
        load: s._count.managedProjects,
      })),
    deliverables,
    releases,
    notes,
    activity: auditRows,
    charges,
  }
})
