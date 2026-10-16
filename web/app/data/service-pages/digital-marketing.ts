import type { ServicePageContent } from './types'
import { marketingPlans } from '../plans'
import { examplesCallout, faqTitle, monthly, promises, technologyLegend, usually, voicesHeading } from './shared'

/** /services/digital-marketing — copy from `ServicePage.dc.html` + `service-data.js` (`mkt`). */

const [essentials, growth, partner] = marketingPlans
const from = monthly(essentials)

export const digitalMarketingPage: ServicePageContent = {
  slug: 'digital-marketing',
  seo: {
    title: `Digital marketing from ${from} a month`,
    description: `Social, email, content and paid media run by one UK team and reported on enquiries. For businesses without a marketer, from ${from} a month.`,
  },

  hero: {
    badge: 'Monthly retainer',
    title: 'One team on your marketing, every month',
    lead: `Social, email, content and paid media run by one UK team and reported on enquiries. For businesses without a marketer. From ${from} a month.`,
    checks: [
      'A named marketer who knows your business',
      'Monthly plan agreed before anything goes out',
      'One report covering every channel',
    ],
    primary: { label: 'See the plans', target: 'plans' },
    secondary: { label: 'Book a free call', target: 'contact' },
  },
  visual: {
    kind: 'marketing',
    url: 'dashboard.apexdigi.co.uk',
    metricLabel: 'Enquiries this month',
    metric: '212',
    toastTitle: 'Campaign approved',
    toastSub: 'October newsletter · just now',
  },
  stats: [
    { value: '1', label: 'named marketer on your account' },
    { value: from, label: 'per month, from' },
    { value: '6', label: 'channels, one report' },
    { value: '3 mo', label: 'minimum, then rolling' },
  ],

  audiences: {
    title: 'Built for three kinds of team',
    intro: 'Most of our retainer clients have no marketer, or one marketer doing the work of five.',
    cards: [
      { tag: 'No marketer', title: 'Marketing is nobody’s job', body: 'Owners who know they should post, email and advertise, but never have the time to do it well.', foot: usually(essentials) },
      { tag: 'Growing team', title: 'You need more than one pair of hands', body: 'Businesses with steady demand who want a consistent plan across channels and someone to run it.', foot: usually(growth) },
      { tag: 'In-house marketer', title: 'You have one person stretched thin', body: 'We work alongside your marketer on the channels they cannot cover, reporting to them.', foot: usually(partner) },
    ],
  },

  offering: {
    eyebrow: 'Channels',
    title: 'Every channel, run as one plan',
    intro: 'We pick the two or three channels that matter most for you, rather than doing everything badly.',
    rows: [
      { title: 'Social media', detail: 'Planned posts, community replies and short video', time: 'Weekly' },
      { title: 'Email marketing', detail: 'Newsletters, automations and win-back flows', time: 'Monthly' },
      { title: 'Content', detail: 'Articles and guides that feed search and social', time: 'Monthly' },
      { title: 'Paid social and search', detail: 'Campaign management within your budget', time: 'Ongoing' },
      { title: 'Reviews and reputation', detail: 'Requests, replies and Trustpilot management', time: 'Ongoing' },
      { title: 'Reporting', detail: 'One page on what each channel brought in', time: 'Monthly' },
    ],
  },

  technology: {
    eyebrow: 'Tools',
    title: 'Your accounts, our time',
    intro: 'We work in the platforms you already pay for where possible, and set up any new ones in your name.',
    checks: ['All logins and data stay yours', 'Content calendar shared with you'],
    legend: technologyLegend,
    groups: [
      {
        title: 'Social',
        summary: 'Planning and publishing',
        marks: [
          { name: 'Meta', icon: 'meta', recommended: true },
          { name: 'LinkedIn', recommended: true },
          { name: 'TikTok', icon: 'tiktok' },
          { name: 'Buffer', icon: 'buffer' },
        ],
      },
      {
        title: 'Email',
        summary: 'Newsletters and automations',
        marks: [
          { name: 'Mailchimp', icon: 'mailchimp', recommended: true },
          { name: 'Klaviyo' },
          { name: 'HubSpot', icon: 'hubspot' },
        ],
      },
      {
        title: 'Creative',
        summary: 'Design and video',
        marks: [
          { name: 'Figma', icon: 'figma', recommended: true },
          { name: 'Canva' },
          { name: 'CapCut' },
        ],
      },
      {
        title: 'Reporting',
        summary: 'One view of every channel',
        marks: [
          { name: 'Analytics 4', icon: 'googleanalytics', recommended: true },
          { name: 'Looker Studio', icon: 'looker', recommended: true },
          { name: 'Trustpilot', icon: 'trustpilot' },
        ],
      },
    ],
  },

  process: {
    title: 'A month that runs itself',
    intro: 'You approve the plan once a month. We do the rest and show you what it brought in.',
    steps: [
      { when: 'Week 1', title: 'Discovery', body: 'Your customers, offers, competitors and what has worked before.', you: 'One 45-minute call' },
      { when: 'Week 2', title: 'Plan', body: 'A three-month plan with channels, themes and targets agreed.', you: 'Approve the plan' },
      { when: 'Week 3', title: 'Launch', body: 'Accounts tidied, first content scheduled, tracking checked.', you: 'Approve first posts' },
      { when: 'Monthly', title: 'Run', body: 'Content, campaigns and replies handled to the agreed calendar.', you: 'Approve the calendar' },
      { when: 'Monthly', title: 'Report', body: 'Enquiries by channel, what we learned and next month’s plan.', you: 'Read one page' },
    ],
    note: 'Total time from you each month: about one hour.',
  },

  work: {
    title: 'Retainers we run for UK businesses',
    cases: [
      { slug: 'oak-and-anchor-social-email', sector: 'Hospitality · Kent', title: 'Pub group, social and email', results: [{ value: '+44%', label: 'table bookings' }, { value: '18 mo', label: 'retainer' }], stack: 'Social', thumb: 'lead', tint: 'violet' },
      { slug: 'physio-clinic-content-reviews', sector: 'Health · London', title: 'Physio clinic, content and reviews', results: [{ value: '+96', label: 'five-star reviews' }, { value: '12 mo', label: 'retainer' }], stack: 'Reviews', thumb: 'lead', tint: 'periwinkle' },
      { slug: 'garden-brand-email-automations', sector: 'Retail · Nationwide', title: 'Garden brand, email automations', results: [{ value: '31%', label: 'revenue from email' }, { value: '9 mo', label: 'retainer' }], stack: 'Email', thumb: 'lead', tint: 'lilac' },
    ],
    callout: examplesCallout,
  },

  plans: {
    kind: 'monthly',
    title: 'Choose a retainer, pay monthly',
    intro: 'Three-month minimum, then rolling monthly with thirty days’ notice. Ad spend, where used, is paid directly to the platform.',
    featured: growth.id,
    items: [
      { ...essentials, fit: 'Two channels for businesses without a marketer.', featuresHeading: 'What you get', features: ['Two channels managed', '12 social posts a month', 'One email campaign a month', 'Review requests set up', 'Monthly report'] },
      { ...growth, fit: 'Four channels and a named marketer.', featuresHeading: `Everything in ${essentials.name}, plus`, features: ['Four channels managed', 'Two articles a month', 'Paid social management', 'Email automations', 'Fortnightly call with your marketer'], flag: 'Most chosen' },
      { ...partner, fit: 'Working alongside an in-house team.', featuresHeading: `Everything in ${growth.name}, plus`, features: ['All channels available', 'Short-form video each month', 'Quarterly campaign launch', 'Shared planning board', 'Dedicated account manager'] },
    ],
    footnote: {
      title: 'How the retainer works',
      body: 'One flat monthly fee, agreed before we start and fixed for the term. You can move up or down a plan with a month’s notice. No hourly billing and no surprise invoices.',
    },
  },

  proof: {
    caseStudySlug: 'oak-and-anchor-social-email',
    title: 'The Oak & Anchor filled midweek tables',
    body: `Social, email and Google reviews on the ${growth.name} plan, focused on two quiet weekday evenings.`,
    quote: '“I used to post when I remembered. Now there is a plan, and I can see which posts actually bring people through the door.”',
    quoteBy: 'Owner, The Oak & Anchor — Hospitality, Kent',
    stats: [
      { value: '+44%', label: 'table bookings in a year' },
      { value: '5,800', label: 'people on the mailing list' },
      { value: '4.8★', label: 'Google rating, up from 4.1' },
    ],
  },

  voices: {
    ...voicesHeading,
    quotes: [
      { quote: '“Same person every month, who actually knows our menu and our regulars.”', name: 'Claire Doyle', role: 'Owner, The Oak & Anchor — Kent' },
      { quote: '“The report is one page. I know exactly what we got for the money.”', name: 'Dr. Amir Hussain', role: 'Clinic Director, physiotherapy — London' },
      { quote: '“The email flows they built now bring in almost a third of our online sales.”', name: 'Emma Clarke', role: 'Founder, garden brand — Nationwide' },
    ],
    promises,
  },

  faq: {
    title: faqTitle,
    items: [
      { question: 'Which channels should I be on?', answer: 'Usually two or three, chosen for where your customers already spend time. We recommend them in the discovery call and explain why.' },
      { question: 'Do I have to approve everything?', answer: 'You approve the monthly plan and calendar. Individual posts can go out without sign-off once you are comfortable, or you can review each one.' },
      { question: 'Is ad spend included?', answer: 'No. Ad spend is paid directly to the platform from your card, so you can see and control it. Our fee covers management only.' },
      { question: 'Can I change plans?', answer: `Yes. Move up or down with a month’s notice. Many clients start on ${essentials.name} and add channels once they see what works.` },
      { question: 'What if I already have a marketer?', answer: `The ${partner.name} plan is built for that. We report to them, cover the channels they cannot, and share our planning board with them.` },
    ],
  },

  cta: {
    title: `Start your marketing from ${from} a month`,
    body: 'Book a free call and we will suggest the two channels most likely to bring you enquiries.',
    primary: { label: 'See the plans', target: 'plans' },
  },
}
