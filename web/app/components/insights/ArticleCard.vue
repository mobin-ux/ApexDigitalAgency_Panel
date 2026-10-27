<script setup lang="ts">
import type { Article } from '~/data/articles'
import { articleLink, articleTopic } from '~/data/articles'
import { comingSoon, insightsBrowse } from '~/data/insights'
import { routes } from '~/data/routes'
import { serviceBySlug } from '~/data/services'

/**
 * One article in the Insights list. A written article links to its page; an
 * unwritten one says "Coming soon" and links nowhere. Both link to the service
 * the article is about.
 */
const props = defineProps<{ article: Article }>()

const to = articleLink(props.article)
const service = serviceBySlug(props.article.service)
</script>

<template>
  <article class="flex h-full flex-col gap-4">
    <div class="group relative flex flex-col gap-4">
      <div class="relative h-52.5 overflow-hidden rounded-xl">
        <UiMediaFrame
          :image="article.body?.heroImage ?? article.image"
          sizes="100vw md:50vw lg:384px"
        />
        <span
          v-if="!to"
          class="absolute top-3.5 left-3.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold whitespace-nowrap text-heading shadow-chip"
        >{{ comingSoon }}</span>
      </div>
      <p class="flex items-center gap-2.5 text-xs font-bold tracking-[0.06em] whitespace-nowrap text-muted uppercase">
        <span class="text-violet-600">{{ article.format ?? articleTopic(article) }}</span>
        <span
          class="size-0.75 rounded-full bg-line-dashed"
          aria-hidden="true"
        />
        {{ article.readMinutes }} min
      </p>
      <h3 class="font-display text-[1.3125rem] leading-[1.25] font-semibold tracking-[-0.02em] text-pretty text-heading">
        <NuxtLink
          v-if="to"
          :to="to"
          class="transition-colors group-hover:text-violet-600 after:absolute after:inset-0"
        >
          {{ article.title }}
        </NuxtLink>
        <template v-else>
          {{ article.title }}
        </template>
      </h3>
      <p
        v-if="article.excerpt"
        class="text-[0.90625rem] leading-[1.55] text-pretty text-body"
      >
        {{ article.excerpt }}
      </p>
    </div>

    <NuxtLink
      :to="routes.service(service.slug)"
      class="group/service mt-auto flex min-h-11 items-center gap-2.5 border-t border-line-soft pt-3.5 text-[0.84375rem] text-muted transition-colors hover:text-violet-600"
    >
      <span class="whitespace-nowrap">{{ insightsBrowse.relatedService }}</span>
      <span class="ml-auto text-right font-semibold text-heading group-hover/service:text-violet-600">
        {{ service.shortName }} <span
          class="text-violet-500"
          aria-hidden="true"
        >→</span>
      </span>
    </NuxtLink>
  </article>
</template>
