import type { ServiceSlug } from './routes'

export type ServiceGlyphName = 'software' | 'marketing' | 'seo' | 'ppc' | 'uiux' | 'branding'

/** The outcomes a visitor can filter the services page by. */
export type ServiceGoalId = 'enquiries' | 'google' | 'credible' | 'sell' | 'admin' | 'brand'

export interface ServiceGoal {
  id: ServiceGoalId
  label: string
}

export interface Service {
  slug: ServiceSlug
  /** Full name, used in the services menu and as the link text. */
  name: string
  /** Short name for cards and footer columns. */
  shortName: string
  /** One line under the name in the services menu. */
  menuBlurb: string
  /** Sentence on the homepage card. */
  blurb: string
  /** Sentence on the services page card. */
  summary: string
  /** The problem it fixes, in the visitor's words. */
  fixes: string
  bestFor: string
  timeline: string
  /** Outcomes this service answers on the services page filter. */
  goals: readonly ServiceGoalId[]
  /** Monthly price in pounds (inc. VAT); `null` when the work is scoped on a call. */
  fromMonthly: number | null
  glyph?: ServiceGlyphName
}

/** Single source for the services menu, homepage cards, services page, footer and schema. */
export const services: readonly Service[] = [
  {
    slug: 'website-design',
    name: 'Website Design',
    shortName: 'Website Design',
    menuBlurb: 'From £149/month over 12 months',
    blurb: 'A site built to win enquiries. Design, build, hosting and SEO foundations included.',
    summary: 'A site built to win enquiries, not just to look modern.',
    fixes: 'A site that gets traffic but no calls',
    bestFor: 'Sole traders and small teams',
    timeline: '4–6 weeks',
    goals: ['enquiries', 'credible', 'sell'],
    fromMonthly: 149,
  },
  {
    slug: 'software-development',
    name: 'Software Development',
    shortName: 'Software Development',
    menuBlurb: 'Web apps, portals, internal tools',
    blurb: 'Web apps and internal tools, built around how you work.',
    summary: 'Web apps and internal tools built around how you work.',
    fixes: 'Spreadsheets and manual admin',
    bestFor: 'Teams of five and up',
    timeline: 'Two-week sprints',
    goals: ['admin'],
    fromMonthly: null,
    glyph: 'software',
  },
  {
    slug: 'digital-marketing',
    name: 'Digital Marketing',
    shortName: 'Digital Marketing',
    menuBlurb: 'Campaigns that fill the diary',
    blurb: 'One team on your channels, reporting on enquiries.',
    summary: 'One team on your channels, reporting on enquiries.',
    fixes: 'Marketing is nobody’s actual job',
    bestFor: 'Businesses without a marketer',
    timeline: 'Ongoing, monthly reporting',
    goals: ['enquiries', 'sell', 'google'],
    fromMonthly: 399,
    glyph: 'marketing',
  },
  {
    slug: 'seo',
    name: 'Search Engine Optimisation (SEO)',
    shortName: 'Search Engine Optimisation',
    menuBlurb: 'Rank for what customers search',
    blurb: 'Get found for what your customers actually type.',
    summary: 'Get found for what your customers actually type.',
    fixes: 'Nobody finds you on Google',
    bestFor: 'Local trades and services',
    timeline: '3–6 months to compound',
    goals: ['google', 'enquiries'],
    fromMonthly: 349,
    glyph: 'seo',
  },
  {
    slug: 'ppc',
    name: 'Pay-Per-Click Advertising (PPC)',
    shortName: 'Pay-Per-Click Advertising',
    menuBlurb: 'Enquiries from week one',
    blurb: 'Enquiries from week one while SEO builds.',
    summary: 'Enquiries from week one while slower channels build.',
    fixes: 'You need work in the diary now',
    bestFor: 'Anyone with capacity to fill',
    timeline: 'Live in 5 working days',
    goals: ['enquiries', 'sell'],
    fromMonthly: 299,
    glyph: 'ppc',
  },
  {
    slug: 'ui-ux-design',
    name: 'UI/UX Design',
    shortName: 'UI/UX Design',
    menuBlurb: 'Research, flows and prototypes',
    blurb: 'Research, flows and prototypes before any code.',
    summary: 'Research, flows and prototypes before any code.',
    fixes: 'People drop out halfway through',
    bestFor: 'Products and booking flows',
    timeline: '2–4 weeks',
    goals: ['credible', 'admin', 'sell'],
    fromMonthly: 249,
    glyph: 'uiux',
  },
  {
    slug: 'branding',
    name: 'Branding & Graphic Design',
    shortName: 'Branding & Graphic Design',
    menuBlurb: 'Identity for new businesses',
    blurb: 'Identity and collateral for businesses starting out.',
    summary: 'Identity and collateral for businesses starting out.',
    fixes: 'You look smaller than you are',
    bestFor: 'New and rebranding businesses',
    timeline: '2–3 weeks',
    goals: ['brand', 'credible'],
    fromMonthly: 129,
    glyph: 'branding',
  },
]

/** The flagship service shown as the large card on the homepage. */
export const featuredService = {
  slug: 'website-design',
  badge: 'Most popular',
  leadTime: 'Live in 4–6 weeks',
  inclusions: ['Up to 12 pages', 'Hosting included', 'You own the code'],
  instalments: { total: 12, paid: 3 },
} as const

export const featuredServiceData = services.find(s => s.slug === featuredService.slug)!
export const gridServices = services.filter(s => s.slug !== featuredService.slug)

export const serviceGoals: readonly ServiceGoal[] = [
  { id: 'enquiries', label: 'More enquiries' },
  { id: 'google', label: 'Get found on Google' },
  { id: 'credible', label: 'Look more credible' },
  { id: 'sell', label: 'Sell online' },
  { id: 'admin', label: 'Save admin time' },
  { id: 'brand', label: 'Launch a new brand' },
]

/** Services page order: how often each one is chosen first. */
const catalogueOrder: readonly ServiceSlug[] = [
  'website-design',
  'seo',
  'ppc',
  'digital-marketing',
  'branding',
  'ui-ux-design',
  'software-development',
]

export const catalogueServices = catalogueOrder.map(slug => services.find(s => s.slug === slug)!)

export function isServiceGoal(value: unknown): value is ServiceGoalId {
  return serviceGoals.some(goal => goal.id === value)
}
