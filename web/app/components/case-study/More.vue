<script setup lang="ts">
import type { CaseStudy } from '~/data/case-studies'
import { relatedStudies } from '~/data/case-studies'
import { routes } from '~/data/routes'

const props = defineProps<{ study: CaseStudy }>()
const chrome = useCmsContent('case-study-chrome')
const similarProjects = computed(() => ({ eyebrow: chrome.value.moreEyebrow, title: chrome.value.moreTitle, link: chrome.value.moreLink }))

const related = relatedStudies(props.study)
</script>

<template>
  <section
    v-if="related.length"
    aria-labelledby="similar-title"
    class="border-t border-line bg-subtle"
  >
    <div class="container-page flex flex-col gap-10 py-20 lg:py-26">
      <div class="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div class="flex flex-col gap-4">
          <UiEyebrowChip>{{ similarProjects.eyebrow }}</UiEyebrowChip>
          <h2
            id="similar-title"
            class="font-display text-h2 text-heading lg:text-[2.75rem]"
          >
            {{ similarProjects.title }}
          </h2>
        </div>
        <NuxtLink
          :to="routes.ourWork"
          class="group pb-1.5 text-[0.9375rem] font-semibold whitespace-nowrap text-violet-600 hover:underline sm:ml-auto"
        >
          {{ similarProjects.link }} <span
            class="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
            aria-hidden="true"
          >→</span>
        </NuxtLink>
      </div>

      <ul class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="item in related"
          :key="item.slug"
        >
          <WorkProjectCard
            :study="item"
            compact
          />
        </li>
      </ul>
    </div>
  </section>
</template>
