<script setup lang="ts">
import { normalisePath } from '#shared/cms'
import { articleBySlug } from '~/data/articles'

/**
 * One page per article: a written article from the code catalogue
 * (`Article.dc.html`, `<ArticlePage>`), or one built in the admin console
 * (ADR-026, `<CmsBuiltPage>`). A catalogue slug without a body is listed
 * elsewhere but has no page yet, so it is a 404 like an unknown slug.
 */
definePageMeta({ readingProgress: true })

const route = useRoute()
const found = articleBySlug(String(route.params.slug))
const written = found?.body ? { ...found, body: found.body } : null
const doc = useCmsPageState().value[normalisePath(route.path)]
const built = !written && doc?.template === 'built-article' ? { ...doc, title: doc.title ?? '' } : null
if (!written && !built) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}
</script>

<template>
  <ArticlePage
    v-if="written"
    :found="written"
  />
  <CmsBuiltPage
    v-else-if="built"
    :document="built"
    og-type="article"
  />
</template>
