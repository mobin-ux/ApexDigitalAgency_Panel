import { deliverQueued } from '../../utils/mail/outbox'

/**
 * Every minute (nuxt.config → nitro.scheduledTasks): send what is queued
 * and retry what failed, with the outbox's own backoff. One panel process
 * runs one scheduler; the claim inside deliverQueued() and the provider's
 * idempotency key are what make a second runner harmless.
 */
export default defineTask({
  meta: { name: 'mail:deliver', description: 'Send queued emails and retry failed ones' },
  async run() {
    const result = await deliverQueued()
    if (result.failed) {
      console.warn(`[mail] ${result.failed} message${result.failed === 1 ? '' : 's'} failed for good; see Admin › Email`)
    }
    return { result }
  },
})
