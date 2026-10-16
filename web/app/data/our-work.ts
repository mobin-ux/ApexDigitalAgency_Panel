import type { ServiceSlug } from './routes'
import { clients } from './home'

/** Page copy for /our-work (`Our Work.dc.html`). The projects are in `case-studies.ts`. */

export const ourWorkSeo = {
  title: 'Our work: case studies with measured results',
  description:
    'Websites, SEO, ads, software and branding for UK businesses, each shown with what changed after launch. Filter by service or by sector.',
} as const

export const ourWorkHero = {
  eyebrow: 'Our work',
  title: 'Judge us by the numbers, not the portfolio',
  lead: 'Every project below shows what changed for the client after launch, measured the same way we would measure yours. Filter by what we did or by the kind of business.',
} as const

/** The "What we did" filter, in the design's order. */
export const serviceFilterOrder: readonly ServiceSlug[] = [
  'website-design',
  'seo',
  'ppc',
  'digital-marketing',
  'software-development',
  'ui-ux-design',
  'branding',
]

export const nextProject = {
  title: 'Your business could be the next card here',
  body: 'Tell us which project is closest to yours. We will send back what we would change and a monthly figure within one working day.',
  checks: ['Written plan, no call needed', 'Monthly figure up front', 'Reply within one working day'],
  cta: 'Discuss a similar project',
} as const

export interface ClientQuote {
  quote: string
  name: string
  role: string
  /** The result chip beside the name. */
  result: string
}

/** TODO(content): confirm each quote is real and that the client consents to being named. */
export const ourWorkVoices = {
  eyebrow: 'In their words',
  title: 'Most clients come back for a second service',
  /** TODO(content): "seven in ten" needs a source before launch. */
  intro: 'Seven in ten add SEO, ads or a rebrand within their first year. That tends to happen when the first project pays for itself.',
  quotes: [
    {
      quote: '“We paid the first month and had more quote requests by the third week than in the whole of the previous quarter.”',
      name: 'Mark Hartley',
      role: 'Director, Hartley & Sons Roofing',
      result: '4.2× enquiries',
    },
    {
      quote: '“They asked what we wanted to stop doing, not what we wanted it to look like. The portal gave every accountant a day back.”',
      name: 'Priya Shah',
      role: 'Partner, Northgate Accountants',
      result: '−78% admin',
    },
  ] satisfies ClientQuote[],
  // The featured client already has a card and a quote on this page.
  alsoTrustedBy: clients.filter(name => !name.startsWith('Hartley')),
}

export const ourWorkCta = {
  eyebrow: 'Seen something close?',
  title: 'Point at a project. We will tell you what yours would cost.',
  body: 'Send us the case study that looks most like your business. You get a short written plan, a timeline and a monthly figure. No call needed unless you want one.',
  button: 'Discuss a similar project',
} as const
