<script setup lang="ts">
import { sectorLabel, featuredCaseStudy as study } from '~/data/case-studies'
import { serviceBySlug } from '~/data/services'

const tags = study.services.map(slug => serviceBySlug(slug).tag)
</script>

<template>
  <section
    aria-labelledby="featured-title"
    class="container-page pt-14 lg:pt-16"
  >
    <article class="group relative grid overflow-hidden rounded-3xl border border-line bg-white shadow-[0_20px_56px_rgb(17_31_34/0.07)] transition-shadow duration-200 hover:shadow-[0_28px_64px_rgb(17_31_34/0.11)] lg:grid-cols-[1.15fr_0.85fr]">
      <div class="relative min-h-80 sm:min-h-105 lg:min-h-130">
        <div class="absolute inset-0">
          <UiMediaFrame
            :image="study.image"
            sizes="100vw lg:660px"
            priority
          />
        </div>
        <span class="absolute top-5.5 left-5.5 rounded-full bg-white px-3.5 py-1.75 text-[0.78125rem] font-bold whitespace-nowrap text-heading shadow-[0_8px_24px_rgb(17_31_34/0.1)]">Featured case study</span>
        <span class="absolute bottom-5.5 left-5.5 flex max-w-[calc(100%-2.75rem)] items-center gap-2.5 rounded-full border border-line bg-white px-4 py-2.5 shadow-[0_20px_44px_rgb(17_31_34/0.12)]">
          <UiTick size="md" />
          <span class="text-[0.84375rem] font-semibold text-heading">{{ study.milestone }}</span>
        </span>
      </div>

      <div class="flex flex-col gap-5.5 px-6 pt-8 pb-8 sm:px-11 sm:pt-11 sm:pb-10">
        <p class="text-xs font-bold tracking-[0.07em] text-muted uppercase">
          {{ sectorLabel(study.sector) }} · {{ study.place }}
        </p>
        <div class="flex flex-col gap-3">
          <h2
            id="featured-title"
            class="font-display text-[clamp(1.75rem,1.4rem+1.2vw,2.25rem)] leading-[1.08] font-bold tracking-[-0.028em] text-heading"
          >
            {{ study.client }}
          </h2>
          <p class="text-base leading-[1.6] text-pretty text-body">
            {{ study.summary }}
          </p>
        </div>

        <dl class="grid grid-cols-3 border-y border-line-soft">
          <div
            v-for="(result, i) in study.results"
            :key="result.label"
            class="flex flex-col-reverse justify-end gap-1.5 py-4.5"
            :class="[
              i === 0 ? 'pr-4' : 'border-l border-line-soft pl-4',
              i === 1 && 'pr-4',
            ]"
          >
            <dt class="text-[0.8125rem] leading-[1.45] text-muted">
              {{ result.label }}
            </dt>
            <dd
              class="font-display text-[clamp(1.625rem,1.4rem+0.6vw,2rem)] leading-none font-extrabold tracking-[-0.03em]"
              :class="i === 0 ? 'text-violet-500' : 'text-heading'"
            >
              {{ result.value }}
            </dd>
          </div>
        </dl>

        <ul
          class="flex flex-wrap gap-2"
          aria-label="Services"
        >
          <li
            v-for="tag in tags"
            :key="tag"
            class="rounded-[9px] bg-violet-50 px-3 py-1.5 text-[0.8125rem] font-semibold whitespace-nowrap text-violet-600"
          >
            {{ tag }}
          </li>
        </ul>

        <div class="mt-auto flex flex-wrap items-center gap-3 pt-1.5">
          <NuxtLink
            :to="study.to"
            class="inline-flex items-center gap-2.25 rounded-[13px] bg-heading px-5 py-3.25 text-[0.90625rem] font-semibold whitespace-nowrap text-white after:absolute after:inset-0 after:rounded-3xl"
          >
            Read the case study<span class="sr-only">: {{ study.client }}</span>
            <span
              class="text-violet-400 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
              aria-hidden="true"
            >→</span>
          </NuxtLink>
          <span class="text-[0.84375rem] text-muted">{{ study.readMinutes }} min read</span>
        </div>
      </div>
    </article>
  </section>
</template>
