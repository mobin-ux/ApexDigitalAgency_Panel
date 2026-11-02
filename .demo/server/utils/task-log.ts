import { writeLog } from '../../shared/log'

/**
 * A scheduled task's run, logged (shared/log.ts): `task.<name>` with its
 * duration and result when it ends, or the error with its stack when it
 * fails (then rethrown, so Nitro still reports the task as failed). A run
 * that found nothing to do is `debug`, so the every-minute tasks do not
 * fill the log with empty runs.
 */
export async function runLoggedTask<T extends Record<string, unknown>>(
  name: string,
  work: () => Promise<T>,
  idle?: (result: T) => boolean,
): Promise<T> {
  const started = performance.now()
  const actor = { kind: 'system' as const, id: `task:${name}` }
  try {
    const result = await work()
    writeLog({
      level: idle?.(result) ? 'debug' : 'info',
      category: 'task',
      event: `task.${name}`,
      message: `Task ${name} finished`,
      outcome: 'success',
      actor,
      durationMs: performance.now() - started,
      data: result,
    })
    return result
  }
  catch (error) {
    writeLog({
      level: 'error',
      category: 'task',
      event: `task.${name}`,
      message: `Task ${name} failed`,
      outcome: 'failure',
      actor,
      durationMs: performance.now() - started,
      error,
      stack: true,
    })
    throw error
  }
}
