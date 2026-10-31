<script setup lang="ts">
import { routes } from '~/data/routes'
import { company } from '~/data/site'

const home = useCmsContent('home')
</script>

<template>
  <section
    aria-labelledby="cta-title"
    class="bg-page px-4 pb-20 sm:px-6 lg:pb-32"
  >
    <div class="relative mx-auto grid max-w-300 items-center gap-10 overflow-hidden rounded-4xl bg-ink-900 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16 lg:rounded-5xl lg:px-16 lg:py-18">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_120%_at_88%_26%,rgb(125_83_242/0.3),transparent_60%)]"
        aria-hidden="true"
      />

      <div class="relative flex flex-col gap-5.5">
        <UiEyebrowChip
          tone="dark"
          emoji="👋"
        >
          {{ home.cta.eyebrow }}
        </UiEyebrowChip>
        <h2
          id="cta-title"
          class="max-w-[20ch] font-display text-h2 text-white"
        >
          {{ home.cta.title }}
        </h2>
        <p class="max-w-[48ch] text-body-lg text-body-on-dark">
          {{ home.cta.text }}
        </p>
        <div class="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4.5">
          <UiButton
            :to="routes.contact"
            size="lg"
          >
            {{ home.cta.button }}
          </UiButton>
          <a
            :href="`mailto:${company.email}`"
            class="text-[0.96875rem] font-semibold text-white hover:underline"
          >{{ company.email }}</a>
        </div>
      </div>

      <ul class="relative flex flex-col gap-3.5">
        <li class="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 px-6 py-5">
          <span class="text-[0.78rem] text-muted-on-dark">{{ home.cta.replyLabel }}</span>
          <span class="font-display text-[1.3125rem] font-semibold tracking-tight text-white">{{ home.cta.replyValue }}</span>
        </li>
        <li class="relative flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 px-6 py-5 transition-colors hover:bg-white/8">
          <span class="text-[0.78rem] text-muted-on-dark">{{ home.cta.clientLabel }}</span>
          <NuxtLink
            :to="routes.contact"
            class="font-display text-[1.3125rem] font-semibold tracking-tight text-white after:absolute after:inset-0 after:rounded-xl"
          >
            {{ home.cta.clientValue }} <span aria-hidden="true">→</span>
          </NuxtLink>
        </li>
        <li class="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 px-6 py-5">
          <span class="text-[0.78rem] text-muted-on-dark">{{ home.cta.whereLabel }}</span>
          <span class="font-display text-[1.3125rem] font-semibold tracking-tight text-white">{{ company.address.locality }}, {{ company.address.region }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
