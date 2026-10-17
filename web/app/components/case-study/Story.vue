<script setup lang="ts">
import type { CaseStudy, CaseStudyStory } from '~/data/case-studies'
import type { StoryChapterId } from '~/data/case-study-page'
import { sideCta, storyChapters } from '~/data/case-study-page'
import { routes } from '~/data/routes'
import { serviceBySlug } from '~/data/services'

/**
 * The four chapters, with a sticky contents list beside them from `lg`.
 *
 * The contents list is plain anchor links (smooth scrolling and the header
 * offset come from `main.css`); the highlight on the chapter in view is an
 * enhancement added after mount.
 */
const props = defineProps<{ study: CaseStudy, story: CaseStudyStory }>()

const primary = serviceBySlug(props.study.services[0]!)
const { contact } = useServiceLinks(primary.slug)

const delivered = props.study.services
  .map(slug => ({ service: serviceBySlug(slug), items: props.story.servicesUsed.delivered[slug] ?? [] }))
  .filter(entry => entry.items.length)

function numbered(id: StoryChapterId) {
  const i = storyChapters.findIndex(chapter => chapter.id === id)
  return `${String(i + 1).padStart(2, '0')} · ${storyChapters[i]!.label}`
}

const active = ref<StoryChapterId>(storyChapters[0].id)

// The last chapter whose top has passed 200px from the viewport top, as in
// the design. A scroll listener is enough for four elements.
function update() {
  let current: StoryChapterId = storyChapters[0].id
  for (const chapter of storyChapters) {
    const el = document.getElementById(chapter.id)
    if (el && el.getBoundingClientRect().top < 200) {
      current = chapter.id
    }
  }
  active.value = current
}

useEventListener('scroll', update, { passive: true })
onMounted(update)
</script>

