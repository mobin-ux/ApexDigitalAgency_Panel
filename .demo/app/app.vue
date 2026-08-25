<script setup lang="ts">
const { locale } = useI18n()
const head = useLocaleHead()
const route = useRoute()

/**
 * Global head configuration
 * @see https://nuxt.com/docs/getting-started/seo-meta
 */
useHead({
  title: () => route?.meta?.title ?? '',
  titleTemplate: (titleChunk) => {
    return titleChunk
      ? `${titleChunk} — Apex Digi`
      : `Apex Digi`
  },
  htmlAttrs: {
    lang: () => head.value.htmlAttrs!.lang,
    dir: () => head.value.htmlAttrs!.dir as any,
  },
  link: () => [
    ...(head.value.link || []),
    {
      rel: 'icon',
      type: 'image/svg+xml',
      href: '/brand/apex-icon.svg',
    },
  ],
  meta: () => [
    ...(head.value.meta || []),
    {
      name: 'description',
      content: () =>
        route?.meta?.description
        ?? 'Apex Digi customer dashboard — projects, wallet, credit and support in one place.',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:site',
      content: '@cssninjaStudio',
    },
    {
      name: 'og:image:type',
      content: 'image/png',
    },
    {
      name: 'og:image:width',
      content: '1200',
    },
    {
      name: 'og:image:height',
      content: '630',
    },
    {
      name: 'og:image',
      content: `https://media.cssninja.io/embed/marketplace/product/wide.png?headline=${encodeURIComponent(
        route?.meta?.description
        || (route?.meta?.preview
          ? `${route.meta?.preview?.title} - ${route.meta?.preview?.description}`
          : 'Nuxt & Tailwind CSS dashboard system'),
      )}&url=${encodeURIComponent(
        'https://media.cssninja.io/content/products/logos/tairo-text-white.svg',
      )}&previewUrl=${encodeURIComponent(
        `https://tairo.cssninja.io${
          route.meta?.preview?.src || '/img/screens/documentation-hub.png'
        }`,
      )}`,
    },
  ],
})
</script>

<template>
  <BaseProviders
    :config="{ dir: head.htmlAttrs!.dir as any, locale }"
    :toast="{ position: 'top-center' }"
  >
    <!--
      Global app search modal — Tairo's, which indexes the `docs` collection
      and the demo pages' `meta.preview`. It stays mounted for the template
      routes it was written for, and declines to open on the Apex panel, which
      has its own search (`ApexSearch`, mounted by the `sidenav` and `admin`
      layouts) over the customer's own projects and tickets. Both read the same
      `useSearchOpen()` state, so ⌘K and the toolbar button open whichever one
      belongs to the current route.
      @see .demo/app/components/DemoAppSearch.vue
    -->
    <DemoAppSearch />
    <!--
      Global app layout switcher
      @see .demo/components/DemoAppLayoutSwitcher.vue
    -->
    <DemoAppLayoutSwitcher />

    <NuxtLayout>
      <NuxtLoadingIndicator color="var(--color-primary-500)" />
      <NuxtPage />
    </NuxtLayout>

    <TairoPanels />
  </BaseProviders>
</template>
