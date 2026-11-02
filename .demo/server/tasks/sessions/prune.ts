import { ENDED_SESSION_RETENTION_DAYS, pruneEndedSessions } from '../../utils/auth'
import { runLoggedTask } from '../../utils/task-log'

/**
 * Daily (nuxt.config → nitro.scheduledTasks): delete signed-in device rows
 * that expired or were signed out more than 30 days ago (AUD-10). Logged as
 * `task.sessions:prune` with the number deleted.
 */
export default defineTask({
  meta: { name: 'sessions:prune', description: 'Delete sessions that ended more than 30 days ago' },
  async run() {
    const result = await runLoggedTask('sessions:prune', async () => ({ retentionDays: ENDED_SESSION_RETENTION_DAYS, deleted: await pruneEndedSessions() }))
    return { result }
  },
})
