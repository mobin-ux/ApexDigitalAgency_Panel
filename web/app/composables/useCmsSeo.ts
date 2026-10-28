import type { SeoValue } from '#shared/cms'
import { resolveSeo } from '#shared/cms'
import { setResponseHeader } from 'h3'
import { CMS_MEDIA_KEY } from './useCmsContent'

/**
 * The page's head from its SEO object (ADR-021 §SEO): title, description,
 * canonical, robots and the social tags, with precedence page → template
 * default → site settings default, and X-Robots-Tag set server-side for a
 * page hidden from search. Every page calls this once with the document's
 * `seo` and, as the template default, the words it used before the CMS
 * existed (so an empty panel field changes nothing). The social image is
 * the page's own when the document names one it can resolve, else the
 * image the page passes (an article's hero), else the site default from
 * settings, else the bundled card.
 */
export interface SeoImage {
  src: string
  width?: number | null
  height?: number | null
  alt: string
}

export interface CmsSeoOptions {
  ogType?: 'website' | 'article'
  /** The page's own image (absolute or site-relative), used when the document sets none. */
  image?: SeoImage | null
}

const DEFAULT_ALT = 'Apex Digital Agency — Grow online. Pay monthly.'

export function useCmsSeo(seo: Partial<SeoValue> | null | undefined, templateDefault: Partial<SeoValue>, options: CmsSeoOptions = {}) {
  const settings = useSiteSettings()
  const siteUrl = useSiteConfig().url
  const mediaIndex = inject(CMS_MEDIA_KEY, null)
  const absolute = (src: string) => src.startsWith('http') ? src : `${siteUrl}${src.replace(/^.*\/api\/site\/media\//, '/media/')}`

  const resolved = computed(() => resolveSeo(seo, templateDefault, {
    title: settings.value.seoDefaultTitle,
    description: settings.value.seoDefaultDescription,
  }))

  const image = computed<Required<SeoImage>>(() => {
    const own = seo?.ogImage ?? templateDefault.ogImage
    const info = own && mediaIndex?.value[own.mediaId]
    if (info && info.mime.startsWith('image/')) {
      return { src: absolute(info.src), width: info.width ?? 1200, height: info.height ?? 630, alt: own.alt || info.alt }
    }
    if (options.image) {
      return { src: absolute(options.image.src), width: options.image.width ?? 1200, height: options.image.height ?? 630, alt: options.image.alt }
    }
    const fallback = settings.value.ogImage
    if (fallback) {
      return { src: absolute(fallback.src), width: fallback.width ?? 1200, height: fallback.height ?? 630, alt: fallback.alt || DEFAULT_ALT }
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
