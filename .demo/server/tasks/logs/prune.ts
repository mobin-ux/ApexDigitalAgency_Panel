import { pruneLogs } from '../../../shared/log'
import { runLoggedTask } from '../../utils/task-log'

/**
 * Daily (nuxt.config → nitro.scheduledTasks): delete the panel's log files
 * older than `NUXT_LOG_RETENTION_DAYS` (30 by default). The site prunes its
 * own files with its own task.
 */
export default defineTask({
  meta: { name: 'logs:prune', description: 'Delete log files older than the retention period' },
  async run() {
    const days = Math.max(1, Number((useRuntimeConfig().log as { retentionDays?: number | string } | undefined)?.retentionDays) || 30)
    const result = await runLoggedTask('logs:prune', async () => ({ retentionDays: days, removed: pruneLogs(days) }))
    return { result }
  },
})
