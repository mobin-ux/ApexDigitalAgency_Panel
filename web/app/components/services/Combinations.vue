<script setup lang="ts">
import { planTermMonths } from '~/data/home'
import { routes } from '~/data/routes'
import { serviceCombinations } from '~/data/services-page'
import { formatGbp } from '~/utils/format'
</script>

<template>
  <section
    aria-labelledby="combinations-title"
    class="border-y border-line bg-subtle"
  >
    <div class="container-page flex flex-col gap-11 py-20 lg:py-26">
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end lg:gap-16">
        <UiSectionHeader
          id="combinations-title"
          eyebrow="Combinations"
          title="Most businesses need two things, not one"
        />
        <p class="text-body-lg text-body lg:mb-1.5">
          A site with nobody visiting it does not sell, and traffic to a weak site does not either. These are the pairings we set up most often.
        </p>
      </div>

      <ul class="grid gap-5.5 lg:grid-cols-3">
        <li
          v-for="combo in serviceCombinations"
          :key="combo.title"
          class="relative flex flex-col gap-4 overflow-hidden rounded-2xl p-6 sm:p-8"
          :class="combo.featured ? 'bg-ink-900' : 'border border-line bg-white shadow-tile'"
        >
          <div
            v-if="combo.featured"
            class="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_120%_at_85%_12%,rgb(125_83_242/0.28),transparent_62%)]"
            aria-hidden="true"
          />

          <span
            class="relative w-fit rounded-full border px-3 py-1.25 text-[0.71875rem] font-bold"
            :class="combo.featured ? 'border-white/12 bg-white/8 text-white' : 'border-line bg-subtle text-muted'"
          >{{ combo.audience }}</span>

          <h3
            class="relative font-display text-2xl leading-[1.14] font-semibold tracking-[-0.022em]"
            :class="combo.featured ? 'text-white' : 'text-heading'"
          >
            {{ combo.title }}
          </h3>

          <ul
            class="relative flex flex-wrap items-center gap-2"
            :aria-label="`Services in “${combo.title}”`"
          >
            <li
              v-for="(part, i) in combo.services"
              :key="part.slug"
              class="flex items-center gap-2"
            >
              <span
                v-if="i > 0"
                aria-hidden="true"
                :class="combo.featured ? 'text-white/35' : 'text-muted'"
              >+</span>
              <NuxtLink
                :to="routes.service(part.slug)"
                class="rounded-[9px] px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors"
                :class="combo.featured
                  ? 'bg-violet-400/18 text-violet-200 hover:bg-violet-400/28'
                  : 'bg-violet-50 text-violet-600 hover:bg-violet-100'"
              >
                {{ part.label }}
              </NuxtLink>
            </li>
          </ul>

          <p
            class="relative text-[0.90625rem] leading-relaxed"
            :class="combo.featured ? 'text-body-on-dark' : 'text-body'"
          >
            {{ combo.body }}
          </p>

          <p
            class="relative mt-auto flex items-baseline gap-2.5 border-t pt-4.5"
            :class="combo.featured ? 'border-white/10' : 'border-line-soft'"
          >
            <template v-if="combo.monthly !== null">
              <span
                class="font-display text-2xl leading-none font-extrabold tracking-[-0.024em]"
                :class="combo.featured ? 'text-white' : 'text-heading'"
              >{{ formatGbp(combo.monthly) }}</span>
              <span
                class="text-[0.84375rem]"
                :class="combo.featured ? 'text-muted-on-dark' : 'text-muted'"
              >/month, {{ planTermMonths }} months</span>
            </template>
            <span
              v-else
              class="font-display text-[1.1875rem] leading-none font-semibold tracking-[-0.018em] text-heading"
            >Quoted on a call</span>
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>
