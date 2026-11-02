import type { TemplateContent, TemplateKey } from '#shared/cms'
import type { ComputedRef, InjectionKey } from 'vue'
import type { FixedBaselineKey } from '~/data/cms-baseline'
import { normalisePath, resolveDocument, TEMPLATES } from '#shared/cms'
import { fixedBaselines } from '~/data/cms-baseline'

/**
 * The words a page or a piece of chrome renders (ADR-026): its code
 * baseline (`data/cms-baseline.ts`) with whatever the admin console has
 * published laid over it, field by field (`resolveDocument`). A field the
 * published document leaves out, or sets to something the template now
 * refuses, renders from the baseline. With no panel configured, or the
 * panel unreachable and no snapshot, the baseline renders as it always has.
 *
 * The published documents are loaded before the page by
 * `middleware/cms.global.ts`; these read them synchronously.
 */

export interface CmsDocumentLike {
  template: string
  key: string
  title?: string
  content: unknown
  /** The media-library files a built document names (id → the site address, size, alt). */
  media?: Record<string, { src: string, width: number | null, height: number | null, mime: string, alt: string }>
}

/** Published page documents by address (null: nothing published there). */
export function useCmsPageState() {
  return useState<Record<string, CmsDocumentLike | null>>('cms-pages', () => ({}))
}

/** Published chrome documents by template; null until loaded. */
export function useCmsGlobalState() {
  return useState<Record<string, CmsDocumentLike> | null>('cms-globals', () => null)
}

/**
 * A draft standing in for the published document while staff preview it
 * (`pages/preview/[token].vue`). Matched by template and address, so only
 * the previewed page takes it.
 */
export const CMS_PREVIEW: InjectionKey<CmsDocumentLike | null> = Symbol('cms-preview')

function overlayFor(template: TemplateKey, key: string): ComputedRef<unknown> {
  const preview = inject(CMS_PREVIEW, null)
  if (preview && preview.template === template && preview.key === key) {
    return computed(() => preview.content)
  }
  if (TEMPLATES[template].kind === 'global') {
    const globals = useCmsGlobalState()
    return computed(() => {
      const doc = globals.value?.[template]
      return doc && doc.template === template ? doc.content : null
    })
  }
  const pages = useCmsPageState()
  return computed(() => {
    const doc = pages.value[key]
    return doc && doc.template === template ? doc.content : null
  })
}

/** A fixed-key document: the six core pages and the chrome globals. */
export function useCmsContent<T extends FixedBaselineKey>(template: T): ComputedRef<TemplateContent<T>> {
  const def = TEMPLATES[template]
  const key = def.kind === 'global' ? (def.fixedKey ?? template) : (def.fixedKey ?? '/')
  const overlay = overlayFor(template, key)
  const baseline = fixedBaselines[template] as TemplateContent<T>
  return computed(() => resolveDocument(template, baseline, overlay.value).content)
}

/** A per-record document (service, case study, article), at the current page's address. */
export function useCmsRecord<T extends Extract<TemplateKey, 'service' | 'case-study' | 'article'>>(template: T, baseline: TemplateContent<T>, path?: string): ComputedRef<TemplateContent<T>> {
  // On the preview page the record's own address is the previewed document's, not the route's.
  const preview = inject(CMS_PREVIEW, null)
  const key = path ?? (preview?.template === template ? preview.key : useRoute().path)
  const overlay = overlayFor(template, normalisePath(key))
  return computed(() => resolveDocument(template, baseline, overlay.value).content)
}
