import type { SeoValue, TemplateContent, TemplateKey } from '#shared/cms'
import type { Article } from './articles'
import type { CaseStudy } from './case-studies'
import type { ServicePageContent } from './service-pages/types'
import { aboutCta, aboutHero, aboutSeo, paperwork, promises, story, team, visit } from './about'
import { articleChrome, articleCta, keepReading } from './article-page'
import { caseStudyCta, sideCta, similarProjects } from './case-study-page'
import { contactFaq, contactForm, contactHero, contactSeo, contactStats, contactSteps, contactStudio } from './contact'
import { clients, faqs, heroStats, monthlyFinalStep, monthlySteps, trustMarks, whySwaps } from './home'
import { costAnswers, insightsBrowse, insightsCta, insightsFeatured, insightsHero, insightsSeo } from './insights'
import { nextProject, ourWorkCta, ourWorkHero, ourWorkSeo, ourWorkVoices } from './our-work'
import { homeAnchors, routes } from './routes'
import { orderingSteps, servicesSeo } from './services-page'
import { mainNav, seoDefaults } from './site'

/**
 * The code baseline: one complete document per template, built from the
 * data modules. These are exactly what the pages show: the panel's CMS
 * that could overlay them (ADR-021) was removed on 2026-10-31, so copy is
 * edited here and in the data modules. Every document is validated against
 * its template by the contract tests and once at render.
 */

function seo(title: string, description: string): SeoValue {
  return {
    title,
    description,
    canonical: '',
    robots: 'index,follow',
    ogTitle: '',
    ogDescription: '',
  }
}

const internal = (path: string) => ({ kind: 'internal' as const, path })

export const homeBaseline: TemplateContent<'home'> = {
  hero: {
    chip: 'A UK agency in Maidstone, Kent',
    title: 'Grow online. Pay monthly.',
    lead: 'Apex builds the websites, marketing and software that UK businesses grow on — and lets you spread the cost across twelve months instead of paying it all upfront.',
    primary: { label: 'Explore our services', link: internal(routes.services) },
    secondary: { label: 'See how monthly plans work', link: internal(`${routes.service('website-design')}#plans`) },
    stats: heroStats.map(s => ({ value: s.value, label: s.label })),
  },
  clients: {
    title: 'Trusted by UK businesses',
    names: [...clients],
  },
  services: {
    eyebrow: 'Services',
    title: 'Pick the problem. We do the rest.',
    text: 'Start with what is costing you money today. Add the others later from your dashboard.',
    all: 'All services',
  },
  monthly: {
    eyebrow: 'Pay monthly',
    title: 'Professional work without the upfront lump sum',
    text: 'Most of our clients are sole traders and small teams. Spread the cost over twelve months and pay for the project out of the revenue it brings in.',
    steps: monthlySteps.map(s => ({ title: s.title, body: s.body })),
    finalStep: { title: monthlyFinalStep.title, body: monthlyFinalStep.body },
  },
  work: {
    eyebrow: 'Our work',
    title: 'Results we can point at',
    all: 'See all case studies',
  },
  why: {
    eyebrow: 'Why work with us?',
    title: 'We swapped the awkward bits',
    text: 'Crossed out is how agencies usually work. Underneath is how we do it.',
    swaps: whySwaps.map(s => ({ before: s.before, after: s.after, note: s.note })),
    trust: trustMarks.map(t => ({ title: t.title, note: t.note })),
  },
  insights: {
    eyebrow: 'Our blog',
    title: 'Straight answers, before you spend anything',
    text: 'We publish what we would tell you on a call — costs, timelines and what actually works for UK businesses.',
    all: 'All insights',
  },
  faq: {
    eyebrow: 'Questions',
    title: 'The things people ask before they start',
    items: faqs.map(f => ({ question: f.question, answer: f.answer })),
  },
  cta: {
    eyebrow: 'Get in touch',
    title: 'Tell us what your business needs next',
    text: 'Fifteen minutes, an honest view of what will move the needle first, and a monthly figure. No pitch deck, no pressure.',
    button: 'Book a free call',
    replyLabel: 'Typical reply time',
    replyValue: 'Within one working day',
    clientLabel: 'Already a client?',
    clientValue: 'Start your next project',
    whereLabel: 'Where we are',
  },
  seo: seo(seoDefaults.title, seoDefaults.description),
}

