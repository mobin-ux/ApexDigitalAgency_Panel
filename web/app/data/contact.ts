/**
 * Copy for the Contact page (`Contact.dc.html`). The form's identifiers and
 * limits live in `shared/contact.ts`; this file gives each of them its words.
 * The server imports it too, so the email the team receives uses the same
 * labels the visitor picked from.
 *
 * TODO(content): the reply promises ("within one working day", "4 hrs
 * average first reply", "a named lead replies") are the design's. Confirm each
 * is how the team actually works before launch, and how the 4 hours is measured.
 */

import type { ContactBudgetId, ContactReplyId, ContactServiceId } from '../../shared/contact'
import type { ServiceSlug } from './routes'
import { studio } from '../utils/studio'
import { brandPlans, marketingPlans, ppcPlans, seoPlans, uxPlans, websitePlans } from './plans'
import { routes } from './routes'
import { services } from './services'
import { company } from './site'

export const contactSeo = {
  title: 'Contact us: tell us what you need',
  description:
    'Send a message, email or visit the Maidstone studio. A named lead replies within one working day with a written plan and a monthly figure, free and with no obligation.',
} as const

/** "Within one working day": the one place the reply promise is worded. */
const replyWhen = 'within one working day'

export const contactHero = {
  eyebrow: 'Get in touch',
  title: 'Tell us what you need. We reply within one working day.',
  lead: 'Use the form, call, email or come to the studio. Whichever you pick, a named person from our team replies with a written plan and a monthly figure.',
} as const

export interface ContactStat {
  value: string
  label: string
}

/** An empty value hides its row. */
export const contactStats: readonly ContactStat[] = [
  /** TODO(content): measured how, over which period? Empty it until it is. */
  { value: '4 hrs', label: 'average first reply, Mon to Fri' },
  { value: '1 day', label: 'longest you will wait for a written plan' },
  { value: '£0', label: 'for the plan, with no obligation to go ahead' },
].filter(stat => stat.value)

/** The short service names the chips show; derived from the catalogue, so a rename cannot drift. */
export const contactServiceLabels: Record<ContactServiceId, string> = {
  ...(Object.fromEntries(services.map(service => [service.slug, service.tag])) as Record<ServiceSlug, string>),
  'not-sure': 'Not sure yet',
}

export const contactBudgets: Record<ContactBudgetId, { label: string, hint: string }> = {
  'under-250': { label: 'Under £250', hint: 'Starter website' },
  '250-500': { label: '£250–£500', hint: 'Website plus local SEO' },
  '500-1k': { label: '£500–£1k', hint: 'Site, SEO and ads' },
  '1k-plus': { label: '£1k+', hint: 'Full growth or software' },
  'not-sure': { label: 'Not sure', hint: 'We will recommend one' },
}

export const contactReplies: Record<ContactReplyId, string> = {
  email: 'Email',
  phone: 'Phone call',
  visit: 'Studio visit',
}

const planCatalogues: Partial<Record<ServiceSlug, readonly { id: string, name: string }[]>> = {
  'website-design': websitePlans,
  'seo': seoPlans,
  'ppc': ppcPlans,
  'digital-marketing': marketingPlans,
  'ui-ux-design': uxPlans,
  'branding': brandPlans,
}

/**
 * The plan a service page's "Start your order" sent the visitor with
 * (`?service=seo&plan=growth` → "SEO Growth plan"). Only a plan that exists in
 * the catalogue resolves; anything else in the query string is ignored rather
 * than echoed back.
 */
export function resolvePlan(service: string | null, plan: string | null): { service: ContactServiceId, label: string } | null {
  if (!service || !plan) {
    return null
  }
  const found = planCatalogues[service as ServiceSlug]?.find(item => item.id === plan)
  return found ? { service: service as ContactServiceId, label: `${contactServiceLabels[service as ContactServiceId]} ${found.name} plan` } : null
}

