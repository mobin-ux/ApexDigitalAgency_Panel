import { z } from 'zod'
import { requireStaffPermission } from '../../../../utils/permissions'
import { validateBody } from '../../../../utils/validate'
import { checkRedirect } from '../../../../utils/website/redirects'

const bodySchema = z.object({ fromPath: z.string().trim().min(1).max(512), toPath: z.string().trim().min(1).max(2048), id: z.string().optional() })

/** Live validation for the form: what saving would do, without saving. */
export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const body = await validateBody(event, bodySchema)
  return checkRedirect(body, body.id)
})
