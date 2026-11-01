import { fetchManifest } from '../../utils/cms'

/** Same-origin read of every published address, for the lists that show built articles and case studies. */
export default defineEventHandler(async () => ({ pages: await fetchManifest() }))
