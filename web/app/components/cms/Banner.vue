<script setup lang="ts">
import type { SectionProps } from '#shared/cms'

defineProps<{ id: string, props: SectionProps<'banner'> }>()
const { linkAttrs } = useCmsLink()
const tones = { info: 'bg-subtle text-heading', success: 'bg-success-50 text-success-ink', warning: 'bg-amber-50 text-heading' } as const
</script>

<template>
  <section :id="id" class="px-4 py-3 sm:px-6" :class="tones[props.tone]">
    <div class="container-page flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.9375rem] font-semibold">
      <span>{{ props.text }}</span>
      <NuxtLink v-if="props.link" v-bind="linkAttrs(props.link.link)" class="underline underline-offset-4">
        {{ props.link.label }}
      </NuxtLink>
    </div>
  </section>
</template>
