<script setup lang="ts">
import type { ArticleBody } from '~/data/articles'
import type { ServiceSlug } from '~/data/routes'
import { routes } from '~/data/routes'
import { serviceBySlug } from '~/data/services'

/**
 * The article itself, with a sticky contents list and the related service
 * beside it from `lg`.
 *
 * The contents list is plain anchor links (smooth scrolling and the header
 * offset come from `main.css`); the highlight on the section in view is an
 * enhancement added after mount.
 */
const props = defineProps<{ body: ArticleBody, service: ServiceSlug }>()
const chrome = useCmsContent('article-chrome')
const articleChrome = computed(() => ({
  contents: chrome.value.contents,
  sideService: { label: chrome.value.relatedService, link: chrome.value.viewService },
  writtenBy: chrome.value.writtenBy,
}))

const offer = serviceBySlug(props.service)

const contents = [
  { id: 'short', label: props.body.summary.label },
  ...props.body.sections.map(section => ({ id: section.id, label: section.label })),
  { id: 'faq', label: props.body.faq.label },
]

const active = ref(contents[0]!.id)

// The last section whose top has passed 220px from the viewport top, as in the design.
function update() {
  let current = contents[0]!.id
  for (const entry of contents) {
    const el = document.getElementById(entry.id)
    if (el && el.getBoundingClientRect().top < 220) {
      current = entry.id
    }
  }
  active.value = current
}

useEventListener('scroll', update, { passive: true })
onMounted(update)
</script>

<template>
  <div class="container-page pt-16 pb-20 lg:pb-24">
    <div class="grid gap-16 lg:grid-cols-[240px_minmax(0,760px)] lg:items-start lg:justify-center lg:gap-20">
      <aside class="sticky top-27 hidden flex-col gap-6 lg:flex">
        <nav
          aria-labelledby="contents-title"
          class="flex flex-col gap-0.5"
        >
          <p
            id="contents-title"
            class="pb-2.5 pl-3.5 text-xs font-bold tracking-[0.07em] text-muted uppercase"
          >
            {{ articleChrome.contents }}
          </p>
          <a
            v-for="entry in contents"
            :key="entry.id"
            :href="`#${entry.id}`"
            :aria-current="active === entry.id ? 'location' : undefined"
            class="group/toc flex items-start gap-3 rounded-[12px] px-3.5 py-2.25 text-sm leading-[1.4] font-semibold text-body transition-colors duration-200 hover:text-violet-600 aria-[current=location]:bg-violet-50 aria-[current=location]:text-violet-600"
          >
            <span
              class="mt-1.5 size-1.5 flex-none rounded-full bg-line-strong transition-colors duration-200 group-aria-[current=location]/toc:bg-violet-500"
              aria-hidden="true"
            />
            {{ entry.label }}
          </a>
        </nav>

        <div class="flex flex-col gap-3 rounded-xl border border-line bg-white p-5 shadow-tile">
          <p class="text-xs font-bold tracking-[0.07em] text-muted uppercase">
            {{ articleChrome.sideService.label }}
          </p>
          <p class="font-display text-[1.0625rem] font-semibold tracking-[-0.015em] text-heading">
            {{ offer.shortName }}
          </p>
          <p
            v-if="offer.fromMonthly"
            class="flex items-baseline gap-1.5"
          >
            <span class="text-[0.78125rem] text-muted">From</span>
            <span class="font-display text-2xl leading-none font-extrabold tracking-[-0.024em] text-heading">{{ formatGbp(offer.fromMonthly) }}</span>
            <span class="text-[0.8125rem] text-muted">/month</span>
          </p>
          <NuxtLink
            :to="routes.service(offer.slug)"
            class="group text-sm font-semibold whitespace-nowrap text-violet-600 hover:underline"
          >
            {{ articleChrome.sideService.link }} <span
              class="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
              aria-hidden="true"
            >→</span>
          </NuxtLink>
        </div>
      </aside>

      <div class="flex min-w-0 flex-col gap-6">
        <section
          id="short"
          aria-labelledby="short-title"
          class="flex scroll-mt-5 flex-col gap-4.5 rounded-2xl border border-violet-150 bg-lilac-50 px-5.5 py-7 sm:px-8.5 sm:py-8"
        >
          <h2
            id="short-title"
            class="text-xs font-bold tracking-[0.07em] text-violet-600 uppercase"
          >
            {{ body.summary.label }}
          </h2>
          <p class="font-display text-[clamp(1.1875rem,1rem+0.7vw,1.375rem)] leading-[1.42] font-semibold tracking-[-0.015em] text-pretty text-heading">
            {{ body.summary.answer }}
          </p>
          <ul class="grid gap-3 sm:grid-cols-3">
            <li
              v-for="figure in body.summary.figures"
              :key="figure.label"
              class="flex flex-col gap-1.5 rounded-lg bg-white px-4.5 py-4"
            >
              <span class="font-display text-2xl leading-none font-extrabold tracking-[-0.024em] whitespace-nowrap text-heading">{{ figure.value }}</span>
              <span class="text-[0.8125rem] leading-[1.45] text-body">{{ figure.label }}</span>
            </li>
          </ul>
        </section>

        <section
          v-for="section in body.sections"
          :id="section.id"
          :key="section.id"
          :aria-labelledby="`${section.id}-title`"
          class="mt-7 flex scroll-mt-5 flex-col gap-6"
        >
          <h2
            :id="`${section.id}-title`"
            class="font-display text-h3 leading-[1.12] text-pretty text-heading"
          >
            {{ section.title }}
          </h2>
          <ArticleBlock
            v-for="(block, i) in section.blocks"
            :key="i"
            :block="block"
            :service="service"
          />
        </section>

        <section
          id="faq"
          aria-labelledby="faq-title"
          class="mt-7 flex scroll-mt-5 flex-col gap-6"
        >
          <h2
            id="faq-title"
            class="font-display text-h3 leading-[1.12] text-pretty text-heading"
          >
            {{ body.faq.title }}
          </h2>
          <ArticleFaq :items="body.faq.items" />
        </section>

        <aside
          v-if="body.method"
          aria-labelledby="method-title"
          class="mt-5 flex flex-col gap-2 rounded-xl border border-line bg-subtle px-6 py-5.5"
        >
          <h2
            id="method-title"
            class="text-xs font-bold tracking-[0.07em] text-muted uppercase"
          >
            {{ body.method.title }}
          </h2>
          <p class="text-[0.90625rem] leading-[1.65] text-body">
            {{ body.method.body }}
          </p>
        </aside>

        <div class="mt-2 grid grid-cols-[64px_minmax(0,1fr)] gap-5 border-t border-line pt-7">
          <span
            class="inline-flex size-16 items-center justify-center rounded-full bg-violet-50 font-display text-xl font-bold text-violet-600"
            aria-hidden="true"
          >{{ initials(body.author.name) }}</span>
          <div class="flex flex-col gap-1.5">
            <p class="text-xs font-bold tracking-[0.07em] text-muted uppercase">
              {{ articleChrome.writtenBy }}
            </p>
            <p class="font-display text-[1.1875rem] font-semibold tracking-[-0.015em] text-heading">
              {{ body.author.name }}, {{ body.author.role }}
            </p>
            <p class="text-[0.9375rem] leading-[1.6] text-body">
              {{ body.author.bio }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
