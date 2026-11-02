<script setup lang="ts">
import { normalisePath } from '#shared/cms'
import { caseStudyBySlug } from '~/data/case-studies'

/**
 * One page per case study: one from the code catalogue (`Case Study.dc.html`,
 * `<CaseStudyPage>`), or one built in the admin console (ADR-026,
 * `<CmsBuiltPage>`). An unknown slug is a 404.
 */
const route = useRoute()
const found = caseStudyBySlug(String(route.params.slug))
const doc = useCmsPageState().value[normalisePath(route.path)]
const built = !found && doc?.template === 'built-case-study' ? { ...doc, title: doc.title ?? '' } : null
if (!found && !built) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}
</script>

<template>
  <CaseStudyPage
    v-if="found"
    :found="found"
  />
  <CmsBuiltPage
    v-else-if="built"
    :document="built"
    og-type="article"
  />
</template>
