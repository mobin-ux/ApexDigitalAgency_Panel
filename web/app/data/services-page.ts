import type { ServiceSlug } from './routes'

/**
 * Copy for the /services page that is not part of a service record.
 * British spelling, sentence case, one emoji (the CTA eyebrow).
 */

export const servicesSeo = {
  /** The site name is appended by the title template. */
  title: 'Services: websites, SEO, PPC and software',
  description:
    'Seven services, each on an interest-free monthly plan. Pick what you want to change and see the work that fixes it, with the monthly price attached.',
} as const

export interface ServiceCombination {
  audience: string
  title: string
  services: readonly { slug: ServiceSlug, label: string }[]
  body: string
  /**
   * Combined monthly price in pounds over the standard 12-month term, or
   * `null` when the work is quoted on a call.
   * TODO(content): confirm these bundle figures with the business — they are
   * the design's, and are lower than the sum of the "from" prices.
   */
  monthly: number | null
  /** Rendered as the dark, emphasised card. */
  featured?: boolean
}

export const serviceCombinations: readonly ServiceCombination[] = [
  {
    audience: 'New business',
    title: 'Get open and get found',
    services: [
      { slug: 'branding', label: 'Branding' },
      { slug: 'website-design', label: 'Website Design' },
    ],
    body: 'Identity, then a site that looks like a real company from day one.',
    monthly: 239,
  },
  {
    audience: 'Most chosen',
    title: 'Fill the diary',
    services: [
      { slug: 'website-design', label: 'Website Design' },
      { slug: 'seo', label: 'Local SEO' },
      { slug: 'ppc', label: 'PPC' },
    ],
    body: 'Enquiries from paid ads in week one while search rankings build underneath.',
    monthly: 649,
    featured: true,
  },
  {
    audience: 'Established',
    title: 'Take the admin off your desk',
    services: [
      { slug: 'ui-ux-design', label: 'UI/UX Design' },
      { slug: 'software-development', label: 'Software Development' },
    ],
    body: 'A portal or internal tool designed around your process, then built.',
    monthly: null,
  },
]

/**
 * The three steps every order ends in. They describe the panel's real flow:
 * signup asks for a name, an email and a password (not a business name, which
 * the design's copy said), and the payment schedule is shown before signing.
 */
export const orderingSteps = [
  { title: 'Pick a plan', where: 'On the service page' },
  { title: 'Create your account', where: 'Your name and email' },
  { title: 'Confirm the schedule', where: 'In your dashboard' },
] as const
