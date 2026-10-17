<script setup lang="ts">
import { articleBySlug } from '~/data/articles'
import { routes } from '~/data/routes'
import { serviceBySlug } from '~/data/services'

/**
 * One page per written article (`Article.dc.html`). A slug in the catalogue
 * without a body is listed elsewhere but has no page yet, so it is a 404 like
 * an unknown slug; `nuxt.config.ts` prerenders only written articles.
 */
definePageMeta({ readingProgress: true })

const route = useRoute()
const found = articleBySlug(String(route.params.slug))
if (!found?.body) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}
const article = found
const body = found.body

const siteUrl = useSiteConfig().url
const pageUrl = `${siteUrl}${routes.article(article.slug)}`
const ogImage = body.heroImage ? `${siteUrl}${body.heroImage.src}` : `${siteUrl}/og-default.png`
const service = serviceBySlug(body.service)

useSeoMeta({
  title: body.seo.title,
  description: body.seo.description,
  ogTitle: body.seo.title,
  ogDescription: body.seo.description,
  ogType: 'article',
  ogLocale: 'en_GB',
  ogImage,
  ...(body.heroImage ? { ogImageAlt: body.heroImage.alt } : { ogImageWidth: 1200, ogImageHeight: 630, ogImageAlt: 'Apex Digital Agency — Grow online. Pay monthly.' }),
  articlePublishedTime: article.published,
  articleModifiedTime: article.updated ?? article.published,
  articleSection: article.topic,
  articleAuthor: [body.author.name],
  twitterCard: 'summary_large_image',
  twitterImage: ogImage,
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
    'articleSection': article.topic,
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
      <ArticleBody :body="body" />
    </article>
    <ArticleCta :body="body" />
    <ArticleMore :article="article" />
  </div>
</template>
