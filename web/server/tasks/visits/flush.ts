import { writeLog } from '#shared/log'
import { flushVisits } from '../../utils/visits'

/**
 * Hands the visit totals to the console; scheduled every minute (ADR-026,
 * phase F). Each run is a `task.visits:flush` line: debug when there was
 * nothing to send, info when totals went, a warning when the console
 * refused them or some had to be kept for the next run.
 */
export default defineTask({
  meta: {
    name: 'visits:flush',
    description: 'Send the visit totals to the console',
  },
  async run() {
    const started = performance.now()
    const result = await flushVisits()
    const trouble = Boolean(result.skipped && result.skipped !== 'not configured') || result.kept > 0
    writeLog({
      level: trouble ? 'warn' : result.sent ? 'info' : 'debug',
      category: 'task',
      event: 'task.visits:flush',
      message: trouble ? 'Visit totals not delivered' : 'Visit totals flushed',
      outcome: trouble ? 'failure' : 'success',
      actor: { kind: 'system', id: 'task:visits:flush' },
      durationMs: performance.now() - started,
      data: { ...result },
    })
    return { result }
  },
})
