import type { Ref } from 'vue'
import type { CmsMediaInfo } from './useCmsContent'
import { CMS_MEDIA_KEY } from './useCmsContent'

/**
 * Resolves a media reference to an image the site can show: the address,
 * size and alt text the content API attached to the document being
 * rendered (provided by the page under CMS_MEDIA_KEY). A reference the
 * index does not know renders nothing, so a page never shows a placeholder
 * the business did not choose. Images go through /_ipx (which fetches the
 * panel's file and caches the result); PDFs link to /media.
 */
export function useCmsMedia(src: Ref<string>) {
  const index = inject(CMS_MEDIA_KEY, ref<Record<string, CmsMediaInfo>>({}))
  return computed(() => {
    const id = src.value.replace(/^\/media\//, '')
    const info = index.value[id]
    if (!info) {
      return null
    }
    // The panel address is /api/site/media/<id>/<v>/<name>; the site serves it as /media/<id>/<v>/<name>.
    const path = info.src.replace(/^.*\/api\/site\/media\//, '/media/')
    return { src: path, width: info.width ?? undefined, height: info.height ?? undefined, alt: info.alt, image: info.mime.startsWith('image/') }
  })
}
