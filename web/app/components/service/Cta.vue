<script setup lang="ts">
import type { ServicePageContent } from '~/data/service-pages/types'
import { company } from '~/data/site'

const props = defineProps<{ page: ServicePageContent }>()

const { contact, linkTo } = useServiceLinks(props.page.slug)
// An unconfirmed phone number is empty and its row is not rendered.
const phoneHref = company.phone ? `tel:${company.phone.replace(/\s+/g, '')}` : ''
</script>

<template>
  <section
    aria-labelledby="service-cta-title"
    class="bg-page px-4 pb-20 sm:px-6 lg:pb-26"
  >
    <div class="relative mx-auto flex max-w-300 flex-col gap-10 overflow-hidden rounded-4xl bg-ink-900 px-6 py-12 sm:px-10 lg:flex-row lg:items-center lg:gap-14 lg:px-14 lg:py-16">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_120%_at_88%_26%,rgb(125_83_242/0.3),transparent_60%)]"
        aria-hidden="true"
      />

      <div class="relative flex max-w-[54ch] flex-col gap-5">
        <UiEyebrowChip
          tone="dark"
          emoji="👋"
        >
          Ready when you are
        </UiEyebrowChip>
        <h2
          id="service-cta-title"
          class="font-display text-h2 text-white"
        >
          {{ page.cta.title }}
        </h2>
        <p class="text-[1.0625rem] leading-[1.62] text-body-on-dark">
          {{ page.cta.body }}
        </p>
      </div>

      <div class="relative flex w-full flex-none flex-col gap-4.5 lg:ml-auto lg:w-72">
        <UiButton
          v-bind="linkTo(page.cta.primary.target)"
          size="lg"
          block
        >
          {{ page.cta.primary.label }}
        </UiButton>
        <UiButton
          :to="contact()"
          variant="ghost-dark"
          size="lg"
          block
        >
          Book a free call
        </UiButton>
        <div
          class="h-px bg-white/10"
          aria-hidden="true"
        />
        <dl class="grid grid-cols-[92px_minmax(0,1fr)] items-baseline gap-x-4 gap-y-3">
          <dt class="text-[0.78125rem] text-muted-on-dark">
            Email
          </dt>
          <dd>
            <a
              :href="`mailto:${company.email}`"
              class="text-[0.90625rem] font-semibold break-all text-white hover:underline"
            >{{ company.email }}</a>
          </dd>
          <template v-if="phoneHref">
            <dt class="text-[0.78125rem] text-muted-on-dark">
              Phone
            </dt>
            <dd>
              <a
                :href="phoneHref"
                class="text-[0.90625rem] font-semibold text-white hover:underline"
              >{{ company.phone }}</a>
            </dd>
          </template>
        </dl>
      </div>
    </div>
  </section>
</template>
