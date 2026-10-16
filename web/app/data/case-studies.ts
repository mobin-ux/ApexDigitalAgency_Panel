import type { MediaImage } from './content'
import type { ServiceSlug } from './routes'
import { routes } from './routes'

/**
 * The case-study catalogue behind /our-work, from `Our Work.dc.html`.
 *
 * TODO(content): every client, figure and quote here is the design's. Each one
 * must be confirmed as real, and the client's consent to be named recorded,
 * before launch (DMCC Act 2024: invented testimonials and results are unfair
 * commercial practices). The images are empty until the photography arrives;
 * `MediaFrame` draws a placeholder panel at the final size meanwhile.
 *
 * TODO(content): the service pages link to further case studies (Brightwire
 * Electrical, Keystone Builders …) that this list does not include. When the
 * real studies are written they belong in this one catalogue, so every card on
 * the site opens a study that /our-work also lists.
 */

export type SectorId = 'trades' | 'hospitality' | 'health' | 'retail' | 'professional-services' | 'property'

export interface Sector {
  id: SectorId
  label: string
}

export const sectors: readonly Sector[] = [
  { id: 'trades', label: 'Trades' },
  { id: 'hospitality', label: 'Hospitality' },
  { id: 'health', label: 'Health' },
  { id: 'retail', label: 'Retail' },
  { id: 'professional-services', label: 'Professional services' },
  { id: 'property', label: 'Property' },
]

export interface CaseStudy {
  slug: string
  client: string
  sector: SectorId
  /** Town or area, shown after the sector: "Health · Tunbridge Wells". */
  place: string
  summary: string
  /** The one change the card leads with, measured before and after. */
  result: {
    before: string
    after: string
    /** What was measured, read after the figures: "table bookings a week". */
    metric: string
  }
  services: readonly ServiceSlug[]
  image?: MediaImage
}

/** Most recent first, the order the page lists them in. */
export const caseStudies: readonly CaseStudy[] = [
  {
    slug: 'brew-and-bloom-cafe',
    client: 'Brew & Bloom Café',
    sector: 'hospitality',
    place: 'Canterbury',
    summary: 'A booking site and local ads for a café opening a second site.',
    result: { before: '20', after: '85', metric: 'table bookings a week' },
    services: ['website-design', 'ppc'],
  },
  {
    slug: 'oakfield-dental',
    client: 'Oakfield Dental',
    sector: 'health',
    place: 'Tunbridge Wells',
    summary: 'New-patient funnel with online booking and review collection.',
    result: { before: '11', after: '38', metric: 'new patients a month' },
    services: ['website-design', 'seo'],
  },
  {
    slug: 'northgate-accountants',
    client: 'Northgate Accountants',
    sector: 'professional-services',
    place: 'Kent',
    summary: 'A client portal that replaced email chains and paper forms.',
    result: { before: '9h', after: '2h', metric: 'admin per week, per accountant' },
    services: ['software-development', 'ui-ux-design'],
  },
  {
    slug: 'loom-and-thread',
    client: 'Loom & Thread',
    sector: 'retail',
    place: 'Nationwide',
    summary: 'Shopify rebuild and paid social for an independent fabric shop.',
    result: { before: '£6k', after: '£21k', metric: 'online sales a month' },
    services: ['website-design', 'digital-marketing'],
  },
  {
    slug: 'weald-property-group',
    client: 'Weald Property Group',
    sector: 'property',
    place: 'Sevenoaks',
    summary: 'Search campaigns for vendor valuations across three towns.',
    result: { before: '£94', after: '£31', metric: 'cost per valuation lead' },
    services: ['ppc'],
  },
  {
    slug: 'kinetic-physio',
    client: 'Kinetic Physio',
    sector: 'health',
    place: 'Maidstone',
    summary: 'Name, identity and signage for a clinic launching from scratch.',
    result: { before: '0', after: '140', metric: 'bookings in the first quarter' },
    services: ['branding', 'website-design'],
  },
  {
    slug: 'ashby-electrical',
    client: 'Ashby Electrical',
    sector: 'trades',
    place: 'Ashford',
    summary: 'Local SEO for 22 towns and a quote form that asks the right questions.',
    result: { before: '6', after: '29', metric: 'quote requests a month' },
    services: ['seo'],
  },
  {
    slug: 'old-forge-inn',
    client: 'The Old Forge Inn',
    sector: 'hospitality',
    place: 'Rye',
    summary: 'Brand refresh and monthly content across Instagram and email.',
    result: { before: '12%', after: '41%', metric: 'rooms booked direct' },
    services: ['branding', 'digital-marketing'],
  },
  {
    slug: 'greenway-legal',
    client: 'Greenway Legal',
    sector: 'professional-services',
    place: 'London',
    summary: 'Enquiry flow redesigned after testing with twelve real clients.',
    result: { before: '1.4%', after: '4.9%', metric: 'enquiry conversion rate' },
    services: ['ui-ux-design', 'website-design'],
  },
  {
    slug: 'stonebridge-builders',
    client: 'Stonebridge Builders',
    sector: 'trades',
    place: 'Medway',
    summary: 'Job-tracking app for site teams, built in six two-week sprints.',
    result: { before: '3 days', after: 'same day', metric: 'invoice turnaround' },
    services: ['software-development'],
  },
  {
    slug: 'pawsome-supplies',
    client: 'Pawsome Supplies',
    sector: 'retail',
    place: 'Nationwide',
    summary: 'Shopping ads and product feed clean-up ahead of peak season.',
    result: { before: '2.1×', after: '5.6×', metric: 'return on ad spend' },
    services: ['ppc', 'digital-marketing'],
  },
  {
    slug: 'harbour-lettings',
    client: 'Harbour Lettings',
    sector: 'property',
    place: 'Folkestone',
    summary: 'Landlord-facing site ranked for every postcode they manage in.',
    result: { before: '4', after: '17', metric: 'landlord enquiries a month' },
    services: ['seo', 'website-design'],
  },
]

/**
 * The study at the top of /our-work. Its slug is the homepage's featured case
 * study, so both link to the same page.
 *
 * TODO(content): the homepage quotes this project as "+214% enquiries, 4.2×
 * return on ad spend", this page as "4.2× quote requests", and the Case Study
 * design as "29 quote requests a month". One set of figures has to be chosen
 * and both pages taken from it.
 */
export const featuredCaseStudy = {
  slug: 'hartley-and-sons',
  client: 'Hartley & Sons Roofing',
  sector: 'trades' as SectorId,
  place: 'Maidstone, Kent',
  summary: 'A three-generation roofer relying on word of mouth. We rebuilt the site around a quote form and ranked them for every town in their patch.',
  milestone: 'Live in 5 weeks · paid back in 9',
  results: [
    { value: '4.2×', label: 'quote requests' },
    { value: '#1', label: 'for 14 local searches' },
    { value: '9 wk', label: 'to pay back the plan' },
  ],
  services: ['website-design', 'seo'] as readonly ServiceSlug[],
  readMinutes: 6,
  image: undefined as MediaImage | undefined,
  to: routes.caseStudy('hartley-and-sons'),
} as const

export function sectorLabel(id: SectorId): string {
  return sectors.find(sector => sector.id === id)!.label
}

export function isSector(value: unknown): value is SectorId {
  return sectors.some(sector => sector.id === value)
}
