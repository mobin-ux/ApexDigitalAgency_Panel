import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireStaffPermission } from '../../../../utils/permissions'
import { enquiryDetail } from '../../../../utils/website/enquiries'

/** GET /api/admin/website/enquiries/:id — one enquiry with its staff notes. */
export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'leads.handle')
  const detail = await enquiryDetail(getRouterParam(event, 'id') ?? '')
  if (!detail) {
    throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'This enquiry no longer exists.' })
  }
  return detail
})
