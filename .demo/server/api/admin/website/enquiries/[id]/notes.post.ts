import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { enquiryRef } from '../../../../../../shared/refs'
import { recordAudit } from '../../../../../utils/audit'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { validateBody } from '../../../../../utils/validate'
import { enquiryDetail } from '../../../../../utils/website/enquiries'

/**
 * POST /api/admin/website/enquiries/:id/notes — a staff-only note ("called,
 * left voicemail"). Never sent to the enquirer, and deleted with the
 * enquiry. The audit entry records that a note was added, not what it says.
 */

const bodySchema = z.object({ body: z.string().trim().min(1, 'Write the note first.').max(2000) })

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'leads.handle')
  const id = getRouterParam(event, 'id') ?? ''
  const { body } = await validateBody(event, bodySchema)
  if (!(await prisma.enquiry.findUnique({ where: { id }, select: { id: true } }))) {
    throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'This enquiry no longer exists.' })
  }
  await prisma.enquiryNote.create({ data: { enquiryId: id, body, authorId: actor.id, authorRole: actor.staffRole } })
  await recordAudit(event, actor, { action: 'admin.website.enquiry.note', targetType: 'Enquiry', targetId: id, subject: `${enquiryRef(id)}: note added` })
  return enquiryDetail(id)
})
