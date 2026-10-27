<script setup lang="ts">
import { insightsHero as hero } from '~/data/insights'
import { routes } from '~/data/routes'

const crumbs = [
  { label: 'Home', to: routes.home },
  { label: 'Insights', to: routes.insights },
] as const

const filter = useInsightsFilter()

// The list filters as you type, so the button only takes you to the results.
// Without JavaScript the form is a plain GET to ?q=, which the page reads.
function showResults() {
  document.getElementById('insights-browse-title')?.focus()
}

function ask(query: string) {
  filter.ask(query)
  showResults()
}
</script>

<template>
  <section
    aria-labelledby="insights-hero-title"
    class="container-page pt-10 lg:pt-18"
  >
    <div class="mb-8 lg:mb-8.5">
      <UiBreadcrumbs :items="crumbs" />
    </div>

    <div class="mx-auto flex max-w-205 flex-col items-center gap-5.5 text-center">
      <UiEyebrowChip>{{ hero.eyebrow }}</UiEyebrowChip>
      <h1
        id="insights-hero-title"
        class="font-display text-h1 text-balance text-heading"
      >
        {{ hero.title }}
      </h1>
      <p class="max-w-[56ch] text-lead text-pretty text-body">
        {{ hero.lead }}
      </p>

      <form
        role="search"
        :action="routes.insights"
        method="get"
        class="mt-2 flex w-full max-w-160 items-center gap-3 rounded-[1.125rem] border border-line-strong bg-white py-2 ps-5 pe-2 shadow-card focus-within:border-violet-500"
        @submit.prevent="showResults"
      >
        <svg
          class="size-4 flex-none text-muted"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <circle
            cx="6.5"
            cy="6.5"
            r="5"
          />
          <path d="m10.5 10.5 4 4" />
        </svg>
        <input
          v-model="filter.query.value"
          type="search"
          name="q"
          maxlength="120"
          enterkeyhint="search"
          autocomplete="off"
          :placeholder="hero.searchPlaceholder"
          :aria-label="hero.searchLabel"
          class="min-w-0 flex-1 bg-transparent py-3 text-base text-heading outline-none placeholder:text-muted"
        >
        <UiButton type="submit">
          {{ hero.searchButton }}
        </UiButton>
      </form>

      <div class="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2">
        <span class="text-[0.84375rem] whitespace-nowrap text-muted">{{ hero.popularLabel }}</span>
        <button
          v-for="item in hero.popular"
          :key="item.label"
          type="button"
          class="min-h-9 rounded-full border border-line bg-subtle px-3.5 py-1.75 text-[0.84375rem] font-semibold whitespace-nowrap text-body transition-colors hover:border-violet-200 hover:text-violet-600"
          @click="ask(item.query)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
  </section>
</template>
