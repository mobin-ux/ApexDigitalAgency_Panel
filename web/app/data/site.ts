import { routes } from './routes'

export interface SocialProfile {
  label: string
  /** Two-letter glyph shown in the footer button. */
  short: string
  url: string
}

export interface Company {
  name: string
  legalName: string
  tagline: string
  email: string
  phone: string
  companyNumber: string
  vatNumber: string
  registeredIn: string
  address: { locality: string, region: string, country: string }
  social: readonly SocialProfile[]
}

/**
 * Company facts used by the footer, the contact blocks and structured data.
 *
 * Anything the business has not confirmed yet is an empty string. Components
 * render a field only when it is non-empty, so a placeholder can never reach
 * production (a made-up company number or phone line is a legal problem, not
 * just a content one). Fill them in here before launch.
 */
export const company: Company = {
  name: 'Apex Digital Agency',
  legalName: 'Apex Digital Agency Ltd',
  tagline: 'Design, development and marketing for UK businesses. In-house team, monthly payment plans.',
  email: 'ceo@digiapex.co.uk',
  /** TODO(content): confirm the real number — the design used a 01622 000 000 placeholder. */
  phone: '',
  /** TODO(legal): Companies House number — required on a UK company website. */
  companyNumber: '',
  /** TODO(legal): VAT number. */
  vatNumber: '',
  registeredIn: 'England & Wales',
  address: {
    locality: 'Maidstone',
    region: 'Kent',
    country: 'GB',
  },
  /** TODO(content): add the real profile URLs; empty entries are not rendered or put in JSON-LD. */
  social: [
    { label: 'LinkedIn', short: 'in', url: '' },
    { label: 'Instagram', short: 'ig', url: '' },
    { label: 'X', short: 'x', url: '' },
    { label: 'YouTube', short: 'yt', url: '' },
  ],
}

export const seoDefaults = {
  /** Homepage <title>; the site name is appended by the title template. */
  title: 'Websites, marketing & software, paid monthly',
  description:
    'Apex builds the websites, marketing and software UK businesses grow on. In-house team in Kent — spread the cost over 12 interest-free monthly payments.',
} as const

export const mainNav = [
  { label: 'Pay monthly', to: `${routes.home}#monthly` },
  { label: 'Our work', to: routes.ourWork },
  { label: 'Insights', to: routes.insights },
  { label: 'About', to: routes.about },
] as const
