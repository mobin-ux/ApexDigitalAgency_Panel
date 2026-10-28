<script setup lang="ts">
import type { Department } from '~/data/about'
import { fill } from '#shared/cms'
import { departments, team as teamData } from '~/data/about'

const page = useCmsContent('about')
const team = computed(() => ({
  ...page.value.team,
  members: teamData.members,
  since: (year: string) => fill(page.value.team.since, { year }),
  hiring: { ...page.value.team.hiring, to: teamData.hiring.to },
}))

/**
 * The team, filterable by department. Every person is in the prerendered
 * HTML; the filter is local state added after hydration. Cards animate in only
 * after a filter change, so first paint never waits on an animation.
 */
const selected = ref<Department | null>(null)
const animate = ref(false)

const chips = [
  { id: null, label: team.value.everyone, count: teamData.members.length },
  ...departments.map(department => ({
    id: department,
    label: department,
    count: teamData.members.filter(member => member.department === department).length,
  })),
]

const shown = computed(() => teamData.members.filter(member => !selected.value || member.department === selected.value))

function pick(id: Department | null) {
  selected.value = id
  animate.value = true
}
</script>

<template>
  <section
    id="team"
    aria-labelledby="team-title"
    class="scroll-mt-4 border-y border-line bg-subtle"
  >
    <div class="container-page flex flex-col gap-10 py-20 lg:py-26">
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
        <div class="flex flex-col gap-4">
          <UiEyebrowChip>{{ team.eyebrow }}</UiEyebrowChip>
          <h2
            id="team-title"
            class="max-w-[22ch] font-display text-h2 text-heading"
          >
            {{ team.title }}
          </h2>
          <p class="max-w-[58ch] text-[1.03125rem] leading-[1.62] text-body">
            {{ team.lead }}
          </p>
        </div>
        <div
          role="group"
          :aria-label="team.filterLabel"
          class="flex max-w-115 flex-wrap gap-2 lg:justify-end"
        >
          <UiFilterChip
            v-for="chip in chips"
            :key="chip.label"
            :pressed="selected === chip.id"
            :count="chip.count"
            :noun="['person', 'people']"
            size="sm"
            @click="pick(chip.id)"
          >
            {{ chip.label }}
          </UiFilterChip>
        </div>
      </div>

      <ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <li
          v-for="member in shown"
          :key="member.name"
          class="flex flex-col gap-4 rounded-2xl border border-line bg-white px-3 pt-3 pb-5.5 shadow-tile"
          :class="animate && 'motion-safe:animate-rise'"
        >
          <div class="aspect-square overflow-hidden rounded-lg">
            <UiMediaFrame
              :image="member.photo"
              sizes="100vw sm:50vw lg:270px"
            />
          </div>
          <div class="flex flex-col gap-1.25 px-2.5">
            <h3 class="font-display text-[1.1875rem] leading-[1.2] font-bold tracking-[-0.02em] text-heading">
              {{ member.name }}
            </h3>
            <p class="text-sm font-semibold text-violet-600">
              {{ member.role }}
            </p>
            <p class="pt-1 text-sm leading-[1.55] text-pretty text-body">
              {{ member.bio }}
            </p>
          </div>
          <p class="mx-2.5 mt-auto flex min-h-11.5 items-center gap-2 border-t border-line-soft pt-3.5 text-[0.8125rem] text-muted">
            <span class="whitespace-nowrap">{{ team.since(member.since) }}</span>
            <a
              v-if="member.linkedin"
              :href="member.linkedin"
              :aria-label="`${member.name} on LinkedIn`"
              target="_blank"
              rel="noopener noreferrer"
              class="ml-auto inline-flex size-7.5 items-center justify-center rounded-[9px] border border-line-strong font-display text-[0.71875rem] font-semibold text-body transition-colors hover:border-violet-500 hover:text-violet-600"
            >in</a>
          </p>
        </li>
      </ul>

      <div
        v-if="team.hiring.title"
        class="flex flex-col gap-4 rounded-xl border-[1.5px] border-dashed border-line-dashed bg-white px-6 py-6 sm:flex-row sm:items-center sm:gap-6 sm:px-7.5"
      >
        <p class="flex flex-col gap-1">
          <span class="font-display text-xl font-bold tracking-[-0.02em] text-heading">{{ team.hiring.title }}</span>
          <span class="text-[0.90625rem] text-body">{{ team.hiring.body }}</span>
        </p>
        <NuxtLink
          :to="team.hiring.to"
          class="group text-[0.90625rem] font-semibold whitespace-nowrap text-violet-600 hover:underline sm:ml-auto"
        >
          {{ team.hiring.link }} <span
            class="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
            aria-hidden="true"
          >→</span>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
