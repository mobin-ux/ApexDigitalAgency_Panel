import type { ComputedRef } from 'vue'
import type { ResolveWarning, TemplateContent, TemplateKey } from '../../shared/cms'
import type { FixedBaselineKey } from '~/data/cms-baseline'
import { fixedBaselines } from '~/data/cms-baseline'
import { resolveDocument, resolveSections, TEMPLATES, validateContent } from '../../shared/cms'

/**
 * The content a page or a piece of chrome renders (ADR-021).
 *
 * Components read their words from here instead of importing data modules,
 * so a document published from the panel can replace any field. The answer
 * is always complete: `resolveDocument()` lays the overlay over the code
 * baseline field by field, and a field the overlay does not set, or sets to
 * something the template refuses, renders from the baseline.
 *
 * The overlay comes from this server's own /api/cms/** proxies (cached 60 s
 * there), fetched once per request during SSR and shared through the
 * payload, so hydration renders the same words. With no panel configured
 * the proxies answer 404 and every page renders its baseline.
 */

interface OverlayDoc {
  template: TemplateKey
  content: unknown
}

function warn(template: string, key: string, warnings: ResolveWarning[]) {
  if (warnings.length && import.meta.server) {
    console.warn(`[cms] ${template} ${key}: ${warnings.map(w => `${w.path || '(document)'}: ${w.message}`).join('; ')}`)
  }
}

/** The published globals, keyed by template; one fetch per request, shared by every chrome component. */
function useGlobalsOverlay() {
  return useFetch<{ globals: Record<string, OverlayDoc> }>('/api/cms/globals', {
    key: 'cms:globals',
    default: () => ({ globals: {} }),
    // A failed read renders the baseline; nothing on the page depends on the error.
    ignoreResponseError: true,
  })
}

/** A page's published document, by address; 404 (no document) is the normal CMS-off answer. */
function usePageOverlay(path: string) {
  return useFetch<OverlayDoc | null>(`/api/cms/page?path=${encodeURIComponent(path)}`, {
    key: `cms:page:${path}`,
    default: () => null,
    ignoreResponseError: true,
    transform: doc => (doc && typeof doc === 'object' && 'content' in doc ? doc : null),
  })
}

/** A fixed-key document: the six core pages and the chrome globals. */
export function useCmsContent<T extends FixedBaselineKey>(template: T): ComputedRef<TemplateContent<T>> {
  const def = TEMPLATES[template]
  const baseline = fixedBaselines[template] as TemplateContent<T>
  if (def.kind === 'global') {
    const { data } = useGlobalsOverlay()
    return computed(() => {
      const overlay = data.value?.globals?.[template]?.content ?? null
      const result = resolveDocument(template, baseline, overlay)
      warn(template, def.fixedKey ?? template, result.warnings)
      return result.content
    })
  }
  const { data } = usePageOverlay(def.fixedKey ?? '/')
  return computed(() => {
    const overlay = data.value?.template === template ? data.value.content : null
    const result = resolveDocument(template, baseline, overlay)
    warn(template, def.fixedKey ?? '/', result.warnings)
    return result.content
  })
}

/** A per-record document (service, case study, article) at its page address, over the baseline built from the catalogue. */
export function useCmsRecord<T extends Extract<TemplateKey, 'service' | 'case-study' | 'article'>>(template: T, path: string, baseline: TemplateContent<T>): ComputedRef<TemplateContent<T>> {
  const { data } = usePageOverlay(path)
  return computed(() => {
    const overlay = data.value?.template === template ? data.value.content : null
    const result = resolveDocument(template, baseline, overlay)
    warn(template, path, result.warnings)
    return result.content
  })
}

/** A landing page's published document at an address the code does not render, or null. */
/** Awaited by the page, because the page decides 404 from the answer. */
export async function useCmsLanding(path: string) {
  const fetched = usePageOverlay(path)
  await fetched
  const { data, status } = fetched
  const page = computed(() => {
    if (data.value?.template !== 'landing') {
      return null
    }
    // A landing page has no code baseline: the document is validated as a
    // whole, with sections the site cannot render dropped one by one.
    const raw = data.value.content as { sections?: unknown } | null
    const warnings: ResolveWarning[] = []
    const sections = resolveSections(raw?.sections ?? [], 'sections', warnings)
    const check = validateContent('landing', { ...(raw ?? {}), sections })
    if (!check.ok) {
      warnings.push(...check.issues)
      warn('landing', path, warnings)
      return null
    }
    warn('landing', path, warnings)
    return check.content
  })
  return { page, status }
}
