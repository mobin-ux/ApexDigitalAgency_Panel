<script setup lang="ts">
import type { SectorId } from '~/data/case-studies'
import type { ServiceSlug } from '~/data/routes'
import { caseStudies, isSector, sectorLabel, sectors } from '~/data/case-studies'
import { serviceFilterOrder } from '~/data/our-work'
import { routes } from '~/data/routes'
import { serviceBySlug } from '~/data/services'

/**
 * Every project, filtered by what we did and by sector.
 *
 * Works like the services page finder: the prerendered HTML lists every
 * project, the filters are mirrored in `?service=` and `?sector=` so a view
 * can be shared, and they are read after mount, because a prerendered page is
 * one file for every query string.
 */
const route = useRoute()
const router = useRouter()
const page = useCmsContent('our-work')
const nextProject = computed(() => page.value.next)

const service = ref<ServiceSlug | null>(null)
const sector = ref<SectorId | null>(null)

// Cards animate in only after the visitor changes a filter, so the first
// paint never waits on an animation.
const animate = ref(false)

function isFilterService(value: unknown): value is ServiceSlug {
  return serviceFilterOrder.includes(value as ServiceSlug)
}

onMounted(() => {
  const { service: fromService, sector: fromSector } = route.query
  if (isFilterService(fromService)) {
    service.value = fromService
  }
  if (isSector(fromSector)) {
    sector.value = fromSector
  }
})

watch([service, sector], ([serviceValue, sectorValue]) => {
  const query = { ...route.query }
  delete query.service
  delete query.sector
  if (serviceValue) {
    query.service = serviceValue
  }
  if (sectorValue) {
    query.sector = sectorValue
  }
  router.replace({ query })
})

const matchesService = (slugs: readonly ServiceSlug[]) => !service.value || slugs.includes(service.value)
const matchesSector = (id: SectorId) => !sector.value || id === sector.value

const visible = computed(() => caseStudies.filter(s => matchesService(s.services) && matchesSector(s.sector)))

// Each row counts within the other row's selection, so a chip says how many
// projects choosing it would show.
const serviceChips = computed(() => {
  const pool = caseStudies.filter(s => matchesSector(s.sector))
  return [
    { id: null, label: 'All work', count: pool.length },
    ...serviceFilterOrder.map(slug => ({
      id: slug,
      label: serviceBySlug(slug).tag,
      count: pool.filter(s => s.services.includes(slug)).length,
    })),
  ]
})

const sectorChips = computed(() => {
  const pool = caseStudies.filter(s => matchesService(s.services))
  return [
    { id: null, label: 'Any sector', count: pool.length },
    ...sectors.map(item => ({
      id: item.id,
      label: item.label,
      count: pool.filter(s => s.sector === item.id).length,
    })),
  ]
})

const filtered = computed(() => Boolean(service.value || sector.value))

const resultLabel = computed(() => `${visible.value.length} ${visible.value.length === 1 ? 'project' : 'projects'}`)

const resultHint = computed(() => {
  if (!visible.value.length) {
    return 'no exact match yet, which is usually a good sign'
  }
  const serviceName = service.value && serviceBySlug(service.value).tag
  const sectorName = sector.value && sectorLabel(sector.value).toLowerCase()
  if (serviceName && sectorName) {
    return `for ${serviceName} in ${sectorName}`
  }
  if (serviceName) {
    return `where we did ${serviceName}`
  }
  return sectorName ? `in ${sectorName}` : 'most recent first'
})

const nextLabel = computed(() => `${sector.value ? sectorLabel(sector.value) : 'Your sector'} · your town`)

function pickService(id: ServiceSlug | null) {
  animate.value = true
  service.value = service.value === id ? null : id
}

function pickSector(id: SectorId | null) {
  animate.value = true
  sector.value = sector.value === id ? null : id
}

function clearAll() {
  animate.value = true
  service.value = null
  sector.value = null
}
</script>

