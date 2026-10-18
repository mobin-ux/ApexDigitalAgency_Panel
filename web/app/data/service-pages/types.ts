import type { InstalmentPlan, MonthlyPlan, PlanId, PlanTerm } from '../plans'
import type { ServiceSlug } from '../routes'

/**
 * The shape of one service page. Every section of `/services/[slug]` renders
 * from these fields, so a new service is a new content file, not new markup.
 * Optional blocks (industries, comparison table, …) render only when present.
 */

export interface Stat {
  value: string
  label: string
}

/** A technology badge. `icon` is a Simple Icons slug baked into the local sprite. */
export interface TechMark {
  name: string
  icon?: string
  /** Shown in violet: what we most often recommend. */
  recommended?: boolean
}

export type IndustryIcon
  = | 'wrench' | 'home' | 'heart-pulse' | 'briefcase' | 'shopping-bag' | 'utensils' | 'dumbbell'
    | 'graduation-cap' | 'car' | 'factory' | 'code' | 'users' | 'camera' | 'sprout'

export type WorkThumb = 'lead' | 'booking' | 'shop' | 'portal' | 'calendar' | 'rebuild'

export interface WorkCase {
  slug: string
  sector: string
  title: string
  results: readonly [Stat, Stat]
  stack: string
  thumb: WorkThumb
  tint: 'violet' | 'periwinkle' | 'lilac'
}

/** The words on a plan card; prices come from the plan catalogue. */
export interface PlanCopy {
  /** Who the plan is for. */
  fit: string
  /** Heading over the feature list ("What you get", "Everything in Starter, plus"). */
  featuresHeading: string
  features: readonly string[]
  /** Badge shown on the emphasised (dark) card. */
  flag?: string
}

export interface PlanCard extends PlanCopy {
  id: PlanId
}

/** A plan card ready to render: copy plus the figures and link worked out for it. */
export interface PlanCardView extends PlanCopy {
  id: string
  name: string
  featured: boolean
  /** "£299". */
  price: string
  /** Optional line under the price ("£499 deposit, then 12 × £299"). */
  detail?: string
  /** The pill under the price: the total, or the billing terms. */
  chip: string
  order: { to: string } | { href: string }
  /** Read after "Start your order" by screen readers, naming the plan. */
  orderContext: string
}

/** One row of the comparison table: a value per plan, `true` = included, `false` = not. */
export interface CompareRow {
  label: string
  values: Record<PlanId, string | boolean>
}

export interface Quote {
  quote: string
  name: string
  role: string
}

/**
 * Where a call to action goes: the plans or work section on the page, the
 * contact form (with the service named), or the panel's New Order wizard.
 */
export type CtaTarget = 'plans' | 'work' | 'contact' | 'order'

export interface CtaLink {
  label: string
  target: CtaTarget
}

/**
 * The decorative composition beside the hero. `kind` picks the drawing; the
 * labels here are the parts of it that differ per service.
 */
export interface HeroVisual {
  kind: 'site' | 'search' | 'ads' | 'marketing' | 'software' | 'ux' | 'brand'
  url: string
  metricLabel: string
  metric: string
  toastTitle: string
  toastSub: string
  /** The floating card; drawn by the `site` and `ads` kinds. */
  card?: { label: string, value: string, unit: string, note: string, change?: string }
}

interface PlansCommon {
  title: string
  intro: string
  footnote: { title: string, body: string }
}

/**
 * Three ways a service is priced: instalment plans with a 12 / 6-month switch
 * (website design), one monthly figure per plan (retainers and short
 * instalment plans), or a scoping call then a quote (software).
 */
export type ServicePlans
  = | (PlansCommon & {
    kind: 'terms'
    catalogue: readonly InstalmentPlan[]
    cards: readonly PlanCard[]
    featured: PlanId
    termNotes: Record<PlanTerm, string>
    compare?: readonly CompareRow[]
  })
  | (PlansCommon & {
    kind: 'monthly'
    items: readonly (MonthlyPlan & PlanCopy)[]
    featured: string
  })
  | (PlansCommon & {
    kind: 'scoping'
    /** `price` is in pounds; 0 reads "Free" and `null` reads "Quoted". */
    steps: readonly { name: string, price: number | null, note: string, detail: string }[]
  })

export interface ServicePageContent {
  slug: ServiceSlug
  seo: { title: string, description: string }

  hero: {
    badge: string
    title: string
    lead: string
    checks: readonly string[]
    primary: CtaLink
    secondary: CtaLink
  }
  visual: HeroVisual
  stats: readonly Stat[]

  audiences: {
    title: string
    intro: string
    cards: readonly { tag: string, title: string, body: string, foot: string }[]
  }

  offering: {
    eyebrow: string
    title: string
    intro: string
    /**
     * Full top padding. Website Design's own design spaces this section from
     * the audiences above; `ServicePage.dc.html` runs it straight on from them.
     */
    spaced?: boolean
    rows: readonly { title: string, detail: string, time: string }[]
    industries?: {
      title: string
      note: string
      items: readonly { glyph: IndustryIcon, name: string, examples: string }[]
      cta: { lead: string, link: string, tail: string }
    }
  }

  technology: {
    eyebrow: string
    title: string
    intro: string
    checks: readonly string[]
    legend?: string
    groups: readonly { title: string, summary: string, marks: readonly TechMark[], wide?: boolean }[]
    extras?: { title: string, body: string, marks: readonly TechMark[], cta: string }
  }

  process: {
    title: string
    intro: string
    steps: readonly { when: string, title: string, body: string, you: string }[]
    note: string
    /** Draw the last step as done (a tick) rather than numbered. */
    tickLastStep?: boolean
  }

  work: {
    title: string
    cases: readonly WorkCase[]
    callout?: { title: string, body: string, cta: string }
  }

  plans: ServicePlans

  proof: {
    caseStudySlug: string
    title: string
    body: string
    quote: string
    quoteBy: string
    stats: readonly Stat[]
  }

  voices: {
    title: string
    intro: string
    quotes: readonly Quote[]
    promises?: readonly { title: string, body: string }[]
  }

  faq: {
    title: string
    items: readonly { question: string, answer: string }[]
  }

  cta: { title: string, body: string, primary: CtaLink }
}
