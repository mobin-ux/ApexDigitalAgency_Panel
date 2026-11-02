<script setup lang="ts">
import type { SectionFields } from '#shared/cms'
import { routes } from '~/data/routes'
import { catalogueServices } from '~/data/services'

/** Service tiles: names, lines and prices come from the site's catalogue, never the section. */
defineProps<{
  fields: SectionFields<'services'>
  anchor: string
}>()
</script>

<template>
  <section
    :aria-labelledby="fields.heading ? `${anchor}-title` : undefined"
    :aria-label="fields.heading ? undefined : 'Services'"
    class="container-page flex flex-col gap-10 py-12 lg:py-16"
  >
    <div
      v-if="fields.heading || fields.body"
      class="flex max-w-[56ch] flex-col gap-4"
    >
      <h2
        v-if="fields.heading"
        :id="`${anchor}-title`"
        class="font-display text-h2 text-heading"
      >
        {{ fields.heading }}
      </h2>
      <p
        v-if="fields.body"
        class="text-body-lg text-body"
      >
        {{ fields.body }}
      </p>
    </div>
    <ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="service in catalogueServices"
        :key="service.slug"
        class="relative flex flex-col gap-3 rounded-2xl border border-line bg-white p-6 shadow-tile transition duration-200 ease-out-soft hover:shadow-tile-hover"
      >
        <h3 class="font-display text-xl font-semibold tracking-tight text-heading">
          <NuxtLink
            :to="routes.service(service.slug)"
            class="after:absolute after:inset-0 after:rounded-2xl"
          >
            {{ service.name }}
          </NuxtLink>
        </h3>
        <p class="text-[0.9375rem] leading-[1.6] text-body">
          {{ service.blurb }}
        </p>
        <p class="mt-auto pt-2 text-sm font-semibold text-heading">
          {{ service.fromMonthly === null ? 'Priced after a free call' : `From £${service.fromMonthly}/mo` }}
        </p>
      </li>
    </ul>
  </section>
</template>
