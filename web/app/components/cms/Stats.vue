<script setup lang="ts">
import type { SectionProps } from '#shared/cms'

defineProps<{ id: string, props: SectionProps<'stats'> }>()
</script>

<template>
  <section :id="id" class="bg-page px-4 py-12 sm:px-6 lg:py-16">
    <div class="container-page">
      <dl class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="(item, i) in props.items" :key="i" class="flex flex-col gap-1 border-l-2 border-violet-500 pl-5">
          <dd class="font-display text-[2rem] leading-none font-extrabold tracking-tight text-heading">
            {{ item.value }}
          </dd>
          <dt class="text-[0.9063rem] text-body">
            {{ item.label }}
          </dt>
        </div>
      </dl>
      <p v-if="props.note" class="mt-5 text-[0.8125rem] text-muted">
        {{ props.note }}
      </p>
    </div>
  </section>
</template>
