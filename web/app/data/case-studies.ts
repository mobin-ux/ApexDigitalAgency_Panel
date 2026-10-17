import type { MediaImage } from './content'
import type { ServiceSlug } from './routes'
import { formatGbp } from '../utils/format'
import { defaultPlanTerm, websitePlans } from './plans'
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
  /** The written-up study. Without one, its page is a short summary kept out of search. */
  story?: CaseStudyStory
  /** Slugs for "Similar projects"; derived from sector and services when absent. */
  related?: readonly string[]
}

/** A figure in the results band: "Quote requests 7 → 29, per month …". */
export interface StoryResult {
  label: string
  before: string
  after: string
  note: string
}

export interface StoryStep {
  title: string
  /** When in the project it happened: "Week 1–2". */
  when: string
  body: string
}

/**
 * The full case study, from `Case Study.dc.html`. Four numbered chapters
 * (problem, work, outcome, services used) that the page's contents list
 * follows; the client and services facts come from the study itself.
 */
export interface CaseStudyStory {
  seo: { title: string, description: string }
  title: string
  lead: string
  /** Facts in the hero card beside Client and Services. */
  team: string
  timeline: string
  plan: string
  readMinutes: number
  heroImage?: MediaImage
  results: readonly StoryResult[]
  problem: {
    title: string
    body: string
    figures: readonly { value: string, label: string }[]
  }
  work: {
    title: string
    body: string
    steps: readonly StoryStep[]
    images: { wide?: MediaImage, narrow?: MediaImage }
  }
  outcome: {
    title: string
    body: string
    chart?: {
      title: string
      /** Index of the first month after launch; bars before it are drawn grey. */
      launchIndex: number
      points: readonly { month: string, value: number }[]
    }
    quote: { quote: string, name: string, role: string }
  }
  servicesUsed: {
    title: string
    /** What was delivered under each of the study's services. */
    delivered: Partial<Record<ServiceSlug, readonly string[]>>
  }
  cta: { eyebrow: string, title: string, body: string }
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

const hartleyPlan = websitePlans[0]

/**
 * Hartley & Sons, the one study written up in full (`Case Study.dc.html`).
 *
 * TODO(content): the design's own figures disagree with each other. The
 * results band says 29 quote requests a month "averaged over six months", but
 * the chart's last six months average 27; and the hero card names the plan
 * "Growth · £149/month" while Growth is £299 a month. The plan line is derived
 * from the £149 plan (Starter), which the page's two "From £149" prices also
 * quote. Confirm every figure with the client before launch.
 */
export const hartleyAndSons: CaseStudy = {
  slug: 'hartley-and-sons',
  client: 'Hartley & Sons Roofing',
  sector: 'trades',
  place: 'Maidstone, Kent',
  summary: 'A three-generation roofer relying on word of mouth. We rebuilt the site around a quote form and ranked them for every town in their patch.',
  result: { before: '7', after: '29', metric: 'quote requests a month' },
  services: ['website-design', 'seo'],
  related: ['ashby-electrical', 'stonebridge-builders', 'harbour-lettings'],
  story: {
    seo: {
      title: 'Hartley & Sons Roofing: 7 to 29 quote requests a month',
      description: 'How a Kent roofer went from word of mouth to 29 quote requests a month: a mobile-first site built around a quote form, and local SEO for 14 towns.',
    },
    title: 'From word of mouth to 29 quote requests a month',
    lead: 'Hartley & Sons have roofed Kent for three generations. Their work was good, but they were invisible online. We rebuilt the site around a quote form and ranked them in every town they cover.',
    team: '11 staff, family-owned',
    timeline: 'Live in 5 weeks',
    plan: `${hartleyPlan.name} · ${formatGbp(hartleyPlan.monthly[defaultPlanTerm])}/month`,
    readMinutes: 6,
    results: [
      { label: 'Quote requests', before: '7', after: '29', note: 'per month, averaged over six months' },
      { label: 'Local rankings', before: '0', after: '14', note: 'searches where they rank first' },
      { label: 'Mobile load time', before: '6.8s', after: '1.1s', note: 'on a mid-range phone over 4G' },
      { label: 'Payback', before: '—', after: '9 wk', note: 'until new jobs covered the plan' },
    ],
    problem: {
      title: 'Good work, a full diary in summer, and nothing in winter',
      body: 'Almost every job came from a past customer or a neighbour. That worked while the older generation ran the firm, but it left the diary empty from November to March. The old site was eight years old, did not work on phones and had no way to ask for a quote.',
      figures: [
        { value: '0', label: 'enquiries from the website in the previous year' },
        { value: '8 yrs', label: 'since the site was last updated' },
        { value: 'Page 4', label: 'on Google for “roofer Maidstone”' },
      ],
    },
    work: {
      title: 'A site built around one action, then found for every town they cover',
      body: 'We spent a morning on site with the team to learn how a job is quoted, then designed backwards from that conversation.',
      steps: [
        { title: 'A quote form that asks the right questions', when: 'Week 1–2', body: 'Roof type, the problem, a photo and a postcode. The team can now price most jobs before a site visit.' },
        { title: 'A fast, mobile-first rebuild', when: 'Week 2–4', body: 'Most visits come from a phone, often from someone standing under a leak. Every page loads in about a second.' },
        { title: 'A page for every town they cover', when: 'Week 4–5, then ongoing', body: 'Fourteen local pages with real projects from each area, plus a Google Business Profile we manage monthly.' },
      ],
      images: {},
    },
    outcome: {
      title: 'Winter stopped being the quiet season',
      body: 'Quote requests passed the old summer peak in the second month after launch and kept climbing through winter. The team hired a fourth crew in January.',
      chart: {
        title: 'Quote requests per month',
        launchIndex: 4,
        points: [
          { month: 'Mar', value: 6 },
          { month: 'Apr', value: 7 },
          { month: 'May', value: 5 },
          { month: 'Jun', value: 8 },
          { month: 'Jul', value: 14 },
          { month: 'Aug', value: 19 },
          { month: 'Sep', value: 22 },
          { month: 'Oct', value: 25 },
          { month: 'Nov', value: 27 },
          { month: 'Dec', value: 29 },
          { month: 'Jan', value: 31 },
          { month: 'Feb', value: 29 },
        ],
      },
      quote: {
        quote: '“We paid the first month and had more quote requests by the third week than in the whole of the previous quarter.”',
        name: 'Mark Hartley',
        role: 'Director, Hartley & Sons Roofing',
      },
    },
    servicesUsed: {
      title: 'Two services, one monthly payment',
      delivered: {
        'website-design': ['Mobile-first rebuild', 'Quote form with photo upload', 'Hosting and care included'],
        'seo': ['Fourteen local town pages', 'Google Business Profile management', 'Monthly ranking report'],
      },
    },
    cta: {
      eyebrow: 'Run a local business?',
      title: 'Get the same for your business',
      body: 'The same site and local SEO setup, adapted to your trade and your towns. Twelve monthly payments, no interest, and work starts the week you sign.',
    },
  },
}

/** Every study with a page, the featured one first. */
export const allCaseStudies: readonly CaseStudy[] = [hartleyAndSons, ...caseStudies]

export function caseStudyBySlug(slug: string): CaseStudy | undefined {
  return allCaseStudies.find(study => study.slug === slug)
}

/**
 * Three studies to read next: the study's own picks, otherwise the same
 * sector first, then the most services in common, most recent first.
 */
export function relatedStudies(study: CaseStudy, count = 3): CaseStudy[] {
  if (study.related?.length) {
    return study.related
      .map(slug => caseStudyBySlug(slug))
      .filter((item): item is CaseStudy => item !== undefined)
      .slice(0, count)
  }
  const shared = (other: CaseStudy) => other.services.filter(slug => study.services.includes(slug)).length
  const score = (other: CaseStudy) => (other.sector === study.sector ? 10 : 0) + shared(other)
  return allCaseStudies
    .filter(other => other.slug !== study.slug && score(other) > 0)
    .map((other, order) => ({ other, order }))
    .sort((a, b) => score(b.other) - score(a.other) || a.order - b.order)
    .slice(0, count)
    .map(({ other }) => other)
}

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
  slug: hartleyAndSons.slug,
  client: hartleyAndSons.client,
  sector: hartleyAndSons.sector,
  place: hartleyAndSons.place,
  summary: hartleyAndSons.summary,
  milestone: 'Live in 5 weeks · paid back in 9',
  results: [
    { value: '4.2×', label: 'quote requests' },
    { value: '#1', label: 'for 14 local searches' },
    { value: '9 wk', label: 'to pay back the plan' },
  ],
  services: hartleyAndSons.services,
  readMinutes: hartleyAndSons.story!.readMinutes,
  image: hartleyAndSons.image,
  to: routes.caseStudy(hartleyAndSons.slug),
} as const

export function sectorLabel(id: SectorId): string {
  return sectors.find(sector => sector.id === id)!.label
}

export function isSector(value: unknown): value is SectorId {
  return sectors.some(sector => sector.id === value)
}
