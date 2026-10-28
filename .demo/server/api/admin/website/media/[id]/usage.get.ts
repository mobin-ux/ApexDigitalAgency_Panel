import { getRouterParam } from 'h3'
import { requireStaffPermission } from '../../../../../utils/permissions'
import { loadMedia, mediaUsage } from '../../../../../utils/website/media'

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const id = getRouterParam(event, 'id')!
  await loadMedia(id)
  return { usage: await mediaUsage(id) }
})
