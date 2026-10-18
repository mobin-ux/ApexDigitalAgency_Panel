import type { MediaImage } from './content'
import { routes } from './routes'
import { company, reviewRating, teamSize } from './site'

/**
 * Copy for the About page (`About.dc.html`). Company facts — numbers, address,
 * hours — come from `site.ts`, where an unconfirmed value is an empty string
 * and its row, link or tick disappears from this page.
 *
 * TODO(content): everything below is the design's copy and needs confirming:
 * - The eight people, their roles, start years and bios must be real staff who
 *   have agreed to appear (with headshots). The design lists no James Cole,
 *   who is the byline on the website cost guide.
 * - Promise 04 says clients own everything "from day one"; the cost guide's
 *   FAQ says ownership transfers once the final payment clears.
 * - The two open roles, the studio timeline and the team photo caption.
 */

export const aboutSeo = {
  title: 'About Apex: the Kent team behind your project',
  description:
    'Meet the in-house Apex team in Maidstone, Kent: who will do your work, the promises in every contract, and the company details you can check before you sign.',
} as const

export const aboutHero = {
  eyebrow: 'About Apex',
  title: 'A Kent team you can meet, call and visit',
  lead: 'Apex is a registered UK company with every designer, developer and marketer on our own payroll. Nothing is handed off overseas. Below is who we are, where we work and how to check us out before you sign anything.',
  team: { label: 'Meet the team', to: '#team' },
  company: { label: 'Company details', to: '#company' },
  /** Shown over the team photo only once the photo exists. */
  photoCaption: 'The whole team, photographed in our studio',
} as const

/** TODO(content): the whole-team photo and the studio exterior (or a map image). */
export const aboutPhotos: { team?: MediaImage, studio?: MediaImage } = {}

export interface AboutStat {
  value: string
  label: string
  stars?: boolean
}

/** The three figures beside the hero; an unconfirmed one is left out. */
export const aboutStats: readonly AboutStat[] = ([
  { value: teamSize, label: 'people, all employed in-house' },
  { value: company.incorporated, label: `incorporated in ${company.registeredIn}` },
  { value: reviewRating.score, label: `on ${reviewRating.source} from verified clients`, stars: true },
] satisfies AboutStat[]).filter(stat => stat.value)

export const promises = {
  eyebrow: 'How we work',
  title: 'Four promises we put in every contract',
  lead: 'We started Apex because small businesses kept telling us the same story about agencies. These are the rules we set so that story does not repeat.',
  items: [
    { title: 'Everyone is on our payroll', body: 'No freelancers you have never met and no offshore handoffs. The people on this page build your project.' },
    { title: 'Prices in writing first', body: 'You get a fixed monthly figure and a scope before any work starts. It does not change unless you ask for more.' },
    { title: 'Measured after launch', body: 'We agree the numbers that matter at kick-off and report on them every month, good or bad.' },
    { title: 'You own what we make', body: 'Domain, code, designs and ad accounts are in your name from day one, whether you stay or leave.' },
  ],
} as const

export const departments = ['Design', 'Development', 'Marketing', 'Client team'] as const
export type Department = typeof departments[number]

export interface TeamMember {
  name: string
  role: string
  department: Department
  /** Year they joined. */
  since: string
  bio: string
  /** Profile URL; empty hides the LinkedIn button. */
  linkedin: string
  photo?: MediaImage
}

const teamMembers: readonly TeamMember[] = [
  { name: 'Daniel Okafor', role: 'Founder & CEO', department: 'Client team', since: '2024', bio: 'Ran digital for two Kent agencies before starting Apex. Signs off every plan.', linkedin: '' },
  { name: 'Sophie Turner', role: 'Head of Design', department: 'Design', since: '2024', bio: 'Leads brand and web design. Ten years across retail and hospitality.', linkedin: '' },
  { name: 'James Whitfield', role: 'Lead Developer', department: 'Development', since: '2024', bio: 'Owns hosting, performance and every site we put live.', linkedin: '' },
  { name: 'Amira Hassan', role: 'Head of Marketing', department: 'Marketing', since: '2024', bio: 'Runs SEO and paid media. Google Ads certified.', linkedin: '' },
  { name: 'Tom Reeves', role: 'UI/UX Designer', department: 'Design', since: '2025', bio: 'Tests every enquiry flow with real customers before launch.', linkedin: '' },
  { name: 'Grace Liu', role: 'Full-stack Developer', department: 'Development', since: '2025', bio: 'Builds client portals and the Apex dashboard.', linkedin: '' },
  { name: 'Ollie Barnes', role: 'SEO Specialist', department: 'Marketing', since: '2025', bio: 'Local search for trades and professional services.', linkedin: '' },
  { name: 'Hannah Price', role: 'Account Manager', department: 'Client team', since: '2025', bio: 'Your first point of contact after launch. Monthly reports come from her.', linkedin: '' },
]

