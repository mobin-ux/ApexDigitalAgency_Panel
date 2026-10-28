<script setup lang="ts">
import type { NuxtError } from '#app'
import { routes } from '~/data/routes'

/**
 * The site's error page. A 404 says the address has nothing at it and
 * offers the places people usually wanted; anything else says we know and
 * offers the way back. Nothing here reads the CMS, so an outage in the
 * content layer cannot take the error page down with it.
 */
const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)

useSeoMeta({ title: notFound.value ? 'Page not found' : 'Something went wrong', robots: 'noindex, nofollow' })

function home() {
  clearError({ redirect: routes.home })
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-page">
    <LayoutHeader />
    <main id="main" class="container-page flex flex-1 flex-col items-start justify-center gap-5 py-20">
      <p class="text-[0.78rem] font-bold tracking-widest text-muted uppercase">
        {{ notFound ? '404' : error.statusCode }}
      </p>
      <h1 class="max-w-[22ch] font-display text-h1 text-heading">
        {{ notFound ? 'There is nothing at this address' : 'Something went wrong on our side' }}
      </h1>
      <p class="max-w-[52ch] text-body-lg text-body">
        {{ notFound ? 'The page may have moved, or the link may be out of date. The links below cover most of what people come here for.' : 'The page could not be shown. Try again in a moment, or go back to the homepage.' }}
      </p>
      <div class="mt-2 flex flex-wrap gap-3">
        <UiButton size="lg" @click="home">
          Back to the homepage
        </UiButton>
        <UiButton v-if="notFound" :to="routes.services" variant="light" size="lg">
          Our services
        </UiButton>
        <UiButton v-if="notFound" :to="routes.contact" variant="light" size="lg">
          Contact us
        </UiButton>
      </div>
    </main>
    <LayoutFooter />
  </div>
</template>
