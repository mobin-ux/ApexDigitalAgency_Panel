import { flushVisits } from '../utils/visits'

/** The last minute of visit totals goes to the console when the server stops (ADR-026, phase F). */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', async () => {
    await flushVisits().catch(() => {})
  })
})
