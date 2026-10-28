<script setup lang="ts">
import { contactStudio as studioData } from '~/data/contact'
import { company } from '~/data/site'

/**
 * The studio card. The address, the travel line and "Get directions" wait for
 * a confirmed street address in `site.ts`; until then the card says where we
 * are, when we are open, and points at the team. The map panel takes a static
 * image when one exists: an embedded map would load a third party's script
 * and send every visitor's IP to it.
 */
const { addressLines, directionsUrl } = studio
const page = useCmsContent('contact')
const contactStudio = computed(() => ({
  ...studioData,
  ...page.value.studio,
  team: { label: page.value.studio.teamLink, to: studioData.team.to },
}))
</script>

<template>
  <section
    aria-labelledby="studio-title"
    class="container-page pt-20 lg:pt-26"
  >
    <div class="grid overflow-hidden rounded-3xl border border-line bg-white shadow-card lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div class="relative h-60 sm:h-80 lg:h-auto lg:min-h-100">
        <div class="absolute inset-0">
          <UiMediaFrame sizes="100vw lg:640px" />
        </div>
      </div>

      <div class="flex flex-col gap-6 p-6 sm:p-11">
        <div class="flex flex-col gap-3">
          <p class="text-xs font-bold tracking-[0.07em] text-muted uppercase">
            {{ contactStudio.eyebrow }}
          </p>
          <h2
            id="studio-title"
            class="font-display text-h3 leading-[1.08] tracking-[-0.028em] text-heading"
          >
            {{ contactStudio.title }}
          </h2>
          <p
            v-if="addressLines.length"
            class="text-[0.96875rem] leading-[1.6] text-body"
          >
            {{ contactStudio.travel }}
          </p>
        </div>

        <dl class="grid grid-cols-[90px_minmax(0,1fr)] gap-x-4.5 gap-y-3.5 border-y border-line-soft py-5.5">
          <template v-if="addressLines.length">
            <dt class="text-[0.8125rem] text-muted">
              {{ contactStudio.labels.address }}
            </dt>
            <dd class="text-[0.9375rem] leading-normal font-semibold text-heading">
              <address class="not-italic">
                <template
                  v-for="(line, i) in addressLines"
                  :key="line"
                >
                  <br v-if="i > 0">{{ line }}
                </template>
              </address>
            </dd>
          </template>
          <dt class="text-[0.8125rem] text-muted">
            {{ contactStudio.labels.hours }}
          </dt>
          <dd class="text-[0.9375rem] leading-normal text-heading">
            <template v-if="company.openingHours">
              {{ company.openingHours }}<br>
            </template>
            <span class="text-body">{{ contactStudio.byAppointment }}</span>
          </dd>
        </dl>

        <div class="mt-auto flex flex-wrap items-center gap-4.5">
          <UiButton
            v-if="directionsUrl"
            :href="directionsUrl"
            variant="ink"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ contactStudio.directions }} <span
              class="text-violet-400"
              aria-hidden="true"
            >↗</span><span class="sr-only"> (opens in a new tab)</span>
          </UiButton>
          <NuxtLink
            :to="contactStudio.team.to"
            class="text-[0.90625rem] font-semibold whitespace-nowrap text-violet-600 hover:underline"
          >
            {{ contactStudio.team.label }} <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
