<script setup lang="ts">
import type { ServicePageContent } from '~/data/service-pages/types'
import { routes } from '~/data/routes'

defineProps<{ page: ServicePageContent }>()
</script>

<template>
  <section
    aria-labelledby="technology-title"
    class="border-b border-line bg-subtle"
  >
    <div class="container-page grid items-start gap-12 py-20 lg:grid-cols-[0.74fr_1.26fr] lg:gap-18 lg:py-26">
      <div class="flex flex-col gap-4.5 lg:sticky lg:top-29">
        <UiSectionHeader
          id="technology-title"
          :eyebrow="page.technology.eyebrow"
          :title="page.technology.title"
        >
          {{ page.technology.intro }}
        </UiSectionHeader>
        <ul class="mt-1 flex flex-col gap-2.5">
          <li
            v-for="check in page.technology.checks"
            :key="check"
            class="flex gap-2.75 text-[0.90625rem] leading-normal text-heading"
          >
            <UiTick class="mt-0.5" />
            {{ check }}
          </li>
        </ul>
        <p
          v-if="page.technology.legend"
          class="mt-2.5 inline-flex items-center gap-2 text-[0.8125rem] text-muted"
        >
          <span
            class="size-2.5 rounded-full border border-violet-150 bg-lilac-50"
            aria-hidden="true"
          />
          {{ page.technology.legend }}
        </p>
      </div>

      <div class="flex flex-col gap-4">
        <ul class="grid gap-4 md:grid-cols-2">
          <li
            v-for="group in page.technology.groups"
            :key="group.title"
            class="flex flex-col gap-4.5 rounded-xl border border-line bg-white px-6.5 py-6"
            :class="group.wide && 'md:col-span-2'"
          >
            <div class="flex flex-col gap-0.75">
              <h3 class="font-display text-[1.03125rem] font-semibold tracking-[-0.015em] text-heading">
                {{ group.title }}
              </h3>
              <p class="text-[0.84375rem] leading-[1.45] text-muted">
                {{ group.summary }}
              </p>
            </div>
            <ul class="flex flex-wrap gap-2">
              <li
                v-for="mark in group.marks"
                :key="mark.name"
                class="flex items-center gap-1.75 rounded-full border py-1.5 pr-3.25 pl-2.25 text-[0.84375rem] font-semibold"
                :class="mark.recommended ? 'border-violet-150 bg-lilac-50 text-violet-700' : 'border-line bg-white text-body'"
              >
                <UiTechMark
                  v-if="mark.icon"
                  :icon="mark.icon"
                  class="size-3.75 flex-none"
                />
                {{ mark.name }}<span
                  v-if="mark.recommended"
                  class="sr-only"
                > (often recommended)</span>
              </li>
            </ul>
          </li>
        </ul>

        <div
          v-if="page.technology.extras"
          class="flex flex-col gap-5 rounded-xl bg-heading px-6 py-7 sm:px-7.5"
        >
          <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h3 class="font-display text-[1.03125rem] font-semibold tracking-[-0.015em] text-white">
              {{ page.technology.extras.title }}
            </h3>
            <p class="text-sm leading-normal text-body-on-dark">
              {{ page.technology.extras.body }}
            </p>
          </div>
          <ul
            class="flex flex-wrap items-center gap-x-5.5 gap-y-5"
            aria-label="Other technologies we work with"
          >
            <li
              v-for="mark in page.technology.extras.marks"
              :key="mark.name"
            >
              <UiTechMark
                v-if="mark.icon"
                :icon="mark.icon"
                :label="mark.name"
                class="size-4.75 brightness-0 invert-[.66]"
              />
            </li>
          </ul>
          <NuxtLink
            :to="`${routes.contact}?service=${page.slug}`"
            class="w-fit text-[0.90625rem] font-semibold text-violet-200 hover:underline"
          >
            {{ page.technology.extras.cta }} <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
