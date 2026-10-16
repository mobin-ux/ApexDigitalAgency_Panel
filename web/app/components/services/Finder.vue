<script setup lang="ts">
import type { ServiceGoalId } from '~/data/services'
import { routes } from '~/data/routes'
import { catalogueServices, isServiceGoal, serviceGoals } from '~/data/services'

/**
 * "What do you want to change?" — goal chips that filter the service cards.
 *
 * The prerendered HTML always lists every service, so crawlers and visitors
 * without JavaScript get the whole catalogue. The chosen goal is mirrored in
 * `?goal=` so a filtered view can be shared; it is read after mount, because
 * a prerendered page is the same file for every query string.
 */
const route = useRoute()
const router = useRouter()

const goal = ref<ServiceGoalId | null>(null)

// The cards animate in only when the visitor changes the filter. The first
// paint never waits on an animation, so content is visible even where the
// animation timeline is paused (background tabs, renderers, print).
const animate = ref(false)

onMounted(() => {
  const fromUrl = route.query.goal
  if (isServiceGoal(fromUrl)) {
    goal.value = fromUrl
  }
})

watch(goal, (value) => {
  const query = { ...route.query }
  if (value) {
    query.goal = value
  }
  else {
    delete query.goal
  }
  router.replace({ query })
})

const total = catalogueServices.length

const visible = computed(() =>
  goal.value ? catalogueServices.filter(s => s.goals.includes(goal.value!)) : catalogueServices,
)

const chips = serviceGoals.map(item => ({
  ...item,
  count: catalogueServices.filter(s => s.goals.includes(item.id)).length,
}))

const activeLabel = computed(() => serviceGoals.find(item => item.id === goal.value)?.label)

function choose(id: ServiceGoalId | null) {
  animate.value = true
  goal.value = id
}

function toggle(id: ServiceGoalId) {
  choose(goal.value === id ? null : id)
}
</script>

<template>
  <section
    aria-labelledby="finder-title"
    class="container-page pt-14 pb-20 lg:pb-26"
  >
    <div class="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6 shadow-card sm:px-8 sm:py-7.5">
      <div class="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <h2
          id="finder-title"
          class="font-display text-lg leading-[1.3] font-semibold tracking-[-0.015em] text-heading"
        >
          What do you want to change?
        </h2>
        <p class="text-sm text-muted">
          Pick one — the list below updates.
        </p>
        <button
          v-if="goal"
          type="button"
          class="ml-auto text-[0.84375rem] font-semibold text-body transition-colors hover:text-violet-600"
          @click="choose(null)"
        >
          Show everything
        </button>
      </div>

      <div
        role="group"
        aria-labelledby="finder-title"
        class="flex flex-wrap gap-2.5"
      >
        <UiFilterChip
          v-for="chip in chips"
          :key="chip.id"
          :pressed="goal === chip.id"
          :count="chip.count"
          :noun="['service', 'services']"
          @click="toggle(chip.id)"
        >
          {{ chip.label }}
        </UiFilterChip>
      </div>
    </div>

    <p
      class="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-6 pb-5.5 text-sm"
      aria-live="polite"
    >
      <span class="font-semibold text-heading">{{ goal ? `${visible.length} of ${total} services` : `All ${total} services` }}</span>{{ ' ' }}
      <span class="text-muted">{{ activeLabel ? `for “${activeLabel.toLowerCase()}”` : 'ordered by how often they are chosen first' }}</span>
    </p>

    <ul
      v-if="visible.length"
      :key="goal ?? 'all'"
      class="grid gap-6 md:grid-cols-2"
    >
      <li
        v-for="service in visible"
        :key="service.slug"
        :class="animate && 'motion-safe:animate-rise'"
      >
        <ServicesCard :service="service" />
      </li>
    </ul>

    <div
      v-else
      class="flex flex-col items-center gap-3.5 rounded-2xl border border-dashed border-line-dashed bg-subtle p-12 text-center"
    >
      <p class="font-display text-[1.375rem] font-semibold tracking-[-0.02em] text-heading">
        Nothing matches that on its own
      </p>
      <p class="max-w-[46ch] text-[0.96875rem] leading-relaxed text-body">
        It probably needs two services working together. A fifteen-minute call is the quickest way to work out which.
      </p>
      <UiButton :to="routes.contact">
        Book a free call
      </UiButton>
    </div>
  </section>
</template>
