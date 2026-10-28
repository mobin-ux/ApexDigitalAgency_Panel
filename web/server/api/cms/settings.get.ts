import { fetchSettings } from '../../utils/cms'

/** Same-origin proxy for the site settings (null when no panel is attached). */
export default defineEventHandler(async () => ({ settings: await fetchSettings() }))
