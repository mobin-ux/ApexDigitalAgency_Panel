import type { ServicePageContent } from './types'
import { uxPlans } from '../plans'
import { examplesCallout, faqTitle, monthly, promises, technologyLegend, usually, voicesHeading } from './shared'

/** /services/ui-ux-design — copy from `ServicePage.dc.html` + `service-data.js` (`uiux`). */

const [review, redesign, product] = uxPlans
const from = monthly(review)

export const uiUxDesignPage: ServicePageContent = {
  slug: 'ui-ux-design',
  seo: {
    title: `UI/UX design from ${from} a month`,
    description: `User experience research, flows and clickable prototypes for UK products, booking flows and sites, tested with real users. From ${from} a month, no interest.`,
  },

  hero: {
    badge: 'Research-led design',
    title: 'Fix where people drop out, before you build',
    lead: `User Experience (UX) research, flows and clickable prototypes for UK products, booking flows and sites. Tested with real users. From ${from} a month.`,
    checks: [
      'Testing with real users, not just opinions',
      'Clickable prototype you can put in front of customers',
      'Developer-ready files, or we build it too',
    ],
    primary: { label: 'See the plans', target: 'plans' },
    secondary: { label: 'Book a free UX review', target: 'contact' },
  },
  visual: {
    kind: 'ux',
    url: 'figma.com/proto',
    metricLabel: 'Checkout completion',
    metric: '71%',
    toastTitle: 'Test session done',
    toastSub: '5 of 5 users · 1 hr ago',
  },
  stats: [
    { value: '2–4', label: 'weeks per project' },
    { value: from, label: 'per month, from' },
    { value: '5', label: 'users per test round' },
    { value: '+38%', label: 'average conversion lift' },
  ],

  audiences: {
    title: 'Built for three kinds of project',
    intro: 'Design work pays off most when something already exists and people are dropping out of it.',
    cards: [
      { tag: 'Existing site', title: 'Visitors leave without enquiring', body: 'Sites with decent traffic but poor conversion, where the problem is the journey rather than the look.', foot: usually(review) },
      { tag: 'Booking or checkout', title: 'People start but do not finish', body: 'Multi-step flows for bookings, quotes or purchases where each extra step loses customers.', foot: usually(redesign) },
      { tag: 'New product', title: 'You are about to build something', body: 'Apps and platforms that need testing with real users before any development money is spent.', foot: usually(product) },
    ],
  },

  offering: {
    eyebrow: 'What we do',
    title: 'From research to developer-ready files',
    intro: 'Each project picks the steps it needs. Most include research, flows and a prototype.',
    rows: [
      { title: 'User Experience (UX) Research', detail: 'Interviews, analytics and session recordings', time: '1 wk' },
      { title: 'UX audit', detail: 'A ranked list of problems and fixes', time: '1 wk' },
      { title: 'User flows and wireframes', detail: 'The journey mapped step by step', time: '1–2 wks' },
      { title: 'User Interface (UI) Design', detail: 'Full visual design for every screen', time: '2–3 wks' },
      { title: 'Prototyping and testing', detail: 'Clickable prototype tested with five users', time: '1 wk' },
      { title: 'Design systems', detail: 'Reusable components for your team', time: '3–4 wks' },
    ],
  },

  technology: {
    eyebrow: 'Tools',
    title: 'Shared files, open process',
    intro: 'You get access to every file as we work, and a handover your developers can build from without guessing.',
    checks: ['Figma files in your account', 'Recorded test sessions included'],
    legend: technologyLegend,
    groups: [
      {
        title: 'Design',
        summary: 'Screens and prototypes',
        marks: [
          { name: 'Figma', icon: 'figma', recommended: true },
          { name: 'FigJam', icon: 'figma' },
        ],
      },
      {
        title: 'Research',
        summary: 'Understanding real behaviour',
        marks: [
          { name: 'Hotjar', icon: 'hotjar', recommended: true },
          { name: 'Maze' },
          { name: 'Analytics 4', icon: 'googleanalytics' },
        ],
      },
      {
        title: 'Testing',
        summary: 'Sessions with real users',
        marks: [
          { name: 'Lookback', recommended: true },
          { name: 'Zoom', icon: 'zoom' },
        ],
      },
      {
        title: 'Handover',
        summary: 'Built without guesswork',
        marks: [
          { name: 'Storybook', icon: 'storybook', recommended: true },
          { name: 'Notion', icon: 'notion' },
          { name: 'Jira', icon: 'jira' },
        ],
      },
    ],
  },

  process: {
    title: 'Four weeks from problem to prototype',
    intro: 'You see the findings, the flows and the designs as they develop, and join the test sessions if you want to.',
    steps: [
      { when: 'Week 1', title: 'Research', body: 'Analytics, recordings and interviews to find where and why people drop out.', you: 'Share access' },
      { when: 'Week 1', title: 'Findings', body: 'A ranked list of problems, with the likely effect of fixing each.', you: 'Agree priorities' },
      { when: 'Week 2', title: 'Flows and wireframes', body: 'The new journey mapped out before any visual design.', you: 'Review the flow' },
      { when: 'Week 3', title: 'Design and prototype', body: 'Full designs turned into a clickable prototype.', you: 'Sign off the designs' },
      { when: 'Week 4', title: 'Test and hand over', body: 'Tested with five users, refined, and handed to your developers.', you: 'Watch a session' },
    ],
    note: 'Want us to build it too? Design fees are credited against a Website Design or Software plan.',
  },

  work: {
    title: 'Journeys we have fixed for UK businesses',
    cases: [
      { slug: 'riverside-clinics-booking-flow', sector: 'Health · Maidstone', title: 'Clinic booking flow, five steps to two', results: [{ value: '+54%', label: 'completed bookings' }, { value: '3 wks', label: 'project' }], stack: 'Booking', thumb: 'lead', tint: 'violet' },
      { slug: 'd2c-checkout-redesign', sector: 'Retail · Nationwide', title: 'Checkout redesign for a D2C brand', results: [{ value: '+38%', label: 'conversion' }, { value: '4 wks', label: 'project' }], stack: 'Checkout', thumb: 'lead', tint: 'periwinkle' },
      { slug: 'lending-app-onboarding', sector: 'Finance · London', title: 'Onboarding for a lending app', results: [{ value: '−47%', label: 'drop-off' }, { value: '5 wks', label: 'project' }], stack: 'Product', thumb: 'lead', tint: 'lilac' },
    ],
    callout: examplesCallout,
  },

  plans: {
    kind: 'monthly',
    title: 'Choose a plan, pay monthly',
    intro: 'Priced per project and spread over six monthly payments. Credited in full if we go on to build it for you.',
    featured: redesign.id,
    items: [
      { ...review, fit: 'A UX audit and fix list for an existing site.', featuresHeading: 'What you get', features: ['Analytics and recording review', 'Ranked problem list', 'Wireframes for top three fixes', 'One round of user testing', 'Findings presentation'] },
      { ...redesign, fit: 'One key journey redesigned and tested.', featuresHeading: `Everything in ${review.name}, plus`, features: ['User interviews', 'Full flow redesign', 'UI design for every screen', 'Clickable prototype', 'Developer handover'], flag: 'Most chosen' },
      { ...product, fit: 'A new product designed end to end.', featuresHeading: `Everything in ${redesign.name}, plus`, features: ['Discovery workshops', 'Up to 30 screens', 'Two rounds of testing', 'Starter design system', 'Build support during development'] },
    ],
    footnote: {
      title: 'How the instalments work',
      body: 'A deposit, then equal monthly payments. Instalment plans are payment schedules for our own services, agreed directly with Apex. They are not credit agreements, no interest is charged, and no credit check is carried out.',
    },
  },

  proof: {
    caseStudySlug: 'riverside-clinics-booking-flow',
    title: 'Riverside Clinics doubled online bookings',
    body: `Research showed patients abandoning at the insurance step. The ${redesign.name} plan cut the flow from five steps to two.`,
    quote: '“We thought we needed a new website. It turned out we needed two fewer steps in the booking form.”',
    quoteBy: 'Practice Manager, Riverside Clinics — Healthcare, Maidstone',
    stats: [
      { value: '+54%', label: 'completed bookings' },
      { value: '−40%', label: 'calls to reception' },
      { value: '3 wks', label: 'from research to launch' },
    ],
  },

  voices: {
    ...voicesHeading,
    quotes: [
      { quote: '“Watching real patients use our booking form was uncomfortable and incredibly useful.”', name: 'Laura Bennett', role: 'Practice Manager, Riverside Clinics — Maidstone' },
      { quote: '“The handover was so clear our developers built it without a single question.”', name: 'Chris Adeyemi', role: 'Head of Digital, D2C retail — Nationwide' },
      { quote: '“We tested the product before we built it and changed half of it. That saved us months.”', name: 'Mei Lin', role: 'Founder, lending app — London' },
    ],
    promises,
  },

  faq: {
    title: faqTitle,
    items: [
      { question: 'What is the difference between UI and UX?', answer: 'User Experience (UX) is how the journey works: the steps, the order and what people understand. User Interface (UI) is how each screen looks. We do both, and UX comes first.' },
      { question: 'Who are the test users?', answer: 'Where possible, your real customers. Otherwise we recruit people who match them. Five users per round finds most usability problems.' },
      { question: 'Can you build the design too?', answer: 'Yes. Our Website Design and Software teams build from the same files, and your design fee is credited against the build.' },
      { question: 'We already have developers. Does that work?', answer: 'Yes. We hand over annotated Figma files and components, and stay available to answer questions during their build.' },
      { question: 'How long does a project take?', answer: 'Reviews take about two weeks, single-journey redesigns three to four weeks, and new products six weeks or more.' },
    ],
  },

  cta: {
    title: `Start your UX project from ${from} a month`,
    body: 'Book a free UX review. Send us the page where people drop out and we will show you three likely reasons why.',
    primary: { label: 'See the plans', target: 'plans' },
  },
}
