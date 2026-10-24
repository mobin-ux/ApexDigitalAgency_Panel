/**
 * Panel v2 service catalogue and pricing (ADR-019).
 *
 * Imported by BOTH halves of the app, like `permissions.ts`: the New order
 * wizard renders its cards, schedule and summary with `orderTerms()`, and
 * `POST /api/orders` prices the order with the very same function. The figure
 * on the card and the figure on the contract therefore cannot disagree — the
 * Phase 3 bug that put £113 on a card beside £200 in the rail.
 *
 * Three ways to pay, matching the website's v2 plans:
 *   fixed     a deposit at kickoff, then N equal monthly payments (or the same
 *             total in one payment at kickoff). No interest.
 *   retainer  set-up fee (if any) and the first month at kickoff, then monthly
 *             for a minimum term, then rolling with 30 days' notice.
 *   scope     software: a free scoping call, or fixed-price discovery that is
 *             paid when discovery starts. The build is quoted afterwards.
 *
 * Figures include VAT. The admin catalogue screen can override prices and
 * copy (Setting `catalog.v2`); ids and kinds are what orders are keyed on.
 */

export type ServiceId = 'web' | 'soft' | 'mkt' | 'seo' | 'ppc' | 'uiux' | 'brand'
export type PlanKind = 'fixed' | 'retainer' | 'scope'
export type PayMode = 'monthly' | 'full'

export interface CatalogPlan {
  id: string
  name: string
  summary: string
  features: string[]
  featured?: boolean
  /** Badge on the featured card. Defaults to "Most chosen". */
  flag?: string
  /** fixed + retainer: the monthly payment. */
  monthly?: number
  /** fixed: paid at kickoff, before the monthly payments. */
  deposit?: number
  /** fixed: overrides the service's payment count (Brand + Web runs twelve). */
  payments?: number
  /** retainer: one-off set-up fee taken with the first month. */
  setup?: number
  /** scope: the fixed price; 0 is free. */
  price?: number
  /** scope: the short line under the price ("45 minutes"). */
  note?: string
}

export interface CatalogService {
  id: ServiceId
  /** The website's URL slug, so `?service=website-design` deep links work. */
  slug: string
  name: string
  line: string
  kind: PlanKind
  /** fixed: number of monthly payments after the deposit. */
  payments?: number
  /** retainer: minimum term in months. */
  minimumMonths?: number
  heading: string
  sub: string
  foot: string
  plans: CatalogPlan[]
}

export interface Catalog {
  version: 2
  services: CatalogService[]
}

