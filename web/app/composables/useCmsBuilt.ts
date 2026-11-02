import type { MaybeRefOrGetter } from 'vue'
import { isHttpsUrl, isSafeInternalPath } from '#shared/cms'

/**
 * Helpers for the pages, articles and case studies built in the admin
 * console (ADR-026).
 */

export interface CmsManifestEntry {
  key: string
  template: string
  title: string
  publishedAt: string | null
  built: boolean
  noindex: boolean
  meta: Record<string, unknown> | null
}

/**
 * A section button: its label and where it goes, or null when either is
 * missing. The design draws buttons with a label only; a button with
 * nowhere to go is a dead control, so it is not rendered.
 */
export function useCmsButton() {
  function buttonAttrs(label: string, link: string) {
    const text = label.trim()
    const target = link.trim()
    if (!text || !target) {
      return null
    }
    if (isSafeInternalPath(target)) {
      return { label: text, attrs: { to: target } }
    }
    return isHttpsUrl(target) ? { label: text, attrs: { href: target } } : null
  }
  return { buttonAttrs }
}

/** Every published address with its list meta, shared by the components that need it. */
export function useCmsManifest() {
  const { data } = useFetch<{ pages: CmsManifestEntry[] }>('/api/cms/manifest', {
    key: 'cms-manifest',
    default: () => ({ pages: [] }),
  })
  return computed(() => data.value?.pages ?? [])
}

export interface CmsMediaRef {
  src: string
  alt: string
  mime: string
  width: number | null
  height: number | null
}

/**
 * The library file an image section names, from the index the built page
 * provides (`media` on its document). A file the index does not know
 * (deleted, or not an image) renders nothing rather than a broken image.
 */
export function useCmsMedia(id: MaybeRefOrGetter<string>) {
  const index = inject<Ref<Record<string, CmsMediaRef>> | null>('cms-media', null)
  return computed<CmsMediaRef | null>(() => {
    const key = toValue(id)
    return key ? index?.value?.[key] ?? null : null
  })
}
