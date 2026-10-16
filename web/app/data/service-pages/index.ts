import type { ServiceSlug } from '../routes'
import type { ServicePageContent } from './types'

/**
 * Service pages that have content, each loaded on demand so a visitor to one
 * service page does not download the copy for all seven.
 * A slug missing here is a 404 until its content file exists.
 */
const loaders: Partial<Record<ServiceSlug, () => Promise<ServicePageContent>>> = {
  'website-design': () => import('./website-design').then(m => m.websiteDesignPage),
}

export function loadServicePage(slug: string): Promise<ServicePageContent> | undefined {
  return loaders[slug as ServiceSlug]?.()
}

/** Paths to prerender. */
export const servicePagePaths = Object.keys(loaders)
