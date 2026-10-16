import type { ServicePageContent } from './types'
import { formatGbp } from '../../utils/format'
import { brandPlans, monthlyPlanTotal } from '../plans'
import { examplesCallout, faqTitle, monthly, promises, technologyLegend, usually, voicesHeading } from './shared'

/** /services/branding — copy from `ServicePage.dc.html` + `service-data.js` (`brand`). */

const [starter, identity, brandWeb] = brandPlans
const from = monthly(starter)

export const brandingPage: ServicePageContent = {
  slug: 'branding',
  seo: {
    title: `Branding and logos from ${from} a month`,
    description: `Logos, identities and print for new and rebranding UK businesses. A complete brand in two to three weeks, with full copyright and source files, from ${from} a month.`,
  },

  hero: {
    badge: 'Entry service for new businesses',
    title: 'Look as established as you are',
    lead: `Logos, identities and print for new and rebranding UK businesses. A complete brand in two to three weeks, from ${from} a month.`,
    checks: [
      'Three distinct directions to choose from',
      'Every file format you will ever need',
      'Brand guidelines your printer can follow',
    ],
    primary: { label: 'See the plans', target: 'plans' },
    secondary: { label: 'Book a free call', target: 'contact' },
  },
  visual: {
    kind: 'brand',
    url: 'brand.yourbusiness.co.uk',
    metricLabel: 'Assets delivered',
    metric: '64',
    toastTitle: 'Direction approved',
    toastSub: 'Option B · 10 min ago',
  },
  stats: [
    { value: '2–3', label: 'weeks to a finished brand' },
    { value: from, label: 'per month, from' },
    { value: '3', label: 'directions to choose from' },
    { value: '100%', label: 'files and rights yours' },
  ],

  audiences: {
    title: 'Built for three kinds of business',
    intro: 'A brand has to work on the van, the invoice and the website. We design for the places you will actually use it.',
    cards: [
      { tag: 'Just starting', title: 'You need a name to look real', body: 'New businesses who need a logo, colours and cards to start trading with confidence.', foot: usually(starter) },
      { tag: 'Rebranding', title: 'You have outgrown the old logo', body: 'Established businesses whose identity no longer matches the size or quality of the work.', foot: usually(identity) },
      { tag: 'Launching and building', title: 'You need the brand and the site', body: 'Identity, then a website built on it, so everything looks like one company from day one.', foot: usually(brandWeb) },
    ],
  },

  offering: {
    eyebrow: 'What we design',
    title: 'Everything with your name on it',
    intro: 'Start with the identity, then add what you need as you grow.',
    rows: [
      { title: 'Logo and identity', detail: 'Mark, colours, type and usage rules', time: '2 wks' },
      { title: 'Brand guidelines', detail: 'A short guide anyone can follow', time: '1 wk' },
      { title: 'Stationery', detail: 'Business cards, letterheads, email signatures', time: '3 days' },
      { title: 'Signage and vehicles', detail: 'Shopfronts, van wraps, site boards', time: '1 wk' },
      { title: 'Print and marketing', detail: 'Brochures, flyers, menus and leaflets', time: '3–5 days' },
      { title: 'Social templates', detail: 'Editable posts and stories in your style', time: '3 days' },
    ],
  },

  technology: {
    eyebrow: 'Deliverables',
    title: 'Files for every place you will use them',
    intro: 'You receive every file in every format, organised so you can find the right one without calling us.',
    checks: ['Full copyright assigned to you', 'Editable source files included'],
    legend: technologyLegend,
    groups: [
      {
        title: 'Design',
        summary: 'Where the work is made',
        marks: [
          { name: 'Illustrator', recommended: true },
          { name: 'Figma', icon: 'figma', recommended: true },
          { name: 'InDesign' },
        ],
      },
      {
        title: 'Formats',
        summary: 'Print, screen and signage',
        marks: [
          { name: 'SVG', icon: 'svg', recommended: true },
          { name: 'PDF', recommended: true },
          { name: 'PNG' },
          { name: 'EPS' },
        ],
      },
      {
        title: 'Editable templates',
        summary: 'For your own team',
        marks: [
          { name: 'Canva', recommended: true },
          { name: 'Google Slides', icon: 'googleslides' },
          { name: 'Word' },
        ],
      },
      {
        title: 'Print partners',
        summary: 'Trusted UK suppliers',
        marks: [
          { name: 'Local printers', recommended: true },
          { name: 'Signmakers' },
        ],
      },
    ],
  },

  process: {
    title: 'Three weeks from brief to brand',
    intro: 'You see three genuinely different directions, choose one, and refine it with us until it is right.',
    steps: [
      { when: 'Day 1', title: 'Call and brief', body: 'Your business, customers, competitors and the feeling you want to give.', you: 'Answer eight questions' },
      { when: 'Week 1', title: 'Three directions', body: 'Three distinct logo and colour routes, each shown in real use.', you: 'Pick one' },
      { when: 'Week 2', title: 'Refine', body: 'Two rounds of changes on your chosen direction.', you: 'Give feedback' },
      { when: 'Week 2', title: 'Roll out', body: 'Stationery, social templates and any print applied to the new identity.', you: 'Approve the set' },
      { when: 'Week 3', title: 'Hand over', body: 'Guidelines and every file delivered, with copyright assigned.', you: 'Download the files' },
    ],
    note: 'Total time from you across the whole project: about two hours.',
  },

  work: {
    title: 'Brands we have made for UK businesses',
    cases: [
      { slug: 'cole-plumbing-identity-livery', sector: 'Trades · Kent', title: 'Identity and van livery for a plumber', results: [{ value: '+3×', label: 'direct calls' }, { value: '2 wks', label: 'to finish' }], stack: 'Identity', thumb: 'lead', tint: 'violet' },
      { slug: 'cafe-rebrand-menus-signage', sector: 'Hospitality · London', title: 'Café rebrand, menus and signage', results: [{ value: '+22%', label: 'footfall' }, { value: '3 wks', label: 'to finish' }], stack: 'Rebrand', thumb: 'lead', tint: 'periwinkle' },
      { slug: 'accountancy-launch-brand-site', sector: 'Professional · Maidstone', title: 'Accountancy launch, brand and site', results: [{ value: '40', label: 'clients in year one' }, { value: '6 wks', label: 'brand + site' }], stack: 'Brand + Web', thumb: 'lead', tint: 'lilac' },
    ],
    callout: examplesCallout,
  },

  plans: {
    kind: 'monthly',
    title: 'Choose a plan, pay monthly',
    // The design said "six equal monthly payments"; Brand + Web runs for twelve.
    intro: 'A small deposit, then equal monthly payments. Every plan includes full copyright and source files.',
    featured: identity.id,
    items: [
      { ...starter, fit: 'A logo and essentials to start trading.', featuresHeading: 'What you get', features: ['Two logo directions', 'Colour and type palette', 'Business card design', 'Email signature', 'All file formats'] },
      { ...identity, fit: 'A complete brand for established businesses.', featuresHeading: `Everything in ${starter.name}, plus`, features: ['Three logo directions', 'Brand guidelines', 'Full stationery set', 'Social media templates', 'Two rounds of refinements'], flag: 'Most chosen' },
      { ...brandWeb, fit: 'Identity and a website built on it.', featuresHeading: `Everything in ${identity.name}, plus`, features: ['Five-page website', 'Copy support', 'Hosting and maintenance', 'Signage or vehicle design', 'Launch in about 6 weeks'] },
    ],
    footnote: {
      title: 'How the instalments work',
      body: 'A deposit, then equal monthly payments. Instalment plans are payment schedules for our own services, agreed directly with Apex. They are not credit agreements, no interest is charged, and no credit check is carried out.',
    },
  },

  proof: {
    caseStudySlug: 'cole-plumbing-identity-livery',
    title: 'Cole Plumbing went from word of mouth to recognised on sight',
    body: `A new identity, van livery and business cards on the ${identity.name} plan, finished in two weeks.`,
    quote: '“People flag the van down now. The phone number on the side brings in more work than our old website ever did.”',
    quoteBy: 'Owner, Cole Plumbing — Trades, Kent',
    stats: [
      { value: '+3×', label: 'calls from the vans' },
      { value: '2 wks', label: 'from brief to files' },
      // The design printed £1,643; the plan's deposit plus six payments is the
      // figure that is actually charged, so it is derived.
      { value: formatGbp(monthlyPlanTotal(identity)!), label: 'total, over six months' },
    ],
  },

  voices: {
    ...voicesHeading,
    quotes: [
      { quote: '“Three directions that were actually different. Choosing was the hardest part.”', name: 'Jamie Cole', role: 'Owner, Cole Plumbing — Kent' },
      { quote: '“The guidelines meant our sign maker got it right first time.”', name: 'Nadia Rahman', role: 'Owner, café — London' },
      { quote: '“We launched with a brand and a website that looked like a firm three times our size.”', name: 'Paul Hewitt', role: 'Partner, accountancy practice — Maidstone' },
    ],
    promises,
  },

  faq: {
    title: faqTitle,
    items: [
      { question: 'How many logo options will I see?', answer: `Two on ${starter.name}, three on ${identity.name} and ${brandWeb.name}. Each is a genuinely different direction, shown on real items like a van, a card and a website.` },
      { question: 'Do I own the logo?', answer: 'Yes. Full copyright is assigned to you on the final payment, and you receive every source file.' },
      { question: 'What if I do not like any of the directions?', answer: 'We run a fresh round based on your feedback at no extra cost. It rarely happens, because we spend time on the brief first.' },
      { question: 'Can you print things for us?', answer: 'We prepare print-ready files and can arrange printing through trusted UK suppliers at cost, or send the files to your own printer.' },
      { question: 'Can I add a website later?', answer: 'Yes. Your branding fee is credited against a Website Design plan if you add one within six months.' },
    ],
  },

  cta: {
    title: `Start your brand from ${from} a month`,
    body: 'Book a free call and tell us about your business. We will suggest the right plan and send examples from your sector.',
    primary: { label: 'See the plans', target: 'plans' },
  },
}
