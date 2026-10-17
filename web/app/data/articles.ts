import type { MediaImage } from './content'
import type { ServiceSlug } from './routes'
import { formatGbp } from '../utils/format'
import { defaultPlanTerm, websitePlans } from './plans'

/**
 * Every Insights article, in one catalogue (`Article.dc.html`).
 *
 * An entry without a `body` is a teaser: it can be listed and linked to, but
 * has no page of its own yet (its URL is a 404 until the article is written).
 * Write the body and the article is prerendered, listed in the sitemap and
 * marked up as an Article.
 *
 * A body is a list of sections, each a heading and a list of typed blocks, so
 * a new article is a data file and never new markup.
 */

export interface ArticleAuthor {
  name: string
  role: string
  /** Shown under "Written by" at the end of the article. */
  bio: string
}

/** One answer-first figure in the summary box: "£1.8k–£6k" / "small business site, up front". */
export interface ArticleFigure {
  value: string
  label: string
}

export type ArticleBlock
  = | { kind: 'paragraph', text: string }
    /** A three-column table: a labelled row, then two values (the last right-aligned). */
    | {
      kind: 'table'
      caption: string
      columns: readonly [string, string, string]
      rows: readonly { label: string, detail?: string, values: readonly [string, string] }[]
    }
    | { kind: 'note', text: string }
    /** Ticked list; `lead` is the bold opening phrase. */
    | { kind: 'checklist', items: readonly { lead?: string, text: string }[] }
    /** Pairs of a cost and its figure, two to a row. */
    | { kind: 'costs', items: readonly { label: string, value: string }[] }
    | { kind: 'quote', text: string, by: string }
    /** A card offering the article's related service; its price comes from the plan catalogue. */
    | { kind: 'service-cta', title: string, points: readonly string[], button: string }

export interface ArticleSection {
  /** Anchor and scroll-spy id. */
  id: string
  /** Short label for the contents list. */
  label: string
  title: string
  blocks: readonly ArticleBlock[]
}

export interface ArticleBody {
  seo: { title: string, description: string }
  lead: string
  author: ArticleAuthor
  heroImage?: MediaImage
  /** The answer-first box at the top: what an answer engine should quote. */
  summary: { label: string, answer: string, figures: readonly ArticleFigure[] }
  sections: readonly ArticleSection[]
  faq: { label: string, title: string, items: readonly { question: string, answer: string }[] }
  method?: { title: string, body: string }
  /** The service the article sells: side card, inline card and closing panel. */
  service: ServiceSlug
  cta: { title: string, body: string }
  /** Slugs shown under "Keep reading". */
  related: readonly string[]
}

export interface Article {
  slug: string
  /** Subject area: the breadcrumb and the homepage's category label ("Websites", "SEO"). */
  topic: string
  /** Format chip, when it has one ("Cost guide", "Checklist"). Cards fall back to the topic. */
  format?: string
  title: string
  excerpt?: string
  readMinutes: number
  /** ISO dates. */
  published?: string
  updated?: string
  image?: MediaImage
  body?: ArticleBody
}

const webFrom = formatGbp(Math.min(...websitePlans.map(plan => plan.monthly[defaultPlanTerm])))

/**
 * TODO(content): this article is the design's copy and must be checked before
 * launch, because it presents research as fact:
 * - The "120 quotes from 64 agencies and 56 freelancers" survey and every
 *   figure drawn from it must be real, or the figures and the method note must
 *   go (a fabricated survey on a commercial page is a misleading claim).
 * - James Cole, his role and "more than 200 builds" must be a real, consenting
 *   member of staff; the byline is also in the Article markup.
 * - The ownership answer ("transfers once the final payment clears") conflicts
 *   with the Website Design page, which says the client owns everything.
 * - The table's monthly column reads as market maths (low price ÷ 12), except
 *   "from £149/mo", which is also Apex's Starter price. Confirm which it is.
 */
