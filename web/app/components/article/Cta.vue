<script setup lang="ts">
import type { ArticleBody } from '~/data/articles'
import type { ServiceSlug } from '~/data/routes'
import { articleCta } from '~/data/article-page'
import { routes } from '~/data/routes'
import { serviceBySlug } from '~/data/services'

/** Closing panel: the article's related service, and a call for anyone not ready to order. */
const props = defineProps<{ body: ArticleBody, service: ServiceSlug }>()

const offer = serviceBySlug(props.service)
</script>

<template>
  <section
    aria-labelledby="article-cta-title"
    class="bg-page px-4 pb-20 sm:px-6 lg:pb-24"
  >
    <div class="relative mx-auto flex max-w-300 flex-col gap-10 overflow-hidden rounded-4xl bg-ink-900 px-6 py-12 sm:px-10 lg:flex-row lg:items-center lg:gap-14 lg:px-14 lg:py-15">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_120%_at_88%_26%,rgb(125_83_242/0.28),transparent_60%)]"
        aria-hidden="true"
      />

      <div class="relative flex max-w-[54ch] flex-col gap-4.5">
        <UiEyebrowChip tone="dark">
          {{ articleCta.eyebrow(offer.shortName) }}
        </UiEyebrowChip>
        <h2
          id="article-cta-title"
          class="font-display text-h2 text-white lg:text-[2.75rem]"
        >
          {{ body.cta.title }}
        </h2>
        <p class="text-[1.0625rem] leading-[1.62] text-body-on-dark">
          {{ body.cta.body }}
        </p>
      </div>

      <div class="relative flex w-full flex-none flex-col gap-4 lg:ml-auto lg:w-75">
        <UiButton
          :to="routes.service(offer.slug)"
          size="lg"
          block
        >
          {{ articleCta.button(offer.shortName) }}
        </UiButton>
        <NuxtLink
          :to="routes.contact"
          class="text-center text-sm font-semibold text-violet-200 hover:text-white"
        >
          {{ articleCta.call }}
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
