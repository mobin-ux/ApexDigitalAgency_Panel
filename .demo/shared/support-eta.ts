/**
 * The reply promise, in one place (Phase 9 Admin, badge 27).
 *
 * Phase 6 found a hardcoded "15 minutes" in three client components next
 * to a config-driven pill, so changing the setting made the other copy
 * quietly false. The fix was one setting; this is the other half of it —
 * one function that turns the stored number of minutes into the words
 * the client reads, imported by both `/api/config` (which serves the
 * string) and the admin settings screen (which previews it). The
 * operator therefore sees the exact sentence the customer will see, not
 * an approximation of it.
 */

export const REPLY_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const

export type ReplyPriority = typeof REPLY_PRIORITIES[number]

/** Setting key for a priority's reply target, in minutes. */
export function replyTargetKey(priority: ReplyPriority): string {
  return `support.reply-target.${priority}`
}

export const DEFAULT_REPLY_TARGETS: Record<ReplyPriority, number> = {
  urgent: 5,
  high: 10,
  normal: 15,
  low: 240,
}

/**
 * "~15 min" / "~4 hours" / "~1 working day". Hours and days only appear
 * once the number is exact, because "~1.5 hours" reads as a guess about
 * a guess; anything in between stays in minutes.
 */
export function formatReplyEta(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m === 0) {
    return 'as soon as we can'
  }
  if (m < 60) {
    return `~${m} min`
  }
  if (m % 1440 === 0) {
    const days = m / 1440
    return `~${days} working day${days === 1 ? '' : 's'}`
  }
  if (m % 60 === 0) {
    const hours = m / 60
    return `~${hours} hour${hours === 1 ? '' : 's'}`
  }
  return `~${m} min`
}

/** The exact sentence the client's Support header shows. */
export function onlinePillText(normalMinutes: number): string {
  return `Team online · replies in ${formatReplyEta(normalMinutes)}`
}
