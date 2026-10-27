<script setup lang="ts">
import { articles, articleTopic, publishedArticles } from '~/data/articles'
import { insightsFeatured as copy } from '~/data/insights'
import { routes } from '~/data/routes'
import { formatMonthYear } from '~/utils/format'

/**
 * The newest written article, beside the articles still to come. Shown only
 * while nothing is searched or filtered, as in the design.
 */
const featured = [...publishedArticles]
  .sort((a, b) => (b.updated ?? b.published ?? '').localeCompare(a.updated ?? a.published ?? ''))[0]

const upcoming = articles.filter(article => !article.body).slice(0, copy.upcomingCount)

const chip = computed(() => {
  if (!featured) {
    return ''
  }
  const date = featured.updated ?? featured.published
  const label = featured.format ?? articleTopic(featured)
  return date ? `${label} · ${featured.updated ? 'Updated' : 'Published'} ${formatMonthYear(date)}` : label
})
</script>

<template>
  <section
    v-if="featured?.body"
    aria-labelledby="insights-featured-title"
    class="container-page pt-14 lg:pt-18"
  >
    <div
      class="grid gap-6"
      :class="upcoming.length > 0 && 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]'"
    >
      <article class="group relative flex flex-col gap-5.5 rounded-3xl border border-line bg-white p-3 shadow-card transition-shadow duration-200 hover:shadow-lift sm:p-3.5">
        <div class="relative h-56 overflow-hidden rounded-[1.125rem] sm:h-85">
          <UiMediaFrame
            :image="featured.body.heroImage ?? featured.image"
            priority
            sizes="100vw lg:700px"
          />
          <span class="absolute top-4.5 left-4.5 rounded-full bg-white px-3.5 py-1.75 text-[0.78125rem] font-bold whitespace-nowrap text-heading shadow-chip">{{ chip }}</span>
        </div>

        <div class="flex flex-col gap-3.5 px-3 pb-3 sm:px-4.5 sm:pb-4.5">
          <h2
            id="insights-featured-title"
            class="font-display text-[clamp(1.625rem,1.2rem+1.5vw,2.125rem)] leading-[1.1] font-bold tracking-[-0.028em] text-pretty text-heading"
          >
            <NuxtLink
              :to="routes.article(featured.slug)"
              class="after:absolute after:inset-0 after:rounded-3xl"
            >
              {{ featured.title }}
            </NuxtLink>
          </h2>
          <p class="text-base leading-[1.6] text-pretty text-body">
            {{ featured.body.lead }}
          </p>
          <div class="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-4 border-t border-line-soft pt-4">
            <span
              class="inline-flex size-9 flex-none items-center justify-center rounded-full bg-violet-50 font-display text-[0.8125rem] font-bold text-violet-600"
              aria-hidden="true"
            >{{ initials(featured.body.author.name) }}</span>
            <p class="flex flex-col gap-px">
              <span class="text-sm font-semibold text-heading">{{ featured.body.author.name }}</span>
              <span class="text-[0.8125rem] text-muted">{{ featured.body.author.role }} · {{ featured.readMinutes }} min read</span>
            </p>
            <span
              class="inline-flex items-center gap-2.25 rounded-[0.8125rem] bg-heading px-4.5 py-3 text-sm font-semibold whitespace-nowrap text-white sm:ml-auto"
              aria-hidden="true"
            >
              {{ copy.read }} <span class="text-violet-400 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">→</span>
            </span>
          </div>
        </div>
      </article>

      <div
        v-if="upcoming.length"
        class="flex flex-col rounded-3xl border border-line bg-white px-6 pt-7 pb-3.5 shadow-tile sm:px-7.5"
      >
        <h2 class="pb-2 text-xs font-bold tracking-[0.07em] text-muted uppercase">
          {{ copy.upcomingTitle }}
        </h2>
        <ol>
          <li
            v-for="(item, i) in upcoming"
            :key="item.slug"
            class="grid grid-cols-[34px_minmax(0,1fr)] gap-3.5 border-t border-line-soft py-4.5 first:border-transparent"
          >
            <span
              class="font-display text-[1.375rem] leading-[1.2] font-extrabold tracking-[-0.02em] text-violet-200"
              aria-hidden="true"
            >{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="flex flex-col gap-1.5">
              <span class="font-display text-[1.0625rem] leading-[1.3] font-semibold tracking-[-0.015em] text-heading">{{ item.title }}</span>
              <span class="text-[0.8125rem] text-muted">{{ articleTopic(item) }} · {{ item.readMinutes }} min read</span>
            </span>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>
