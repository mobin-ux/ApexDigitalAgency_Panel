<script setup lang="ts">
import type { BuiltContent } from '#shared/cms'
import type { CmsDocumentLike } from '~/composables/useCmsContent'
import { builtContentSchema, isBuiltTemplate } from '#shared/cms'

/**
 * A page, article or case study built in the admin console (ADR-026), with
 * its search listing. The stored content is checked against its template
 * again here: a document that fails (an older shape, a hand edit) is
 * answered with a 404 rather than a half-rendered page.
 */
const props = defineProps<{
  document: CmsDocumentLike & { title: string }
  ogType?: 'website' | 'article'
}>()

if (!isBuiltTemplate(props.document.template)) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}
const parsed = builtContentSchema(props.document.template).safeParse(props.document.content)
if (!parsed.success) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}
const content = parsed.data as BuiltContent

const first = content.sections.find(s => !s.hidden)
const lead = first?.type === 'hero' ? String((first.fields as { body?: string }).body ?? '') : ''
const summary = String((content.meta as { summary?: string }).summary ?? '')

// The files its image sections name, for <CmsImage> (useCmsMedia).
const media = computed(() => props.document.media ?? {})
provide('cms-media', media)
// Its first image is its social image when it has one.
const firstImage = content.sections.find(s => s.type === 'image' && !s.hidden)
const shared = firstImage ? media.value[String((firstImage.fields as { media?: string }).media ?? '')] : undefined

useCmsSeo(content.seo, { title: props.document.title, description: summary || lead.slice(0, 200) }, {
  ogType: props.ogType ?? 'website',
  image: shared?.mime.startsWith('image/') ? { src: shared.src, width: shared.width, height: shared.height, alt: shared.alt } : null,
})
</script>

<template>
  <CmsSections
    :sections="content.sections"
    :title="document.title"
  />
</template>
