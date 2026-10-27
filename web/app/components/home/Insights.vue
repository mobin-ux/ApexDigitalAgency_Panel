<script setup lang="ts">
import { articleList, leadArticle } from '~/data/content'
import { comingSoon } from '~/data/insights'
import { routes } from '~/data/routes'
import { formatMonthYear } from '~/utils/format'
</script>

<template>
  <section
    id="insights"
    aria-labelledby="insights-title"
    class="border-y border-line bg-subtle"
  >
    <div class="container-page flex flex-col gap-12 py-24 lg:py-32">
      <div class="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-12">
        <div class="max-w-160">
          <UiSectionHeader
            id="insights-title"
            eyebrow="Our blog"
            title="Straight answers, before you spend anything"
          >
            We publish what we would tell you on a call — costs, timelines and what actually works for UK businesses.
          </UiSectionHeader>
        </div>
        <NuxtLink
          :to="routes.insights"
          class="text-[0.9375rem] font-semibold text-violet-600 hover:underline md:pb-2.5"
        >
          All insights →
        </NuxtLink>
      </div>

      <div class="grid items-start gap-10 lg:grid-cols-[1.04fr_0.96fr]">
        <article class="relative flex flex-col gap-5.5">
          <div class="h-60 overflow-hidden rounded-2xl sm:h-75">
            <UiMediaFrame
              :image="leadArticle.image"
              sizes="(min-width: 1024px) 600px, 100vw"
            />
          </div>
          <p class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="rounded-sm bg-violet-50 px-2.75 py-1.25 text-[0.71875rem] font-bold text-violet-600">{{ leadArticle.category }}</span>
            <span class="text-[0.8125rem] text-muted">
              {{ leadArticle.readMinutes }} min read<template v-if="leadArticle.published"> · <time :datetime="leadArticle.published">{{ formatMonthYear(leadArticle.published) }}</time></template>
            </span>
          </p>
          <h3 class="max-w-[26ch] font-display text-[1.625rem] leading-tight font-bold tracking-tight text-heading sm:text-[1.875rem]">
            <NuxtLink
              :to="leadArticle.to"
              class="after:absolute after:inset-0"
            >
              {{ leadArticle.title }}
            </NuxtLink>
          </h3>
          <p class="max-w-[48ch] text-base leading-relaxed text-body">
            {{ leadArticle.excerpt }}
          </p>
        </article>

        <ul class="flex flex-col">
          <li
            v-for="article in articleList"
            :key="article.slug"
            class="relative flex flex-col gap-2.5 border-b border-line-strong py-6.5 first:pt-0 last:border-b-0 last:pb-0"
          >
            <p class="flex items-center gap-3">
              <span class="text-[0.71875rem] font-bold tracking-wider text-violet-600 uppercase">{{ article.category }}</span>
              <span class="text-[0.78rem] text-muted">{{ article.readMinutes }} min read<template v-if="!article.to"> · {{ comingSoon }}</template></span>
            </p>
            <h3 class="font-display text-[1.3125rem] leading-snug font-semibold tracking-tight text-heading">
              <NuxtLink
                v-if="article.to"
                :to="article.to"
                class="after:absolute after:inset-0"
              >
                {{ article.title }}
              </NuxtLink>
              <template v-else>
                {{ article.title }}
              </template>
            </h3>
            <p class="text-[0.90625rem] leading-relaxed text-body">
              {{ article.excerpt }}
            </p>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
