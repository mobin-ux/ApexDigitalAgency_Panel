import type { ServicePageContent } from './types'
import { ppcPlans } from '../plans'
import { examplesCallout, faqTitle, monthly, promises, technologyLegend, usually, voicesHeading } from './shared'

/** /services/ppc — copy from `ServicePage.dc.html` + `service-data.js` (`ppc`). */

const [search, multiChannel, b2b] = ppcPlans
const from = monthly(search)

export const ppcPage: ServicePageContent = {
  slug: 'ppc',
  seo: {
    title: `PPC management from ${from} a month`,
    description: `Google, Meta and LinkedIn ad campaigns for UK businesses that need work now. Live in five working days, management from ${from} a month, ad spend paid straight to the platform.`,
  },

  hero: {
    badge: 'Enquiries from week one',
    title: 'Paid ads that fill the diary this month',
    lead: `Google, Meta and LinkedIn campaigns for UK businesses that need work now. Live in five working days, management from ${from} a month.`,
    checks: [
      'Campaigns live within five working days',
      'Landing page included on every plan',
      'Your ad spend goes straight to the platform',
    ],
    primary: { label: 'See the plans', target: 'plans' },
    secondary: { label: 'Get a free account review', target: 'contact' },
  },
  visual: {
    kind: 'ads',
    url: 'ads.google.com',
    metricLabel: 'Leads this week',
    metric: '46',
    toastTitle: 'New lead',
    toastSub: 'Search ad · 4 min ago',
    card: { label: 'Cost per lead', value: '£18', unit: ' avg.', change: '↓ 56%', note: 'Down from £41 in month one' },
  },
  stats: [
    { value: '5 days', label: 'to go live' },
    { value: from, label: 'per month management, from' },
    { value: '4.2×', label: 'average return on ad spend' },
    { value: '30 days', label: 'notice, no long contract' },
  ],

  audiences: {
    title: 'Built for three kinds of advertiser',
    intro: 'The right channel depends on how your customers decide and how quickly you need the phone to ring.',
    cards: [
      { tag: 'Urgent demand', title: 'Customers search when they need you', body: 'Emergency trades, clinics and local services where the first result on Google gets the job.', foot: usually(search) },
      { tag: 'Considered purchase', title: 'Customers browse before buying', body: 'Home improvement, retail and leisure where people need to see you several times before acting.', foot: usually(multiChannel) },
      { tag: 'B2B', title: 'You sell to other businesses', body: 'Longer sales cycles where the right job title matters more than the number of clicks.', foot: usually(b2b) },
    ],
  },

  offering: {
    eyebrow: 'Channels',
    title: 'The right channel for how your customers buy',
    intro: 'We recommend where to spend, and move budget monthly to what is working.',
    rows: [
      { title: 'Google Search', detail: 'Appear when people search for exactly what you sell', time: '5 days' },
      { title: 'Local Services Ads', detail: 'Google Guaranteed badge and pay-per-lead', time: '2 wks' },
      { title: 'Performance Max and Shopping', detail: 'Product ads across Google for online shops', time: '1 wk' },
      { title: 'Meta (Facebook and Instagram)', detail: 'Reach people before they start searching', time: '1 wk' },
      { title: 'LinkedIn', detail: 'Target by job title, sector and company size', time: '1 wk' },
      { title: 'Remarketing', detail: 'Bring back visitors who did not enquire', time: '1 wk' },
    ],
  },

  technology: {
    eyebrow: 'Platforms',
    title: 'Your accounts, our management',
    intro: 'Every ad account is opened in your name and billed to your card. If we part ways, the history and the learning stay with you.',
    checks: ['Ad spend paid directly to the platform', 'No mark-up on your media budget'],
    legend: technologyLegend,
    groups: [
      {
        title: 'Search',
        summary: 'High-intent demand',
        marks: [
          { name: 'Google Ads', icon: 'googleads', recommended: true },
          { name: 'Microsoft Ads' },
        ],
      },
      {
        title: 'Social',
        summary: 'Reach and remarketing',
        marks: [
          { name: 'Meta', icon: 'meta', recommended: true },
          { name: 'LinkedIn' },
          { name: 'TikTok', icon: 'tiktok' },
        ],
      },
      {
        title: 'Tracking',
        summary: 'Every lead attributed',
        marks: [
          { name: 'Tag Manager', icon: 'googletagmanager', recommended: true },
          { name: 'Analytics 4', icon: 'googleanalytics', recommended: true },
          { name: 'CallRail' },
        ],
      },
      {
        title: 'Landing pages',
        summary: 'Built to convert paid traffic',
        marks: [
          { name: 'Webflow', icon: 'webflow', recommended: true },
          { name: 'Unbounce' },
          { name: 'Hotjar', icon: 'hotjar' },
        ],
      },
    ],
  },

  process: {
    title: 'Live in a week, better every month',
    intro: 'You approve every ad before it runs, and see spend and leads in your dashboard daily.',
    steps: [
      { when: 'Day 1', title: 'Call and brief', body: 'Your services, margins, areas and what a good lead is worth to you.', you: 'Answer six questions' },
      { when: 'Days 2–3', title: 'Build', body: 'Accounts, tracking, ads and a landing page set up and tested.', you: 'Approve the ads' },
      { when: 'Day 5', title: 'Launch', body: 'Campaigns go live on a controlled budget while data comes in.', you: 'Answer the phone' },
      { when: 'Weeks 2–4', title: 'Optimise', body: 'Wasted searches cut, bids adjusted, budget moved to what works.', you: 'Tell us which leads were good' },
      { when: 'Monthly', title: 'Report and scale', body: 'Cost per lead and revenue reported, with a recommendation on budget.', you: 'Read one page' },
    ],
    note: 'Most clients see their first lead within 48 hours of launch.',
  },

  work: {
    title: 'Campaigns we run for UK businesses',
    cases: [
      { slug: 'summit-roofing-search-lsa', sector: 'Trades · South East', title: 'Roofing firm, Google Search and LSAs', results: [{ value: '£14', label: 'cost per lead' }, { value: '6.1×', label: 'return' }], stack: 'Search', thumb: 'lead', tint: 'violet' },
      { slug: 'escape-rooms-meta-remarketing', sector: 'Leisure · Kent', title: 'Escape rooms, Meta and remarketing', results: [{ value: '+73%', label: 'bookings' }, { value: '3.8×', label: 'return' }], stack: 'Meta', thumb: 'lead', tint: 'periwinkle' },
      { slug: 'it-support-linkedin', sector: 'B2B · Nationwide', title: 'IT support provider on LinkedIn', results: [{ value: '31', label: 'qualified meetings' }, { value: '90 days', label: '' }], stack: 'LinkedIn', thumb: 'lead', tint: 'lilac' },
    ],
    callout: examplesCallout,
  },

  plans: {
    kind: 'monthly',
    title: 'Management fee, paid monthly',
    intro: 'A flat monthly fee for management. Ad spend is separate and paid straight to the platform. Thirty days’ notice, no minimum term after month three.',
    featured: multiChannel.id,
    items: [
      { ...search, fit: 'One channel, for businesses with urgent local demand.', featuresHeading: 'What you get', features: ['Google Search campaigns', 'One landing page', 'Call and form tracking', 'Weekly optimisation', 'Monthly lead report'] },
      { ...multiChannel, fit: 'Search plus social for considered purchases.', featuresHeading: `Everything in ${search.name}, plus`, features: ['Meta or Performance Max', 'Remarketing across channels', 'Two landing pages', 'Ad creative refreshed monthly', 'Fortnightly check-in call'], flag: 'Most chosen' },
      { ...b2b, fit: 'LinkedIn-led campaigns for longer sales cycles.', featuresHeading: `Everything in ${multiChannel.name}, plus`, features: ['LinkedIn lead-gen campaigns', 'CRM integration', 'Lead scoring with your team', 'Account-based targeting', 'Dedicated account manager'] },
    ],
    footnote: {
      title: 'How ad spend works',
      body: 'Your ad budget is billed by Google, Meta or LinkedIn directly to your card. We never mark it up and never hold it. Our fee covers management only, and you can change the budget at any time.',
    },
  },

  proof: {
    caseStudySlug: 'summit-roofing-search-lsa',
    title: 'Summit Roofing booked six weeks of work in the first month',
    body: `Google Search and Local Services Ads with one landing page, on the ${search.name} plan and a £900 monthly budget.`,
    quote: '“We paused the ads twice because we could not keep up. That has never happened with any marketing we have tried.”',
    quoteBy: 'Director, Summit Roofing — Trades, South East',
    stats: [
      { value: '£14', label: 'average cost per lead' },
      { value: '6.1×', label: 'return on ad spend' },
      { value: '48 hrs', label: 'to the first enquiry' },
    ],
  },

  voices: {
    ...voicesHeading,
    quotes: [
      { quote: '“They cut half the keywords we were paying for and the leads went up. That told me everything.”', name: 'Gareth Lowe', role: 'Director, Summit Roofing — South East' },
      { quote: '“Every ad account is in our name. We can see exactly where each pound goes.”', name: 'Hannah Price', role: 'Owner, escape room venue — Kent' },
      { quote: '“Real meetings with the right people, not a spreadsheet of downloads.”', name: 'Ravi Patel', role: 'Sales Director, IT support — Nationwide' },
    ],
    promises,
  },

  faq: {
    title: faqTitle,
    items: [
      { question: 'How much should I spend on ads?', answer: 'It depends on your market and what a customer is worth. We give you a recommended starting budget on the first call, usually between £500 and £1,500 a month for local businesses.' },
      { question: 'How quickly will I get leads?', answer: 'Search campaigns usually produce leads within two days of launch. Social campaigns take one to three weeks to learn who to show ads to.' },
      { question: 'Do I own the ad accounts?', answer: 'Yes. Every account is created in your name and billed to your card. If we stop working together, everything stays with you.' },
      { question: 'Is there a minimum contract?', answer: 'Three months, because campaigns need time to learn. After that it is rolling monthly with thirty days’ notice.' },
      { question: 'Do I need a new website?', answer: 'No. Every plan includes at least one landing page built for paid traffic, so ads never send people to a slow or generic page.' },
    ],
  },

  cta: {
    title: `Start your ads from ${from} a month`,
    body: 'Book a free account review. If you already run ads, we will show you where the budget is being wasted.',
    primary: { label: 'See the plans', target: 'plans' },
  },
}
