import type { TemplateContent } from './cms'

/**
 * The customer panel's own baseline for the documents the CMS can replace
 * (ADR-021): the words the dashboard promo and the panel announcement show
 * when no document is published. The legal pages have no baseline text on
 * purpose — they keep their placeholder until the real documents are
 * published (the TODO(legal) in pages/legal/*.vue).
 */

export const panelPromoBaseline: TemplateContent<'panel-promo'> = {
  eyebrow: 'Grow now, pay monthly',
  title: 'Build your business. Let it pay its own way.',
  text: 'Order today and spread the cost into small monthly payments. As your new website and marketing bring in customers, the revenue covers each payment. No interest, no credit check.',
  button: 'Start your order',
  finePrint: '',
}

export const panelAnnouncementBaseline: TemplateContent<'panel-announcement'> = {
  enabled: false,
  text: '',
  link: undefined,
  tone: 'info',
  startsAt: '',
  endsAt: '',
}