export const websiteCostGuide: Article = {
  slug: 'website-cost-uk-2026',
  topic: 'Websites',
  format: 'Cost guide',
  title: 'How much does a website cost in the UK in 2026?',
  excerpt: 'What sits behind a £900 site, a £4,000 site and a £15,000 site — and how to work out which one your business actually needs.',
  readMinutes: 9,
  published: '2026-03-01',
  updated: '2026-09-14',
  body: {
    seo: {
      title: 'How much does a website cost in the UK in 2026?',
      description: 'Real UK website prices from 120 agency and freelancer quotes, what pushes a price up, the costs that are easy to miss, and when paying monthly makes sense.',
    },
    lead: 'Real prices from 120 agency and freelancer quotes, what pushes a price up, and when paying monthly makes more sense than paying up front.',
    author: {
      name: 'James Cole',
      role: 'Head of Web',
      bio: 'James has led more than 200 website builds for UK small businesses and reviews every quote Apex sends before it goes out.',
    },
    summary: {
      label: 'The short answer',
      answer: 'A small business website in the UK typically costs £1,800 to £6,000 up front in 2026, or £100 to £250 a month on a payment plan. E-commerce sites start around £4,000.',
      figures: [
        { value: '£1.8k–£6k', label: 'small business site, up front' },
        { value: '£100–£250', label: 'a month on a 12-month plan' },
        { value: '4–6 weeks', label: 'typical time to launch' },
      ],
    },
    sections: [
      {
        id: 'prices',
        label: 'Typical prices',
        title: 'Typical prices by type of site',
        blocks: [
          { kind: 'paragraph', text: 'We collected 120 quotes from UK agencies and freelancers between January and August 2026. The ranges below cover the middle 80% of quotes, so the cheapest and most expensive outliers are left out.' },
          {
            kind: 'table',
            caption: 'Typical UK website prices in 2026, by type of site',
            columns: ['Type of site', 'Typical UK price', 'Monthly'],
            rows: [
              { label: 'Starter site', detail: '1–5 pages, one template', values: ['£800–£2,000', 'from £79/mo'] },
              { label: 'Small business site', detail: '5–10 pages, custom design', values: ['£1,800–£6,000', 'from £149/mo'] },
              { label: 'E-commerce shop', detail: 'Up to 100 products', values: ['£4,000–£12,000', 'from £349/mo'] },
              { label: 'Booking or membership site', detail: 'Accounts, payments, calendar', values: ['£6,000–£18,000', 'from £499/mo'] },
              { label: 'Bespoke web app', detail: 'Custom features and data', values: ['£15,000+', 'Quoted'] },
            ],
          },
          { kind: 'note', text: 'Monthly figures assume a 12-month plan with no interest. Prices exclude VAT.' },
        ],
      },
      {
        id: 'factors',
        label: 'What pushes the price up',
        title: 'What pushes the price up',
        blocks: [
          { kind: 'paragraph', text: 'Most of the difference between a £2,000 quote and a £6,000 quote comes down to five things. If two quotes look far apart, check which of these each one includes.' },
          {
            kind: 'checklist',
            items: [
              { lead: 'Number of unique page designs.', text: 'A five-page site with one template costs far less than five individually designed pages.' },
              { lead: 'Copywriting.', text: 'Writing the words yourself saves £400 to £1,200, but it is the part most owners underestimate.' },
              { lead: 'Integrations.', text: 'Booking systems, CRMs and payment providers each add a day or more of work.' },
              { lead: 'Content migration.', text: 'Moving 200 blog posts from an old site is slow, careful work.' },
              { lead: 'Ongoing care.', text: 'Hosting, updates and backups are sometimes bundled and sometimes billed separately.' },
            ],
          },
        ],
      },
      {
        id: 'hidden',
        label: 'Costs that are easy to miss',
        title: 'Costs that are easy to miss',
        blocks: [
          { kind: 'paragraph', text: 'The build is usually the largest single cost, but it is not the only one. Budget for these in the first year.' },
          {
            kind: 'costs',
            items: [
              { label: 'Domain name', value: '£10–£20 a year' },
              { label: 'Hosting', value: '£120–£600 a year' },
              { label: 'Care and updates', value: '£300–£1,200 a year' },
              { label: 'Photography', value: '£300–£900 once' },
            ],
          },
        ],
      },
      {
        id: 'monthly',
        label: 'Up front or monthly',
        title: 'Paying up front or paying monthly',
        blocks: [
          { kind: 'paragraph', text: 'Paying up front is usually cheaper overall. Paying monthly spreads the cost so the site can start earning before it is paid for, and most plans include hosting and care. Monthly plans make most sense when cash flow matters more than the total.' },
          { kind: 'quote', text: 'The question is not what the site costs. It is how many new customers it takes to pay for itself.', by: 'James Cole, Head of Web' },
          { kind: 'service-cta', title: 'See what your site would cost per month', points: ['No interest', 'Hosting included'], button: 'See the plans' },
        ],
      },
      {
        id: 'questions',
        label: 'Questions to ask',
        title: 'Questions to ask before you sign',
        blocks: [
          { kind: 'paragraph', text: 'Whoever you choose, get clear answers to these in writing. A good agency or freelancer will not mind being asked.' },
          {
            kind: 'checklist',
            items: [
              { text: 'Who owns the site and the domain if we part ways?' },
              { text: 'What is included in the price, and what is billed separately?' },
              { text: 'How many rounds of changes are included at each stage?' },
              { text: 'Who will actually build it, and can I speak to them?' },
              { text: 'What happens if the site breaks after launch?' },
            ],
          },
        ],
      },
    ],
    faq: {
      label: 'FAQ',
      title: 'Frequently asked questions',
      items: [
        { question: 'Can I build a website myself for less?', answer: 'Yes. Site builders cost £15 to £40 a month. They suit simple sites well, but most owners find the time cost higher than expected, and they rarely rank well for local searches.' },
        { question: 'How long does a small business website take?', answer: 'Four to six weeks for a typical five to ten page site, assuming content and feedback arrive on time. E-commerce sites usually take six to ten weeks.' },
        { question: 'Is a monthly plan more expensive overall?', answer: 'Sometimes slightly, because hosting and care are included. Compare the twelve-month total with an up-front quote plus a year of hosting and maintenance.' },
        { question: 'Do I own the website on a monthly plan?', answer: 'With Apex, yes. Ownership transfers once the final payment clears. Always check this in writing with any provider.' },
      ],
    },
    method: {
      title: 'How we got these numbers',
      body: '120 written quotes from 64 UK agencies and 56 freelancers, requested January to August 2026 using the same five-page brief. Figures exclude VAT and are reviewed every six months.',
    },
    service: 'website-design',
    cta: {
      title: `A site that pays for itself, from ${webFrom} a month`,
      body: 'Everything in this guide, handled for you. Design, build, hosting and care on one monthly plan.',
    },
    related: ['questions-before-hiring-web-agency', 'how-long-does-seo-take', 'logo-brand-identity-cost'],
  },
}

