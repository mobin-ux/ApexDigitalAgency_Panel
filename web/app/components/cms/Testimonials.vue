<script setup lang="ts">
import type { SectionProps } from '../../../shared/cms'

defineProps<{ id: string, props: SectionProps<'testimonials'> }>()
</script>

<template>
  <section :id="id" class="bg-page px-4 py-16 sm:px-6 lg:py-24">
    <div class="container-page flex flex-col gap-10">
      <h2 v-if="props.title" class="font-display text-h2 text-heading">
        {{ props.title }}
      </h2>
      <ul class="grid gap-5 md:grid-cols-2">
        <li v-for="(item, i) in props.items" :key="i" class="flex flex-col gap-4 rounded-2xl border border-line bg-subtle p-7">
          <blockquote class="font-display text-[1.125rem] font-semibold tracking-tight text-heading">
            {{ item.quote }}
          </blockquote>
          <p class="text-[0.9063rem] text-body">
            <span class="font-semibold text-heading">{{ item.name }}</span><template v-if="item.role">
              , {{ item.role }}
            </template>
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>
