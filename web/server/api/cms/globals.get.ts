import { fetchGlobals, fetchSettings } from '../../utils/cms'

/**
 * Same-origin read of what every page shares: the published site chrome
 * (header, footer, announcement, page chrome) and Site settings.
 */
export default defineEventHandler(async () => {
  const [globals, settings] = await Promise.all([fetchGlobals(), fetchSettings()])
  return { globals, settings }
})
