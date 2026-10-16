import type { InstalmentPlan } from '../plans'
import type { ServicePageContent } from './types'
import { formatGbp } from '../../utils/format'
import { featuredCaseStudy } from '../content'
import { defaultPlanTerm, websitePlans } from '../plans'

/**
 * /services/website-design — copy from `Service - Website Design.dc.html`.
 *
 * TODO(content): every case-study figure, client quote and named person on
 * this page must be confirmed as real, with the client's consent to be named,
 * before launch. UK law (DMCC Act 2024) treats invented testimonials as a
 * banned practice.
 */

const [enquiries, roas, launch] = featuredCaseStudy.results

// Prices in the copy come from the plan catalogue, so changing a plan changes
// every sentence that quotes it.
const [starter, growth, complete] = websitePlans
const monthly = (plan: InstalmentPlan) => formatGbp(plan.monthly[defaultPlanTerm])
const from = monthly(starter)

export const websiteDesignPage: ServicePageContent = {
  slug: 'website-design',
  seo: {
    title: `Website design from ${from} a month`,
    description:
      `Websites designed, written and built to win enquiries. Live in four to six weeks, hosting included, you own the code. Pay monthly from ${from}, no interest.`,
  },

  hero: {
    badge: 'Most popular service',
    title: 'A website that brings in work',
    lead: `Designed, written and built for UK businesses that need enquiries — not a portfolio piece. Live in four to six weeks, from ${from} a month.`,
    checks: [
      'Copy support, hosting and maintenance included',
      'Search Engine Optimisation (SEO) foundations from day one',
      'You own the site, the code and the domain',
    ],
    primary: { label: 'See the plans', target: 'plans' },
    secondary: { label: 'Book a free call', target: 'contact' },
  },
  visual: {
    kind: 'site',
    url: 'yourbusiness.co.uk',
    metricLabel: 'Enquiries this month',
    metric: '128',
    toastTitle: 'New enquiry',
    toastSub: 'Quote request · 2 min ago',
    card: {
      label: 'Your plan',
      value: from,
      unit: ' /month',
      note: `${defaultPlanTerm} payments · no interest · VAT included`,
    },
  },
  stats: [
    { value: '4–6', label: 'weeks to launch' },
    { value: from, label: `per month, ${defaultPlanTerm} months` },
    { value: '128', label: 'sites built and launched' },
    { value: '100%', label: 'code and files handed over' },
  ],

  audiences: {
    title: 'Built for three kinds of UK business',
    intro: 'The plan you need depends far more on how you win work than on how big you are. Find yourself below.',
    cards: [
      { tag: 'Sole trader', title: 'You are the business', body: 'Trades, consultants and self-employed professionals who need to look established and be reachable in one tap.', foot: `Usually ${starter.name} · ${monthly(starter)}/mo` },
      { tag: 'Growing SME', title: 'You need work every month', body: 'Five to fifty staff, with capacity to fill and a site that should be generating enquiries on its own.', foot: `Usually ${growth.name} · ${monthly(growth)}/mo` },
      { tag: 'Multi-site or online retail', title: 'You sell in more than one place', body: 'Several locations, an online shop or a booking system, with stock and payments to keep in step.', foot: `Usually ${complete.name} · ${monthly(complete)}/mo` },
    ],
  },

  offering: {
    eyebrow: 'What we build',
    title: 'Every kind of website, for every kind of business',
    intro: 'Ten build types, fourteen sectors, one process and one monthly plan.',
    rows: [
      { title: 'Brochure and lead generation', detail: 'Five to twelve pages built around the enquiry', time: '4–5 wks' },
      { title: 'E-commerce', detail: 'Catalogue, payments, shipping and stock', time: '6–8 wks' },
      { title: 'Booking and appointments', detail: 'Live availability, deposits, reminders', time: '5–6 wks' },
      { title: 'Multi-location', detail: 'A page per branch, ranking in its own town', time: '6 wks' },
      { title: 'Campaign landing pages', detail: 'One page built to convert paid traffic', time: '1–2 wks' },
      { title: 'Membership and subscription', detail: 'Logins, gated content, recurring payments', time: '6–8 wks' },
      { title: 'Directories and marketplaces', detail: 'Listings, search and routed enquiries', time: '8–10 wks' },
      { title: 'Portals and web apps', detail: 'Quoting, tracking and account tools', time: '10+ wks' },
      { title: 'Content and publishing', detail: 'Article volume, categories, ad slots', time: '5–7 wks' },
      { title: 'Rebuilds and migrations', detail: 'Same domain, rankings and redirects kept', time: '4–6 wks' },
    ],
    industries: {
      title: 'Industries we build for',
      note: 'Same process in all of them.',
      items: [
        { glyph: 'wrench', name: 'Trades and construction', examples: 'Builders, electricians, plumbers, roofers' },
        { glyph: 'home', name: 'Property', examples: 'Estate agents, developers, architects' },
        { glyph: 'heart-pulse', name: 'Health and care', examples: 'Clinics, dentists, care homes, veterinary' },
        { glyph: 'briefcase', name: 'Professional services', examples: 'Accountants, solicitors, recruiters' },
        { glyph: 'shopping-bag', name: 'Retail and e-commerce', examples: 'Shops, D2C brands, wholesalers' },
        { glyph: 'utensils', name: 'Hospitality and leisure', examples: 'Restaurants, pubs, hotels, venues' },
        { glyph: 'dumbbell', name: 'Beauty and fitness', examples: 'Salons, barbers, spas, gyms' },
        { glyph: 'graduation-cap', name: 'Education and training', examples: 'Schools, nurseries, tutors, providers' },
        { glyph: 'car', name: 'Automotive and transport', examples: 'Garages, dealerships, haulage' },
        { glyph: 'factory', name: 'Manufacturing and industrial', examples: 'Engineering, distribution, energy' },
        { glyph: 'code', name: 'Technology and B2B', examples: 'SaaS, telecoms, data, agencies' },
        { glyph: 'users', name: 'Charity and public sector', examples: 'Charities, housing, councils' },
        { glyph: 'camera', name: 'Creative and events', examples: 'Photographers, studios, organisers' },
        { glyph: 'sprout', name: 'Agriculture and rural', examples: 'Farms, equestrian, garden centres' },
      ],
      cta: { lead: 'Not listed?', link: 'Tell us your trade', tail: 'and we will show you a site like it.' },
    },
  },

  technology: {
    eyebrow: 'Technology',
    title: 'Any technology your project needs',
    intro: 'We are not tied to one platform. We choose what fits the job, tell you why in plain English, and build it so anyone can take it on after us.',
    checks: ['No proprietary platform, no licence to us', 'You own the code, the domain and the accounts'],
    legend: 'Violet marks what we most often recommend',
    groups: [
      {
        title: 'Content management',
        summary: 'So you can edit the site yourself',
        marks: [
          { name: 'WordPress', icon: 'wordpress', recommended: true },
          { name: 'Webflow', icon: 'webflow', recommended: true },
          { name: 'Sanity', icon: 'sanity' },
          { name: 'Contentful', icon: 'contentful' },
          { name: 'Statamic', icon: 'statamic' },
        ],
      },
      {
        title: 'Front end',
        summary: 'Where speed and search performance are won',
        marks: [
          { name: 'Next.js', icon: 'nextdotjs', recommended: true },
          { name: 'Astro', icon: 'astro', recommended: true },
          { name: 'React', icon: 'react' },
          { name: 'TypeScript', icon: 'typescript' },
          { name: 'Tailwind', icon: 'tailwindcss' },
        ],
      },
      {
        title: 'Selling online',
        summary: 'Payments, stock and shipping',
        marks: [
          { name: 'Shopify', icon: 'shopify', recommended: true },
          { name: 'WooCommerce', icon: 'woocommerce', recommended: true },
          { name: 'Stripe', icon: 'stripe' },
          { name: 'Klarna', icon: 'klarna' },
          { name: 'PayPal', icon: 'paypal' },
        ],
      },
      {
        title: 'Hosting',
        summary: 'UK and EU regions, GDPR compliant',
        marks: [
          { name: 'Vercel', icon: 'vercel', recommended: true },
          { name: 'Cloudflare', icon: 'cloudflare', recommended: true },
          { name: 'Google Cloud', icon: 'googlecloud' },
          { name: 'DigitalOcean', icon: 'digitalocean' },
        ],
      },
      {
        title: 'Talking to your other tools',
        summary: 'The site feeds the systems you already run',
        wide: true,
        marks: [
          { name: 'Analytics 4', icon: 'googleanalytics' },
          { name: 'HubSpot', icon: 'hubspot' },
          { name: 'Mailchimp', icon: 'mailchimp' },
          { name: 'Xero', icon: 'xero' },
          { name: 'Calendly', icon: 'calendly' },
          { name: 'Zapier', icon: 'zapier' },
          { name: 'QuickBooks', icon: 'quickbooks' },
          { name: 'Intercom', icon: 'intercom' },
        ],
      },
    ],
    extras: {
      title: 'And anything else the brief calls for',
      body: 'Already on a stack? We will work in it, or tell you honestly if moving is worth the cost.',
      marks: [
        { name: 'Laravel', icon: 'laravel' },
        { name: 'PHP', icon: 'php' },
        { name: 'Python', icon: 'python' },
        { name: 'Django', icon: 'django' },
        { name: 'Node.js', icon: 'nodedotjs' },
        { name: 'Vue', icon: 'vuedotjs' },
        { name: 'Svelte', icon: 'svelte' },
        { name: '.NET', icon: 'dotnet' },
        { name: 'PostgreSQL', icon: 'postgresql' },
        { name: 'MySQL', icon: 'mysql' },
        { name: 'MongoDB', icon: 'mongodb' },
        { name: 'Supabase', icon: 'supabase' },
        { name: 'Firebase', icon: 'firebase' },
        { name: 'Netlify', icon: 'netlify' },
        { name: 'BigCommerce', icon: 'bigcommerce' },
        { name: 'Umbraco', icon: 'umbraco' },
        { name: 'Drupal', icon: 'drupal' },
        { name: 'Craft CMS', icon: 'craftcms' },
        { name: 'Shopware', icon: 'shopware' },
        { name: 'Strapi', icon: 'strapi' },
        { name: 'Flutter', icon: 'flutter' },
        { name: 'Swift', icon: 'swift' },
        { name: 'Kotlin', icon: 'kotlin' },
        { name: 'Docker', icon: 'docker' },
      ],
      cta: 'Ask about your stack',
    },
  },

  process: {
    title: 'Five weeks, five steps, no mystery',
    intro: 'You see progress in your dashboard at every stage, and nothing moves forward without your sign-off.',
    steps: [
      { when: 'Day 1', title: 'Call and brief', body: 'Fifteen minutes on your business, your customers and what counts as success.', you: 'Answer six questions' },
      { when: 'Week 1', title: 'Structure and copy', body: 'Pages, order and words agreed before any design work starts.', you: 'Approve the outline' },
      { when: 'Weeks 2–3', title: 'Design', body: 'Homepage first for sign-off, then the rest of the site follows it.', you: 'Sign off the homepage' },
      { when: 'Week 4', title: 'Build and test', body: 'Built, checked on real devices, with speed and forms tested end to end.', you: 'Send final content' },
      { when: 'Week 5', title: 'Launch and handover', body: 'Live, indexed, and every account and file transferred to your name.', you: 'Take the keys' },
    ],
    note: 'Total time from you across the whole build: about two hours.',
    tickLastStep: true,
  },

  work: {
    title: 'Sites we have built for UK businesses',
    cases: [
      { slug: 'hartley-and-sons', sector: 'Trades · Kent', title: 'Hartley & Sons — five-page lead site', results: [{ value: enquiries.value, label: 'enquiries' }, { value: launch.value, label: 'to launch' }], stack: 'WordPress', thumb: 'lead', tint: 'violet' },
      { slug: 'restaurant-group-bookings', sector: 'Hospitality · London', title: 'Two-site restaurant group with live booking', results: [{ value: '+61%', label: 'bookings' }, { value: '6 wks', label: 'to launch' }], stack: 'Next.js', thumb: 'booking', tint: 'periwinkle' },
      { slug: 'retail-rebrand-rebuild', sector: 'Retail · Nationwide', title: 'Rebrand and online shop rebuild', results: [{ value: '+38%', label: 'conversion' }, { value: '8 wks', label: 'to launch' }], stack: 'Shopify', thumb: 'shop', tint: 'lilac' },
      { slug: 'client-portal-admin-hours', sector: 'Professional services · Kent', title: 'Client portal and marketing site', results: [{ value: '20 hrs', label: 'admin saved' }, { value: '7 wks', label: 'to launch' }], stack: 'Next.js', thumb: 'portal', tint: 'violet' },
      { slug: 'three-clinic-booking', sector: 'Healthcare · Maidstone', title: 'Three-clinic site with appointment booking', results: [{ value: '+92%', label: 'appointments' }, { value: '6 wks', label: 'to launch' }], stack: 'Webflow', thumb: 'calendar', tint: 'periwinkle' },
      { slug: 'construction-rescue-rebuild', sector: 'Construction · South East', title: 'Rescue rebuild on the same domain', results: [{ value: '+147%', label: 'organic traffic' }, { value: '4 wks', label: 'to launch' }], stack: 'Astro', thumb: 'rebuild', tint: 'lilac' },
    ],
    callout: {
      title: 'Want to see one like yours?',
      body: 'Tell us your sector and we will send two relevant examples with the numbers behind them.',
      cta: 'Request examples',
    },
  },

  plans: {
    kind: 'terms',
    title: 'Choose a plan, pay monthly',
    intro: 'A deposit, then equal monthly payments. Hosting, maintenance and support are included for the whole term, and one-off pricing is available on request.',
    catalogue: websitePlans,
    featured: 'growth',
    termNotes: {
      12: 'Lower monthly figure, spread over a year.',
      6: 'Higher monthly figure, lower total — paid off in six months.',
    },
    cards: [
      {
        id: 'starter',
        fit: 'Sole traders who need to look established and take enquiries.',
        featuresHeading: 'What you get',
        features: ['Up to 5 pages', 'Contact form and map', 'Hosting, maintenance and support', 'Google Business Profile setup', 'Launch in about 5 weeks'],
      },
      {
        id: 'growth',
        fit: 'Businesses that need the site to generate work every month.',
        featuresHeading: 'Everything in Starter, plus',
        features: ['Up to 12 pages', 'Copywriting on every page', 'Search Engine Optimisation (SEO) foundations', 'Booking or payment integration', 'Monthly enquiry report'],
        flag: 'Most chosen',
      },
      {
        id: 'complete',
        fit: 'Multi-location or e-commerce businesses with more moving parts.',
        featuresHeading: 'Everything in Growth, plus',
        features: ['Unlimited pages', 'Online shop or client portal', 'Photography day included', 'Priority support and quarterly reviews', 'Dedicated account manager'],
      },
    ],
    compare: [
      { label: 'Pages', values: { starter: 'Up to 5', growth: 'Up to 12', complete: 'Unlimited' } },
      { label: 'Design', values: { starter: 'Template-led', growth: 'Custom design', complete: 'Custom design' } },
      { label: 'Copywriting', values: { starter: false, growth: 'Every page', complete: 'Every page' } },
      { label: 'SEO foundations', values: { starter: 'Basic', growth: true, complete: true } },
      { label: 'Booking or payments', values: { starter: false, growth: true, complete: true } },
      { label: 'Online shop or portal', values: { starter: false, growth: false, complete: true } },
      { label: 'Photography', values: { starter: false, growth: false, complete: 'One day' } },
      { label: 'Reporting', values: { starter: false, growth: 'Monthly', complete: 'Monthly + reviews' } },
      { label: 'Support response', values: { starter: '2 working days', growth: 'Next working day', complete: 'Same day' } },
      { label: 'Hosting and maintenance', values: { starter: true, growth: true, complete: true } },
      { label: 'You own the code and accounts', values: { starter: true, growth: true, complete: true } },
    ],
    footnote: {
      title: 'How the instalments work',
      body: 'A deposit, then equal monthly payments for the rest of the term. Instalment plans are payment schedules for our own services, agreed directly with Apex. They are not credit agreements, no interest is charged, and no credit check is carried out.',
    },
  },

  proof: {
    caseStudySlug: featuredCaseStudy.slug,
    title: featuredCaseStudy.title,
    body: 'A five-page site, local Search Engine Optimisation (SEO) and a small paid budget on the Growth plan. The phone started ringing before the third instalment.',
    quote: featuredCaseStudy.quote,
    quoteBy: `${featuredCaseStudy.quoteBy} — Trades, Kent`,
    stats: [
      { value: enquiries.value, label: 'enquiries within three months' },
      { value: launch.value, label: 'from first call to launch' },
      { value: roas.value, label: 'return on their ad spend' },
    ],
  },

  voices: {
    title: 'Ordinary businesses, plainly said',
    intro: 'Every quote below is from a UK client on a monthly plan. We will put you in touch with any of them.',
    quotes: [
      { quote: '“The designer on the first call was the one who built it. That never happened with our last agency.”', name: 'Daniel Hartley', role: 'Owner, Hartley & Sons — Trades, Kent' },
      { quote: '“We paid monthly out of the bookings the site brought in. It funded itself by month four.”', name: 'Sofia Marchetti', role: 'Director, two-site restaurant group — London' },
      { quote: '“They moved us off our old platform and gave us the code. No arguments, no lock-in.”', name: 'James Okafor', role: 'Managing Director, retail — Nationwide' },
    ],
    promises: [
      { title: 'Fixed monthly figure', body: 'Agreed before we start, unchanged for the term.' },
      { title: 'You own everything', body: 'Code, files, domain and accounts in your name.' },
      { title: 'Named team, no outsourcing', body: 'In-house designers and developers in Kent.' },
      { title: 'Accessible and GDPR compliant', body: 'WCAG AA checked, data held in UK and EU regions.' },
    ],
  },

  faq: {
    title: 'Before you order',
    items: [
      { question: 'What do you need from me to start?', answer: 'Your logo if you have one, any photos you want used, and fifteen minutes on a call. We write the first draft of the copy, so you are editing rather than starting from a blank page.' },
      { question: 'What happens at the end of the term?', answer: 'The site is paid for and yours. Hosting and maintenance continue on a small monthly plan if you want us to keep looking after it, or we hand everything over and you take it elsewhere. Nothing renews automatically without your agreement.' },
      { question: 'Can I pay for the site outright instead?', answer: 'Yes. One-off pricing is available on request for any plan — ask on the call or in your dashboard and we will send the figure. Most clients choose monthly because it keeps cash in the business.' },
      { question: 'Do you write the content for me?', answer: 'Copy support is included on the Growth and Complete plans: we draft every page from the brief and your existing material, then you review it. Starter includes structure and headings, with the body copy from you.' },
      { question: 'What if I already have a website?', answer: 'We rebuild on your existing domain and keep your rankings intact with redirects, so nothing is lost in the move. Your current site stays live until the new one is signed off.' },
    ],
  },

  cta: {
    title: `Start your website from ${from} a month`,
    body: 'Pick a plan and set your order up in the dashboard, or book a call first and we will do it with you. Nothing is taken until you have seen every payment date.',
    primary: { label: 'Start your order', target: 'order' },
  },
}
