import { getRouterParam } from 'h3'
import { requireStaffPermission } from '../../../../utils/permissions'
import { documentDetail } from '../../../../utils/website/documents'

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  return documentDetail(getRouterParam(event, 'id')!)
})
