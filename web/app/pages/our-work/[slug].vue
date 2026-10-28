<script setup lang="ts">
import type { StoryResult } from '~/data/case-studies'
import { caseStudyBySlug } from '~/data/case-studies'
import { caseStudyBaseline } from '~/data/cms-baseline'
import { routes } from '~/data/routes'
import { serviceBySlug } from '~/data/services'

/**
 * One page per case study (`Case Study.dc.html`).
 *
 * A study with a written-up story renders all of it. One without renders its
 * summary, its headline result and the ways to act on it, so every card on
 * /our-work opens a real page; `nuxt.config.ts` keeps those pages out of
 * search until the story is written. An unknown slug is a 404.
 */
const route = useRoute()
const found = caseStudyBySlug(String(route.params.slug))
if (!found) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}
// The overlay covers the written-up title, lead and search listing; figures and chapters stay in the catalogue.
const cms = useCmsRecord('case-study', routes.caseStudy(found.slug), caseStudyBaseline(found))
const study = found.story
  ? { ...found, story: { ...found.story, title: cms.value.title, lead: cms.value.lead, seo: { title: cms.value.seo.title, description: cms.value.seo.description } } }
  : found
const story = study.story

const results: readonly StoryResult[] = story?.results ?? [
  { label: 'Result', before: study.result.before, after: study.result.after, note: study.result.metric },
]

const title = story?.seo.title ?? `${study.client} case study`
const description = story?.seo.description ?? study.summary

const siteUrl = useSiteConfig().url
const pageUrl = `${siteUrl}${routes.caseStudy(study.slug)}`
const image = story?.heroImage ?? study.image
const ogImage = image ? `${siteUrl}${image.src}` : `${siteUrl}/og-default.png`

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogType: 'article',
  ogLocale: 'en_GB',
  ogImage,
  ...(image ? { ogImageAlt: image.alt } : { ogImageWidth: 1200, ogImageHeight: 630, ogImageAlt: 'Apex Digital Agency — Grow online. Pay monthly.' }),
  twitterCard: 'summary_large_image',
  twitterImage: ogImage,
})

// The study as an Article by the agency about the client and the services it
// used. The breadcrumb node comes from <UiBreadcrumbs> in the hero. The client
// quote is not marked up as a Review: Google ignores self-served reviews.
// TODO(content): add datePublished once each study carries a real date.
useSchemaOrg([
  defineWebPage({
    name: title,
    description,
  }),
  {
    '@type': 'Article',
    'headline': story?.title ?? title,
    description,
    'url': pageUrl,
    'mainEntityOfPage': pageUrl,
    'inLanguage': 'en-GB',
    'author': { '@id': `${siteUrl}/#identity` },
    'publisher': { '@id': `${siteUrl}/#identity` },
    ...(image ? { image: `${siteUrl}${image.src}` } : {}),
    'about': [
      { '@type': 'Organization', 'name': study.client },
      ...study.services.map(slug => ({
        '@type': 'Service',
        'name': serviceBySlug(slug).name,
        'url': `${siteUrl}${routes.service(slug)}`,
      })),
    ],
  },
])
</script>

<template>
  <div>
    <CaseStudyHero :study="study" />
    <CaseStudyResults :results="results" />
    <CaseStudyStory
      v-if="story"
      :study="study"
      :story="story"
    />
    <div
      v-else
      class="h-20 lg:h-26"
      aria-hidden="true"
    />
    <CaseStudyCta :study="study" />
    <CaseStudyMore :study="study" />
  </div>
</template>
