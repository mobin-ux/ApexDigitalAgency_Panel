<script setup lang="ts">
import type { ContactBudgetId, ContactReplyId, ContactServiceId } from '#shared/contact'
import { contactFieldError } from '#shared/contact'
import { contactBudgets, contactForm as contactFormData, contactReplies, contactServiceLabels, contactThanks } from '~/data/contact'

const page = useCmsContent('contact')
const contactForm = computed(() => {
  const f = page.value.form
  return {
    ...contactFormData,
    title: f.title,
    intro: f.intro,
    services: { label: f.servicesLabel, hint: f.servicesHint },
    budget: { label: f.budgetLabel, hint: f.budgetHint },
    reply: { label: f.replyLabel },
    submit: f.submit,
    hintReady: f.hintReady,
    hintMissing: f.hintMissing,
  }
})

/**
 * The message card. Name and email are the only required fields. Sending
 * posts to `/api/contact`; when the site cannot deliver it, the card says the
 * message was not sent and offers the visitor's own email with everything
 * they wrote, so nothing typed is lost and nothing claims to have arrived.
 */
const form = useContactForm()
const { fields, errors, touched, failure, status, summary } = form

const serviceIds = Object.keys(contactServiceLabels) as ContactServiceId[]
const budgetIds = Object.keys(contactBudgets) as ContactBudgetId[]
const replyIds = Object.keys(contactReplies) as ContactReplyId[]

const thanksTitle = useTemplateRef<HTMLHeadingElement>('thanksTitle')
const failureBox = useTemplateRef<HTMLDivElement>('failureBox')

const firstName = computed(() => fields.name.trim().split(/\s+/)[0] ?? '')
const hint = computed(() => form.canSend.value ? contactForm.value.hintReady : contactForm.value.hintMissing)

/**
 * A required field's error shows once it has been left, or a send was
 * attempted, and then follows the value live, so it clears as soon as it is fixed.
 */
function fieldError(field: 'name' | 'email' | 'phone' | 'business' | 'message') {
  if (field === 'name' || field === 'email') {
    return touched[field] ? contactFieldError(field, fields[field]) || undefined : undefined
  }
  return errors.value[field]
}

async function onSubmit() {
  const invalid = await form.submit()
  await nextTick()
  if (invalid) {
    document.getElementById(invalid)?.focus()
  }
  else if (status.value === 'sent') {
    thanksTitle.value?.focus()
  }
  else if (failure.value) {
    failureBox.value?.focus()
  }
}

async function again() {
  form.reset()
  await nextTick()
  document.getElementById('contact-name')?.focus()
}
</script>

