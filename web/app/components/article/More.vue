<script setup lang="ts">
import type { Article } from '~/data/articles'
import { keepReading } from '~/data/article-page'
import { articleLink, articleTopic, relatedArticles } from '~/data/articles'
import { comingSoon } from '~/data/insights'
import { routes } from '~/data/routes'

const props = defineProps<{ article: Article }>()

const related = relatedArticles(props.article).map(item => ({ ...item, to: articleLink(item) }))
</script>

<template>
  <section
    v-if="related.length"
    aria-labelledby="keep-reading-title"
    class="border-t border-line bg-subtle"
  >
    <div class="container-page flex flex-col gap-9 py-20 lg:py-26">
      <div class="flex flex-wrap items-end gap-x-6 gap-y-3">
        <h2
          id="keep-reading-title"
          class="font-display text-[clamp(2rem,1.5rem+1.6vw,2.5rem)] leading-[1.08] font-bold tracking-[-0.028em] text-heading"
        >
          {{ keepReading.title }}
        </h2>
        <NuxtLink
          :to="routes.insights"
          class="group pb-1 text-[0.9375rem] font-semibold whitespace-nowrap text-violet-600 hover:underline sm:ml-auto"
        >
          {{ keepReading.link }} <span
            class="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
            aria-hidden="true"
          >→</span>
        </NuxtLink>
      </div>

      <ul class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="item in related"
          :key="item.slug"
          class="relative flex flex-col gap-4 rounded-2xl border border-line bg-white p-3 pb-6 shadow-tile"
          :class="item.to && 'transition duration-200 ease-out-soft hover:shadow-tile-hover motion-safe:hover:-translate-y-0.75'"
        >
          <div class="h-47.5 overflow-hidden rounded-lg">
            <UiMediaFrame
              :image="item.body?.heroImage ?? item.image"
              sizes="100vw md:50vw lg:360px"
            />
          </div>
          <p class="flex items-center gap-2.5 px-3 text-xs font-bold tracking-[0.06em] whitespace-nowrap text-muted uppercase">
            <span class="text-violet-600">{{ item.format ?? articleTopic(item) }}</span>
            <span
              class="size-0.75 rounded-full bg-line-dashed"
              aria-hidden="true"
            />
            {{ item.readMinutes }} min
            <template v-if="!item.to">
              <span
                class="size-0.75 rounded-full bg-line-dashed"
                aria-hidden="true"
              />
              {{ comingSoon }}
            </template>
          </p>
          <h3 class="px-3 font-display text-xl leading-[1.28] font-semibold tracking-[-0.02em] text-pretty text-heading">
            <NuxtLink
              v-if="item.to"
              :to="item.to"
              class="after:absolute after:inset-0 after:rounded-2xl"
            >
              {{ item.title }}
            </NuxtLink>
            <template v-else>
              {{ item.title }}
            </template>
          </h3>
        </li>
      </ul>
    </div>
  </section>
</template>
