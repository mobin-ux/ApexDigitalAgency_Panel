<script setup lang="ts">
import { planTermMonths } from '~/data/home'
import { homeAnchors, routes } from '~/data/routes'
import { featuredService } from '~/data/services'

const { paid } = featuredService.instalments
const page = useCmsContent('services')
</script>

<template>
  <section
    aria-labelledby="ordering-title"
    class="container-page py-20 lg:py-26"
  >
    <div class="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-18">
      <div class="flex flex-col gap-4.5">
        <UiSectionHeader
          id="ordering-title"
          :eyebrow="page.ordering.eyebrow"
          :title="page.ordering.title"
        />
        <p class="max-w-[44ch] text-body-lg text-body">
          {{ page.ordering.text }}
        </p>
        <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
          <UiButton :to="routes.service(featuredService.slug)">
            {{ page.ordering.button }}
          </UiButton>
          <NuxtLink
            :to="`${routes.home}${homeAnchors.monthly}`"
            class="text-[0.90625rem] font-semibold text-violet-600 hover:underline"
          >
            How monthly plans work <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>
      </div>

      <div class="flex flex-col gap-3.5">
        <ol class="flex flex-col gap-3.5">
          <li
            v-for="(step, i) in page.ordering.steps"
            :key="step.title"
            class="flex items-center gap-4.5 rounded-xl border border-line bg-white px-5 py-5 shadow-tile sm:px-6.5 sm:py-6"
          >
            <span class="inline-flex size-8 flex-none items-center justify-center rounded-full bg-violet-50 font-display text-sm font-semibold text-violet-600">{{ i + 1 }}</span>
            <span class="flex flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
              <span class="font-display text-lg font-semibold tracking-[-0.015em] text-heading">{{ step.title }}</span>
              <span class="text-sm text-muted sm:ml-auto">{{ step.where }}</span>
            </span>
          </li>
        </ol>
        <p class="flex flex-wrap items-center gap-3.5 px-1 pt-1.5">
          <span
            class="flex items-center gap-1.25"
            aria-hidden="true"
          >
            <span
              v-for="n in planTermMonths"
              :key="n"
              class="block size-2.25 rounded-full"
              :class="n <= paid ? 'bg-violet-500' : 'bg-violet-100'"
            />
          </span>
          <span class="text-[0.8125rem] text-muted">Twelve payments, no interest, VAT included</span>
        </p>
      </div>
    </div>
  </section>
</template>