<template>
  <div class="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-11">
    <form
      v-if="status !== 'sent'"
      class="flex flex-col gap-8"
      aria-labelledby="contact-form-title"
      novalidate
      @submit.prevent="onSubmit"
    >
      <div class="flex flex-col gap-2">
        <h2
          id="contact-form-title"
          class="font-display text-[1.875rem] leading-[1.1] font-bold tracking-[-0.026em] text-heading"
        >
          {{ contactForm.title }}
        </h2>
        <p class="text-[0.9375rem] leading-[1.6] text-body">
          {{ contactForm.intro }}
        </p>
      </div>

      <fieldset class="min-w-0">
        <legend class="mb-3.5 text-sm font-semibold text-heading">
          {{ contactForm.services.label }} <span class="font-normal text-muted">{{ contactForm.services.hint }}</span>
        </legend>
        <div class="flex flex-col gap-3.5">
          <div
            v-if="form.plan.value"
            class="flex items-center gap-3 rounded-md border border-violet-150 bg-violet-25 px-4 py-3"
          >
            <span
              class="inline-flex size-5.5 flex-none items-center justify-center rounded-full bg-violet-500 text-[0.6875rem] font-extrabold text-white"
              aria-hidden="true"
            >✓</span>
            <p class="text-sm text-heading">
              {{ contactForm.plan.before }} <strong class="font-bold text-violet-600">{{ form.plan.value }}</strong>{{ contactForm.plan.after }}
            </p>
            <button
              type="button"
              class="ml-auto text-[0.8125rem] font-semibold whitespace-nowrap text-body hover:text-heading"
              @click="form.plan.value = ''"
            >
              {{ contactForm.plan.remove }}<span class="sr-only"> {{ form.plan.value }}</span>
            </button>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="id in serviceIds"
              :key="id"
              type="button"
              :aria-pressed="form.services.value.includes(id)"
              class="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors duration-150"
              :class="form.services.value.includes(id)
                ? 'border-heading bg-heading text-white'
                : 'border-line-strong bg-white text-body hover:border-heading hover:text-heading'"
              @click="form.toggleService(id)"
            >
              <span
                v-if="form.services.value.includes(id)"
                aria-hidden="true"
              >✓</span>{{ contactServiceLabels[id] }}
            </button>
          </div>
        </div>
      </fieldset>

      <fieldset class="min-w-0">
        <legend class="mb-3.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm font-semibold text-heading">
          {{ contactForm.budget.label }} <span class="font-normal text-muted">{{ contactForm.budget.hint }}</span>
        </legend>
        <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          <button
            v-for="id in budgetIds"
            :key="id"
            type="button"
            :aria-pressed="form.budget.value === id"
            class="flex flex-col items-start gap-1.5 rounded-lg border-[1.5px] px-4 pt-4 pb-3.75 text-left transition duration-150 hover:border-violet-200"
            :class="form.budget.value === id
              ? 'border-violet-500 bg-violet-25 shadow-[0_10px_28px_rgb(125_83_242/0.16)]'
              : 'border-line-strong bg-white'"
            @click="form.toggleBudget(id)"
          >
            <span
              class="mb-1 inline-flex size-4.5 flex-none items-center justify-center rounded-full text-[0.625rem] text-white"
              :class="form.budget.value === id ? 'bg-violet-500' : 'border-[1.5px] border-line-dashed'"
              aria-hidden="true"
            >{{ form.budget.value === id ? '✓' : '' }}</span>
            <span
              class="font-display text-[1.1875rem] leading-[1.1] font-bold tracking-[-0.02em] whitespace-nowrap"
              :class="form.budget.value === id ? 'text-violet-600' : 'text-heading'"
            >{{ contactBudgets[id].label }}</span>
            <span class="text-[0.78125rem] leading-[1.4] text-muted">{{ contactBudgets[id].hint }}</span>
          </button>
        </div>
      </fieldset>

      <div class="grid gap-x-5 gap-y-4.5 sm:grid-cols-2">
        <UiField
          id="contact-name"
          v-model="fields.name"
          :label="contactForm.fields.name.label"
          :placeholder="contactForm.fields.name.placeholder"
          autocomplete="name"
          :maxlength="form.limits.name"
          :error="fieldError('name')"
          required
          @blur="form.check('name')"
        />
        <UiField
          id="contact-email"
          v-model="fields.email"
          type="email"
          inputmode="email"
          :label="contactForm.fields.email.label"
          :placeholder="contactForm.fields.email.placeholder"
          autocomplete="email"
          :maxlength="form.limits.email"
          :error="fieldError('email')"
          required
          @blur="form.check('email')"
        />
        <UiField
          id="contact-phone"
          v-model="fields.phone"
          type="tel"
          inputmode="tel"
          :label="contactForm.fields.phone.label"
          :placeholder="contactForm.fields.phone.placeholder"
          autocomplete="tel"
          :maxlength="form.limits.phone"
          :error="fieldError('phone')"
        />
        <UiField
          id="contact-business"
          v-model="fields.business"
          :label="contactForm.fields.business.label"
          :placeholder="contactForm.fields.business.placeholder"
          autocomplete="organization"
          :maxlength="form.limits.business"
          :error="fieldError('business')"
        />
        <UiField
          id="contact-message"
          v-model="fields.message"
          class="sm:col-span-2"
          :label="contactForm.fields.message.label"
          :placeholder="contactForm.fields.message.placeholder"
          :maxlength="form.limits.message"
          :error="fieldError('message')"
          multiline
        />
        <!-- Honeypot: off-screen, out of the tab order and hidden from assistive tech. -->
        <div
          class="absolute -left-[9999px] size-px overflow-hidden"
          aria-hidden="true"
        >
          <label for="contact-fax">Fax</label>
          <input
            id="contact-fax"
            v-model="form.trap.value"
            type="text"
            tabindex="-1"
            autocomplete="off"
          >
        </div>
      </div>

      <fieldset class="min-w-0">
        <legend class="mb-3.5 text-sm font-semibold text-heading">
          {{ contactForm.reply.label }}
        </legend>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="id in replyIds"
            :key="id"
            class="inline-flex cursor-pointer items-center gap-2.25 rounded-[0.75rem] border px-4 py-2.75 text-sm font-semibold whitespace-nowrap transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-violet-500"
            :class="form.reply.value === id
              ? 'border-violet-200 bg-violet-50 text-violet-600'
              : 'border-line-strong bg-white text-body hover:text-heading'"
          >
            <input
              v-model="form.reply.value"
              type="radio"
              name="contact-reply"
              :value="id"
              class="sr-only"
            >
            <span
              class="size-3.5 rounded-full"
              :class="form.reply.value === id ? 'border-[4.5px] border-violet-500' : 'border-[1.5px] border-line-dashed'"
              aria-hidden="true"
            />
            {{ contactReplies[id] }}
          </label>
        </div>
      </fieldset>

      <div
        v-if="failure"
        ref="failureBox"
        role="alert"
        tabindex="-1"
        class="flex flex-col gap-3 rounded-lg border border-danger bg-danger-50 p-5"
      >
        <p class="text-[0.9375rem] font-semibold text-danger-ink">
          {{ contactForm.errors.title }}
        </p>
        <p class="text-sm leading-[1.6] text-heading">
          {{ contactForm.errors[failure] }}
        </p>
        <div
          v-if="failure !== 'invalid'"
          class="flex flex-wrap items-center gap-4 pt-1"
        >
          <UiButton
            :href="form.mailtoHref.value"
            variant="ink"
            size="sm"
          >
            {{ contactForm.errors.email }}
          </UiButton>
        </div>
      </div>

      <div class="flex flex-col gap-4 border-t border-line-soft pt-6 sm:flex-row sm:items-center sm:gap-5">
        <UiButton
          type="submit"
          size="lg"
          class="sm:w-auto"
          :class="!form.canSend.value && 'cursor-not-allowed opacity-50 motion-safe:hover:translate-y-0'"
          :aria-disabled="!form.canSend.value || status === 'sending' ? 'true' : undefined"
          aria-describedby="contact-send-hint"
        >
          {{ status === 'sending' ? contactForm.sending : contactForm.submit }}
        </UiButton>
        <p
          id="contact-send-hint"
          class="text-[0.84375rem] leading-normal text-muted"
          aria-live="polite"
        >
          {{ hint }}
        </p>
      </div>
    </form>

    <div
      v-else
      class="flex flex-col gap-5.5 py-6 motion-safe:animate-rise"
    >
      <span
        class="inline-flex size-14 items-center justify-center rounded-full bg-success text-2xl text-white shadow-[0_12px_32px_rgb(34_176_125/0.28)]"
        aria-hidden="true"
      >✓</span>
      <h2
        ref="thanksTitle"
        tabindex="-1"
        class="font-display text-[clamp(1.75rem,1.4rem+1.4vw,2.25rem)] leading-[1.08] font-bold tracking-[-0.028em] text-heading outline-none"
      >
        {{ contactThanks.title(firstName) }}
      </h2>
      <p class="max-w-[52ch] text-base leading-[1.62] text-body">
        {{ contactThanks.body(fields.email.trim()) }}
      </p>
      <dl class="flex flex-col rounded-lg border border-line-soft bg-subtle px-5.5 py-1.5">
        <div class="grid grid-cols-[110px_minmax(0,1fr)] gap-4 border-b border-line py-3.5">
          <dt class="text-[0.8125rem] text-muted">
            {{ contactThanks.labels.services }}
          </dt>
          <dd class="text-[0.90625rem] font-semibold text-heading">
            {{ summary.services || contactThanks.unspecified }}
          </dd>
        </div>
        <div class="grid grid-cols-[110px_minmax(0,1fr)] gap-4 border-b border-line py-3.5">
          <dt class="text-[0.8125rem] text-muted">
            {{ contactThanks.labels.budget }}
          </dt>
          <dd class="text-[0.90625rem] font-semibold text-heading">
            {{ summary.budget || contactThanks.unspecified }}
          </dd>
        </div>
        <div class="grid grid-cols-[110px_minmax(0,1fr)] gap-4 py-3.5">
          <dt class="text-[0.8125rem] text-muted">
            {{ contactThanks.labels.reply }}
          </dt>
          <dd class="text-[0.90625rem] font-semibold text-heading">
            {{ summary.reply }}
          </dd>
        </div>
      </dl>
      <div class="flex flex-wrap items-center gap-5 pt-1.5">
        <UiButton
          :to="contactThanks.work.to"
          variant="ink"
        >
          {{ contactThanks.work.label }} <span
            class="text-violet-400"
            aria-hidden="true"
          >→</span>
        </UiButton>
        <button
          type="button"
          class="text-[0.90625rem] font-semibold text-violet-600 hover:underline"
          @click="again"
        >
          {{ contactThanks.again }}
        </button>
      </div>
    </div>
  </div>
</template>
