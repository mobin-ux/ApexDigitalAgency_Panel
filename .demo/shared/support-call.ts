/**
 * Call requests (Support "Book a call"). Shared by the page and
 * `POST /api/support/call`, so the slots the dialog offers are exactly the
 * slots the endpoint accepts.
 *
 * There is no calendar or staff availability behind this. The customer picks
 * a preferred slot, it arrives as a support request, and staff confirm by
 * replying. All times are UK time.
 */

export const CALL_TIMES = ['10:00', '11:30', '14:00', '15:30'] as const
export type CallTime = typeof CALL_TIMES[number]

export interface CallDay {
  /** YYYY-MM-DD, UK date. */
  date: string
  /** "Mon". */
  dow: string
  /** "27". */
  day: string
  /** "Mon 27/10". */
  label: string
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Today's date in the UK, as YYYY-MM-DD. */
export function ukToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

function dayOf(date: string): CallDay {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!
  const dd = String(d).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return { date, dow, day: dd, label: `${dow} ${dd}/${mm}` }
}

/** The next five working days after today (UK), the days the dialog offers. */
export function callDays(now: Date = new Date()): CallDay[] {
  const [y, m, d] = ukToday(now).split('-').map(Number) as [number, number, number]
  const out: CallDay[] = []
  for (let i = 1; out.length < 5 && i < 14; i++) {
    const t = new Date(Date.UTC(y, m - 1, d + i))
    const wd = t.getUTCDay()
    if (wd !== 0 && wd !== 6) {
      out.push(dayOf(t.toISOString().slice(0, 10)))
    }
  }
  return out
}

/** True when the date is one the dialog offers today and the time is on the list. */
export function isCallSlot(date: string, time: string, now: Date = new Date()): boolean {
  return (CALL_TIMES as readonly string[]).includes(time) && callDays(now).some(d => d.date === date)
}

/** "2026-10-30 10:00" → "Thu 30/10 at 10:00". */
export function callLabel(slot: string | null | undefined): string {
  if (!slot || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(slot)) {
    return ''
  }
  const [date, time] = slot.split(' ') as [string, string]
  return `${dayOf(date).label} at ${time}`
}
