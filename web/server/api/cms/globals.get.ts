import { fetchGlobals } from '../../utils/cms'

/** Same-origin read of the published site chrome (header, footer, announcement, page chrome). */
export default defineEventHandler(async () => ({ globals: await fetchGlobals() }))
