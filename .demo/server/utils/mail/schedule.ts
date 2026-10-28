/**
 * The outbox's retry schedule, on its own so the unit tests can read it
 * without loading Prisma. After the `attempts`-th failure the next try is
 * 1, 2, 4, 8, 16, 32 minutes away, capped at an hour; after MAX_ATTEMPTS
 * the row stays FAILED until someone retries it from the Email screen.
 */
export const MAX_ATTEMPTS = 6

export function nextAttemptFor(attempts: number, now = new Date()): Date {
  const minutes = Math.min(2 ** Math.max(0, attempts - 1), 60)
  return new Date(now.getTime() + minutes * 60_000)
}
