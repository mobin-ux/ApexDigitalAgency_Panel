<script setup lang="ts">
import { normalisePath } from '#shared/cms'

/**
 * Pages built in the admin console (ADR-026): any address the site has no
 * route of its own for, when the console has published a built page there.
 * Everything else is the site's 404. The document was loaded before this
 * page by `middleware/cms.global.ts`.
 */
const route = useRoute()
const doc = useCmsPageState().value[normalisePath(route.path)]
if (!doc || doc.template !== 'built-page') {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}
const built = { ...doc, title: doc.title ?? '' }
</script>

<template>
  <CmsBuiltPage :document="built" />
</template>