<template>
  <section
    aria-labelledby="projects-title"
    class="container-page pt-12 pb-20 lg:pt-14 lg:pb-26"
  >
    <h2
      id="projects-title"
      class="sr-only"
    >
      All projects
    </h2>

    <div class="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6 shadow-card sm:px-8 sm:py-7">
      <div
        role="group"
        aria-labelledby="filter-service-label"
        class="grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)] sm:items-start sm:gap-4"
      >
        <span
          id="filter-service-label"
          class="text-xs font-bold tracking-[0.07em] whitespace-nowrap text-muted uppercase sm:pt-3.25"
        >What we did</span>
        <div class="flex flex-wrap gap-2">
          <UiFilterChip
            v-for="chip in serviceChips"
            :key="chip.label"
            size="sm"
            :pressed="service === chip.id"
            :count="chip.count"
            :noun="['project', 'projects']"
            @click="pickService(chip.id)"
          >
            {{ chip.label }}
          </UiFilterChip>
        </div>
      </div>

      <div
        class="h-px bg-line-soft"
        aria-hidden="true"
      />

      <div
        role="group"
        aria-labelledby="filter-sector-label"
        class="grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)] sm:items-start sm:gap-4"
      >
        <span
          id="filter-sector-label"
          class="text-xs font-bold tracking-[0.07em] whitespace-nowrap text-muted uppercase sm:pt-3.25"
        >Sector</span>
        <div class="flex flex-wrap gap-2">
          <UiFilterChip
            v-for="chip in sectorChips"
            :key="chip.label"
            size="sm"
            :pressed="sector === chip.id"
            :count="chip.count"
            :noun="['project', 'projects']"
            @click="pickSector(chip.id)"
          >
            {{ chip.label }}
          </UiFilterChip>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-12 pb-5.5 text-sm">
      <p
        class="flex flex-wrap items-baseline gap-x-3 gap-y-1"
        aria-live="polite"
      >
        <span class="font-semibold text-heading">{{ resultLabel }}</span>{{ ' ' }}
        <span class="text-muted">{{ resultHint }}</span>
      </p>
      <button
        v-if="filtered"
        type="button"
        class="ml-auto text-[0.84375rem] font-semibold text-violet-600 hover:underline"
        @click="clearAll"
      >
        Clear filters
      </button>
    </div>

    <ul
      v-if="visible.length"
      :key="`${service}-${sector}`"
      class="mb-7 grid gap-x-6 gap-y-7 md:grid-cols-2 lg:grid-cols-3"
    >
      <li
        v-for="study in visible"
        :key="study.slug"
        :class="animate && 'motion-safe:animate-rise'"
      >
        <WorkProjectCard :study="study" />
      </li>
    </ul>

    <div class="grid gap-8 rounded-2xl border-[1.5px] border-dashed border-line-dashed bg-subtle px-6 py-8 sm:px-11 sm:py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
      <div class="flex flex-col gap-3.5">
        <span class="w-fit rounded-full border border-line bg-white px-3.25 py-1.5 text-xs font-bold whitespace-nowrap text-body">{{ nextLabel }}</span>
        <h3 class="font-display text-[clamp(1.5rem,1.25rem+0.9vw,1.875rem)] leading-[1.1] font-bold tracking-[-0.026em] text-heading">
          {{ nextProject.title }}
        </h3>
        <p class="max-w-[60ch] text-[0.9375rem] leading-[1.6] text-body">
          {{ nextProject.body }}
        </p>
        <ul class="flex flex-wrap gap-x-6 gap-y-2.5 pt-1">
          <li
            v-for="check in nextProject.checks"
            :key="check"
            class="flex items-center gap-2.25 text-[0.84375rem] text-body"
          >
            <UiTick />
            {{ check }}
          </li>
        </ul>
      </div>
      <UiButton
        :to="routes.contact"
        size="lg"
      >
        {{ nextProject.button }}
      </UiButton>
    </div>
  </section>
</template>
