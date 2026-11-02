import { runLoggedTask } from '../../utils/task-log'
import { purgeExpiredEnquiries } from '../../utils/website/enquiries'

/**
 * Daily (nuxt.config → nitro.scheduledTasks): delete enquiries older than
 * 24 months that did not become a client, with their staff notes
 * (ADR-026, phase E; the owner's retention decision). Logged as
 * `task.website:enquiries-retention` with the number deleted.
 */
export default defineTask({
  meta: { name: 'website:enquiries-retention', description: 'Delete enquiries older than 24 months that did not become a client' },
  async run() {
    const result = await runLoggedTask('website:enquiries-retention', async () => ({ deleted: await purgeExpiredEnquiries() }))
    return { result }
  },
})
