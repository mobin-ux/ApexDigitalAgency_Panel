import type { ContactBudgetId, ContactField, ContactReplyId, ContactServiceId } from '#shared/contact'
import { contactFieldError, contactLimits, validateContact } from '#shared/contact'
import { contactBudgets, contactForm, contactReplies, contactServiceLabels, resolvePlan } from '~/data/contact'
import { company } from '~/data/site'

/**
 * Why a send did not go through. `unavailable` means nothing reached the team
 * (no mail provider, or it is down), so the page offers the visitor's own email
 * with everything they wrote instead of losing it.
 */
export type ContactFailure = 'unavailable' | 'failed' | 'rateLimited' | 'invalid'

/**
 * State and sending for the contact form. The page is prerendered, so the plan
 * a service page sent the visitor with (`?service=&plan=`) is read once
 * mounted, as the services finder reads `?goal=`.
 */
export function useContactForm() {
  const services = ref<ContactServiceId[]>([])
  const budget = ref<ContactBudgetId | null>(null)
  const reply = ref<ContactReplyId>('email')
  const plan = ref('')
  const fields = reactive({ name: '', email: '', phone: '', business: '', message: '' })
  /** Honeypot: hidden from people, filled in by form-filling bots. */
  const trap = ref('')

  const status = ref<'idle' | 'sending' | 'sent'>('idle')
  const failure = ref<ContactFailure | null>(null)
  const errors = ref<Partial<Record<ContactField, string>>>({})
  /** Only fields the visitor has left (or tried to send) show an error. */
  const touched = reactive({ name: false, email: false })

  const route = useRoute()
  onMounted(() => {
    const service = typeof route.query.service === 'string' ? route.query.service : null
    const chosen = resolvePlan(service, typeof route.query.plan === 'string' ? route.query.plan : null)
    if (chosen) {
      plan.value = chosen.label
    }
    const known = Object.keys(contactServiceLabels).includes(service ?? '')
    if (known) {
      services.value = [service as ContactServiceId]
    }
  })

  const canSend = computed(() => !contactFieldError('name', fields.name) && !contactFieldError('email', fields.email))

  /** Marks a required field as left, so its error starts to show. */
  function check(field: 'name' | 'email') {
    touched[field] = true
  }

  function toggleService(id: ContactServiceId) {
    services.value = services.value.includes(id)
      ? services.value.filter(item => item !== id)
      : [...services.value, id]
  }

  function toggleBudget(id: ContactBudgetId) {
    budget.value = budget.value === id ? null : id
  }

  function payload() {
    return {
      services: services.value,
      budget: budget.value,
      reply: reply.value,
      plan: plan.value,
      ...fields,
      fax: trap.value,
    }
  }

  /** Returns the id of the first field to fix, so the page can move focus there. */
  async function submit(): Promise<string | null> {
    if (status.value === 'sending') {
      return null
    }
    const result = validateContact(payload())
    if (!result.ok) {
      touched.name = true
      touched.email = true
      errors.value = result.errors
      failure.value = null
      return firstInvalid(result.errors)
    }

    status.value = 'sending'
    failure.value = null
    try {
      await $fetch('/api/contact', { method: 'POST', body: payload(), timeout: 15_000 })
      status.value = 'sent'
      return null
    }
    catch (error: unknown) {
      status.value = 'idle'
      const code = (error as { statusCode?: number }).statusCode
      if (code === 422) {
        errors.value = ((error as { data?: { data?: { errors?: typeof errors.value } } }).data?.data?.errors) ?? {}
        failure.value = 'invalid'
        return firstInvalid(errors.value)
      }
      failure.value = code === 429 ? 'rateLimited' : code === 503 || code === 502 ? 'unavailable' : 'failed'
      return null
    }
  }

  function firstInvalid(found: Partial<Record<ContactField, string>>): string | null {
    const order: ContactField[] = ['name', 'email', 'phone', 'business', 'message']
    const field = order.find(item => found[item])
    return field ? `contact-${field}` : null
  }

  function reset() {
    services.value = []
    budget.value = null
    reply.value = 'email'
    plan.value = ''
    Object.assign(fields, { name: '', email: '', phone: '', business: '', message: '' })
    Object.assign(touched, { name: false, email: false })
    errors.value = {}
    failure.value = null
    status.value = 'idle'
  }

  /** What the visitor chose, in words, for the thank-you summary and the email fallback. */
  const summary = computed(() => ({
    services: [services.value.map(id => contactServiceLabels[id]).join(', '), plan.value].filter(Boolean).join(' · '),
    budget: budget.value ? contactBudgets[budget.value].label : '',
    reply: contactReplies[reply.value],
  }))

  /** A mailto: link carrying the whole message, for when the site cannot send it. */
  const mailtoHref = computed(() => {
    const lines = [
      fields.message,
      '',
      summary.value.services && `Services: ${summary.value.services}`,
      summary.value.budget && `Budget: ${summary.value.budget}`,
      `Reply by: ${summary.value.reply}`,
      `Name: ${fields.name}`,
      fields.phone && `Phone: ${fields.phone}`,
      fields.business && `Business: ${fields.business}`,
    ].filter(line => line !== '')
    const query = new URLSearchParams({ subject: contactForm.mailSubject, body: lines.join('\n') })
    // URLSearchParams writes spaces as "+", which mail clients print literally.
    return `mailto:${company.email}?${query.toString().replace(/\+/g, '%20')}`
  })

  return {
    services,
    budget,
    reply,
    plan,
    fields,
    trap,
    status,
    failure,
    errors,
    touched,
    canSend,
    summary,
    mailtoHref,
    limits: contactLimits,
    check,
    toggleService,
    toggleBudget,
    submit,
    reset,
  }
}
