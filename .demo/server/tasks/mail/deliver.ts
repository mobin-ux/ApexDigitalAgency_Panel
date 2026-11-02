import { deliverQueued } from '../../utils/mail/outbox'
import { runLoggedTask } from '../../utils/task-log'

/**
 * Every minute (nuxt.config → nitro.scheduledTasks): send what is queued
 * and retry what failed, with the outbox's own backoff. One panel process
 * runs one scheduler; the claim inside deliverQueued() and the provider's
 * idempotency key are what make a second runner harmless. Each run is a
 * `task.mail:deliver` log line; one that found nothing to send is debug.
 */
export default defineTask({
  meta: { name: 'mail:deliver', description: 'Send queued emails and retry failed ones' },
  async run() {
    const result = await runLoggedTask('mail:deliver', async () => ({ ...await deliverQueued() }), r => Object.values(r).every(v => !v))
    return { result }
  },
})
