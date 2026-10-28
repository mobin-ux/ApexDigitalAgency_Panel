import { publishDue } from '../../utils/website/publish'

/**
 * Every minute (nuxt.config → nitro.scheduledTasks): publish what is due
 * and retry any publish the site has not been told about. One panel
 * process runs one scheduler; the claim inside publishDue() is what makes
 * a second runner harmless if that ever changes.
 */
export default defineTask({
  meta: { name: 'website:publish-due', description: 'Publish scheduled website documents and retry pending revalidations' },
  async run() {
    const result = await publishDue()
    if (result.failed.length) {
      console.warn(`[website] scheduled publish: ${result.failed.length} failed (retried next minute)`)
    }
    return { result }
  },
})
