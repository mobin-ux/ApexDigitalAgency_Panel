import { pruneLogs, writeLog } from '#shared/log'

/** Daily: delete the site's log files older than `NUXT_LOG_RETENTION_DAYS` (30 by default). */
export default defineTask({
  meta: { name: 'logs:prune', description: 'Delete log files older than the retention period' },
  async run() {
    const days = Math.max(1, Number((useRuntimeConfig().log as { retentionDays?: number | string } | undefined)?.retentionDays) || 30)
    const removed = pruneLogs(days)
    writeLog({ level: 'info', category: 'task', event: 'task.logs:prune', message: 'Old log files removed', outcome: 'success', actor: { kind: 'system', id: 'task:logs:prune' }, data: { retentionDays: days, removed } })
    return { result: { removed } }
  },
})
