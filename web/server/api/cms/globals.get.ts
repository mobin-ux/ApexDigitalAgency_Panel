import { fetchGlobals } from '../../utils/cms'

/** Same-origin proxy for the published chrome documents. */
export default defineEventHandler(async () => ({ globals: await fetchGlobals() }))