export const team = {
  eyebrow: 'The team',
  title: 'The people who will actually do your work',
  lead: 'Your project gets a named lead from this list on day one. You will have their direct email and phone number, not a ticket queue.',
  everyone: 'Everyone',
  filterLabel: 'Filter the team by department',
  since: (year: string) => `Since ${year}`,
  members: teamMembers,
  /** Empty `title` hides the hiring card. */
  hiring: {
    title: 'We are hiring in Maidstone',
    body: 'Two roles open: mid-weight developer and PPC specialist. Hybrid, three days in the studio.',
    link: 'See open roles',
    to: routes.careers,
  },
}

export const paperwork = {
  eyebrow: 'Check us out',
  title: 'The paperwork, in one place',
  lead: 'Before you commit to a monthly plan you should be able to confirm who you are paying. Every number here can be checked on a public register.',
  request: {
    text: 'Need these for a supplier form? We can send a signed company information sheet.',
    link: 'Request it',
    subject: 'Company information sheet',
  },
} as const

export interface CompanyFact {
  label: string
  value: string
  link?: { label: string, href: string }
}

/** Each row is shown only when its fact is confirmed in `site.ts`, so no placeholder number is ever printed. */
export const companyFacts: readonly CompanyFact[] = ([
  { label: 'Registered name', value: company.legalName },
  {
    label: 'Company number',
    value: company.companyNumber,
    link: { label: 'Companies House', href: `https://find-and-update.company-information.service.gov.uk/company/${company.companyNumber}` },
  },
  { label: 'Incorporated', value: company.incorporated && `${company.incorporated}, ${company.registeredIn}` },
  {
    label: 'Registered office',
    value: company.address.street && [company.address.street, company.address.locality, company.address.postcode].filter(Boolean).join(', '),
  },
  {
    label: 'VAT number',
    value: company.vatNumber,
    link: { label: 'HMRC check', href: 'https://www.tax.service.gov.uk/check-vat-number/enter-vat-details' },
  },
  {
    label: 'Data protection',
    value: company.icoNumber && `ICO registration ${company.icoNumber}`,
    link: { label: 'ICO register', href: `https://ico.org.uk/ESDWebPages/Entry/${company.icoNumber}` },
  },
  { label: 'Insurance', value: company.insurance },
] satisfies CompanyFact[]).filter(fact => fact.value)

/** The ticks beside the paperwork: each one only when the fact behind it is confirmed. */
export const companyChecks: readonly string[] = [
  company.companyNumber && 'Registered UK limited company',
  company.icoNumber && 'ICO registered for data protection',
  company.insurance && 'Professional indemnity insured',
].filter(Boolean)

export const story = {
  eyebrow: 'Our story',
  title: 'Two years, one studio, no shortcuts',
  milestones: [
    { when: 'Spring 2024', title: 'Founded in Maidstone', body: 'Three people, one spare room and a first client who still pays monthly.' },
    { when: 'Autumn 2024', title: 'Monthly plans launched', body: 'Websites paid over 12 months, so small businesses could start without a big invoice.' },
    { when: 'Summer 2025', title: 'Moved into the studio', body: 'Team grew to ten and we opened a space clients can visit.' },
    { when: '2026', title: 'Client dashboard', body: 'Every client can now see progress, invoices and results in one login.' },
  ],
} as const

export const visit = {
  eyebrow: 'Visit the studio',
  title: 'Come and see where your site gets built',
  body: 'Kick-off meetings happen here for most Kent clients. Book a slot and the kettle will be on.',
  labels: { address: 'Address', hours: 'Hours', phone: 'Phone', email: 'Email' },
  button: 'Book a studio visit',
  directions: 'Get directions',
} as const

export const aboutCta = {
  eyebrow: 'Get in touch',
  title: 'Talk to the person who would lead your project',
  body: 'Tell us what you need. We will reply within one working day with a named lead, a written plan and a monthly figure.',
  button: 'Get in touch',
  facts: ([
    { label: 'Team', value: teamSize && `${teamSize}, all in-house`, strong: true },
    { label: 'Based', value: `${company.address.locality}, ${company.address.region}`, strong: true },
    { label: 'Reply', value: 'Within one working day', strong: false },
  ]).filter(fact => fact.value),
} as const
