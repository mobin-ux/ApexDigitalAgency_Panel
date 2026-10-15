<script setup lang="ts">
import type { ServiceGlyphName } from '~/data/services'

/** The six small geometric service marks. Purely decorative. */
defineProps<{ name: ServiceGlyphName }>()
</script>

<template>
  <span
    class="flex h-7.5 items-center"
    aria-hidden="true"
  >
    <span
      v-if="name === 'software'"
      class="relative block h-6.5 w-7.5"
    >
      <span class="absolute top-0 left-0 block size-5 rounded-[5px] border-2 border-violet-500" />
      <span class="absolute right-0 bottom-0 block size-5 rounded-[5px] bg-violet-200" />
    </span>

    <span
      v-else-if="name === 'marketing'"
      class="flex h-6.5 items-end gap-1"
    >
      <span class="h-3 w-[7px] rounded-[2px] bg-violet-200" />
      <span class="h-[19px] w-[7px] rounded-[2px] bg-violet-400" />
      <span class="h-6.5 w-[7px] rounded-[2px] bg-violet-500" />
    </span>

    <span
      v-else-if="name === 'seo'"
      class="relative block size-7"
    >
      <span class="absolute top-0 left-0 block size-5 rounded-full border-2 border-violet-500" />
      <span class="absolute right-0.5 bottom-px block h-[3px] w-[11px] rotate-45 rounded-[2px] bg-violet-500" />
    </span>

    <span
      v-else-if="name === 'ppc'"
      class="relative block size-7"
    >
      <span class="absolute inset-0 block rounded-full border-2 border-violet-200" />
      <span class="absolute top-2 left-2 block size-3 rounded-full bg-violet-500" />
    </span>

    <span
      v-else-if="name === 'uiux'"
      class="grid grid-cols-[12px_12px] grid-rows-[12px_12px] gap-1"
    >
      <span class="rounded-[3px] bg-violet-500" />
      <span class="rounded-[3px] bg-violet-200" />
      <span class="rounded-[3px] bg-violet-200" />
      <span class="rounded-[3px] bg-violet-500" />
    </span>

    <span
      v-else
      class="relative block h-6.5 w-7.5"
    >
      <span class="absolute top-0.5 left-0 block size-5.5 rounded-full bg-violet-200" />
      <span class="absolute top-0.5 right-0 block size-5.5 rounded-md border-2 border-violet-500" />
    </span>
  </span>
</template>
