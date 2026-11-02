/**
 * Enquiry statuses (ADR-026, phase E, `Admin Console.dc.html` `v_43leads`),
 * shared by the console's Enquiries screen and the routes that change them,
 * so the select, the filters and the validation are the same list.
 */

export const ENQUIRY_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'] as const
export type EnquiryStatus = typeof ENQUIRY_STATUSES[number]

export const ENQUIRY_STATUS: Record<EnquiryStatus, { label: string, tone: 'info' | 'violet' | 'warning' | 'success' | 'neutral' }> = {
  new: { label: 'New', tone: 'info' },
  contacted: { label: 'Contacted', tone: 'violet' },
  qualified: { label: 'Qualified', tone: 'warning' },
  won: { label: 'Won', tone: 'success' },
  lost: { label: 'Lost', tone: 'neutral' },
}

/** The design's filters: Open is everything not yet decided. */
export const ENQUIRY_FILTERS = ['open', ...ENQUIRY_STATUSES] as const
export type EnquiryFilter = typeof ENQUIRY_FILTERS[number]

/** Enquiries that did not become a client are deleted this long after they arrived (owner's decision). */
export const ENQUIRY_RETENTION_MONTHS = 24

/** The moment before which an enquiry that did not become a client is deleted. */
export function enquiryRetentionCutoff(now: Date): Date {
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - ENQUIRY_RETENTION_MONTHS)
  return cutoff
}
