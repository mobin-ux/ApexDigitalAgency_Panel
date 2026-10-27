/**
 * Every internal URL the site links to, in one place.
 *
 * Pages are linked by their final URL even before the page exists, so adding
 * a page never means touching the components that point at it.
 * Built so far: `home`, `services`, all seven `service(slug)` pages, `ourWork`,
 * `caseStudy(slug)`, `insights`, `article(slug)` for written articles, `about`
 * and `contact`; every other URL is a page still to come. Link an article with
 * `articleLink()`, which gives '' for one that is not written yet.
 */

export const routes = {
  home: '/',
  services: '/services',
  service: (slug: ServiceSlug) => `/services/${slug}` as const,
  ourWork: '/our-work',
  caseStudy: (slug: string) => `/our-work/${slug}` as const,
  insights: '/insights',
  article: (slug: string) => `/insights/${slug}` as const,
  about: '/about',
  contact: '/contact',
  careers: '/careers',
  legal: {
    privacy: '/legal/privacy',
    cookies: '/legal/cookies',
    terms: '/legal/terms',
    accessibility: '/legal/accessibility',
    complaints: '/legal/complaints',
    instalmentTerms: '/legal/instalment-terms',
  },
} as const

/** Anchors on the homepage, shared by the nav, the footer and the sections. */
export const homeAnchors = {
  services: '#services',
  monthly: '#monthly',
  work: '#work',
  why: '#why',
  insights: '#insights',
  faq: '#faq',
} as const

export type ServiceSlug
  = | 'website-design'
    | 'software-development'
    | 'digital-marketing'
    | 'seo'
    | 'ppc'
    | 'ui-ux-design'
    | 'branding'
