import { requireStaffPermission } from '../../../utils/permissions'
import { seoAudit } from '../../../utils/website/seo-audit'

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.seo')
  return seoAudit()
})
