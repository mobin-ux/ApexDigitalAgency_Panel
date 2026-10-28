<script setup lang="ts">
import { routes } from '~/data/routes'
import { projectsDelivered, reviewRating } from '~/data/site'

const page = useCmsContent('our-work')
const cta = computed(() => page.value.cta)
</script>

<template>
  <section
    aria-labelledby="work-cta-title"
    class="bg-page px-4 py-20 sm:px-6 lg:py-26"
  >
    <div class="relative mx-auto flex max-w-300 flex-col gap-10 overflow-hidden rounded-4xl bg-ink-900 px-6 py-12 sm:px-10 lg:flex-row lg:items-center lg:gap-14 lg:px-14 lg:py-15">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_120%_at_88%_26%,rgb(125_83_242/0.28),transparent_60%)]"
        aria-hidden="true"
      />

      <div class="relative flex max-w-[54ch] flex-col gap-4.5">
        <UiEyebrowChip
          tone="dark"
          emoji="👋"
        >
          {{ cta.eyebrow }}
        </UiEyebrowChip>
        <h2
          id="work-cta-title"
          class="font-display text-h2 text-white lg:text-[2.75rem]"
        >
          {{ cta.title }}
        </h2>
        <p class="text-[1.0625rem] leading-[1.62] text-body-on-dark">
          {{ cta.body }}
        </p>
      </div>

      <div class="relative flex w-full flex-none flex-col gap-4.5 lg:ml-auto lg:w-75">
        <UiButton
          :to="routes.contact"
          size="lg"
          block
        >
          {{ cta.button }}
        </UiButton>
        <div
          class="h-px bg-white/10"
          aria-hidden="true"
        />
        <dl class="grid grid-cols-[96px_minmax(0,1fr)] items-baseline gap-x-4 gap-y-3">
          <dt class="text-[0.78125rem] text-muted-on-dark">
            Projects
          </dt>
          <dd class="text-[0.90625rem] font-semibold text-white">
            {{ projectsDelivered }} delivered
          </dd>
          <template v-if="reviewRating.score">
            <dt class="text-[0.78125rem] text-muted-on-dark">
              Rating
            </dt>
            <dd class="text-[0.90625rem] font-semibold text-white">
              {{ reviewRating.score }} on {{ reviewRating.source }}
            </dd>
          </template>
          <dt class="text-[0.78125rem] text-muted-on-dark">
            Reply
          </dt>
          <dd class="text-[0.90625rem] text-body-on-dark">
            Within one working day
          </dd>
        </dl>
      </div>
    </div>
  </section>
</template>
