import type { MonthlyPlan } from '../plans'
import type { ServicePageContent } from './types'
import { formatGbp } from '../../utils/format'

/**
 * Copy the generic service template (`ServicePage.dc.html`) prints on every
 * service page except Website Design, which has its own design.
 *
 * TODO(content): as on Website Design, every case-study figure, client quote
 * and named person on these pages comes from the design and must be confirmed
 * as real, with the client's consent to be named, before launch (DMCC Act
 * 2024 bans invented testimonials).
 */

export const technologyLegend = 'Violet marks what we most often recommend'

export const examplesCallout: NonNullable<ServicePageContent['work']['callout']> = {
  title: 'Want to see one like yours?',
  body: 'Tell us your sector and we will send two relevant examples with the numbers behind them.',
  cta: 'Request examples',
}

export const voicesHeading = {
  title: 'Ordinary businesses, plainly said',
  intro: 'Every quote below is from a UK client. We will put you in touch with any of them.',
} as const

export const promises: NonNullable<ServicePageContent['voices']['promises']> = [
  { title: 'Fixed monthly figure', body: 'Agreed before we start, unchanged for the term.' },
  { title: 'You own everything', body: 'Files, accounts and data in your name.' },
  { title: 'Named team, no outsourcing', body: 'In-house specialists in Kent.' },
  { title: 'GDPR compliant', body: 'Data held in UK and EU regions.' },
]

export const faqTitle = 'Before you order'

/** "£349" — a plan's monthly figure. */
export const monthly = (plan: MonthlyPlan) => formatGbp(plan.monthly)

/** "Usually Local · £349/mo", the footer of an audience card. */
export const usually = (plan: MonthlyPlan) => `Usually ${plan.name} · ${monthly(plan)}/mo`
