<script setup lang="ts">
import { aboutPhotos, visit as visitData } from '~/data/about'
import { routes } from '~/data/routes'
import { company } from '~/data/site'

/**
 * The studio card. The address, the phone number and the directions link
 * appear only once they are confirmed in `site.ts`.
 */
const { addressLines, directionsUrl: directions, telHref } = studio
const page = useCmsContent('about')
const visit = computed(() => ({ ...page.value.visit, labels: visitData.labels }))
</script>

<template>
  <section
    aria-labelledby="visit-title"
    class="container-page pt-20 lg:pt-26"
  >
    <div class="grid overflow-hidden rounded-3xl border border-line bg-white shadow-card lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div class="relative h-60 sm:h-80 lg:h-auto lg:min-h-115">
        <div class="absolute inset-0">
          <UiMediaFrame
            :image="aboutPhotos.studio"
            sizes="100vw lg:640px"
          />
        </div>
      </div>

      <div class="flex flex-col gap-6 p-6 sm:p-11">
        <div class="flex flex-col gap-3">
          <p class="text-xs font-bold tracking-[0.07em] text-muted uppercase">
            {{ visit.eyebrow }}
          </p>
          <h2
            id="visit-title"
            class="font-display text-[clamp(1.75rem,1.4rem+1.2vw,2.125rem)] leading-[1.08] font-bold tracking-[-0.028em] text-heading"
          >
            {{ visit.title }}
          </h2>
          <p class="text-[0.96875rem] leading-[1.6] text-body">
            {{ visit.body }}
          </p>
        </div>

        <dl class="grid grid-cols-[90px_minmax(0,1fr)] gap-x-4.5 gap-y-3.5 border-y border-line-soft py-5.5">
          <template v-if="addressLines.length">
            <dt class="text-[0.8125rem] text-muted">
              {{ visit.labels.address }}
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
          <template v-if="company.openingHours">
            <dt class="text-[0.8125rem] text-muted">
              {{ visit.labels.hours }}
            </dt>
            <dd class="text-[0.9375rem] text-heading">
              {{ company.openingHours }}
            </dd>
          </template>
          <template v-if="company.phone">
            <dt class="text-[0.8125rem] text-muted">
              {{ visit.labels.phone }}
            </dt>
            <dd class="text-[0.9375rem] text-heading">
              <a
                :href="telHref"
                class="hover:text-violet-600"
              >{{ company.phone }}</a>
            </dd>
          </template>
          <dt class="text-[0.8125rem] text-muted">
            {{ visit.labels.email }}
          </dt>
          <dd class="min-w-0 text-[0.9375rem] font-semibold break-words">
            <a
              :href="`mailto:${company.email}`"
              class="text-violet-600 hover:underline"
            >{{ company.email }}</a>
          </dd>
        </dl>

        <div class="mt-auto flex flex-wrap items-center gap-4.5">
          <UiButton
            :to="routes.contact"
            size="lg"
          >
            {{ visit.button }}
          </UiButton>
          <a
            v-if="directions"
            :href="directions"
            target="_blank"
            rel="noopener noreferrer"
            class="text-[0.90625rem] font-semibold whitespace-nowrap text-violet-600 hover:underline"
          >{{ visit.directions }} <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>
        </div>
      </div>
    </div>
  </section>
</template>
