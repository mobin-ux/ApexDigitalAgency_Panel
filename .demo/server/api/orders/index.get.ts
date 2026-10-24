import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { deliverableStates } from '../../utils/deliverables'
import prisma from '../../utils/prisma'

/**
 * GET /api/orders — the caller's projects with milestones, files and
 * manager. Returns raw records; all presentation mapping happens in the
 * front-end computed properties.
 *
 * Phase 9 (Overview & work) adds the deliverable gate. When a project's
 * files are held — the platform rule is on and a balance is outstanding
 * with no release recorded — the customer still receives the file list,
 * because knowing what is waiting is the point, but **the download URL
 * is withheld here, on the server**. Hiding the link in the template
 * alone would leave the address in the page payload, which is not a gate
 * at all; and returning nothing would leave the customer unable to see
 * that the work exists.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)

  const projects = await prisma.project.findMany({
    where: { userId: session.id },
    include: {
      /*
       * `nulls: 'last'` is load-bearing, not tidying. SQLite sorts NULL
       * first in an ASC order, and only *completed* milestones carry a
       * date — so a plain `date: 'asc'` put the finished stages at the
       * end and rendered the timeline backwards, on this page and on the
       * customer's own project page. It also broke the progress figure
       * `advance` derives from the order.
       */
      milestones: { orderBy: { date: { sort: 'asc', nulls: 'last' } } },
      files: true,
      manager: { select: { firstName: true, lastName: true, avatar: true, staffRole: true } },
      installmentPlan: true,
      // Panel v2: what the team is waiting on, newest first; answered ones stay
      // so the order can say what was approved.
      clientActions: {
        where: { status: { in: ['OPEN', 'DONE'] } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, body: true, ctaLabel: true, doneLine: true, status: true, createdAt: true, resolvedAt: true },
      },
      // Files the client uploaded; served through /api/attachments/:id.
      attachments: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, size: true, mime: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const states = await deliverableStates(projects)

  return {
    data: projects.map((project) => {
      const state = states.get(project.id)
      const held = Boolean(state?.held)
      // The drawn signature is a data URL of up to 300 KB per order; the list
      // never shows it, so it never leaves the server here.
      const { signature: _signature, ...rest } = project
      return {
        ...rest,
        files: held ? project.files.map(file => ({ ...file, url: '' })) : project.files,
        /*
         * Only what the customer's own screen needs to explain the state.
         * The actor, the reason and the outstanding snapshot stay inside
         * the admin panel — the client is told their files are held, not
         * which member of staff decided it or what was typed about them.
         */
        deliverables: {
          held,
          releasedAt: state?.releasedAt ?? null,
        },
      }
    }),
  }
})
