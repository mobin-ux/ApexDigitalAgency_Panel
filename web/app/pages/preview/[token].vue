<script setup lang="ts">
/**
 * A draft, rendered as the site would publish it, behind a preview token
 * the panel minted (30 minutes, one document). Never cached, never indexed
 * (route rule). Today only landing pages render here in full; for a core
 * page the preview shows the draft's words as a list, because those pages
 * are composed from many components that read the published document.
 */
import { CMS_MEDIA_KEY } from '~/composables/useCmsContent'

definePageMeta({ layout: false })

const route = useRoute()
// A bad or expired token is a 404 from the proxy; `ignoreResponseError` would hand that error body over as if it were a document.
const { data: doc, error } = await useFetch<{ template: string, title: string, key: string, draftVersion: number, draftUpdatedAt: string, content: any, media?: Record<string, any> } | null>(`/api/cms/preview/${route.params.token}`, {
  default: () => null,
})
provide(CMS_MEDIA_KEY, computed(() => doc.value?.media ?? {}))

if (error.value || !doc.value?.template) {
  throw createError({ statusCode: 404, statusMessage: 'This preview link is not valid or has expired', fatal: true })
}

useSeoMeta({ title: `Preview: ${doc.value.title}`, robots: 'noindex, nofollow' })

const sections = computed(() => doc.value?.template === 'landing' ? (doc.value.content?.sections ?? []).filter((s: { hidden?: boolean }) => !s.hidden) : [])
const fields = computed(() => doc.value?.template === 'landing' ? [] : flatten(doc.value?.content ?? {}))

function flatten(value: unknown, prefix = ''): { path: string, value: string }[] {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [{ path: prefix, value: String(value) }]
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => flatten(item, `${prefix}[${i}]`))
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
  }
  return []
}
</script>

<template>
  <div class="min-h-screen bg-page">
    <div class="sticky top-0 z-50 border-b border-line bg-ink-900 px-4 py-2 text-[0.8125rem] text-white sm:px-6">
      <div class="container-page flex flex-wrap items-center gap-x-4 gap-y-1">
        <span class="font-semibold">Draft preview</span>
        <span v-if="doc" class="text-body-on-dark">{{ doc.title }} · {{ doc.key }} · version {{ doc.draftVersion }}</span>
        <span class="text-body-on-dark md:ml-auto">Not published. This link stops working after 30 minutes.</span>
      </div>
    </div>
    <LayoutHeader />
    <main v-if="doc" id="main">
      <h1 class="sr-only">
        {{ doc.title }}
      </h1>
      <CmsSections v-if="sections.length" :sections="sections" />
      <section v-else class="container-page py-16">
        <h2 class="font-display text-h2 text-heading">
          {{ doc.title }}
        </h2>
        <p class="mt-3 max-w-[60ch] text-body">
          This document's words are shown as a list; the page they belong to is composed from the published version once this draft is published.
        </p>
        <dl class="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <template v-for="field in fields" :key="field.path">
            <dt class="font-mono text-[0.8125rem] text-muted">
              {{ field.path }}
            </dt>
            <dd class="text-[0.9375rem] text-heading">
              {{ field.value }}
            </dd>
          </template>
        </dl>
      </section>
    </main>
    <LayoutFooter />
  </div>
</template>
