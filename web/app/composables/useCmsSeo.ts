import type { SeoValue } from '#shared/cms'
import { resolveSeo } from '#shared/cms'
import { setResponseHeader } from 'h3'

/**
 * The page's head from its SEO object: title, description, canonical,
 * robots and the social tags, with precedence document → the page's own
 * default words, and X-Robots-Tag set server-side for a page hidden from
 * search. The social image is the one the page passes (an article's hero),
 * else the bundled card.
 */
export interface SeoImage {
  src: string
  width?: number | null
  height?: number | null
  alt: string
}

export interface CmsSeoOptions {
  ogType?: 'website' | 'article'
  /** The page's own image (absolute or site-relative). */
  image?: SeoImage | null
}

const DEFAULT_ALT = 'Apex Digital Agency — Grow online. Pay monthly.'

export function useCmsSeo(seo: Partial<SeoValue> | null | undefined, templateDefault: Partial<SeoValue>, options: CmsSeoOptions = {}) {
  const siteUrl = useSiteConfig().url
  const absolute = (src: string) => src.startsWith('http') ? src : `${siteUrl}${src}`

  const resolved = computed(() => resolveSeo(seo, templateDefault))

  const image = computed<Required<SeoImage>>(() => {
    if (options.image) {
      return { src: absolute(options.image.src), width: options.image.width ?? 1200, height: options.image.height ?? 630, alt: options.image.alt }
    }
    return { src: `${siteUrl}/og-default.png`, width: 1200, height: 630, alt: DEFAULT_ALT }
  })

  useSeoMeta({
    title: () => resolved.value.title,
    description: () => resolved.value.description,
    robots: () => resolved.value.robots.replace(',', ', '),
    ogTitle: () => resolved.value.ogTitle,
    ogDescription: () => resolved.value.ogDescription,
    ogType: options.ogType ?? 'website',
    ogLocale: 'en_GB',
    ogImage: () => image.value.src,
    ogImageWidth: () => image.value.width,
    ogImageHeight: () => image.value.height,
    ogImageAlt: () => image.value.alt,
    twitterCard: 'summary_large_image',
    twitterImage: () => image.value.src,
  })
  if (resolved.value.canonical) {
    useHead({ link: [{ rel: 'canonical', href: resolved.value.canonical.startsWith('/') ? `${siteUrl}${resolved.value.canonical}` : resolved.value.canonical }] })
  }
  if (resolved.value.noindex && import.meta.server) {
    const event = useRequestEvent()
    if (event) {
      setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
    }
  }
  return resolved
}