<template>
  <section
    aria-label="The story"
    class="container-page py-20 lg:py-26"
  >
    <div class="grid gap-16 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-22">
      <aside class="sticky top-26 hidden flex-col gap-7 lg:flex">
        <nav
          aria-labelledby="toc-title"
          class="flex flex-col gap-1"
        >
          <p
            id="toc-title"
            class="pb-2.5 pl-4 text-xs font-bold tracking-[0.07em] text-muted uppercase"
          >
            On this page
          </p>
          <a
            v-for="chapter in storyChapters"
            :key="chapter.id"
            :href="`#${chapter.id}`"
            :aria-current="active === chapter.id ? 'location' : undefined"
            class="group/toc flex items-center gap-3 rounded-[12px] px-4 py-2.5 text-[0.90625rem] font-semibold text-body transition-colors duration-200 hover:text-violet-600 aria-[current=location]:bg-violet-50 aria-[current=location]:text-violet-600"
          >
            <span
              class="size-1.5 flex-none rounded-full bg-line-strong transition-colors duration-200 group-aria-[current=location]/toc:bg-violet-500"
              aria-hidden="true"
            />
            {{ chapter.label }}
          </a>
        </nav>

        <div
          v-if="primary.fromMonthly"
          class="flex flex-col gap-3.5 rounded-xl border border-line bg-white p-5.5 shadow-tile"
        >
          <p class="font-display text-[1.0625rem] leading-[1.25] font-semibold tracking-[-0.015em] text-heading">
            {{ sideCta.title }}
          </p>
          <p class="flex items-baseline gap-1.5">
            <span class="text-[0.78125rem] text-muted">From</span>
            <span class="font-display text-[1.625rem] leading-none font-extrabold tracking-[-0.026em] text-heading">{{ formatGbp(primary.fromMonthly) }}</span>
            <span class="text-[0.8125rem] text-muted">/month</span>
          </p>
          <UiButton
            :to="contact()"
            block
          >
            {{ sideCta.button }}
          </UiButton>
        </div>
      </aside>

      <div class="flex min-w-0 flex-col gap-22">
        <article
          id="problem"
          aria-labelledby="problem-title"
          class="flex scroll-mt-4 flex-col gap-5.5"
        >
          <p class="text-[0.8125rem] font-bold text-violet-600">
            {{ numbered('problem') }}
          </p>
          <h2
            id="problem-title"
            class="font-display text-[clamp(1.875rem,1.4rem+1.6vw,2.5rem)] leading-[1.08] font-bold tracking-[-0.028em] text-pretty text-heading"
          >
            {{ story.problem.title }}
          </h2>
          <p class="text-body-lg leading-[1.7] text-pretty text-body">
            {{ story.problem.body }}
          </p>
          <ul class="grid gap-4 pt-1.5 sm:grid-cols-3">
            <li
              v-for="figure in story.problem.figures"
              :key="figure.label"
              class="flex flex-col gap-2 rounded-[18px] border border-line-soft bg-subtle p-5.5"
            >
              <span class="font-display text-[1.75rem] leading-none font-extrabold tracking-[-0.026em] text-heading">{{ figure.value }}</span>
              <span class="text-sm leading-normal text-body">{{ figure.label }}</span>
            </li>
          </ul>
        </article>

        <article
          id="work"
          aria-labelledby="work-title"
          class="flex scroll-mt-4 flex-col gap-5.5"
        >
          <p class="text-[0.8125rem] font-bold text-violet-600">
            {{ numbered('work') }}
          </p>
          <h2
            id="work-title"
            class="font-display text-[clamp(1.875rem,1.4rem+1.6vw,2.5rem)] leading-[1.08] font-bold tracking-[-0.028em] text-pretty text-heading"
          >
            {{ story.work.title }}
          </h2>
          <p class="text-body-lg leading-[1.7] text-pretty text-body">
            {{ story.work.body }}
          </p>
          <ol class="flex flex-col gap-4 pt-1.5">
            <li
              v-for="(step, i) in story.work.steps"
              :key="step.title"
              class="grid grid-cols-[44px_minmax(0,1fr)] gap-4 rounded-xl border border-line bg-white px-5 py-6 shadow-tile sm:gap-5 sm:px-7 sm:py-6.5"
            >
              <span
                class="inline-flex size-11 items-center justify-center rounded-full bg-violet-50 font-display text-base font-semibold text-violet-600"
                aria-hidden="true"
              >{{ i + 1 }}</span>
              <div class="flex flex-col gap-2 pt-0.5">
                <h3 class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span class="font-display text-xl font-semibold tracking-[-0.018em] text-heading">{{ step.title }}</span>
                  <span class="rounded-full border border-line bg-subtle px-2.5 py-0.75 text-xs font-semibold whitespace-nowrap text-body">{{ step.when }}</span>
                </h3>
                <p class="text-[0.96875rem] leading-[1.6] text-body">
                  {{ step.body }}
                </p>
              </div>
            </li>
          </ol>
          <div class="grid gap-4 pt-2.5 sm:grid-cols-[1.4fr_1fr]">
            <div class="h-60 overflow-hidden rounded-xl sm:h-85">
              <UiMediaFrame
                :image="story.work.images.wide"
                sizes="100vw sm:60vw lg:470px"
              />
            </div>
            <div class="h-60 overflow-hidden rounded-xl sm:h-85">
              <UiMediaFrame
                :image="story.work.images.narrow"
                sizes="100vw sm:40vw lg:340px"
              />
            </div>
          </div>
        </article>

        <article
          id="outcome"
          aria-labelledby="outcome-title"
          class="flex scroll-mt-4 flex-col gap-5.5"
        >
          <p class="text-[0.8125rem] font-bold text-violet-600">
            {{ numbered('outcome') }}
          </p>
          <h2
            id="outcome-title"
            class="font-display text-[clamp(1.875rem,1.4rem+1.6vw,2.5rem)] leading-[1.08] font-bold tracking-[-0.028em] text-pretty text-heading"
          >
            {{ story.outcome.title }}
          </h2>
          <p class="text-body-lg leading-[1.7] text-pretty text-body">
            {{ story.outcome.body }}
          </p>
          <CaseStudyChart
            v-if="story.outcome.chart"
            :chart="story.outcome.chart"
          />
          <figure class="mt-4 grid grid-cols-[4px_minmax(0,1fr)] gap-5 sm:gap-7">
            <span
              class="rounded-[4px] bg-violet-500"
              aria-hidden="true"
            />
            <div class="flex flex-col gap-5 py-1">
              <blockquote class="font-display text-[clamp(1.375rem,1.1rem+1vw,1.75rem)] leading-[1.3] font-semibold tracking-[-0.02em] text-pretty text-heading">
                <p>{{ story.outcome.quote.quote }}</p>
              </blockquote>
              <figcaption class="flex flex-wrap items-center gap-3.5">
                <span
                  class="inline-flex size-11 flex-none items-center justify-center rounded-full bg-violet-50 font-display text-[0.9375rem] font-bold text-violet-600"
                  aria-hidden="true"
                >{{ initials(story.outcome.quote.name) }}</span>
                <span class="flex flex-col gap-0.5">
                  <span class="text-[0.9375rem] font-semibold text-heading">{{ story.outcome.quote.name }}</span>
                  <span class="text-[0.84375rem] text-muted">{{ story.outcome.quote.role }}</span>
                </span>
                <UiStars
                  :size="14"
                  :gap="2"
                  class="ml-2 text-amber-500"
                />
              </figcaption>
            </div>
          </figure>
        </article>

        <article
          id="services"
          aria-labelledby="services-title"
          class="flex scroll-mt-4 flex-col gap-5.5"
        >
          <p class="text-[0.8125rem] font-bold text-violet-600">
            {{ numbered('services') }}
          </p>
          <h2
            id="services-title"
            class="font-display text-[clamp(1.875rem,1.4rem+1.6vw,2.5rem)] leading-[1.08] font-bold tracking-[-0.028em] text-pretty text-heading"
          >
            {{ story.servicesUsed.title }}
          </h2>
          <ul class="grid gap-4 pt-1.5 md:grid-cols-2">
            <li
              v-for="entry in delivered"
              :key="entry.service.slug"
              class="group relative flex flex-col gap-4 rounded-xl border border-line bg-white p-6.5 shadow-tile transition duration-200 ease-out-soft hover:shadow-tile-hover motion-safe:hover:-translate-y-0.75"
            >
              <h3 class="font-display text-[1.3125rem] font-semibold tracking-[-0.02em] text-heading">
                <NuxtLink
                  :to="routes.service(entry.service.slug)"
                  class="after:absolute after:inset-0 after:rounded-xl"
                >
                  {{ entry.service.shortName }}
                </NuxtLink>
              </h3>
              <ul class="flex flex-col gap-2.5">
                <li
                  v-for="item in entry.items"
                  :key="item"
                  class="flex gap-2.75 text-[0.90625rem] leading-normal text-heading"
                >
                  <UiTick class="mt-0.5" />
                  {{ item }}
                </li>
              </ul>
              <p class="mt-auto flex items-baseline gap-2 border-t border-line-soft pt-4">
                <template v-if="entry.service.fromMonthly">
                  <span class="text-[0.78125rem] text-muted">From</span>
                  <span class="font-display text-[1.375rem] leading-none font-extrabold tracking-[-0.024em] text-heading">{{ formatGbp(entry.service.fromMonthly) }}/mo</span>
                </template>
                <span
                  class="ml-auto text-sm font-semibold whitespace-nowrap text-violet-600"
                  aria-hidden="true"
                >View service <span class="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">→</span></span>
              </p>
            </li>
          </ul>
        </article>
      </div>
    </div>
  </section>
</template>
