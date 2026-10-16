import type { InstalmentPlan, PlanId, PlanTerm } from '../plans'
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

export interface PlanCard {
  id: PlanId
  /** Who the plan is for. */
  fit: string
  /** Heading over the feature list ("What you get", "Everything in Starter, plus"). */
  featuresHeading: string
  features: readonly string[]
  /** Badge shown on the emphasised (dark) card. */
  flag?: string
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

export interface ServicePageContent {
  slug: ServiceSlug
  seo: { title: string, description: string }

  hero: {
    badge: string
    title: string
    lead: string
    checks: readonly string[]
    primaryCta: string
    secondaryCta: string
  }
  /** The illustrative product window beside the hero copy. */
  visual: {
    url: string
    metricLabel: string
    metric: string
    toastTitle: string
    toastSub: string
    cardLabel: string
    cardValue: string
    cardUnit: string
    cardNote: string
  }
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
  }

  work: {
    title: string
    cases: readonly WorkCase[]
    callout?: { title: string, body: string, cta: string }
  }

  plans: {
    title: string
    intro: string
    catalogue: readonly InstalmentPlan[]
    cards: readonly PlanCard[]
    featured: PlanId
    termNotes: Record<PlanTerm, string>
    compare?: readonly CompareRow[]
    footnote: { title: string, body: string }
  }

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

  cta: { title: string, body: string }
}
