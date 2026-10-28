import { getRouterParam } from 'h3'
import { requireStaffPermission } from '../../../../utils/permissions'
import { loadMedia, mediaUsage, publicMedia } from '../../../../utils/website/media'

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const id = getRouterParam(event, 'id')!
  return { ...publicMedia(await loadMedia(id)), usage: await mediaUsage(id) }
})
