/**
 * Homepage copy that is not shared with other pages.
 * British spelling, sentence case, no emoji outside the two eyebrow chips.
 */

import { projectsDelivered } from './site'

export interface PaymentPlan {
  id: 'starter' | 'growth' | 'complete'
  label: string
  /** Monthly payment in pounds, inc. VAT. */
  monthly: number
  /** Deposit due today, in pounds. */
  deposit: number
}

/**
 * Example plans for the monthly-payment explainer. The total is derived
 * (`deposit + monthly × term`), never typed in, so it cannot drift.
 */
export const paymentPlans: readonly PaymentPlan[] = [
  { id: 'starter', label: 'Starter', monthly: 149, deposit: 299 },
  { id: 'growth', label: 'Growth', monthly: 299, deposit: 499 },
  { id: 'complete', label: 'Complete', monthly: 499, deposit: 799 },
]

export const planTermMonths = 12

export const heroStats = [
  { value: projectsDelivered, label: 'Projects delivered' },
  { value: '12 months', label: 'Interest-free instalments' },
  { value: 'UK only', label: 'In-house, never offshored' },
] as const

/** TODO(content): replace with real client marks (SVG) once permission is confirmed. */
export const clients = ['Penta', 'Saona', 'Chain', 'Snowflake', 'Vision', 'Hartley & Sons'] as const

export const monthlySteps = [
  {
    title: 'Choose a plan on the service page',
    body: 'Monthly figure, term and what is included, stated on the card. VAT shown.',
  },
  {
    title: 'Create your account',
    body: 'Your name and email. Your plan carries over, so nothing is entered twice.',
  },
  {
    title: 'Confirm the schedule',
    body: 'Review the brief, the add-ons and every payment date in your dashboard.',
  },
] as const

export const monthlyFinalStep = {
  title: 'Work starts the same week',
  body: 'Instalment plans are payment schedules for our own services, agreed directly with Apex. They are not credit agreements and no interest is charged.',
} as const

export const whySwaps = [
  {
    before: 'An account manager',
    after: 'The person who builds it',
    note: 'In-house team in Maidstone, Kent',
  },
  {
    before: 'Their platform, their licence',
    after: 'Your code. Your keys.',
    note: 'Files, domain and ad accounts handed over',
  },
  {
    before: 'Chasing email threads',
    after: 'One live dashboard',
    note: 'Progress, files and invoices in one place',
  },
] as const

export const trustMarks = [
  { title: 'Companies House', note: 'Registered in England & Wales' },
  { title: 'VAT registered', note: 'GBP prices, VAT always stated' },
  { title: 'UK GDPR compliant', note: 'Data held in UK and EU regions' },
  { title: 'Kent and London', note: 'Video calls UK-wide, in person locally' },
] as const

export interface Faq {
  question: string
  answer: string
}

export const faqs: readonly Faq[] = [
  {
    question: 'How do the monthly payments work?',
    answer:
      'You choose a plan, pay a deposit, then pay the balance in equal monthly amounts over twelve months. There is no interest and no credit check — it is a payment schedule for our own services, agreed directly with us. Every date and amount is shown in your dashboard before you confirm.',
  },
  {
    question: 'What does a website actually cost?',
    answer:
      'Website Design plans start at £149 per month over twelve months. Larger builds and software projects are quoted after a short call, because the honest answer depends on the number of pages, integrations and content involved. One-off pricing is available on request.',
  },
  {
    question: 'How long does a project take?',
    answer:
      'Most websites go live in four to six weeks from the point we have your content. Branding takes two to three weeks, marketing starts within days of approval, and software is delivered in two-week sprints with something to look at after each one.',
  },
  {
    question: 'Do I own the website and the code?',
    answer:
      'Yes. On completion of the plan, the site, source code, design files, domain and any advertising accounts are all in your name. If you ever leave, everything goes with you.',
  },
  {
    question: 'Where are you based, and can we meet?',
    answer:
      'Our team is in Maidstone, Kent, and we work with clients across the UK. Video calls suit most projects, and we are happy to meet in person in Kent, London and the South East.',
  },
  {
    question: 'What happens after the twelve months?',
    answer:
      'The project is paid for and yours. Hosting and maintenance continue on a small monthly plan if you want us to keep looking after it, and marketing retainers simply carry on month to month. Nothing rolls over automatically without your agreement.',
  },
]
