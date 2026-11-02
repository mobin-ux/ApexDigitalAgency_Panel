<script setup lang="ts">
import type { Article } from '~/data/articles'
import { articleTopic } from '~/data/articles'
import { articleBaseline } from '~/data/cms-baseline'
import { routes } from '~/data/routes'
import { serviceBySlug } from '~/data/services'

/**
 * One written article (`Article.dc.html`), rendered from the code catalogue
 * with its words laid over by the admin console. `pages/insights/[slug].vue`
 * picks this or an article built in the console.
 */

const props = defineProps<{ found: Article & { body: NonNullable<Article['body']> } }>()
const found = props.found
// The overlay covers the title, excerpt, lead and search listing; the body stays in the catalogue.
const cms = useCmsRecord('article', articleBaseline(found))
const article = { ...found, title: cms.value.title, excerpt: cms.value.excerpt }
const body = { ...found.body, lead: cms.value.lead, seo: { title: cms.value.seo.title, description: cms.value.seo.description } }

const siteUrl = useSiteConfig().url
const pageUrl = `${siteUrl}${routes.article(article.slug)}`
const service = serviceBySlug(article.service)
const topic = articleTopic(article)

useCmsSeo(cms.value.seo, { title: body.seo.title, description: body.seo.description }, { ogType: 'article', image: body.heroImage })
useSeoMeta({
  articlePublishedTime: article.published,
  articleModifiedTime: article.updated ?? article.published,
  articleSection: topic,
  articleAuthor: [body.author.name],
})

// The page with its questions, and the article by its author for the agency.
// The breadcrumb node comes from <UiBreadcrumbs> in the hero.
useSchemaOrg([
  defineWebPage({
    '@type': ['WebPage', 'FAQPage'],
    'name': body.seo.title,
    'description': body.seo.description,
    'mainEntity': body.faq.items.map(item => ({
      '@type': 'Question',
      'name': item.question,
      'acceptedAnswer': { '@type': 'Answer', 'text': item.answer },
    })),
  }),
  {
    '@type': 'Article',
    'headline': article.title,
    'description': body.seo.description,
    'url': pageUrl,
    'mainEntityOfPage': pageUrl,
    'inLanguage': 'en-GB',
    'articleSection': topic,
    ...(article.published ? { datePublished: article.published } : {}),
    ...((article.updated ?? article.published) ? { dateModified: article.updated ?? article.published } : {}),
    'author': {
      '@type': 'Person',
      'name': body.author.name,
      'jobTitle': body.author.role,
      'worksFor': { '@id': `${siteUrl}/#identity` },
    },
    'publisher': { '@id': `${siteUrl}/#identity` },
    ...(body.heroImage ? { image: `${siteUrl}${body.heroImage.src}` } : {}),
    'about': {
      '@type': 'Service',
      'name': service.name,
      'url': `${siteUrl}${routes.service(service.slug)}`,
    },
  },
])
</script>

<template>
  <div>
    <article aria-labelledby="article-title">
      <ArticleHero
        :article="article"
        :body="body"
      />
      <ArticleBody
        :body="body"
        :service="article.service"
      />
    </article>
    <ArticleCta
      :body="body"
      :service="article.service"
    />
    <ArticleMore :article="article" />
  </div>
</template>
