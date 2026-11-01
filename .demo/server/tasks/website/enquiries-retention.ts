import { createLogger } from '../../utils/logger'
import { purgeExpiredEnquiries } from '../../utils/website/enquiries'

const log = createLogger('enquiries')

/**
 * Daily (nuxt.config → nitro.scheduledTasks): delete enquiries older than
 * 24 months that did not become a client, with their staff notes
 * (ADR-026, phase E; the owner's retention decision).
 */
export default defineTask({
  meta: { name: 'website:enquiries-retention', description: 'Delete enquiries older than 24 months that did not become a client' },
  async run() {
    const deleted = await purgeExpiredEnquiries()
    if (deleted) {
      log.info('retention', { deleted })
    }
    return { result: { deleted } }
  },
})
