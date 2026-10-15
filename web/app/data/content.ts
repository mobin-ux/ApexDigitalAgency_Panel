import { routes } from './routes'

/**
 * Case studies and articles surfaced on the homepage.
 *
 * TODO(content): once the Insights / Our work pages exist these become
 * `@nuxt/content` collections and the homepage queries the latest entries;
 * the shapes below are the fields those collections need to carry.
 */

export interface MediaImage {
  src: string
  alt: string
  width: number
  height: number
}

export interface CaseStudyTeaser {
  slug: string
  sector: string
  location: string
  title: string
  summary?: string
  image?: MediaImage
}

export const featuredCaseStudy = {
  slug: 'hartley-and-sons',
  label: 'Case study · Trades, Kent',
  title: 'Hartley & Sons filled their diary six weeks after launch',
  summary:
    'A new website, local Search Engine Optimisation (SEO) and a modest paid budget, paid monthly across a year. The phone started ringing before the third instalment.',
  quote: '“We could never have paid for this in one go. Twelve payments made it a business decision instead of a gamble.”',
  quoteBy: 'Owner, Hartley & Sons',
  results: [
    { value: '+214%', label: 'Enquiries' },
    { value: '4.2×', label: 'Return on ad spend' },
    { value: '5 wks', label: 'To launch' },
  ],
  /** TODO(content): case study screenshot. */
  image: undefined as MediaImage | undefined,
  to: routes.caseStudy('hartley-and-sons'),
} as const

export const caseStudyTeasers: readonly (CaseStudyTeaser & { to: string })[] = [
  {
    slug: 'restaurant-group-bookings',
    sector: 'Hospitality',
    location: 'London',
    title: 'Bookings up 61% for a two-site restaurant group',
    to: routes.caseStudy('restaurant-group-bookings'),
  },
  {
    slug: 'client-portal-admin-hours',
    sector: 'Professional services',
    location: 'Kent',
    title: 'A client portal that removed 20 admin hours a week',
    to: routes.caseStudy('client-portal-admin-hours'),
  },
  {
    slug: 'retail-rebrand-rebuild',
    sector: 'Retail',
    location: 'Nationwide',
    title: 'Rebrand and store rebuild in eight weeks',
    to: routes.caseStudy('retail-rebrand-rebuild'),
  },
]

export interface ArticleTeaser {
  slug: string
  category: string
  readMinutes: number
  title: string
  excerpt: string
  /** ISO date, rendered as "March 2026". */
  published?: string
  image?: MediaImage
  to: string
}

export const leadArticle: ArticleTeaser = {
  slug: 'website-cost-uk-2026',
  category: 'Pricing',
  readMinutes: 8,
  title: 'How much should a small business website cost in the UK in 2026?',
  excerpt:
    'What sits behind a £900 site, a £4,000 site and a £15,000 site — and how to work out which one your business actually needs.',
  published: '2026-03-01',
  to: routes.article('website-cost-uk-2026'),
}

export const articleList: readonly ArticleTeaser[] = [
  {
    slug: 'local-seo-for-trades',
    category: 'SEO',
    readMinutes: 6,
    title: 'Local SEO for trades: the five things that actually move you up',
    excerpt: 'Most local rankings are won on three signals. The rest is noise.',
    to: routes.article('local-seo-for-trades'),
  },
  {
    slug: 'google-ads-500-budget',
    category: 'PPC',
    readMinutes: 5,
    title: 'Google Ads on a £500 monthly budget: what is realistic',
    excerpt: 'Where a small budget wins, and the two sectors where it will not.',
    to: routes.article('google-ads-500-budget'),
  },
  {
    slug: 'ai-search-answers',
    category: 'Strategy',
    readMinutes: 7,
    title: 'Getting your business quoted in AI search answers',
    excerpt: 'How buyers now research suppliers, and what to publish because of it.',
    to: routes.article('ai-search-answers'),
  },
  {
    slug: 'website-build-checklist',
    category: 'Websites',
    readMinutes: 4,
    title: 'Nine things to have ready before your website build starts',
    excerpt: 'The projects that launch on time all start the same way.',
    to: routes.article('website-build-checklist'),
  },
]