export const servicesBaseline: TemplateContent<'services'> = {
  hero: {
    chip: 'All services',
    title: 'Start with the problem, not the service',
    lead: 'Tell us what you are trying to fix and we will show you the work that fixes it — with a monthly figure attached, so you know where you stand before you talk to anyone.',
  },
  finder: {
    title: 'What do you want to change?',
    hint: 'Pick one — the list below updates.',
    all: 'Show everything',
    emptyTitle: 'Nothing matches that on its own',
    emptyBody: 'It probably needs two services working together. A fifteen-minute call is the quickest way to work out which.',
    emptyButton: 'Book a free call',
  },
  combinations: {
    eyebrow: 'Combinations',
    title: 'Most businesses need two things, not one',
    text: 'A site with nobody visiting it does not sell, and traffic to a weak site does not either. These are the pairings we set up most often.',
  },
  ordering: {
    eyebrow: 'How ordering works',
    title: 'Every service ends in the same three steps',
    text: 'Choose a plan on the service page, create an account, then confirm the schedule in your dashboard. Nothing is taken before you have seen every payment date.',
    button: 'See a service page',
    steps: orderingSteps.map(s => ({ title: s.title, where: s.where })),
  },
  cta: {
    eyebrow: 'Not sure which one?',
    title: 'Describe the problem. We will tell you what it needs.',
    text: 'Fifteen minutes on a call, an honest recommendation, and a monthly figure. If one service is enough, we will say so.',
    button: 'Book a free call',
    replyNote: 'Within one working day',
  },
  seo: seo(servicesSeo.title, servicesSeo.description),
}

export const ourWorkBaseline: TemplateContent<'our-work'> = {
  hero: { eyebrow: ourWorkHero.eyebrow, title: ourWorkHero.title, lead: ourWorkHero.lead },
  next: { title: nextProject.title, body: nextProject.body, checks: [...nextProject.checks], button: nextProject.cta },
  voices: {
    eyebrow: ourWorkVoices.eyebrow,
    title: ourWorkVoices.title,
    intro: ourWorkVoices.intro,
    quotes: ourWorkVoices.quotes.map(q => ({ quote: q.quote, name: q.name, role: q.role, result: q.result })),
  },
  cta: { eyebrow: ourWorkCta.eyebrow, title: ourWorkCta.title, body: ourWorkCta.body, button: ourWorkCta.button },
  seo: seo(ourWorkSeo.title, ourWorkSeo.description),
}

export const insightsBaseline: TemplateContent<'insights'> = {
  hero: {
    eyebrow: insightsHero.eyebrow,
    title: insightsHero.title,
    lead: insightsHero.lead,
    searchLabel: insightsHero.searchLabel,
    searchPlaceholder: insightsHero.searchPlaceholder,
    searchButton: insightsHero.searchButton,
    popularLabel: insightsHero.popularLabel,
    popular: insightsHero.popular.map(p => ({ label: p.label, query: p.query })),
  },
  featured: { read: insightsFeatured.read, upcomingTitle: insightsFeatured.upcomingTitle },
  browse: {
    title: insightsBrowse.title,
    allTopics: insightsBrowse.allTopics,
    clear: insightsBrowse.clear,
    emptyTitle: insightsBrowse.empty.title,
    emptyBody: insightsBrowse.empty.body,
    emptyButton: insightsBrowse.empty.button,
    relatedService: insightsBrowse.relatedService,
  },
  costs: {
    eyebrow: costAnswers.eyebrow,
    title: costAnswers.title,
    lead: costAnswers.lead,
    compare: costAnswers.compare,
    market: costAnswers.market,
    withApex: costAnswers.withApex,
    quotedLabel: costAnswers.quoted.label,
    quotedValue: costAnswers.quoted.value,
    items: costAnswers.items.map(i => ({ question: i.question, market: i.market, service: i.service })),
  },
  cta: { eyebrow: insightsCta.eyebrow, title: insightsCta.title, body: insightsCta.body, button: insightsCta.button, checks: [...insightsCta.checks] },
  seo: seo(insightsSeo.title, insightsSeo.description),
}

