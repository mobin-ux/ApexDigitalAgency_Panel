<script setup lang="ts">
import type { ServicePageContent } from '~/data/service-pages/types'
import { caseStudyBySlug } from '~/data/case-studies'
import { routes } from '~/data/routes'
import { company } from '~/data/site'

const props = defineProps<{ page: ServicePageContent }>()

const { contact } = useServiceLinks(props.page.slug)

// TODO(content): most of these studies are not in the case-study catalogue
// yet. A card links only when its study has a page, so none leads to a 404.
const hasPage = (slug: string) => Boolean(caseStudyBySlug(slug))
</script>

<template>
  <section
    id="work"
    aria-labelledby="work-title"
    class="border-b border-line"
  >
    <div class="container-page flex flex-col gap-11 py-20 lg:py-26">
      <div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-12">
        <div class="max-w-155">
          <UiSectionHeader
            id="work-title"
            eyebrow="Recent work"
            :title="page.work.title"
          />
        </div>
        <NuxtLink
          :to="routes.ourWork"
          class="text-[0.9375rem] font-semibold text-violet-600 hover:underline md:pb-2.5"
        >
          See all case studies <span aria-hidden="true">→</span>
        </NuxtLink>
      </div>

      <ul class="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="item in page.work.cases"
          :key="item.slug"
          class="relative grid grid-rows-[auto_1fr_auto] overflow-hidden rounded-[22px] border border-line bg-white shadow-tile transition duration-200 ease-out-soft"
          :class="hasPage(item.slug) && 'hover:shadow-tile-hover motion-safe:hover:-translate-y-0.75'"
        >
          <ServiceWorkThumb
            :kind="item.thumb"
            :tint="item.tint"
          />
          <div class="flex flex-col gap-2 px-5.5 pt-5">
            <p class="text-[0.71875rem] font-bold tracking-[0.07em] text-muted uppercase">
              {{ item.sector }}
            </p>
            <h3 class="font-display text-[1.1875rem] leading-[1.24] font-semibold tracking-[-0.018em] text-heading">
              <NuxtLink
                v-if="hasPage(item.slug)"
                :to="routes.caseStudy(item.slug)"
                class="after:absolute after:inset-0 after:rounded-[22px]"
              >
                {{ item.title }}
              </NuxtLink>
              <template v-else>
                {{ item.title }}
              </template>
            </h3>
          </div>
          <div class="mx-5.5 mt-4 mb-5 flex items-end gap-5.5 border-t border-line-soft pt-4">
            <p
              v-for="result in item.results"
              :key="result.label"
              class="flex flex-col gap-0.75"
            >
              <span class="font-display text-xl leading-none font-extrabold tracking-[-0.02em] text-violet-600">{{ result.value }}</span>
              <span class="text-[0.78125rem] text-muted">{{ result.label }}</span>
            </p>
            <span class="ml-auto rounded-full border border-line bg-subtle px-2.75 py-1.25 text-xs font-semibold text-body">{{ item.stack }}</span>
          </div>
        </li>
      </ul>

      <div
        v-if="page.work.callout"
        class="relative flex flex-col gap-6 overflow-hidden rounded-[26px] bg-ink-900 px-6 py-8 sm:px-10 sm:py-8.5 lg:flex-row lg:items-center lg:gap-8"
      >
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_130%_at_88%_20%,rgb(125_83_242/0.26),transparent_62%)]"
          aria-hidden="true"
        />
        <div class="relative flex max-w-[60ch] flex-col gap-1.5">
          <h3 class="font-display text-[1.375rem] font-semibold tracking-[-0.02em] text-white">
            {{ page.work.callout.title }}
          </h3>
          <p class="text-[0.9375rem] leading-relaxed text-body-on-dark">
            {{ page.work.callout.body }}
          </p>
        </div>
        <div class="relative flex flex-wrap items-center gap-x-5.5 gap-y-4 lg:ml-auto">
          <a
            :href="`mailto:${company.email}`"
            class="text-[0.90625rem] font-semibold break-all text-white hover:underline"
          >{{ company.email }}</a>
          <UiButton :to="contact()">
            {{ page.work.callout.cta }}
          </UiButton>
        </div>
      </div>
    </div>
  </section>
</template>
