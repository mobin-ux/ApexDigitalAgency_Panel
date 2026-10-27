<script setup lang="ts">
import type { Article, ArticleBody } from '~/data/articles'
import { articleChrome } from '~/data/article-page'
import { articleTopic } from '~/data/articles'
import { routes } from '~/data/routes'

const props = defineProps<{ article: Article, body: ArticleBody }>()

const crumbs = [
  { label: 'Home', to: routes.home },
  { label: 'Insights', to: routes.insights },
  { label: articleTopic(props.article), to: routes.article(props.article.slug) },
]

// The date shown is the last revision; the first publication goes to the markup.
const shownDate = props.article.updated ?? props.article.published
</script>

<template>
  <header class="container-page pt-10 lg:pt-16">
    <div class="mx-auto flex max-w-215 flex-col gap-6">
      <UiBreadcrumbs :items="crumbs" />

      <p class="flex flex-wrap items-center gap-2.5">
        <span class="rounded-full bg-violet-50 px-3.25 py-1.5 text-[0.78125rem] font-bold whitespace-nowrap text-violet-600">{{ article.format ?? articleTopic(article) }}</span>
        <span
          v-if="shownDate"
          class="text-[0.84375rem] whitespace-nowrap text-muted"
        >
          {{ article.updated ? `${articleChrome.updated} ` : '' }}<time :datetime="shownDate">{{ formatDate(shownDate) }}</time>
        </span>
      </p>

      <h1
        id="article-title"
        class="font-display text-[clamp(2.25rem,1.5rem+3vw,3.5rem)] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance text-heading"
      >
        {{ article.title }}
      </h1>
      <p class="max-w-[60ch] text-[clamp(1.0625rem,0.95rem+0.5vw,1.25rem)] leading-[1.6] text-pretty text-body">
        {{ body.lead }}
      </p>

      <div class="flex flex-wrap items-center gap-x-3.5 gap-y-4 border-t border-line pt-5">
        <span
          class="inline-flex size-11 flex-none items-center justify-center rounded-full bg-violet-50 font-display text-[0.9375rem] font-bold text-violet-600"
          aria-hidden="true"
        >{{ initials(body.author.name) }}</span>
        <p class="flex flex-col gap-0.5">
          <span class="text-[0.9375rem] font-semibold text-heading">{{ body.author.name }}</span>
          <span class="text-[0.84375rem] text-muted">{{ articleChrome.byline(body.author.role, article.readMinutes) }}</span>
        </p>
        <ArticleShare
          :title="article.title"
          class="w-full sm:ml-auto sm:w-auto"
        />
      </div>
    </div>

    <div class="mt-10 h-60 overflow-hidden rounded-3xl sm:h-90 lg:mt-12 lg:h-130">
      <UiMediaFrame
        :image="body.heroImage"
        priority
        sizes="100vw lg:1152px"
      />
    </div>
  </header>
</template>
