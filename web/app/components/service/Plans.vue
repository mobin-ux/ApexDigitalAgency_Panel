<script setup lang="ts">
import type { PlanId, PlanTerm } from '~/data/plans'
import type { PlanCardView, ServicePageContent } from '~/data/service-pages/types'
import { billingNote, defaultPlanTerm, maxShortTermSaving, planTerms, planTotal } from '~/data/plans'
import { routes } from '~/data/routes'
import { formatGbp } from '~/utils/format'

/**
 * The plans section, in one of three forms (see `ServicePlans`):
 *
 * - `terms`: instalment plans with a 12 / 6-month switch. The prerendered HTML
 *   carries the standard term, and every figure comes from the catalogue, so
 *   the switch can never show a sum that does not add up.
 * - `monthly`: one monthly figure per plan.
 *
 * In both, "Start your order" opens the contact form with the plan named.
 * - `scoping`: no price list; the steps from a free call to a quoted build.
 */
const props = defineProps<{ page: ServicePageContent }>()

const { contact } = useServiceLinks(props.page.slug)
const plans = props.page.plans
const term = ref<PlanTerm>(defaultPlanTerm)

function termLabel(value: PlanTerm) {
  return value === defaultPlanTerm ? `${value} months` : `${value} months · save up to ${formatGbp(maxShortTermSaving())}`
}

const cards = computed<PlanCardView[]>(() => {
  if (plans.kind === 'terms') {
    return plans.cards.map((card) => {
      const plan = plans.catalogue.find(p => p.id === card.id)!
      const monthly = formatGbp(plan.monthly[term.value])
      return {
        ...card,
        name: plan.name,
        featured: card.id === plans.featured,
        price: monthly,
        detail: `${formatGbp(plan.deposit)} deposit, then ${term.value} × ${monthly}`,
        chip: `Total ${formatGbp(planTotal(plan, term.value))} inc. VAT · 0% interest`,
        order: { to: contact(card.id) },
        orderContext: `${plan.name}, ${term.value} months`,
      }
    })
  }
  if (plans.kind === 'monthly') {
    return plans.items.map(plan => ({
      ...plan,
      featured: plan.id === plans.featured,
      price: formatGbp(plan.monthly),
      chip: billingNote(plan),
      order: { to: contact(plan.id) },
      orderContext: `${plan.name} plan`,
    }))
  }
  return []
})

// The comparison table's footer links.
const compareOrders = computed(() => Object.fromEntries(
  cards.value.map(card => [card.id, card.order.to]),
) as Record<PlanId, string>)

// Retainers are governed by the general terms; anything paid in instalments
// (including a quoted software build) by the instalment terms.
const termsLink = plans.kind === 'monthly' && plans.items[0]?.billing.kind === 'retainer'
  ? routes.legal.terms
  : routes.legal.instalmentTerms
</script>

<template>
  <section
    id="plans"
    aria-labelledby="plans-title"
  >
    <div class="container-page flex flex-col gap-10 py-20 lg:py-26">
      <div class="mx-auto flex max-w-180 flex-col items-center gap-4.5 text-center">
        <UiSectionHeader
          id="plans-title"
          :eyebrow="plans.kind === 'scoping' ? 'Pricing' : 'Plans'"
          :title="plans.title"
          align="center"
        />
        <p
          class="text-[1.0625rem] leading-[1.62] text-pretty text-body"
          :class="plans.kind === 'terms' ? 'max-w-[54ch]' : 'max-w-[56ch]'"
        >
          {{ plans.intro }}
        </p>
        <div
          v-if="plans.kind === 'terms'"
          class="mt-1.5 flex flex-col items-center gap-2.5"
        >
          <div
            role="group"
            aria-label="Payment term"
            class="inline-flex flex-wrap justify-center gap-1 rounded-3xl border border-line bg-subtle p-1.25 sm:rounded-full"
          >
            <button
              v-for="option in planTerms"
              :key="option"
              type="button"
              :aria-pressed="term === option"
              class="min-h-10 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
              :class="term === option ? 'bg-heading text-white' : 'text-body hover:text-heading'"
              @click="term = option"
            >
              {{ termLabel(option) }}
            </button>
          </div>
          <p
            class="text-[0.84375rem] text-muted"
            aria-live="polite"
          >
            {{ plans.termNotes[term] }}
          </p>
        </div>
      </div>

      <ul
        v-if="cards.length"
        class="grid gap-6 lg:grid-cols-3"
      >
        <ServicePlanCard
          v-for="plan in cards"
          :key="plan.id"
          :plan="plan"
        />
      </ul>

      <ServicePlansCompare
        v-if="plans.kind === 'terms' && plans.compare"
        :catalogue="plans.catalogue"
        :rows="plans.compare"
        :featured="plans.featured"
        :orders="compareOrders"
      />

      <ServicePlansScoping
        v-if="plans.kind === 'scoping'"
        :steps="plans.steps"
        :contact-href="contact()"
      />

      <div class="grid gap-6 rounded-[22px] border border-line bg-subtle px-6 py-6.5 sm:px-7.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8">
        <div class="flex max-w-[76ch] flex-col gap-1.25">
          <h3 class="font-display text-[1.03125rem] font-semibold tracking-[-0.012em] text-heading">
            {{ plans.footnote.title }}
          </h3>
          <p class="text-sm leading-relaxed text-body">
            {{ plans.footnote.body }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-x-5.5 gap-y-3">
          <NuxtLink
            :to="termsLink"
            class="text-sm font-semibold text-violet-600 hover:underline"
          >
            Read the full terms <span aria-hidden="true">→</span>
          </NuxtLink>
          <UiButton
            :to="contact()"
            size="lg"
          >
            Book a 15-minute call
          </UiButton>
        </div>
      </div>
    </div>
  </section>
</template>
