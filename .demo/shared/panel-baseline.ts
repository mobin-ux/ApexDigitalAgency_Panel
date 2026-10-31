/**
 * The words of the customer dashboard's pay-monthly band. They used to be
 * a CMS document laid over this baseline (ADR-021); with the website CMS
 * removed (2026-10-31) this is the only source.
 */
export interface PanelPromo {
  eyebrow: string
  title: string
  text: string
  button: string
  finePrint: string
}

export const panelPromoBaseline: PanelPromo = {
  eyebrow: 'Grow now, pay monthly',
  title: 'Build your business. Let it pay its own way.',
  text: 'Order today and spread the cost into small monthly payments. As your new website and marketing bring in customers, the revenue covers each payment. No interest, no credit check.',
  button: 'Start your order',
  finePrint: '',
}
