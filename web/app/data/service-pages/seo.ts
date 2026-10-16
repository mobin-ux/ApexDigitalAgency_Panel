import type { ServicePageContent } from './types'
import { seoPlans } from '../plans'
import { examplesCallout, faqTitle, monthly, promises, technologyLegend, usually, voicesHeading } from './shared'

/** /services/seo — copy from `ServicePage.dc.html` + `service-data.js` (`seo`). */

const [local, growth, commerce] = seoPlans
const from = monthly(local)

export const seoPage: ServicePageContent = {
  slug: 'seo',
  seo: {
    title: `SEO services from ${from} a month`,
    description: `Local and national Search Engine Optimisation for UK businesses, reported on enquiries rather than rankings alone. From ${from} a month, no long-term lock-in.`,
  },

  hero: {
    badge: 'Highest organic intent',
    title: 'Get found for what your customers type',
    lead: `Local and national Search Engine Optimisation (SEO) for UK businesses, reported on enquiries rather than rankings alone. From ${from} a month.`,
    checks: [
      'Technical audit and fixes in the first month',
      'Content written for the questions buyers ask',
      'Monthly report on calls, forms and revenue',
    ],
    primary: { label: 'See the plans', target: 'plans' },
    secondary: { label: 'Get a free audit', target: 'contact' },
  },
  visual: {
    kind: 'search',
    url: 'google.co.uk/search',
    metricLabel: 'Organic visits this month',
    metric: '3,412',
    toastTitle: 'Now ranking #2',
    toastSub: '“electrician maidstone” · today',
  },
  stats: [
    { value: '3–6', label: 'months to compound' },
    { value: from, label: 'per month, from' },
    { value: '74', label: 'clients ranking top three' },
    { value: '0', label: 'long-term lock-in' },
  ],

  audiences: {
    title: 'Built for three kinds of search problem',
    intro: 'What you need depends on where your customers search from and how crowded your market is.',
    cards: [
      { tag: 'Local service', title: 'You work in a set area', body: 'Trades, clinics and practices who need to own the map pack and the “near me” searches in their towns.', foot: usually(local) },
      { tag: 'Regional or national', title: 'You compete beyond your town', body: 'Businesses selling across the UK against bigger names, where content and links decide who wins.', foot: usually(growth) },
      { tag: 'Online shop', title: 'You sell products online', body: 'Category and product pages that rank, with technical fixes for large catalogues and faceted search.', foot: usually(commerce) },
    ],
  },

  offering: {
    eyebrow: 'What we do',
    title: 'Everything that moves a ranking',
    intro: 'Six workstreams, prioritised by what will bring enquiries soonest.',
    rows: [
      { title: 'Technical SEO', detail: 'Speed, indexing, structured data, crawl errors', time: 'Month 1' },
      { title: 'Local SEO', detail: 'Google Business Profile, citations, reviews', time: 'Month 1–2' },
      { title: 'Content', detail: 'Service pages and articles for real search questions', time: 'Ongoing' },
      { title: 'Digital PR and links', detail: 'Earned coverage from relevant UK sites', time: 'Ongoing' },
      { title: 'Conversion fixes', detail: 'Turning the extra visits into calls and forms', time: 'Month 2' },
      { title: 'Migrations', detail: 'Rebuilds and domain moves with rankings kept', time: 'As needed' },
    ],
  },

  technology: {
    eyebrow: 'Tools',
    title: 'The tools behind the reports',
    intro: 'We use industry-standard tools and give you access to the same data we see, so nothing is hidden behind our reports.',
    checks: ['Read-only access to every dashboard', 'All accounts registered in your name'],
    legend: technologyLegend,
    groups: [
      {
        title: 'Research',
        summary: 'Keywords, competitors and gaps',
        marks: [
          { name: 'Semrush', icon: 'semrush', recommended: true },
          { name: 'Ahrefs', recommended: true },
          { name: 'Google Trends', icon: 'google' },
        ],
      },
      {
        title: 'Technical',
        summary: 'Crawling and site health',
        marks: [
          { name: 'Screaming Frog', recommended: true },
          { name: 'Search Console', icon: 'googlesearchconsole', recommended: true },
          { name: 'PageSpeed', icon: 'pagespeedinsights' },
        ],
      },
      {
        title: 'Measurement',
        summary: 'What the traffic is worth',
        marks: [
          { name: 'Analytics 4', icon: 'googleanalytics', recommended: true },
          { name: 'Looker Studio', icon: 'looker' },
          { name: 'CallRail' },
        ],
      },
      {
        title: 'Local',
        summary: 'Maps and reviews',
        marks: [
          { name: 'Business Profile', icon: 'google', recommended: true },
          { name: 'BrightLocal' },
          { name: 'Trustpilot', icon: 'trustpilot' },
        ],
      },
    ],
  },

  process: {
    title: 'A plan you can read on one page',
    intro: 'You see every task and its effect in your dashboard. We report on enquiries first, rankings second.',
    steps: [
      { when: 'Week 1', title: 'Audit', body: 'Technical crawl, competitor review and a list of the quickest wins.', you: 'Grant account access' },
      { when: 'Week 2', title: 'Strategy', body: 'Target searches agreed, ranked by value and how quickly they can move.', you: 'Approve the priorities' },
      { when: 'Month 1', title: 'Fix the foundations', body: 'Speed, indexing and local profile fixed before any new content goes out.', you: 'Nothing' },
      { when: 'Months 2–6', title: 'Content and links', body: 'New pages and earned links published each month to the agreed plan.', you: 'Review drafts' },
      { when: 'Monthly', title: 'Report and adjust', body: 'Calls, forms and rankings reported, and next month re-prioritised.', you: 'Read one page' },
    ],
    note: 'Total time from you each month: about thirty minutes.',
  },

  work: {
    title: 'Rankings we have earned for UK businesses',
    cases: [
      { slug: 'brightwire-electrical-map-pack', sector: 'Trades · Kent', title: 'Electrician owning the Maidstone map pack', results: [{ value: '+188%', label: 'calls' }, { value: '4 mo', label: 'to top three' }], stack: 'Local', thumb: 'lead', tint: 'violet' },
      { slug: 'family-law-service-pages', sector: 'Legal · London', title: 'Family law firm, eighty new service pages', results: [{ value: '+241%', label: 'organic traffic' }, { value: '6 mo', label: 'to result' }], stack: 'Content', thumb: 'lead', tint: 'periwinkle' },
      { slug: 'homeware-category-rebuild', sector: 'Retail · Nationwide', title: 'Homeware shop, category rebuild', results: [{ value: '+57%', label: 'organic revenue' }, { value: '5 mo', label: 'to result' }], stack: 'Commerce', thumb: 'lead', tint: 'lilac' },
    ],
    callout: examplesCallout,
  },

  plans: {
    kind: 'monthly',
    title: 'Choose a plan, pay monthly',
    intro: 'Six-month minimum, then rolling monthly with thirty days’ notice. Every plan includes a monthly report and a named specialist.',
    featured: growth.id,
    items: [
      { ...local, fit: 'Businesses serving one town or area.', featuresHeading: 'What you get', features: ['Technical audit and fixes', 'Google Business Profile management', 'Two local pages a month', 'Review generation set-up', 'Monthly enquiry report'] },
      { ...growth, fit: 'Businesses competing regionally or nationally.', featuresHeading: `Everything in ${local.name}, plus`, features: ['Four content pieces a month', 'Digital PR and link building', 'Competitor tracking', 'Conversion fixes on key pages', 'Quarterly strategy review'], flag: 'Most chosen' },
      { ...commerce, fit: 'Online shops with large catalogues.', featuresHeading: `Everything in ${growth.name}, plus`, features: ['Category and product optimisation', 'Faceted navigation fixes', 'Product feed and schema', 'Revenue attribution report', 'Dedicated account manager'] },
    ],
    footnote: {
      title: 'Why six months?',
      body: 'Search results take time to respond. Six months is the shortest period in which we can show a measurable change. After that you can leave with thirty days’ notice and keep all the content and accounts.',
    },
  },

  proof: {
    caseStudySlug: 'brightwire-electrical-map-pack',
    title: 'Brightwire Electrical doubled their calls in four months',
    body: `A technical clean-up, a rebuilt Google Business Profile and twelve new local pages on the ${local.name} plan.`,
    quote: '“We used to rely on word of mouth. Now most of our new customers say they found us on Google.”',
    quoteBy: 'Owner, Brightwire Electrical — Trades, Kent',
    stats: [
      { value: '+188%', label: 'calls from organic search' },
      { value: '#1–3', label: 'for 22 local searches' },
      { value: '4 mo', label: 'from audit to result' },
    ],
  },

  voices: {
    ...voicesHeading,
    quotes: [
      { quote: '“The report tells me how many calls came in, not just where we rank. That is what I care about.”', name: 'Priya Shah', role: 'Partner, family law firm — London' },
      { quote: '“They fixed things our last agency never mentioned. Traffic moved within weeks.”', name: 'Tom Reeves', role: 'Director, homeware retailer — Nationwide' },
      { quote: '“Plain English every month. I always know what they did and why.”', name: 'Mark Ellis', role: 'Owner, Brightwire Electrical — Kent' },
    ],
    promises,
  },

  faq: {
    title: faqTitle,
    items: [
      { question: 'How long until I see results?', answer: 'Technical and local fixes often show in four to eight weeks. Content and links compound over three to six months. We set expectations for your market in the audit.' },
      { question: 'Do you guarantee first place on Google?', answer: 'No one honestly can. We commit to the work, report on it every month, and agree measurable targets for enquiries and traffic before we start.' },
      { question: 'Do I need a new website first?', answer: 'Usually not. We work on your existing site. If something in it is holding rankings back, we will tell you and price the fix separately.' },
      { question: 'What happens if I stop?', answer: 'You keep every page we wrote, every link we earned and every account. Rankings may drift over time without upkeep, but nothing is switched off.' },
      { question: 'Can you work alongside my web developer?', answer: 'Yes. We send clear tickets for any changes, or make them ourselves if you give us access.' },
    ],
  },

  cta: {
    title: `Start your SEO from ${from} a month`,
    body: 'Book a free audit and we will show you the three changes that would bring the most enquiries, whether or not you work with us.',
    primary: { label: 'See the plans', target: 'plans' },
  },
}
