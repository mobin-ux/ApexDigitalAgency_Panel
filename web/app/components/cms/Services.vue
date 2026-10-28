<script setup lang="ts">
import type { SectionProps } from '#shared/cms'
import { routes } from '~/data/routes'
import { catalogueServices } from '~/data/services'
import { formatGbp } from '~/utils/format'

defineProps<{ id: string, props: SectionProps<'services'> }>()
</script>

<template>
  <section :id="id" class="bg-subtle px-4 py-16 sm:px-6 lg:py-24">
    <div class="container-page flex flex-col gap-10">
      <div v-if="props.title || props.text" class="flex max-w-[60ch] flex-col gap-3">
        <h2 v-if="props.title" class="font-display text-h2 text-heading">
          {{ props.title }}
        </h2>
        <p v-if="props.text" class="text-body-lg text-body">
          {{ props.text }}
        </p>
      </div>
      <ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="service in catalogueServices" :key="service.slug" class="relative flex flex-col gap-2 rounded-2xl border border-line bg-page p-6 transition-colors hover:border-violet-500">
          <h3 class="font-display text-[1.125rem] font-semibold tracking-tight text-heading">
            <NuxtLink :to="routes.service(service.slug)" class="after:absolute after:inset-0 after:rounded-2xl">
              {{ service.name }}
            </NuxtLink>
          </h3>
          <p class="text-[0.9375rem] leading-relaxed text-body">
            {{ service.summary }}
          </p>
          <p class="mt-auto pt-2 text-[0.9063rem] font-semibold text-violet-600">
            {{ service.fromMonthly ? `From ${formatGbp(service.fromMonthly)}/mo` : 'Scoped on a call' }}
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>