export const DEFAULT_CATALOG: Catalog = {
  version: 2,
  services: [
    {
      id: 'web',
      slug: 'website-design',
      name: 'Website Design',
      line: 'A site built to win enquiries.',
      kind: 'fixed',
      payments: 12,
      heading: 'Choose a website plan',
      sub: 'Design, build and hosting included. You own the code from day one.',
      foot: 'Twelve monthly payments after a deposit. Pay in full at kickoff if you prefer, for the same total.',
      plans: [
        { id: 'starter', name: 'Starter', summary: 'A professional site to start winning enquiries.', monthly: 149, deposit: 299, features: ['Up to 12 pages', 'Mobile-first build', 'Hosting and SSL included', 'Search Engine Optimisation (SEO) foundations'] },
        { id: 'growth', name: 'Growth', summary: 'A larger site built to turn visitors into enquiries.', monthly: 299, deposit: 499, featured: true, features: ['Everything in Starter', 'Custom design for every page', 'Lead-capture forms and call tracking', 'Blog and case-study templates'] },
        { id: 'complete', name: 'Complete', summary: 'Site, copy and integrations in one build.', monthly: 499, deposit: 799, features: ['Everything in Growth', 'Copywriting included', 'Booking or shop integration', 'CRM integration'] },
      ],
    },
    {
      id: 'soft',
      slug: 'software',
      name: 'Software Development',
      line: 'Web apps, portals and internal tools.',
      kind: 'scope',
      heading: 'Every build starts with a call',
      sub: 'Software is too varied for a price list. Start with a free call or go straight to a fixed-price discovery.',
      foot: 'Builds are paid in equal monthly instalments across the project, with no interest. Typical projects are £18k to £60k.',
      plans: [
        { id: 'call', name: 'Scoping call', summary: 'The problem, the people who use it, and a rough range for the build.', price: 0, note: '45 minutes', features: ['Video call with a developer', 'Rough cost range', 'Honest view on fit'] },
        { id: 'discovery', name: 'Discovery', summary: 'Workshops, a clickable prototype, a written spec and a fixed quote.', price: 2400, note: 'Fixed · 2 weeks', featured: true, flag: 'Recommended', features: ['Two workshops', 'Clickable prototype', 'Written specification', 'Fixed quote for the build'] },
      ],
    },
    {
      id: 'mkt',
      slug: 'digital-marketing',
      name: 'Digital Marketing',
      line: 'One team on your channels, reporting on enquiries.',
      kind: 'retainer',
      minimumMonths: 3,
      heading: 'Choose a retainer',
      sub: 'Three-month minimum, then rolling monthly with thirty days’ notice.',
      foot: 'Ad spend, where used, is paid directly to the platform from your card.',
      plans: [
        { id: 'essentials', name: 'Essentials', summary: 'Two channels for businesses without a marketer.', monthly: 399, features: ['Two channels managed', '12 social posts a month', 'One email campaign a month', 'Monthly report'] },
        { id: 'growth', name: 'Growth', summary: 'Four channels and a named marketer.', monthly: 899, featured: true, features: ['Four channels managed', 'Two articles a month', 'Paid social management', 'Fortnightly call'] },
        { id: 'partner', name: 'Partner', summary: 'Working alongside an in-house team.', monthly: 1499, features: ['All channels available', 'Short-form video each month', 'Quarterly campaign launch', 'Dedicated account manager'] },
      ],
    },
    {
      id: 'seo',
      slug: 'seo',
      name: 'Search Engine Optimisation',
      line: 'Get found for what your customers type.',
      kind: 'retainer',
      minimumMonths: 6,
      heading: 'Choose an SEO plan',
      sub: 'Six-month minimum, then rolling monthly with thirty days’ notice. No set-up fee.',
      foot: 'Search results take time to respond. Six months is the shortest period in which we can show a measurable change.',
      plans: [
        { id: 'local', name: 'Local', summary: 'Businesses serving one town or area.', monthly: 349, features: ['Technical audit and fixes', 'Google Business Profile management', 'Two local pages a month', 'Monthly enquiry report'] },
        { id: 'growth', name: 'Growth', summary: 'Businesses competing regionally or nationally.', monthly: 699, featured: true, features: ['Everything in Local', 'Four content pieces a month', 'Digital PR and link building', 'Quarterly strategy review'] },
        { id: 'commerce', name: 'Commerce', summary: 'Online shops with large catalogues.', monthly: 999, features: ['Everything in Growth', 'Category and product optimisation', 'Product feed and schema', 'Dedicated account manager'] },
      ],
    },
    {
      id: 'ppc',
      slug: 'ppc',
      name: 'Pay-Per-Click Advertising',
      line: 'Enquiries from week one while SEO builds.',
      kind: 'retainer',
      minimumMonths: 3,
      heading: 'Choose a management plan',
      sub: 'A flat monthly fee for management. Ad spend is separate and paid straight to the platform.',
      foot: 'We never mark up or hold your ad budget. Three-month minimum, then thirty days’ notice.',
      plans: [
        { id: 'search', name: 'Search', summary: 'One channel, for urgent local demand.', monthly: 299, setup: 199, features: ['Google Search campaigns', 'One landing page', 'Call and form tracking', 'Monthly lead report'] },
        { id: 'multi', name: 'Multi-channel', summary: 'Search plus social for considered purchases.', monthly: 549, setup: 299, featured: true, features: ['Everything in Search', 'Meta or Performance Max', 'Remarketing across channels', 'Two landing pages'] },
        { id: 'b2b', name: 'B2B', summary: 'LinkedIn-led campaigns for longer sales cycles.', monthly: 749, setup: 399, features: ['Everything in Multi-channel', 'LinkedIn lead-gen campaigns', 'CRM integration', 'Dedicated account manager'] },
      ],
    },
    {
      id: 'uiux',
      slug: 'uiux',
      name: 'UI/UX Design',
      line: 'Research, flows and prototypes before any code.',
      kind: 'fixed',
      payments: 6,
      heading: 'Choose a design plan',
      sub: 'Priced per project and spread over six monthly payments.',
      foot: 'Credited in full if we go on to build it for you.',
      plans: [
        { id: 'review', name: 'Review', summary: 'A UX audit and fix list for an existing site.', monthly: 249, deposit: 199, features: ['Analytics and recording review', 'Ranked problem list', 'Wireframes for top three fixes', 'One round of user testing'] },
        { id: 'redesign', name: 'Redesign', summary: 'One key journey redesigned and tested.', monthly: 499, deposit: 399, featured: true, features: ['Everything in Review', 'User interviews', 'Clickable prototype', 'Developer handover'] },
        { id: 'product', name: 'Product', summary: 'A new product designed end to end.', monthly: 899, deposit: 699, features: ['Everything in Redesign', 'Up to 30 screens', 'Two rounds of testing', 'Starter design system'] },
      ],
    },
    {
      id: 'brand',
      slug: 'branding',
      name: 'Branding & Graphic Design',
      line: 'Identity and collateral for businesses starting out.',
      kind: 'fixed',
      payments: 6,
      heading: 'Choose a branding plan',
      sub: 'A small deposit, then equal monthly payments. Full copyright and source files on every plan.',
      foot: 'Your branding fee is credited against a Website Design plan if you add one within six months.',
      plans: [
        { id: 'starter', name: 'Starter', summary: 'A logo and essentials to start trading.', monthly: 129, deposit: 149, features: ['Two logo directions', 'Colour and type palette', 'Business card design', 'All file formats'] },
        { id: 'identity', name: 'Identity', summary: 'A complete brand for established businesses.', monthly: 249, deposit: 249, featured: true, features: ['Three logo directions', 'Brand guidelines', 'Full stationery set', 'Social media templates'] },
        { id: 'brandweb', name: 'Brand + Web', summary: 'Identity and a website built on it.', monthly: 239, deposit: 399, payments: 12, features: ['Everything in Identity', 'Five-page website', 'Hosting and maintenance', 'Launch in about 6 weeks'] },
      ],
    },
  ],
}

