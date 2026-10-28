<script setup lang="ts">
import { companyChecks, companyFacts } from '~/data/about'
import { company } from '~/data/site'

const page = useCmsContent('about')
const paperwork = computed(() => ({
  ...page.value.paperwork,
  request: { text: page.value.paperwork.requestText, link: page.value.paperwork.requestLink, subject: page.value.paperwork.requestSubject },
}))
const requestHref = computed(() => `mailto:${company.email}?${new URLSearchParams({ subject: paperwork.value.request.subject }).toString().replaceAll('+', '%20')}`)
</script>

<template>
  <section
    id="company"
    aria-labelledby="company-title"
    class="container-page scroll-mt-4 pt-20 lg:pt-26"
  >
    <div class="grid gap-10 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start lg:gap-18">
      <div class="flex flex-col gap-4.5 lg:sticky lg:top-27.5">
        <UiEyebrowChip>{{ paperwork.eyebrow }}</UiEyebrowChip>
        <h2
          id="company-title"
          class="font-display text-h2 text-heading lg:text-[2.75rem]"
        >
          {{ paperwork.title }}
        </h2>
        <p class="text-[1.03125rem] leading-[1.62] text-body">
          {{ paperwork.lead }}
        </p>
        <ul
          v-if="companyChecks.length"
          class="flex flex-col gap-3 pt-1.5"
        >
          <li
            v-for="check in companyChecks"
            :key="check"
            class="flex items-center gap-3 text-[0.9375rem] font-medium text-heading"
          >
            <UiTick size="lg" />
            {{ check }}
          </li>
        </ul>
      </div>

      <div class="overflow-hidden rounded-3xl border border-line bg-white shadow-card">
        <dl>
          <div
            v-for="fact in companyFacts"
            :key="fact.label"
            class="grid gap-1.5 border-b border-line-soft px-6 py-5 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-8 sm:py-5.5"
          >
            <dt class="text-xs font-bold tracking-[0.07em] text-muted uppercase">
              {{ fact.label }}
            </dt>
            <dd class="text-base leading-normal font-semibold text-heading">
              {{ fact.value }}
            </dd>
            <dd v-if="fact.link">
              <a
                :href="fact.link.href"
                target="_blank"
                rel="noopener noreferrer"
                class="text-[0.84375rem] font-semibold whitespace-nowrap text-violet-600 hover:underline"
              >{{ fact.link.label }} <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>
            </dd>
          </div>
        </dl>
        <div class="flex flex-col gap-3 bg-subtle px-6 py-6 sm:flex-row sm:items-center sm:gap-4 sm:px-8">
          <p class="text-sm leading-[1.55] text-body">
            {{ paperwork.request.text }}
          </p>
          <a
            :href="requestHref"
            class="group text-sm font-semibold whitespace-nowrap text-violet-600 hover:underline sm:ml-auto"
          >
            {{ paperwork.request.link }} <span
              class="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
              aria-hidden="true"
            >→</span>
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