/** Articles listed before they are written: the homepage list and the design's "Keep reading". */
const teasers: readonly Article[] = [
  {
    slug: 'local-seo-for-trades',
    topic: 'SEO',
    readMinutes: 6,
    title: 'Local SEO for trades: the five things that actually move you up',
    excerpt: 'Most local rankings are won on three signals. The rest is noise.',
  },
  {
    slug: 'google-ads-500-budget',
    topic: 'PPC',
    readMinutes: 5,
    title: 'Google Ads on a £500 monthly budget: what is realistic',
    excerpt: 'Where a small budget wins, and the two sectors where it will not.',
  },
  {
    slug: 'ai-search-answers',
    topic: 'Strategy',
    readMinutes: 7,
    title: 'Getting your business quoted in AI search answers',
    excerpt: 'How buyers now research suppliers, and what to publish because of it.',
  },
  {
    slug: 'website-build-checklist',
    topic: 'Websites',
    readMinutes: 4,
    title: 'Nine things to have ready before your website build starts',
    excerpt: 'The projects that launch on time all start the same way.',
  },
  {
    slug: 'questions-before-hiring-web-agency',
    topic: 'Websites',
    format: 'Checklist',
    readMinutes: 5,
    title: 'Twelve questions to ask before you hire a web agency',
  },
  {
    slug: 'how-long-does-seo-take',
    topic: 'SEO',
    format: 'Guide',
    readMinutes: 7,
    title: 'How long does SEO take to work for a local business?',
  },
  {
    slug: 'logo-brand-identity-cost',
    topic: 'Branding',
    format: 'Cost guide',
    readMinutes: 6,
    title: 'How much does a logo and brand identity cost?',
  },
]

export const articles: readonly Article[] = [websiteCostGuide, ...teasers]

/** Articles with a written body: the ones that have a page. */
export const publishedArticles = articles.filter(article => article.body)

export function articleBySlug(slug: string): Article | undefined {
  return articles.find(article => article.slug === slug)
}

/** The body's own picks, in order, skipping any slug not in the catalogue. */
export function relatedArticles(article: Article): Article[] {
  return (article.body?.related ?? [])
    .map(articleBySlug)
    .filter((entry): entry is Article => Boolean(entry))
}
