/**
 * Small formatters the admin console's screens share, so a wait reads
 * "6h" or "3 days" and a timestamp reads "30/10/2026 14:05" everywhere.
 */

/** The design's `hrs()`: hours under a day, whole days beyond it. */
export function waitedSince(iso: string | Date | null | undefined, now = Date.now()): string {
  if (!iso) {
    return '—'
  }
  const hours = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 3_600_000))
  if (hours < 1) {
    return '<1h'
  }
  if (hours < 24) {
    return `${hours}h`
  }
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/** dd/mm/yyyy hh:mm in UK time — the format the console prints every timestamp in. */
export function ukDateTime(iso: string | Date | null | undefined): string {
  if (!iso) {
    return '—'
  }
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso)).replace(',', '')
}

/** "Owner", "Owner or Admin", "Owner, Admin or Finance". */
export function listJoin(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items.at(-1)}` : items.join('')
}

export function personName(u: { firstName?: string | null, lastName?: string | null, email?: string | null, phone?: string | null } | null | undefined, fallback = 'Unnamed account'): string {
  return [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.email || u?.phone || fallback
}
