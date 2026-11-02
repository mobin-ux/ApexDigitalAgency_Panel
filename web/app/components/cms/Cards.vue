<script setup lang="ts">
import type { SectionFields } from '#shared/cms'
import { allCaseStudies, sectorLabel } from '~/data/case-studies'
import { routes } from '~/data/routes'

/**
 * Case study picks (ADR-026): the three most recent published case studies.
 * Ones built in the console come first, newest first, by their publish
 * date; the site's own written-up studies fill the rest. A study without a
 * write-up is a summary page kept out of search, so it is not picked.
 */
defineProps<{
  fields: SectionFields<'cards'>
  anchor: string
}>()

const manifest = useCmsManifest()

const picks = computed(() => {
  const built = manifest.value
    .filter(entry => entry.template === 'built-case-study' && !entry.noindex)
    .map(entry => ({
      key: entry.key,
      title: entry.title,
      over: [entry.meta?.sector, entry.meta?.service].filter(Boolean).join(' · '),
      summary: String(entry.meta?.summary ?? ''),
    }))
  const coded = allCaseStudies.filter(study => study.story).map(study => ({
    key: routes.caseStudy(study.slug),
    title: study.client,
    over: `${sectorLabel(study.sector)} · ${study.place}`,
    summary: study.summary,
  }))
  return [...built, ...coded].slice(0, 3)
})
</script>

<template>
  <section
    v-if="picks.length"
    :aria-labelledby="fields.heading ? `${anchor}-title` : undefined"
    :aria-label="fields.heading ? undefined : 'Case studies'"
    class="container-page flex flex-col gap-10 py-12 lg:py-16"
  >
    <h2
      v-if="fields.heading"
      :id="`${anchor}-title`"
      class="font-display text-h2 text-heading"
    >
      {{ fields.heading }}
    </h2>
    <ul class="grid gap-5 md:grid-cols-3">
      <li
        v-for="pick in picks"
        :key="pick.key"
        class="relative flex flex-col gap-2 rounded-2xl border border-line bg-white p-6 shadow-tile transition duration-200 ease-out-soft hover:shadow-tile-hover"
      >
        <p class="text-xs font-bold tracking-[0.06em] text-muted uppercase">
          {{ pick.over }}
        </p>
        <h3 class="font-display text-[1.375rem] leading-[1.15] font-semibold tracking-[-0.022em] text-heading">
          <NuxtLink
            :to="pick.key"
            class="after:absolute after:inset-0 after:rounded-2xl"
          >
            {{ pick.title }}
          </NuxtLink>
        </h3>
        <p class="text-[0.9375rem] leading-[1.6] text-body">
          {{ pick.summary }}
        </p>
      </li>
    </ul>
  </section>
</template>
