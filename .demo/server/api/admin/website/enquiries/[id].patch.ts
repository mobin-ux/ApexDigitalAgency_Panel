import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { ENQUIRY_STATUS, ENQUIRY_STATUSES } from '../../../../../shared/enquiry-status'
import { enquiryRef } from '../../../../../shared/refs'
import { recordAudit } from '../../../../utils/audit'
import { staffHolding } from '../../../../utils/notify'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateBody } from '../../../../utils/validate'
import { namesOf } from '../../../../utils/website/content'
import { enquiryDetail } from '../../../../utils/website/enquiries'

/**
 * PATCH /api/admin/website/enquiries/:id — status and owner (`v_43leads`).
 *
 * Marking one lost needs a reason (kept for reporting, never sent to the
 * enquirer); moving it away from Lost reopens it and clears the reason,
 * which stays in the audit log. One that became a client stays Won. The
 * owner must be someone who can handle enquiries. Each change is one audit
 * entry naming the enquiry by its reference, not the person.
 */

const bodySchema = z.object({
  status: z.enum(ENQUIRY_STATUSES).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  lostReason: z.string().trim().max(300).optional(),
}).refine(b => b.status !== undefined || b.ownerId !== undefined, { message: 'Nothing to change' })

function label(status: string): string {
  return ENQUIRY_STATUS[status as keyof typeof ENQUIRY_STATUS]?.label ?? status
}

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'leads.handle')
  const id = getRouterParam(event, 'id') ?? ''
  const body = await validateBody(event, bodySchema)
  const row = await prisma.enquiry.findUnique({ where: { id } })
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'This enquiry no longer exists.' })
  }
  const ref = enquiryRef(row.id)
  const data: { status?: string, lostReason?: string | null, ownerId?: string | null } = {}

  if (body.status !== undefined && body.status !== row.status) {
    if (row.clientId) {
      throw createError({ statusCode: 409, statusMessage: 'Conflict', message: 'This enquiry became a client, so it stays Won.' })
    }
    const reason = body.lostReason ?? ''
    if (body.status === 'lost' && reason.length < 3) {
      throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Say why it was lost.', data: { fieldErrors: { lostReason: ['Say why it was lost.'] } } })
    }
    data.status = body.status
    data.lostReason = body.status === 'lost' ? reason : null
  }
  if (body.ownerId !== undefined && body.ownerId !== row.ownerId) {
    if (body.ownerId && !(await staffHolding('leads.handle')).includes(body.ownerId)) {
      throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'That person cannot handle enquiries.', data: { fieldErrors: { ownerId: ['Pick someone who can handle enquiries.'] } } })
    }
    data.ownerId = body.ownerId
  }
  if (!Object.keys(data).length) {
    return enquiryDetail(id)
  }

  // Conditional on what was read above, so two people changing it at once cannot both win.
  const { count } = await prisma.enquiry.updateMany({ where: { id, status: row.status, ownerId: row.ownerId }, data })
  if (!count) {
    throw createError({ statusCode: 409, statusMessage: 'Conflict', message: 'Someone changed this enquiry a moment ago. Reload to see it.' })
  }

  if (data.status) {
    await recordAudit(event, actor, {
      action: 'admin.website.enquiry.status',
      targetType: 'Enquiry',
      targetId: id,
      subject: `${ref}: ${label(row.status)} → ${label(data.status)}`,
      metadata: { from: row.status, to: data.status },
      reason: data.status === 'lost' ? data.lostReason ?? undefined : undefined,
    })
  }
  if (data.ownerId !== undefined) {
    const names = await namesOf([data.ownerId])
    await recordAudit(event, actor, {
      action: 'admin.website.enquiry.owner',
      targetType: 'Enquiry',
      targetId: id,
      subject: `${ref} → ${data.ownerId ? names.get(data.ownerId) ?? 'Staff' : 'Unassigned'}`,
      metadata: { from: row.ownerId, to: data.ownerId },
    })
  }
  return enquiryDetail(id)
})
