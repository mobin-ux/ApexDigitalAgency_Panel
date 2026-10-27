import type { ServiceSlug } from './routes'

/** Page copy for /insights (`Insights.dc.html`). The articles are in `articles.ts`. */

export const insightsSeo = {
  title: 'Insights: straight answers on costs, timelines and agencies',
  description:
    'What websites, SEO, ads, software and branding cost in the UK, how long they take and what to ask any agency. Written by the people who do the work.',
} as const

export const insightsHero = {
  eyebrow: 'Insights',
  title: 'Straight answers before you spend a penny',
  lead: 'What things cost, how long they take and what to ask any agency, us included. Written by the people who do the work.',
  searchLabel: 'Search insights',
  searchPlaceholder: 'Search a question, e.g. how much does SEO cost',
  searchButton: 'Search',
  popularLabel: 'People ask:',
  /** Each chip fills the search box with `query` and clears the topic. */
  popular: [
    { label: 'Website cost', query: 'website cost' },
    { label: 'SEO timeline', query: 'seo' },
    { label: 'Google Ads budget', query: 'google ads' },
  ],
} as const

/** Shown on every article that has no page yet, in place of a link. */
export const comingSoon = 'Coming soon'

export const insightsFeatured = {
  read: 'Read the guide',
  /**
   * The design's "Most read this month" ranks articles by readership, which
   * nothing here measures. The panel lists the articles still to be written
   * instead, which is true, and disappears once they all are.
   */
  upcomingTitle: 'Coming soon',
  upcomingCount: 4,
} as const

export const insightsBrowse = {
  title: 'Browse by topic',
  allTopics: 'All topics',
  clear: 'Clear filters',
  empty: {
    title: 'We have not written that one yet',
    body: 'Send us the question. We will answer it by email within a working day, and it may become the next article.',
    button: 'Ask a question',
  },
  relatedService: 'Related service',
} as const

export interface CostAnswer {
  question: string
  /** The typical UK market range, as written. */
  market: string
  service: ServiceSlug
}

/**
 * "Quick answers": market ranges beside the Apex price, which is read from the
 * plan catalogue so it cannot drift from the service pages.
 *
 * TODO(content): the market ranges are the design's and need a source before
 * launch. The design called them "our 2026 quote research", but the only
 * research described anywhere is the website cost guide's, which covers
 * websites alone (and is itself unconfirmed), so the intro does not claim it.
 */
export const costAnswers = {
  eyebrow: 'Quick answers',
  title: 'The price questions, answered in one line',
  lead: 'Typical UK market ranges, next to what the same work costs with us per month.',
  compare: 'Compare all services',
  market: 'UK typical:',
  withApex: 'With Apex, from',
  quoted: { label: 'With Apex', value: 'Quoted' },
  items: [
    { question: 'How much is a small business website?', market: '£1,800–£6,000 up front', service: 'website-design' },
    { question: 'How much does local SEO cost?', market: '£300–£1,200 a month', service: 'seo' },
    { question: 'What does Google Ads management cost?', market: '10–20% of ad spend', service: 'ppc' },
    { question: 'How much is a logo and brand identity?', market: '£800–£5,000 up front', service: 'branding' },
    { question: 'How much does custom software cost?', market: '£15k–£80k per project', service: 'software-development' },
  ] satisfies CostAnswer[],
}

export const insightsCta = {
  eyebrow: 'Rather ask a person?',
  title: 'Get an answer for your business, not an average one',
  body: 'Fifteen minutes on a call and we will tell you what your project would cost, how long it would take and whether you need us at all.',
  button: 'Book a free call',
  checks: ['No pitch deck, no obligation', 'A monthly figure on the call', 'Reply within one working day'],
} as const
