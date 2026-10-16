<script setup lang="ts">
import type { CaseStudy } from '~/data/case-studies'
import { sectorLabel } from '~/data/case-studies'
import { routes } from '~/data/routes'
import { serviceBySlug } from '~/data/services'

const props = defineProps<{ study: CaseStudy }>()

const tags = props.study.services.map(slug => serviceBySlug(slug).tag)
</script>

<template>
  <article class="relative flex h-full flex-col gap-4.5 rounded-2xl border border-line bg-white px-3 pt-3 pb-5.5 shadow-tile transition duration-200 ease-out-soft hover:shadow-tile-hover motion-safe:hover:-translate-y-0.75">
    <div class="h-57.5 overflow-hidden rounded-lg">
      <UiMediaFrame
        :image="study.image"
        sizes="100vw md:50vw lg:380px"
      />
    </div>

    <div class="flex flex-col gap-2 px-3">
      <p class="text-xs font-bold tracking-[0.06em] text-muted uppercase">
        {{ sectorLabel(study.sector) }} · {{ study.place }}
      </p>
      <h3 class="font-display text-[1.375rem] leading-[1.15] font-semibold tracking-[-0.022em] text-heading">
        <NuxtLink
          :to="routes.caseStudy(study.slug)"
          class="after:absolute after:inset-0 after:rounded-2xl"
        >
          {{ study.client }}
        </NuxtLink>
      </h3>
      <p class="text-[0.90625rem] leading-[1.55] text-pretty text-body">
        {{ study.summary }}
      </p>
    </div>

    <p class="mx-3 flex flex-col gap-2 rounded-[14px] border border-line-soft bg-subtle px-4.5 py-4">
      <span class="flex items-baseline gap-2.5 whitespace-nowrap">
        <span class="sr-only">From</span>
        <span class="font-display text-lg font-semibold tracking-[-0.02em] text-muted">{{ study.result.before }}</span>
        <span
          class="text-sm text-muted"
          aria-hidden="true"
        >→</span>
        <span class="sr-only">to</span>
        <span class="font-display text-[1.625rem] leading-none font-extrabold tracking-[-0.028em] text-violet-500">{{ study.result.after }}</span>
      </span>
      <span class="text-[0.8125rem] leading-[1.4] text-muted">{{ study.result.metric }}</span>
    </p>

    <ul
      class="mx-3 mt-auto flex flex-wrap gap-1.5 border-t border-line-soft pt-4.5"
      aria-label="Services"
    >
      <li
        v-for="tag in tags"
        :key="tag"
        class="rounded-[8px] bg-violet-50 px-2.5 py-1.25 text-[0.78125rem] font-semibold whitespace-nowrap text-violet-600"
      >
        {{ tag }}
      </li>
    </ul>
  </article>
</template>
