<script setup lang="ts">
import type { CaseStudy } from '~/data/case-studies'
import { sectorLabel } from '~/data/case-studies'
import { routes } from '~/data/routes'
import { serviceBySlug } from '~/data/services'

const props = defineProps<{ study: CaseStudy }>()

const header = useCmsContent('header')
const crumbs = [
  { label: header.value.sections.home, to: routes.home },
  { label: header.value.sections.ourWork, to: routes.ourWork },
  { label: props.study.client, to: routes.caseStudy(props.study.slug) },
]

const story = props.study.story

// A fact with no value is left out rather than shown as a dash.
const facts = [
  { label: 'Client', value: props.study.client },
  { label: 'Team', value: story?.team },
  { label: 'Services', value: props.study.services.map(slug => serviceBySlug(slug).tag).join(', ') },
  { label: 'Timeline', value: story?.timeline },
  { label: 'Plan', value: story?.plan },
].filter((fact): fact is { label: string, value: string } => Boolean(fact.value))
</script>

<template>
  <section
    aria-labelledby="case-title"
    class="container-page pt-10 lg:pt-18"
  >
    <div class="mb-8 lg:mb-8.5">
      <UiBreadcrumbs :items="crumbs" />
    </div>

    <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end lg:gap-18">
      <div class="flex flex-col gap-5.5">
        <div class="flex flex-wrap items-center gap-2.5">
          <UiEyebrowChip>Case study</UiEyebrowChip>
          <span class="text-[0.8125rem] font-semibold text-muted">
            {{ sectorLabel(study.sector) }} · {{ study.place }}
          </span>
        </div>
        <h1
          id="case-title"
          class="max-w-[19ch] font-display text-h1 text-pretty text-heading"
        >
          {{ story?.title ?? study.client }}
        </h1>
        <p class="max-w-[54ch] text-lead text-pretty text-body">
          {{ story?.lead ?? study.summary }}
        </p>
      </div>

      <dl class="rounded-2xl border border-line bg-white px-6.5 py-2.5 shadow-tile">
        <div
          v-for="fact in facts"
          :key="fact.label"
          class="grid grid-cols-[100px_minmax(0,1fr)] items-baseline gap-4 border-b border-line-soft py-3.5 last:border-b-0"
        >
          <dt class="text-xs font-bold tracking-[0.06em] whitespace-nowrap text-muted uppercase">
            {{ fact.label }}
          </dt>
          <dd class="text-[0.9375rem] font-semibold text-heading">
            {{ fact.value }}
          </dd>
        </div>
      </dl>
    </div>

    <div class="mt-10 h-75 overflow-hidden rounded-3xl sm:h-105 lg:mt-14 lg:h-140">
      <UiMediaFrame
        :image="story?.heroImage ?? study.image"
        sizes="100vw lg:1152px"
        priority
      />
    </div>
  </section>
</template>
