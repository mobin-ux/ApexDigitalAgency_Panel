<script setup lang="ts">
import type { PlanTerm } from '~/data/plans'
import type { ServicePageContent } from '~/data/service-pages/types'
import { defaultPlanTerm, maxShortTermSaving, planTerms, planTotal } from '~/data/plans'
import { routes } from '~/data/routes'
import { formatGbp } from '~/utils/format'

/**
 * Plan cards with a 12 / 6-month term switch. The prerendered HTML carries the
 * standard term; every figure — monthly, deposit line and total — comes from
 * the plan catalogue, so the switch can never show a sum that does not add up.
 *
 * "Start your order" opens the panel's New Order wizard with the service,
 * plan and term in the query string; the wizard reads `service` today.
 */
const props = defineProps<{ page: ServicePageContent }>()

const panel = usePanelLinks()
const term = ref<PlanTerm>(defaultPlanTerm)

function termLabel(value: PlanTerm) {
  return value === defaultPlanTerm ? `${value} months` : `${value} months · save up to ${formatGbp(maxShortTermSaving())}`
}

const plans = computed(() => props.page.plans.cards.map((card) => {
  const plan = props.page.plans.catalogue.find(p => p.id === card.id)!
  return {
    ...card,
    name: plan.name,
    deposit: formatGbp(plan.deposit),
    monthly: formatGbp(plan.monthly[term.value]),
    total: formatGbp(planTotal(plan, term.value)),
    featured: card.id === props.page.plans.featured,
    orderUrl: panel.orderFor(props.page.slug, { plan: card.id, term: term.value }),
  }
}))
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
          eyebrow="Plans"
          :title="page.plans.title"
          align="center"
        />
        <p class="max-w-[54ch] text-[1.0625rem] leading-[1.62] text-body">
          {{ page.plans.intro }}
        </p>
        <div class="mt-1.5 flex flex-col items-center gap-2.5">
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
            {{ page.plans.termNotes[term] }}
          </p>
        </div>
      </div>

      <ul class="grid gap-6 lg:grid-cols-3">
        <li
          v-for="plan in plans"
          :key="plan.id"
          class="relative grid gap-5 overflow-hidden rounded-[26px] px-6 py-8 sm:px-8 sm:py-8.5 lg:row-span-4 lg:grid-rows-subgrid"
          :class="plan.featured ? 'bg-ink-900 shadow-dark' : 'border border-line bg-white shadow-tile'"
        >
          <div
            v-if="plan.featured"
            class="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_120%_at_85%_10%,rgb(125_83_242/0.3),transparent_62%)]"
            aria-hidden="true"
          />

          <div class="relative flex flex-col gap-2">
            <div class="flex items-center justify-between gap-3">
              <h3
                class="font-display text-[1.3125rem] font-semibold tracking-[-0.02em]"
                :class="plan.featured ? 'text-white' : 'text-heading'"
              >
                {{ plan.name }}
              </h3>
              <span
                v-if="plan.flag"
                class="rounded-full bg-violet-500 px-2.75 py-1.25 text-[0.71875rem] font-bold text-white"
              >{{ plan.flag }}</span>
            </div>
            <p
              class="text-[0.90625rem] leading-[1.55]"
              :class="plan.featured ? 'text-body-on-dark' : 'text-body'"
            >
              {{ plan.fit }}
            </p>
          </div>

          <div
            class="relative flex flex-col gap-2 border-b pb-5"
            :class="plan.featured ? 'border-white/10' : 'border-line-soft'"
          >
            <p
              class="font-display text-[2.875rem] leading-none font-extrabold tracking-[-0.03em] tabular-nums"
              :class="plan.featured ? 'text-white' : 'text-heading'"
            >
              {{ plan.monthly }}<span
                class="text-[0.9375rem] font-semibold"
                :class="plan.featured ? 'text-body-on-dark' : 'text-muted'"
              > /month</span>
            </p>
            <p
              class="text-[0.84375rem] leading-normal"
              :class="plan.featured ? 'text-body-on-dark' : 'text-body'"
            >
              {{ plan.deposit }} deposit, then {{ term }} × {{ plan.monthly }}
            </p>
            <p
              class="inline-flex w-fit items-center rounded-full border px-3 py-1.25 text-[0.78125rem] font-semibold"
              :class="plan.featured ? 'border-white/10 bg-white/7 text-white' : 'border-line bg-subtle text-body'"
            >
              Total {{ plan.total }} inc. VAT · 0% interest
            </p>
          </div>

          <div class="relative flex flex-col gap-3">
            <p
              class="text-xs font-bold tracking-[0.07em] uppercase"
              :class="plan.featured ? 'text-violet-200' : 'text-muted'"
            >
              {{ plan.featuresHeading }}
            </p>
            <ul class="flex flex-col gap-3">
              <li
                v-for="feature in plan.features"
                :key="feature"
                class="flex gap-2.75 text-[0.90625rem] leading-normal"
                :class="plan.featured ? 'text-white' : 'text-heading'"
              >
                <UiTick class="mt-0.5" />
                {{ feature }}
              </li>
            </ul>
          </div>

          <div class="relative flex flex-col gap-2.5 self-end">
            <UiButton
              :href="plan.orderUrl"
              :variant="plan.featured ? 'primary' : 'light'"
              size="lg"
              block
            >
              Start your order<span class="sr-only">: {{ plan.name }}, {{ term }} months</span>
            </UiButton>
            <p
              class="text-center text-[0.78125rem] leading-normal"
              :class="plan.featured ? 'text-muted-on-dark' : 'text-muted'"
            >
              Nothing taken today · free to cancel before kickoff
            </p>
          </div>
        </li>
      </ul>

      <div
        v-if="page.plans.compare"
        role="region"
        aria-labelledby="compare-title"
        tabindex="0"
        class="relative overflow-x-auto rounded-2xl border border-line bg-white shadow-tile"
      >
        <table class="w-full min-w-150 border-collapse text-sm">
          <thead>
            <tr>
              <th
                id="compare-title"
                scope="col"
                class="w-[34%] p-5 text-left font-display text-base font-semibold tracking-[-0.015em] text-heading"
              >
                Compare the plans
              </th>
              <th
                v-for="plan in page.plans.catalogue"
                :key="plan.id"
                scope="col"
                class="px-3.5 py-5 text-center font-display text-[0.9375rem] font-semibold"
                :class="plan.id === page.plans.featured ? 'bg-violet-25 text-violet-700' : 'text-heading'"
              >
                {{ plan.name }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in page.plans.compare"
              :key="row.label"
            >
              <th
                scope="row"
                class="border-t border-line-soft px-5 py-3.25 text-left font-normal text-body"
              >
                {{ row.label }}
              </th>
              <td
                v-for="plan in page.plans.catalogue"
                :key="plan.id"
                class="border-t border-line-soft px-3.5 py-3.25 text-center text-heading"
                :class="plan.id === page.plans.featured && 'bg-violet-25'"
              >
                <template v-if="row.values[plan.id] === true">
                  <UiTick />
                  <span class="sr-only">Included</span>
                </template>
                <template v-else-if="row.values[plan.id] === false">
                  <span
                    class="text-muted"
                    aria-hidden="true"
                  >—</span>
                  <span class="sr-only">Not included</span>
                </template>
                <template v-else>
                  {{ row.values[plan.id] }}
                </template>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td class="border-t border-line p-4.5" />
              <td
                v-for="plan in plans"
                :key="plan.id"
                class="border-t border-line px-3.5 py-4.5 text-center"
                :class="plan.featured && 'bg-violet-25'"
              >
                <a
                  :href="plan.orderUrl"
                  class="font-semibold text-violet-600 hover:underline"
                >Choose {{ plan.name }} <span aria-hidden="true">→</span></a>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="grid gap-6 rounded-[22px] border border-line bg-subtle px-6 py-6.5 sm:px-7.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8">
        <div class="flex max-w-[76ch] flex-col gap-1.25">
          <h3 class="font-display text-[1.03125rem] font-semibold tracking-[-0.012em] text-heading">
            {{ page.plans.footnote.title }}
          </h3>
          <p class="text-sm leading-relaxed text-body">
            {{ page.plans.footnote.body }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-x-5.5 gap-y-3">
          <NuxtLink
            :to="routes.legal.instalmentTerms"
            class="text-sm font-semibold text-violet-600 hover:underline"
          >
            Read the full terms <span aria-hidden="true">→</span>
          </NuxtLink>
          <UiButton
            :to="`${routes.contact}?service=${page.slug}`"
            size="lg"
          >
            Book a 15-minute call
          </UiButton>
        </div>
      </div>
    </div>
  </section>
</template>
