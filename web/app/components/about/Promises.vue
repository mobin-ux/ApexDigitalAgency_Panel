<script setup lang="ts">
const page = useCmsContent('about')
const promises = computed(() => page.value.promises)
</script>

<template>
  <section
    aria-labelledby="promises-title"
    class="container-page py-20 lg:py-26"
  >
    <div class="mb-10 grid gap-6 lg:mb-13 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end lg:gap-16">
      <div class="flex flex-col gap-4">
        <UiEyebrowChip>{{ promises.eyebrow }}</UiEyebrowChip>
        <h2
          id="promises-title"
          class="max-w-[20ch] font-display text-h2 text-heading"
        >
          {{ promises.title }}
        </h2>
      </div>
      <p class="text-[1.03125rem] leading-[1.62] text-body lg:mb-1.5">
        {{ promises.lead }}
      </p>
    </div>

    <ol class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <li
        v-for="(item, i) in promises.items"
        :key="item.title"
        class="flex flex-col gap-3.5 rounded-2xl border border-line bg-white px-7 py-7.5 shadow-tile"
      >
        <span
          class="font-display text-[0.9375rem] font-extrabold tracking-[-0.01em] text-violet-600"
          aria-hidden="true"
        >{{ String(i + 1).padStart(2, '0') }}</span>
        <h3 class="font-display text-[1.375rem] leading-[1.18] font-bold tracking-[-0.022em] text-heading">
          {{ item.title }}
        </h3>
        <p class="text-[0.90625rem] leading-[1.6] text-pretty text-body">
          {{ item.body }}
        </p>
      </li>
    </ol>
  </section>
</template>