export const contactForm = {
  title: 'Send us a message',
  intro: 'Takes about two minutes. Only your name and email are required.',
  services: { label: 'What can we help with?', hint: 'Pick any' },
  plan: {
    before: 'You chose the',
    after: '. We will confirm the details in our reply.',
    remove: 'Remove',
  },
  budget: { label: 'Rough monthly budget', hint: 'Helps us suggest the right plan. You can change it later.' },
  fields: {
    name: { label: 'Your name', placeholder: 'Jane Smith' },
    email: { label: 'Email', placeholder: 'jane@business.co.uk' },
    phone: { label: 'Phone', placeholder: '07700 900000' },
    business: { label: 'Business or website', placeholder: 'yourbusiness.co.uk' },
    message: { label: 'Tell us a bit more', placeholder: 'What does your business do, and what would you like to change?' },
  },
  required: 'required',
  reply: { label: 'How should we reply?' },
  submit: 'Send message',
  sending: 'Sending…',
  hintReady: `A named lead replies ${replyWhen}.`,
  hintMissing: 'Add your name and a valid email to send.',
  errors: {
    title: 'Your message has not been sent',
    /** No mail provider is configured, or it is down: nothing reached the team. */
    unavailable: 'We could not send it from the site just now. Email it to us instead; the button below opens your email with everything you wrote.',
    failed: 'Something went wrong on our side. Try again, or email it to us with everything you wrote.',
    rateLimited: 'You have sent several messages in a few minutes. Wait a little before trying again, or email us instead.',
    invalid: 'Some details need another look. They are marked below.',
    retry: 'Try again',
    email: 'Email your message instead',
  },
  /** Subject of the mailto fallback, and of the "Request it" style links. */
  mailSubject: 'Enquiry from the website',
} as const

export const contactThanks = {
  title: (firstName: string) => `Thanks${firstName ? `, ${firstName}` : ''}. Your message is with the team.`,
  // The design says "We have sent a copy to …". The site sends no copy (an
  // auto-reply from a public form can be aimed at anyone's inbox), so the
  // line promises only what happens next.
  body: (email: string) => `Expect a reply ${replyWhen} at ${email}, from the lead who would run your project.`,
  labels: { services: 'Services', budget: 'Budget', reply: 'Reply by' },
  unspecified: 'Not specified',
  work: { label: 'Browse our work while you wait', to: routes.ourWork },
  again: 'Send another message',
} as const

export interface ContactMethod {
  glyph: string
  label: string
  value: string
  note: string
  href: string
  external?: boolean
}

/** TODO(content): the booking page for the 15-minute call (the design links "#"). Empty hides the card. */
const bookingUrl = ''
const linkedin = company.social.find(profile => profile.label === 'LinkedIn')?.url ?? ''

/** The four ways to reach us beside the form. A method shows only once its destination is real. */
export const contactMethods: readonly ContactMethod[] = [
  { glyph: '☎', label: 'Call', value: company.phone, note: company.openingHours, href: studio.telHref },
  { glyph: '@', label: 'Email', value: company.email, note: `Reply ${replyWhen}`, href: `mailto:${company.email}` },
  { glyph: '15', label: 'Book a call', value: '15-minute video chat', note: 'Pick a time that suits you', href: bookingUrl, external: true },
  { glyph: 'in', label: 'LinkedIn', value: company.name, note: 'Message us directly', href: linkedin, external: true },
].filter(method => method.href && method.value)

export const contactSteps = {
  label: 'What happens next',
  items: [
    { title: 'We read it properly', body: 'A lead from the relevant team reviews your message, site and competitors.' },
    { title: 'You get a written plan', body: `Scope, timeline and a fixed monthly figure, sent ${replyWhen}.` },
    { title: 'Talk if you want to', body: 'Reply, book a call or visit the studio. There is no obligation.' },
  ],
} as const

export const contactStudio = {
  eyebrow: 'The studio',
  title: `${company.address.locality}, ${company.address.region}`,
  /** TODO(content): true of the real address? Shown only once the street address is confirmed. */
  travel: 'Free parking on site. Ten minutes from Maidstone East station and junction 6 of the M20.',
  labels: { address: 'Address', hours: 'Hours' },
  byAppointment: 'Visits by appointment',
  directions: 'Get directions',
  team: { label: 'Meet the team', to: routes.about },
} as const

export const contactFaq = {
  eyebrow: 'Before you get in touch',
  title: 'Common questions',
  intro: 'Anything else, just ask in the form. There are no silly questions about budgets.',
  items: [
    { question: 'Do I need to know exactly what I want?', answer: 'No. Tick “Not sure yet” and describe the problem. We will suggest what would help and what it would cost.' },
    { question: 'Is the written plan really free?', answer: 'Yes. You get a scope, a timeline and a monthly figure with no obligation. Most plans arrive the same day.' },
    { question: 'Will I be passed to a salesperson?', answer: 'No. The person who replies is the lead who would run your project, and they stay your contact throughout.' },
    { question: 'Do you work with businesses outside Kent?', answer: 'Yes. About half our clients are elsewhere in the UK. We run kick-offs on video and visit when it is useful.' },
  ],
} as const
