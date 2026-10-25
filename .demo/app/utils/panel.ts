export type ApexTone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'neutral'
export type ApexGlyphKind = 'web' | 'seo' | 'mkt' | 'ppc' | 'brand' | 'uiux' | 'soft'

/**
 * Shared presentation helpers for the Panel v2 customer pages. One answer per
 * question — "what do we call this status", "which glyph is this service" —
 * so the dashboard, My orders and Wallet cannot each answer it differently.
 */

/** dd/mm/yyyy, the panel's only date format. */
export function ukDate(value: string | Date | null | undefined): string {
  if (!value) {
    return ''
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    return ''
  }
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** Whole days from today to `value`; negative when it has passed. */
export function daysUntil(value: string | Date): number {
  const d = new Date(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

export function inDays(value: string | Date): string {
  const n = daysUntil(value)
  if (n < 0) {
    return n === -1 ? 'Yesterday' : `${-n} days late`
  }
  if (n === 0) {
    return 'Today'
  }
  if (n === 1) {
    return 'Tomorrow'
  }
  return `In ${n} days`
}

/**
 * A notification's timestamp as the bell's panel shows it: the time today,
 * "Yesterday", a weekday and date within the week, then dd/mm.
 */
export function notifWhen(value: string | Date): string {
  const d = new Date(value)
  const ago = -daysUntil(d)
  const dm = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  if (ago <= 0) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  if (ago === 1) {
    return 'Yesterday'
  }
  if (ago < 7) {
    return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${dm}`
  }
  return dm
}

export type ApexNotifKind = 'project' | 'payment' | 'support' | 'account'

/**
 * What a notification is about, read from where it links — the one field every
 * writer of a `Notification` row already sets — so rows need no new column and
 * old rows are classified the same way as new ones.
 */
export function notifKind(link: string | null | undefined): { kind: ApexNotifKind, icon: string, tile: string, cta: string } {
  const to = link ?? ''
  if (to.startsWith('/dashboards/wallet')) {
    return { kind: 'payment', icon: 'solar:wallet-2-linear', tile: 'bg-st-success-bg text-st-success-fg', cta: 'View payments' }
  }
  if (to.startsWith('/dashboards/support')) {
    return { kind: 'support', icon: 'solar:headphones-round-linear', tile: 'bg-st-info-bg text-st-info-fg', cta: 'Open request' }
  }
  if (to.startsWith('/dashboards/settings') || to.startsWith('/auth')) {
    return { kind: 'account', icon: 'solar:shield-user-linear', tile: 'bg-st-warning-bg text-st-warning-fg', cta: 'Review account' }
  }
  return { kind: 'project', icon: 'solar:suitcase-linear', tile: 'bg-accent-tint text-accent-ink', cta: to.startsWith('/dashboards/orders') ? 'View order' : 'Open' }
}

/** One label and one tone per project status, everywhere. */
export function projectStatus(status: string | null | undefined): { label: string, tone: ApexTone, group: 'kickoff' | 'progress' | 'review' | 'done' | 'cancelled' } {
  switch ((status ?? '').toUpperCase()) {
    case 'IN_PROGRESS':
      return { label: 'In progress', tone: 'violet', group: 'progress' }
    case 'IN_REVIEW':
      return { label: 'In review', tone: 'info', group: 'review' }
    case 'COMPLETED':
      return { label: 'Completed', tone: 'success', group: 'done' }
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'neutral', group: 'cancelled' }
    default:
      return { label: 'Awaiting kickoff', tone: 'warning', group: 'kickoff' }
  }
}

/** The service glyph for an order: its catalogue id, else a guess from the category. */
export function glyphFor(serviceId?: string | null, category?: string | null): ApexGlyphKind {
  const known: ApexGlyphKind[] = ['web', 'seo', 'mkt', 'ppc', 'brand', 'uiux', 'soft']
  if (serviceId && (known as string[]).includes(serviceId)) {
    return serviceId as ApexGlyphKind
  }
  const c = (category ?? '').toLowerCase()
  if (c.includes('seo') || c.includes('search')) {
    return 'seo'
  }
  if (c.includes('click') || c.includes('ppc')) {
    return 'ppc'
  }
  if (c.includes('market')) {
    return 'mkt'
  }
  if (c.includes('brand')) {
    return 'brand'
  }
  if (c.includes('ui') || c.includes('ux')) {
    return 'uiux'
  }
  if (c.includes('software')) {
    return 'soft'
  }
  return 'web'
}

/** Read a human message out of a `$fetch` error. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = error as { data?: { message?: string, statusMessage?: string }, message?: string }
  return e?.data?.message || e?.data?.statusMessage || fallback
}
