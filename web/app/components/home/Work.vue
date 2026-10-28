<script setup lang="ts">
import { caseStudyTeasers, featuredCaseStudy as study } from '~/data/content'
import { routes } from '~/data/routes'

const home = useCmsContent('home')
</script>

<template>
  <section
    id="work"
    aria-labelledby="work-title"
    class="border-y border-line bg-subtle"
  >
    <div class="container-page flex flex-col gap-12 py-24 lg:gap-14 lg:py-32">
      <div class="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-12">
        <div class="max-w-150">
          <UiSectionHeader
            id="work-title"
            :eyebrow="home.work.eyebrow"
            :title="home.work.title"
          />
        </div>
        <NuxtLink
          :to="routes.ourWork"
          class="text-[0.9375rem] font-semibold text-violet-600 hover:underline md:pb-2.5"
        >
          {{ home.work.all }} →
        </NuxtLink>
      </div>

      <!-- Featured case study -->
      <div class="relative">
        <article class="relative grid overflow-hidden rounded-4xl border border-line bg-white shadow-card lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div class="flex flex-col gap-5.5 p-6 sm:p-10 lg:px-12 lg:py-13">
            <p class="text-xs font-bold tracking-widest text-muted uppercase">
              {{ study.label }}
            </p>
            <h3 class="font-display text-h3 text-heading">
              <NuxtLink
                :to="study.to"
                class="after:absolute after:inset-0"
              >
                {{ study.title }}
              </NuxtLink>
            </h3>
            <p class="max-w-[44ch] text-[1.03rem] leading-relaxed text-body">
              {{ study.summary }}
            </p>
            <figure class="mt-1.5 border-l-2 border-violet-200 pl-5">
              <blockquote class="text-base leading-relaxed text-heading">
                <p>{{ study.quote }}</p>
              </blockquote>
              <figcaption class="mt-2.5 text-[0.84375rem] text-muted">
                {{ study.quoteBy }}
              </figcaption>
            </figure>
            <span
              class="mt-auto pt-6 text-[0.9375rem] font-semibold text-violet-600"
              aria-hidden="true"
            >Read the full case study →</span>
          </div>
          <div class="min-h-70 lg:min-h-130">
            <UiMediaFrame
              :image="study.image"
              sizes="(min-width: 1024px) 600px, 100vw"
            />
          </div>
        </article>

        <dl class="mt-4 grid grid-cols-3 gap-3 lg:absolute lg:right-12 lg:-bottom-9 lg:mt-0 lg:w-120 lg:gap-4">
          <div
            v-for="result in study.results"
            :key="result.label"
            class="flex flex-col-reverse gap-1 rounded-xl border border-line bg-white p-4 shadow-lift sm:p-5"
          >
            <dt class="text-[0.78rem] text-muted">
              {{ result.label }}
            </dt>
            <dd class="font-display text-2xl leading-none font-extrabold tracking-tight text-violet-600 sm:text-[1.875rem]">
              {{ result.value }}
            </dd>
          </div>
        </dl>
      </div>

      <!-- More case studies -->
      <ul class="grid gap-6 sm:grid-cols-2 lg:mt-11 lg:grid-cols-3">
        <li
          v-for="item in caseStudyTeasers"
          :key="item.slug"
          class="relative flex flex-col gap-4"
        >
          <div class="h-45 overflow-hidden rounded-xl">
            <UiMediaFrame
              :image="item.image"
              sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            />
          </div>
          <p class="text-xs font-bold tracking-wider text-muted uppercase">
            {{ item.sector }} · {{ item.location }}
          </p>
          <h3 class="font-display text-xl leading-tight font-semibold tracking-tight text-heading">
            <NuxtLink
              v-if="item.to"
              :to="item.to"
              class="after:absolute after:inset-0"
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
