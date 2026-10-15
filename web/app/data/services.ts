import type { ServiceSlug } from './routes'

export type ServiceGlyphName = 'software' | 'marketing' | 'seo' | 'ppc' | 'uiux' | 'branding'

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
  /** Monthly price in pounds (inc. VAT); `null` when the work is scoped on a call. */
  fromMonthly: number | null
  glyph?: ServiceGlyphName
}

/** Single source for the services menu, homepage cards, footer and schema. */
export const services: readonly Service[] = [
  {
    slug: 'website-design',
    name: 'Website Design',
    shortName: 'Website Design',
    menuBlurb: 'From £149/month over 12 months',
    blurb: 'A site built to win enquiries. Design, build, hosting and SEO foundations included.',
    fromMonthly: 149,
  },
  {
    slug: 'software-development',
    name: 'Software Development',
    shortName: 'Software Development',
    menuBlurb: 'Web apps, portals, internal tools',
    blurb: 'Web apps and internal tools, built around how you work.',
    fromMonthly: null,
    glyph: 'software',
  },
  {
    slug: 'digital-marketing',
    name: 'Digital Marketing',
    shortName: 'Digital Marketing',
    menuBlurb: 'Campaigns that fill the diary',
    blurb: 'One team on your channels, reporting on enquiries.',
    fromMonthly: 399,
    glyph: 'marketing',
  },
  {
    slug: 'seo',
    name: 'Search Engine Optimisation (SEO)',
    shortName: 'Search Engine Optimisation',
    menuBlurb: 'Rank for what customers search',
    blurb: 'Get found for what your customers actually type.',
    fromMonthly: 349,
    glyph: 'seo',
  },
  {
    slug: 'ppc',
    name: 'Pay-Per-Click Advertising (PPC)',
    shortName: 'Pay-Per-Click Advertising',
    menuBlurb: 'Enquiries from week one',
    blurb: 'Enquiries from week one while SEO builds.',
    fromMonthly: 299,
    glyph: 'ppc',
  },
  {
    slug: 'ui-ux-design',
    name: 'UI/UX Design',
    shortName: 'UI/UX Design',
    menuBlurb: 'Research, flows and prototypes',
    blurb: 'Research, flows and prototypes before any code.',
    fromMonthly: 249,
    glyph: 'uiux',
  },
  {
    slug: 'branding',
    name: 'Branding & Graphic Design',
    shortName: 'Branding & Graphic Design',
    menuBlurb: 'Identity for new businesses',
    blurb: 'Identity and collateral for businesses starting out.',
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