export const aboutBaseline: TemplateContent<'about'> = {
  hero: {
    eyebrow: aboutHero.eyebrow,
    title: aboutHero.title,
    lead: aboutHero.lead,
    teamLink: aboutHero.team.label,
    companyLink: aboutHero.company.label,
    photoCaption: aboutHero.photoCaption,
  },
  promises: { eyebrow: promises.eyebrow, title: promises.title, lead: promises.lead, items: promises.items.map(i => ({ title: i.title, body: i.body })) },
  team: {
    eyebrow: team.eyebrow,
    title: team.title,
    lead: team.lead,
    everyone: team.everyone,
    filterLabel: team.filterLabel,
    since: 'Since {year}',
    hiring: { title: team.hiring.title, body: team.hiring.body, link: team.hiring.link },
  },
  paperwork: {
    eyebrow: paperwork.eyebrow,
    title: paperwork.title,
    lead: paperwork.lead,
    requestText: paperwork.request.text,
    requestLink: paperwork.request.link,
    requestSubject: paperwork.request.subject,
  },
  story: { eyebrow: story.eyebrow, title: story.title, milestones: story.milestones.map(m => ({ when: m.when, title: m.title, body: m.body })) },
  visit: { eyebrow: visit.eyebrow, title: visit.title, body: visit.body, button: visit.button, directions: visit.directions },
  cta: { eyebrow: aboutCta.eyebrow, title: aboutCta.title, body: aboutCta.body, button: aboutCta.button },
  seo: seo(aboutSeo.title, aboutSeo.description),
}

export const contactBaseline: TemplateContent<'contact'> = {
  hero: { eyebrow: contactHero.eyebrow, title: contactHero.title, lead: contactHero.lead },
  stats: contactStats.map(s => ({ value: s.value, label: s.label })),
  form: {
    title: contactForm.title,
    intro: contactForm.intro,
    servicesLabel: contactForm.services.label,
    servicesHint: contactForm.services.hint,
    budgetLabel: contactForm.budget.label,
    budgetHint: contactForm.budget.hint,
    replyLabel: contactForm.reply.label,
    submit: contactForm.submit,
    hintReady: contactForm.hintReady,
    hintMissing: contactForm.hintMissing,
  },
  steps: { label: contactSteps.label, items: contactSteps.items.map(i => ({ title: i.title, body: i.body })) },
  studio: {
    eyebrow: contactStudio.eyebrow,
    travel: contactStudio.travel,
    byAppointment: contactStudio.byAppointment,
    directions: contactStudio.directions,
    teamLink: contactStudio.team.label,
  },
  faq: { eyebrow: contactFaq.eyebrow, title: contactFaq.title, intro: contactFaq.intro, items: contactFaq.items.map(i => ({ question: i.question, answer: i.answer })) },
  seo: seo(contactSeo.title, contactSeo.description),
}

export function serviceBaseline(page: ServicePageContent): TemplateContent<'service'> {
  return {
    hero: { badge: page.hero.badge, title: page.hero.title, lead: page.hero.lead, checks: [...page.hero.checks] },
    faq: { title: page.faq.title, items: page.faq.items.map(i => ({ question: i.question, answer: i.answer })) },
    cta: { title: page.cta.title, body: page.cta.body },
    seo: seo(page.seo.title, page.seo.description),
  }
}

export function caseStudyBaseline(study: CaseStudy): TemplateContent<'case-study'> {
  const story = study.story
  return {
    title: story?.title ?? `${study.client} case study`,
    lead: story?.lead ?? study.summary,
    seo: {
      ...seo(story?.seo.title ?? `${study.client} case study`, story?.seo.description ?? study.summary),
      // A study without a written story is kept out of search (see nuxt.config's former route rule).
      robots: story ? 'index,follow' : 'noindex,follow',
    },
  }
}

export function articleBaseline(article: Article): TemplateContent<'article'> {
  return {
    title: article.title,
    excerpt: article.excerpt ?? '',
    lead: article.body?.lead ?? '',
    seo: seo(article.body?.seo.title ?? article.title, article.body?.seo.description ?? article.excerpt ?? ''),
  }
}

export const headerBaseline: TemplateContent<'header'> = {
  nav: mainNav.map(link => ({ label: link.label, link: internal(link.to) })),
  start: 'Get in touch',
  servicesLabel: 'Services',
  allServices: 'All services',
  menuDescription: 'Site navigation: services, pricing, our work, insights, about and contact.',
  sections: { home: 'Home', services: 'Services', ourWork: 'Our work', insights: 'Insights', about: 'About', contact: 'Contact' },
}

