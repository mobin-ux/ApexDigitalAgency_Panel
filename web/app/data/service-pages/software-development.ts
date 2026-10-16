import type { ServicePageContent } from './types'
import { formatGbp } from '../../utils/format'
import { examplesCallout, faqTitle, promises, technologyLegend, voicesHeading } from './shared'

/**
 * /services/software-development — copy from `ServicePage.dc.html` +
 * `service-data.js` (`soft`). Software has no price list: a free scoping call,
 * then a fixed-price discovery, then a quoted build.
 */

/** The one fixed price on this page, in pounds inc. VAT. */
const discoveryFee = 2400
const discovery = formatGbp(discoveryFee)

export const softwareDevelopmentPage: ServicePageContent = {
  slug: 'software-development',
  seo: {
    title: 'Custom software for UK businesses',
    description: `Web apps, portals and internal tools for UK businesses that have outgrown spreadsheets. Built in two-week sprints, with a ${discovery} fixed-price discovery and a quote before any build.`,
  },

  hero: {
    badge: 'Scoped on a call',
    title: 'Software built around how your team works',
    lead: 'Web apps, portals and internal tools for UK businesses that have outgrown spreadsheets. Built in two-week sprints and quoted after a scoping call.',
    checks: [
      'Fixed-price discovery before any build',
      'Working software every two weeks',
      'You own the code, the data and the IP',
    ],
    primary: { label: 'Book a scoping call', target: 'contact' },
    secondary: { label: 'See recent builds', target: 'work' },
  },
  visual: {
    kind: 'software',
    url: 'portal.yourbusiness.co.uk',
    metricLabel: 'Admin hours saved this month',
    metric: '86',
    toastTitle: 'Sprint 4 shipped',
    toastSub: 'Quote builder · live today',
  },
  stats: [
    { value: '2 wks', label: 'per sprint, with a demo' },
    { value: discovery, label: 'fixed-price discovery' },
    { value: '41', label: 'systems in production' },
    { value: '100%', label: 'code and IP handed over' },
  ],

  audiences: {
    title: 'Built for three kinds of problem',
    intro: 'Most projects start with a process that works but takes too long, lives in spreadsheets or depends on one person.',
    cards: [
      { tag: 'Operations', title: 'Admin is eating your week', body: 'Quoting, scheduling and job tracking done by hand, with the same data typed into three places.', foot: 'Typically 8–12 weeks' },
      { tag: 'Customer-facing', title: 'Clients need to log in', body: 'Portals for orders, documents, bookings or progress, so your team stops answering the same emails.', foot: 'Typically 10–16 weeks' },
      { tag: 'New product', title: 'You are building a platform', body: 'An idea that needs to be tested with real users before you commit to a full build.', foot: 'Typically 12+ weeks' },
    ],
  },

  offering: {
    eyebrow: 'What we build',
    title: 'Software that replaces the workaround',
    intro: 'Six common builds. Most projects combine two or three.',
    rows: [
      { title: 'Internal tools', detail: 'Quoting, scheduling, job and stock management', time: '8–12 wks' },
      { title: 'Client portals', detail: 'Logins, documents, orders and progress tracking', time: '10–14 wks' },
      { title: 'Booking platforms', detail: 'Availability, payments and staff calendars', time: '8–12 wks' },
      { title: 'Integrations', detail: 'Connecting Xero, HubSpot and your other tools', time: '2–6 wks' },
      { title: 'Minimum viable products', detail: 'A first version to test with real users', time: '10–16 wks' },
      { title: 'Rescue and modernisation', detail: 'Taking over or rebuilding an existing system', time: 'Scoped' },
    ],
  },

  technology: {
    eyebrow: 'Technology',
    title: 'Proven technology, clearly explained',
    intro: 'We choose widely used tools so any competent developer can take the code on after us, and we explain every choice in plain English.',
    checks: ['No proprietary framework or licence', 'Documentation and tests handed over'],
    legend: technologyLegend,
    groups: [
      {
        title: 'Front end',
        summary: 'Fast, accessible interfaces',
        marks: [
          { name: 'React', icon: 'react', recommended: true },
          { name: 'Next.js', icon: 'nextdotjs', recommended: true },
          { name: 'TypeScript', icon: 'typescript' },
        ],
      },
      {
        title: 'Back end',
        summary: 'Reliable and well understood',
        marks: [
          { name: 'Node.js', icon: 'nodedotjs', recommended: true },
          { name: 'Laravel', icon: 'laravel' },
          { name: 'Python', icon: 'python' },
        ],
      },
      {
        title: 'Data',
        summary: 'Your data, in your account',
        marks: [
          { name: 'PostgreSQL', icon: 'postgresql', recommended: true },
          { name: 'Supabase', icon: 'supabase' },
          { name: 'Redis', icon: 'redis' },
        ],
      },
      {
        title: 'Hosting',
        summary: 'UK and EU regions, GDPR compliant',
        marks: [
          { name: 'AWS', recommended: true },
          { name: 'Vercel', icon: 'vercel' },
          { name: 'Cloudflare', icon: 'cloudflare' },
        ],
      },
    ],
  },

  process: {
    title: 'Small steps, working software',
    intro: 'Every two weeks you see a demo of something that works. Nothing is built that you have not seen designed first.',
    steps: [
      { when: 'Day 1', title: 'Scoping call', body: 'Forty-five minutes on the problem, who uses it and what success looks like.', you: 'Walk us through the process' },
      { when: 'Weeks 1–2', title: 'Discovery', body: 'Workshops, a clickable prototype and a fixed quote for the build.', you: 'Two workshops' },
      { when: 'Sprints', title: 'Build', body: 'Two-week sprints, each ending in a demo and your feedback.', you: 'Thirty-minute demo' },
      { when: 'Final sprint', title: 'Test and launch', body: 'Tested with your team, data migrated, staff trained.', you: 'Test with real work' },
      { when: 'Ongoing', title: 'Support', body: 'Monitoring, fixes and new features on a monthly support plan.', you: 'Report issues' },
    ],
    note: `Discovery is fixed at ${discovery}. If you do not go ahead, you keep the spec and prototype.`,
  },

  work: {
    title: 'Systems we have built for UK businesses',
    cases: [
      { slug: 'keystone-builders-quoting-tool', sector: 'Construction · Kent', title: 'Quoting and job tracking tool', results: [{ value: '20 hrs', label: 'saved a week' }, { value: '10 wks', label: 'to launch' }], stack: 'Internal', thumb: 'lead', tint: 'violet' },
      { slug: 'logistics-tracking-portal', sector: 'Logistics · Midlands', title: 'Customer portal with live tracking', results: [{ value: '−62%', label: 'status calls' }, { value: '14 wks', label: 'to launch' }], stack: 'Portal', thumb: 'lead', tint: 'periwinkle' },
      { slug: 'tutor-booking-mvp', sector: 'Education · London', title: 'Tutor booking marketplace MVP', results: [{ value: '1,200', label: 'bookings, first term' }, { value: '12 wks', label: 'to launch' }], stack: 'MVP', thumb: 'lead', tint: 'lilac' },
    ],
    callout: examplesCallout,
  },

  plans: {
    kind: 'scoping',
    title: 'Every build starts with a call',
    intro: 'Software is too varied for a price list. A free scoping call tells you whether we are the right fit, and a fixed-price discovery tells you exactly what the build will cost.',
    steps: [
      { name: 'Scoping call', price: 0, note: '45 minutes', detail: 'The problem, the people who use it, and a rough range for the build.' },
      { name: 'Discovery', price: discoveryFee, note: 'Fixed · 2 weeks', detail: 'Workshops, a clickable prototype, a written spec and a fixed quote.' },
      { name: 'Build', price: null, note: 'Monthly instalments', detail: 'Two-week sprints, paid monthly across the build. Typical projects £18k–£60k.' },
    ],
    footnote: {
      title: 'Paying for a build',
      body: 'Builds are paid in equal monthly instalments across the project, agreed directly with Apex. They are not credit agreements, no interest is charged, and no credit check is carried out.',
    },
  },

  proof: {
    caseStudySlug: 'keystone-builders-quoting-tool',
    title: 'Keystone Builders quote in ten minutes instead of two hours',
    body: 'A quoting and job tracking tool replacing four spreadsheets, connected to Xero, built in five sprints.',
    quote: '“Our estimator used to spend Friday afternoons on quotes. Now he is on site, and quotes go out the same day.”',
    quoteBy: 'Managing Director, Keystone Builders — Construction, Kent',
    stats: [
      { value: '20 hrs', label: 'admin saved every week' },
      { value: '+31%', label: 'quotes won' },
      { value: '10 wks', label: 'from discovery to launch' },
    ],
  },

  voices: {
    ...voicesHeading,
    quotes: [
      { quote: '“We saw working software every fortnight. There was never a big reveal at the end.”', name: 'Neil Fletcher', role: 'Managing Director, Keystone Builders — Kent' },
      { quote: '“They took over a half-finished system from another agency and got it live in eight weeks.”', name: 'Sarah Mensah', role: 'Operations Director, logistics — Midlands' },
      { quote: '“The prototype from discovery was enough to raise our first round.”', name: 'Oliver Grant', role: 'Founder, education platform — London' },
    ],
    promises,
  },

  faq: {
    title: faqTitle,
    items: [
      { question: 'How much does custom software cost?', answer: 'Most of our builds fall between £18,000 and £60,000. After discovery you get a fixed quote, so the number does not move unless the scope does.' },
      { question: 'Who owns the code?', answer: 'You do, from the first commit. The code lives in a repository in your name and the intellectual property is assigned to you in the contract.' },
      { question: 'Can we pay monthly?', answer: 'Yes. Builds are paid in equal monthly instalments across the project, with no interest and no credit check.' },
      { question: 'What if we need changes mid-build?', answer: 'Priorities can change between sprints. We show you the effect on the timeline and cost before anything is agreed.' },
      { question: 'Do you support it after launch?', answer: 'Yes, on a monthly support plan covering hosting, monitoring, fixes and a set number of hours for new features.' },
    ],
  },

  cta: {
    title: 'Tell us about the problem',
    body: 'Book a free 45-minute scoping call. You will leave with a rough cost range and an honest view on whether custom software is the right answer.',
    primary: { label: 'Book a scoping call', target: 'contact' },
  },
}
