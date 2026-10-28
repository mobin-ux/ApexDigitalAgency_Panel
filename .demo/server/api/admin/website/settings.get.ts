import { requireStaffPermission } from '../../../utils/permissions'
import { getWebsiteSettings, WEBSITE_SETTING_KEYS, WEBSITE_SETTINGS } from '../../../utils/website/settings'

/** The registry (label, group, hint per key) and the current values, defaults filled. */
export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const values = await getWebsiteSettings()
  return {
    fields: WEBSITE_SETTING_KEYS.map(key => ({ key, label: WEBSITE_SETTINGS[key].label, group: WEBSITE_SETTINGS[key].group, hint: (WEBSITE_SETTINGS[key] as { hint?: string }).hint ?? '' })),
    values,
  }
})
