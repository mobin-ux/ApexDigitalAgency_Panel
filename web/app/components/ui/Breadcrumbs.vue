<script setup lang="ts">
/**
 * Visible breadcrumb trail plus its BreadcrumbList structured data, from one
 * list, so the markup Google reads cannot disagree with what is on screen.
 * The last item is the current page and is not a link.
 */
const props = defineProps<{
  items: readonly { label: string, to: string }[]
}>()

useSchemaOrg([
  defineBreadcrumb({
    itemListElement: props.items.map(item => ({ name: item.label, item: item.to })),
  }),
])
</script>

<template>
  <nav aria-label="Breadcrumb">
    <ol class="flex flex-wrap items-center gap-2 text-[0.84375rem] text-muted">
      <li
        v-for="(item, i) in items"
        :key="item.to"
        class="flex items-center gap-2"
      >
        <span
          v-if="i > 0"
          aria-hidden="true"
        >/</span>
        <span
          v-if="i === items.length - 1"
          aria-current="page"
          class="font-semibold text-heading"
        >{{ item.label }}</span>
        <NuxtLink
          v-else
          :to="item.to"
          class="text-body transition-colors hover:text-violet-600"
        >
          {{ item.label }}
        </NuxtLink>
      </li>
    </ol>
  </nav>
</template>
