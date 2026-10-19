import type { Article } from './articles'
import { articleBySlug, websiteCostGuide } from './articles'
import { caseStudyBySlug } from './case-studies'
import { routes } from './routes'

/**
 * Case studies and articles surfaced on the homepage.
 *
 * Articles come from the catalogue in `articles.ts`; the teasers below are
 * views of it, so a title or reading time cannot differ between pages.
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

/**
 * A study's page, or '' while it has none. TODO(content): these three teasers
 * are not in the case-study catalogue yet, so they render without a link
 * rather than leading to a 404.
 */
function studyLink(slug: string): string {
  return caseStudyBySlug(slug) ? routes.caseStudy(slug) : ''
}

export const caseStudyTeasers: readonly (CaseStudyTeaser & { to: string })[] = [
  {
    slug: 'restaurant-group-bookings',
    sector: 'Hospitality',
    location: 'London',
    title: 'Bookings up 61% for a two-site restaurant group',
    to: studyLink('restaurant-group-bookings'),
  },
  {
    slug: 'client-portal-admin-hours',
    sector: 'Professional services',
    location: 'Kent',
    title: 'A client portal that removed 20 admin hours a week',
    to: studyLink('client-portal-admin-hours'),
  },
  {
    slug: 'retail-rebrand-rebuild',
    sector: 'Retail',
    location: 'Nationwide',
    title: 'Rebrand and store rebuild in eight weeks',
    to: studyLink('retail-rebrand-rebuild'),
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

/** A catalogue article as the homepage lists it: its topic is the category label. */
function teaser(article: Article): ArticleTeaser {
  return {
    slug: article.slug,
    category: article.topic,
    readMinutes: article.readMinutes,
    title: article.title,
    excerpt: article.excerpt ?? '',
    published: article.published,
    image: article.body?.heroImage ?? article.image,
    to: routes.article(article.slug),
  }
}

export const leadArticle: ArticleTeaser = teaser(websiteCostGuide)

export const articleList: readonly ArticleTeaser[] = [
  'local-seo-for-trades',
  'google-ads-500-budget',
  'ai-search-answers',
  'website-build-checklist',
].flatMap((slug) => {
  const article = articleBySlug(slug)
  return article ? [teaser(article)] : []
})