export const footerBaseline: TemplateContent<'footer'> = {
  strip: { title: 'Prefer to talk it through first?', text: 'Fifteen minutes, no pitch deck. We reply within one working day.' },
  groups: [
    {
      label: 'Company',
      links: [
        { label: 'About Apex', link: internal(routes.about) },
        { label: 'Our work', link: internal(routes.ourWork) },
        { label: 'Pay monthly', link: internal(`${routes.home}${homeAnchors.monthly}`) },
        { label: 'Careers', link: internal(routes.careers) },
        { label: 'Contact us', link: internal(routes.contact) },
      ],
    },
    {
      label: 'Resources',
      links: [
        { label: 'Insights blog', link: internal(routes.insights) },
        { label: 'Frequently asked questions', link: internal(`${routes.home}${homeAnchors.faq}`) },
        { label: 'Website cost guide', link: internal(routes.article('website-cost-uk-2026')) },
        { label: 'Instalment plan terms', link: internal(routes.legal.instalmentTerms) },
      ],
    },
    {
      label: 'Legal',
      links: [
        { label: 'Privacy notice', link: internal(routes.legal.privacy) },
        { label: 'Cookie policy', link: internal(routes.legal.cookies) },
        { label: 'Terms of service', link: internal(routes.legal.terms) },
        { label: 'Accessibility statement', link: internal(routes.legal.accessibility) },
        { label: 'Complaints procedure', link: internal(routes.legal.complaints) },
      ],
    },
  ],
  button: 'Book a free call',
  servicesLabel: 'Services',
  registeredIn: 'Registered in',
}

export const announcementBaseline: TemplateContent<'announcement'> = {
  enabled: false,
  text: '',
  link: undefined,
  tone: 'info',
  startsAt: '',
  endsAt: '',
}

export const serviceChromeBaseline: TemplateContent<'service-chrome'> = {
  ctaEyebrow: 'Ready when you are',
  call: 'Book a free call',
  emailLabel: 'Email',
  phoneLabel: 'Phone',
}

export const caseStudyChromeBaseline: TemplateContent<'case-study-chrome'> = {
  sideTitle: sideCta.title,
  sideButton: sideCta.button,
  fallbackEyebrow: caseStudyCta.fallback.eyebrow,
  fallbackTitle: caseStudyCta.fallback.title,
  fallbackBody: caseStudyCta.fallback.body,
  checks: [...caseStudyCta.checks],
  button: caseStudyCta.button,
  call: caseStudyCta.call,
  moreEyebrow: similarProjects.eyebrow,
  moreTitle: similarProjects.title,
  moreLink: similarProjects.link,
}

export const articleChromeBaseline: TemplateContent<'article-chrome'> = {
  updated: articleChrome.updated,
  byline: '{role}, Apex · {minutes} min read',
  share: articleChrome.share.label,
  copy: articleChrome.share.copy,
  copied: articleChrome.share.copied,
  copyFailed: articleChrome.share.failed,
  contents: articleChrome.contents,
  relatedService: articleChrome.sideService.label,
  viewService: articleChrome.sideService.link,
  writtenBy: articleChrome.writtenBy,
  ctaEyebrow: 'Related service · {service}',
  ctaButton: 'View {service}',
  ctaCall: articleCta.call,
  moreTitle: keepReading.title,
  moreLink: keepReading.link,
}

/** The fixed-key documents, by template: what the importer creates and what the site renders without a CMS. */
export const fixedBaselines = {
  'home': homeBaseline,
  'services': servicesBaseline,
  'our-work': ourWorkBaseline,
  'insights': insightsBaseline,
  'about': aboutBaseline,
  'contact': contactBaseline,
  'header': headerBaseline,
  'footer': footerBaseline,
  'announcement': announcementBaseline,
  'service-chrome': serviceChromeBaseline,
  'case-study-chrome': caseStudyChromeBaseline,
  'article-chrome': articleChromeBaseline,
} as const satisfies Partial<{ [K in TemplateKey]: TemplateContent<K> }>

export type FixedBaselineKey = keyof typeof fixedBaselines
