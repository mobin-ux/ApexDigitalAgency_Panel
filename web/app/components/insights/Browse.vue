<script setup lang="ts">
import { routes } from '~/data/routes'

const page = useCmsContent('insights')
const copy = computed(() => {
  const b = page.value.browse
  return { ...b, empty: { title: b.emptyTitle, body: b.emptyBody, button: b.emptyButton } }
})
const filter = useInsightsFilter()
const { visible, chips, filtered, resultLabel, animate, topic } = filter
</script>

<template>
  <section
    aria-labelledby="insights-browse-title"
    class="container-page flex flex-col gap-7 pt-20 pb-20 lg:pt-26 lg:pb-26"
  >
    <div class="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div class="flex flex-col gap-2.5">
        <h2
          id="insights-browse-title"
          tabindex="-1"
          class="scroll-mt-28 font-display text-[clamp(2rem,1.5rem+1.6vw,2.5rem)] leading-[1.08] font-bold tracking-[-0.028em] text-heading outline-none"
        >
          {{ copy.title }}
        </h2>
        <p
          class="text-[0.90625rem] text-muted"
          aria-live="polite"
        >
          {{ resultLabel }}
        </p>
      </div>
      <button
        v-if="filtered"
        type="button"
        class="ml-auto min-h-11 text-[0.84375rem] font-semibold whitespace-nowrap text-violet-600 hover:underline"
        @click="filter.clear"
      >
        {{ copy.clear }}
      </button>
    </div>

    <div
      role="group"
      :aria-label="copy.title"
      class="flex flex-wrap gap-2 border-b border-line pb-6"
    >
      <UiFilterChip
        v-for="chip in chips"
        :key="chip.label"
        :pressed="topic === chip.id"
        :count="chip.count"
        :noun="['article', 'articles']"
        @click="filter.pickTopic(chip.id)"
      >
        {{ chip.label }}
      </UiFilterChip>
    </div>

    <ul
      v-if="visible.length"
      :key="`${topic}-${filter.query.value}`"
      class="grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3"
    >
      <li
        v-for="article in visible"
        :key="article.slug"
        :class="animate && 'motion-safe:animate-rise'"
      >
        <InsightsArticleCard :article="article" />
      </li>
    </ul>

    <div
      v-else
      class="flex flex-col items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed border-line-dashed bg-subtle px-6 py-10 text-center sm:p-12"
    >
      <h3 class="font-display text-[1.375rem] font-semibold tracking-[-0.02em] text-heading">
        {{ copy.empty.title }}
      </h3>
      <p class="max-w-[46ch] text-[0.96875rem] leading-[1.6] text-body">
        {{ copy.empty.body }}
      </p>
      <UiButton :to="routes.contact">
        {{ copy.empty.button }}
      </UiButton>
    </div>
  </section>
</template>
