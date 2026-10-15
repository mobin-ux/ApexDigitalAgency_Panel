<template>
  <div class="flex min-h-dvh flex-col overflow-x-clip">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
    >
      Skip to main content
    </a>
    <LayoutHeader />
    <main
      id="main"
      class="flex-1"
    >
      <slot />
    </main>
    <LayoutFooter />
  </div>
</template>
