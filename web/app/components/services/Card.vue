<script setup lang="ts">
import type { Service } from '~/data/services'
import { routes } from '~/data/routes'
import { featuredService } from '~/data/services'
import { formatGbp } from '~/utils/format'

/**
 * One service on the services page. The whole card is a link to the service
 * page through a stretched link on the heading, so its accessible name is the
 * service name rather than the entire card body. A service quoted on a call
 * also gets a real "Book a call" link, raised above the stretched link.
 */
const props = defineProps<{ service: Service }>()

const quoted = computed(() => props.service.fromMonthly === null)
const popular = computed(() => props.service.slug === featuredService.slug)

const facts = computed(() => [
  { label: 'Fixes', value: props.service.fixes },
  { label: 'Best for', value: props.service.bestFor },
  { label: 'Timeline', value: props.service.timeline },
])
</script>

<template>
  <article class="relative flex h-full flex-col gap-4.5 rounded-2xl border border-line bg-white p-6 shadow-tile transition duration-200 ease-out-soft hover:shadow-tile-hover sm:p-8 motion-safe:hover:-translate-y-0.75">
    <ServicesIllustration :name="service.slug" />

    <div class="flex items-start gap-4.5">
      <div class="flex flex-col gap-1.75">
        <h3 class="font-display text-[1.5625rem] leading-[1.12] font-semibold tracking-[-0.024em] text-heading">
          <NuxtLink
            :to="routes.service(service.slug)"
            class="after:absolute after:inset-0 after:rounded-2xl"
          >
            {{ service.shortName }}
          </NuxtLink>
        </h3>
        <p class="text-[0.96875rem] leading-[1.55] text-body">
          {{ service.summary }}
        </p>
      </div>
      <span
        v-if="popular"
        class="ml-auto flex-none rounded-full bg-violet-50 px-3 py-1.25 text-[0.71875rem] font-bold text-violet-600"
      >Popular</span>
    </div>

    <dl class="flex flex-col gap-2.5 border-y border-line-soft py-4.5">
      <div
        v-for="fact in facts"
        :key="fact.label"
        class="flex items-baseline gap-3"
      >
        <dt class="w-22 flex-none text-[0.78125rem] font-bold tracking-[0.06em] text-muted uppercase">
          {{ fact.label }}
        </dt>
        <dd class="text-[0.90625rem] text-body">
          {{ fact.value }}
        </dd>
      </div>
    </dl>

    <div class="mt-auto flex items-end gap-4">
      <p class="flex flex-col gap-0.75">
        <span class="text-[0.78125rem] text-muted">{{ quoted ? 'Quoted' : 'From' }}</span>
        <span class="font-display text-[1.6875rem] leading-none font-extrabold tracking-[-0.026em] text-heading">
          {{ quoted ? 'On a call' : `${formatGbp(service.fromMonthly!)}/mo` }}
        </span>
      </p>
      <NuxtLink
        v-if="quoted"
        :to="routes.contact"
        class="relative z-10 ml-auto inline-flex items-center gap-2.25 rounded-[13px] bg-heading px-5 py-3 text-[0.90625rem] font-semibold text-white transition-colors hover:bg-ink-800"
      >
        Book a call <span
          class="text-violet-400"
          aria-hidden="true"
        >→</span>
      </NuxtLink>
      <span
        v-else
        class="ml-auto inline-flex items-center gap-2.25 rounded-[13px] bg-heading px-5 py-3 text-[0.90625rem] font-semibold text-white"
        aria-hidden="true"
      >
        View service <span class="text-violet-400">→</span>
      </span>
    </div>
  </article>
</template>
