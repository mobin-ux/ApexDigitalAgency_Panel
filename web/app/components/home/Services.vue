<script setup lang="ts">
import { routes } from '~/data/routes'
import { featuredService, featuredServiceData, gridServices } from '~/data/services'
import { formatGbp } from '~/utils/format'

const { instalments } = featuredService
const home = useCmsContent('home')
</script>

<template>
  <section
    id="services"
    aria-labelledby="services-title"
    class="border-b border-line bg-subtle"
  >
    <div class="container-page py-20 lg:py-26">
      <div class="mb-11 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-12">
        <div class="max-w-150">
          <UiSectionHeader
            id="services-title"
            :eyebrow="home.services.eyebrow"
            :title="home.services.title"
          >
            {{ home.services.text }}
          </UiSectionHeader>
        </div>
        <div class="md:pb-1.5">
          <UiButton
            :to="routes.services"
            variant="light"
          >
            {{ home.services.all }}
          </UiButton>
        </div>
      </div>

      <!-- Flagship service -->
      <article
        class="relative mb-5 grid gap-8 rounded-2xl border border-line bg-white p-6 shadow-card transition duration-200 ease-out-soft sm:p-9 md:grid-cols-[minmax(0,1fr)_300px] md:items-center md:gap-11 motion-safe:hover:-translate-y-0.75"
      >
        <div class="flex flex-col gap-3">
          <p class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span class="rounded-full bg-violet-50 px-3 py-1.25 text-[0.71875rem] font-bold text-violet-600">{{ featuredService.badge }}</span>
            <span class="text-[0.84375rem] text-muted">{{ featuredService.leadTime }}</span>
          </p>
          <h3 class="font-display text-h3 text-heading">
            <NuxtLink
              :to="routes.service(featuredService.slug)"
              class="after:absolute after:inset-0 after:rounded-2xl"
            >
              {{ featuredServiceData.name }}
            </NuxtLink>
          </h3>
          <p class="max-w-[46ch] text-base leading-relaxed text-body">
            {{ featuredServiceData.blurb }}
          </p>
          <ul class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <li
              v-for="(item, i) in featuredService.inclusions"
              :key="item"
              class="flex items-center gap-4"
            >
              <span
                v-if="i > 0"
                aria-hidden="true"
                class="hidden text-line-strong sm:inline"
              >·</span>
              {{ item }}
            </li>
          </ul>
        </div>

        <div class="flex flex-col items-start gap-3 border-t border-line pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-10">
          <span class="text-[0.8125rem] text-muted">From</span>
          <span class="font-display text-[2.5rem] leading-none font-extrabold tracking-tight text-heading">
            {{ formatGbp(featuredServiceData.fromMonthly ?? 0) }}<span class="text-[0.9375rem] font-semibold text-muted"> /mo</span>
          </span>
          <span
            class="flex items-center gap-1.25"
            aria-hidden="true"
          >
            <span
              v-for="n in instalments.total"
              :key="n"
              class="block size-2.25 rounded-full"
              :class="n <= instalments.paid ? 'bg-violet-500' : 'bg-violet-100'"
            />
          </span>
          <span class="text-[0.78rem] text-muted">{{ instalments.total }} payments · no interest</span>
          <span
            class="mt-1.5 text-[0.90625rem] font-semibold text-violet-500"
            aria-hidden="true"
          >View plans →</span>
        </div>
      </article>

      <!-- Other services -->
      <ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="service in gridServices"
          :key="service.slug"
          class="relative flex flex-col gap-3.5 rounded-2xl border border-line bg-white px-6.5 pt-6.5 pb-6 transition duration-200 ease-out-soft hover:shadow-lift motion-safe:hover:-translate-y-0.75"
        >
          <UiServiceGlyph
            v-if="service.glyph"
            :name="service.glyph"
          />
          <h3 class="font-display text-xl leading-tight font-semibold tracking-tight text-heading">
            <NuxtLink
              :to="routes.service(service.slug)"
              class="after:absolute after:inset-0 after:rounded-2xl"
            >
              {{ service.shortName }}
            </NuxtLink>
          </h3>
          <p class="text-[0.90625rem] leading-relaxed text-body">
            {{ service.blurb }}
          </p>
          <p class="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3.5">
            <span class="text-[0.84375rem] text-muted">
              {{ service.fromMonthly ? `From ${formatGbp(service.fromMonthly)}/mo` : 'Scoped on a call' }}
            </span>
            <span
              class="text-base text-violet-500"
              aria-hidden="true"
            >→</span>
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>
