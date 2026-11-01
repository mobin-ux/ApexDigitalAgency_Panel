<script setup lang="ts">
import type { CmsDocumentLike } from '~/composables/useCmsContent'
import { isBuiltTemplate } from '#shared/cms'
import { articleBySlug } from '~/data/articles'
import { caseStudyBySlug } from '~/data/case-studies'
import AboutPage from '~/pages/about.vue'
import ContactPage from '~/pages/contact.vue'
import HomePage from '~/pages/index.vue'
import InsightsIndex from '~/pages/insights/index.vue'
import OurWorkIndex from '~/pages/our-work/index.vue'
import ServicesIndex from '~/pages/services/index.vue'

/**
 * A draft as the site renders it, for staff checking it before it is
 * published (ADR-026). The console signs a 30-minute token; the draft comes
 * through this server from the panel and is never cached or indexed
 * (route rules). A coded page renders its real component with the draft laid
 * over the code baseline (`CMS_PREVIEW`); a built page renders its sections.
 */
const route = useRoute()
const token = String(route.params.token ?? '')
const { data, error } = await useFetch<CmsDocumentLike & { title: string, preview: boolean }>(`/api/cms/preview/${token}`, { key: `cms-preview:${token}` })
if (error.value || !data.value) {
  throw createError({ statusCode: 404, statusMessage: 'This preview link has expired', fatal: true })
}
const doc = data.value
provide(CMS_PREVIEW, doc)
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const FIXED = { 'home': HomePage, 'services': ServicesIndex, 'our-work': OurWorkIndex, 'insights': InsightsIndex, 'about': AboutPage, 'contact': ContactPage } as const
const fixed = doc.template in FIXED ? FIXED[doc.template as keyof typeof FIXED] : null
const slug = doc.key.split('/').pop() ?? ''
const article = doc.template === 'article' ? articleBySlug(slug) : undefined
const written = article?.body ? { ...article, body: article.body } : null
const study = doc.template === 'case-study' ? caseStudyBySlug(slug) ?? null : null
const built = isBuiltTemplate(doc.template)
</script>

<template>
  <div>
    <p
      role="status"
      class="sticky top-0 z-50 bg-violet-600 px-4 py-2 text-center text-sm font-semibold text-white"
    >
      Preview of a draft. Visitors still see the published version.
    </p>
    <CmsBuiltPage
      v-if="built"
      :document="doc"
    />
    <component
      :is="fixed"
      v-else-if="fixed"
    />
    <ArticlePage
      v-else-if="written"
      :found="written"
    />
    <CaseStudyPage
      v-else-if="study"
      :found="study"
    />
    <section
      v-else
      class="container-page py-20"
    >
      <h1 class="font-display text-h2 text-heading">
        {{ doc.title }}
      </h1>
      <p class="mt-4 max-w-[56ch] text-body">
        This kind of page cannot be previewed here yet. Its words will show on the live page once published.
      </p>
    </section>
  </div>
</template>