/** Display order of the New order service grid. */
export const SERVICE_ORDER: ServiceId[] = ['web', 'soft', 'mkt', 'seo', 'ppc', 'uiux', 'brand']

/** Accepts both the website's slugs and the panel's older aliases. */
export const SERVICE_ALIASES: Record<string, ServiceId> = {
  'website-design': 'web',
  'web': 'web',
  'development': 'web',
  'dev': 'web',
  'software': 'soft',
  'soft': 'soft',
  'digital-marketing': 'mkt',
  'marketing': 'mkt',
  'mkt': 'mkt',
  'seo': 'seo',
  'ppc': 'ppc',
  'uiux': 'uiux',
  'design': 'uiux',
  'branding': 'brand',
  'brand': 'brand',
}

export interface OrderTerms {
  kind: PlanKind
  /** Collected when work starts. 0 for a free scoping call. */
  kickoff: number
  /** The recurring monthly payment after kickoff; 0 when there is none. */
  monthly: number
  /** Monthly payments after kickoff that the plan commits to. */
  payments: number
  /** fixed: total, all in. retainer: the minimum-term total. scope: the fixed price. */
  total: number
  deposit: number
  setup: number
  minimumMonths: number
  /** The part paid in instalments, i.e. what is drawn against Apex credit. */
  financed: number
}

export function findService(catalog: Catalog, id: string | null | undefined): CatalogService | undefined {
  if (!id) {
    return undefined
  }
  const key = SERVICE_ALIASES[id] ?? id
  return catalog.services.find(s => s.id === key)
}

export function findPlan(service: CatalogService | undefined, planId: string | null | undefined): CatalogPlan | undefined {
  return service?.plans.find(p => p.id === planId)
}

export function featuredPlan(service: CatalogService): CatalogPlan {
  return service.plans.find(p => p.featured) ?? service.plans[0]!
}

export function paymentCount(service: CatalogService, plan: CatalogPlan): number {
  return plan.payments ?? service.payments ?? 12
}

/** Price an order. `pay` only matters for fixed plans. */
export function orderTerms(service: CatalogService, plan: CatalogPlan, pay: PayMode = 'monthly'): OrderTerms {
  if (service.kind === 'fixed') {
    const n = paymentCount(service, plan)
    const deposit = plan.deposit ?? 0
    const monthly = plan.monthly ?? 0
    const total = deposit + n * monthly
    if (pay === 'full') {
      return { kind: 'fixed', kickoff: total, monthly: 0, payments: 0, total, deposit: 0, setup: 0, minimumMonths: 0, financed: 0 }
    }
    return { kind: 'fixed', kickoff: deposit, monthly, payments: n, total, deposit, setup: 0, minimumMonths: 0, financed: n * monthly }
  }
  if (service.kind === 'retainer') {
    const min = service.minimumMonths ?? 1
    const monthly = plan.monthly ?? 0
    const setup = plan.setup ?? 0
    return { kind: 'retainer', kickoff: setup + monthly, monthly, payments: Math.max(0, min - 1), total: setup + monthly * min, deposit: 0, setup, minimumMonths: min, financed: 0 }
  }
  const price = plan.price ?? 0
  return { kind: 'scope', kickoff: price, monthly: 0, payments: 0, total: price, deposit: 0, setup: 0, minimumMonths: 0, financed: 0 }
}

/** The cheapest monthly figure a service is sold from (dashboard and wizard cards). */
export function fromMonthly(service: CatalogService): number | null {
  const monthlies = service.plans.map(p => p.monthly).filter((m): m is number => typeof m === 'number' && m > 0)
  return monthlies.length ? Math.min(...monthlies) : null
}

/**
 * First instalment date for a plan whose kickoff is collected on `from`: the
 * 1st of the next month, or of the month after when that is under two weeks
 * away, so nobody pays a deposit and an instalment a few days apart.
 */
export function firstPaymentDate(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth() + 1, 1)
  if (d.getTime() - from.getTime() < 14 * 24 * 60 * 60 * 1000) {
    d.setMonth(d.getMonth() + 1)
  }
  return d
}

/** Merge a stored override over the defaults, ignoring anything not v2-shaped. */
export function resolveCatalog(stored: unknown): Catalog {
  const s = stored as Partial<Catalog> | null | undefined
  if (s && s.version === 2 && Array.isArray(s.services) && s.services.length > 0) {
    return { version: 2, services: s.services as CatalogService[] }
  }
  return DEFAULT_CATALOG
}
