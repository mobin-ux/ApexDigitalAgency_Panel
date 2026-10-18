/**
 * The contact form's contract, shared by the page and `POST /api/contact` so
 * the browser and the server apply the same rules to the same fields. The
 * visible copy for every option lives in `app/data/contact.ts`; this file only
 * holds identifiers and limits.
 */

import type { ServiceSlug } from '../app/data/routes'

export const contactServiceIds = [
  'website-design',
  'seo',
  'ppc',
  'digital-marketing',
  'software-development',
  'ui-ux-design',
  'branding',
  'not-sure',
] as const satisfies readonly (ServiceSlug | 'not-sure')[]

export const contactBudgetIds = ['under-250', '250-500', '500-1k', '1k-plus', 'not-sure'] as const
export const contactReplyIds = ['email', 'phone', 'visit'] as const

export type ContactServiceId = (typeof contactServiceIds)[number]
export type ContactBudgetId = (typeof contactBudgetIds)[number]
export type ContactReplyId = (typeof contactReplyIds)[number]

/** Longest value accepted for each free-text field, in characters. */
export const contactLimits = {
  name: 100,
  email: 254,
  phone: 30,
  business: 200,
  message: 5000,
  plan: 120,
} as const

export interface ContactSubmission {
  services: ContactServiceId[]
  budget: ContactBudgetId | null
  reply: ContactReplyId
  name: string
  email: string
  phone: string
  business: string
  message: string
  /** The plan the visitor arrived with ("SEO Growth plan"), already resolved by the page. */
  plan: string
}

export type ContactField = 'name' | 'email' | 'phone' | 'business' | 'message' | 'services' | 'budget' | 'reply' | 'plan'

export type ContactValidation
  = | { ok: true, data: ContactSubmission }
    | { ok: false, errors: Partial<Record<ContactField, string>> }

// Deliberately loose: one @, a dot in the domain, no spaces. The reply is the
// real check; a stricter pattern only rejects valid addresses.
const emailPattern = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

/** Field-level checks for the two required fields, used live by the page. */
export function contactFieldError(field: 'name' | 'email', value: string): string {
  const trimmed = value.trim()
  if (field === 'name') {
    return trimmed ? '' : 'Add your name.'
  }
  if (!trimmed) {
    return 'Add your email address.'
  }
  return emailPattern.test(trimmed) ? '' : 'Check your email address: it should look like jane@business.co.uk.'
}

/** Validates an untrusted body. Unknown keys are ignored; nothing is coerced into an option. */
export function validateContact(input: unknown): ContactValidation {
  const body = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const errors: Partial<Record<ContactField, string>> = {}

  const data: ContactSubmission = {
    services: [],
    budget: null,
    reply: 'email',
    name: text(body.name),
    email: text(body.email),
    phone: text(body.phone),
    business: text(body.business),
    message: text(body.message),
    plan: text(body.plan),
  }

  for (const field of ['name', 'email'] as const) {
    const error = contactFieldError(field, data[field])
    if (error) {
      errors[field] = error
    }
  }
  for (const field of ['name', 'email', 'phone', 'business', 'message', 'plan'] as const) {
    if (data[field].length > contactLimits[field]) {
      errors[field] = `Keep this under ${contactLimits[field]} characters.`
    }
  }

  if (Array.isArray(body.services) && body.services.every(id => oneOf(contactServiceIds, id))) {
    data.services = [...new Set(body.services as ContactServiceId[])]
  }
  else if (body.services !== undefined) {
    errors.services = 'Pick from the listed services.'
  }

  if (oneOf(contactBudgetIds, body.budget)) {
    data.budget = body.budget
  }
  else if (body.budget !== undefined && body.budget !== null) {
    errors.budget = 'Pick one of the listed budgets.'
  }

  if (oneOf(contactReplyIds, body.reply)) {
    data.reply = body.reply
  }
  else if (body.reply !== undefined) {
    errors.reply = 'Pick how we should reply.'
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data }
}
