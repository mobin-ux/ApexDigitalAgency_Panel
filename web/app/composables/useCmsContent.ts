import type { ComputedRef } from 'vue'
import type { TemplateContent, TemplateKey } from '../../shared/cms'
import type { FixedBaselineKey } from '~/data/cms-baseline'
import { fixedBaselines } from '~/data/cms-baseline'
import { resolveDocument } from '../../shared/cms'

/**
 * The content a page or a piece of chrome renders (ADR-021).
 *
 * Components read their words from here instead of importing data modules,
 * so a document published from the panel can replace any field. The answer
 * is always complete: `resolveDocument()` lays the overlay over the code
 * baseline field by field, and a field the overlay does not set, or sets to
 * something the template refuses, renders from the baseline.
 *
 * This is the CMS-off path: the baseline alone. The overlay fetch arrives
 * with the content API; callers do not change.
 */

const resolved = new Map<string, unknown>()

function baselineFor<T extends FixedBaselineKey>(template: T): TemplateContent<T> {
  const cached = resolved.get(template)
  if (cached) {
    return cached as TemplateContent<T>
  }
  const result = resolveDocument(template, fixedBaselines[template] as TemplateContent<T>, null)
  resolved.set(template, result.content)
  return result.content
}

/** A fixed-key document: the six core pages and the chrome globals. */
export function useCmsContent<T extends FixedBaselineKey>(template: T): ComputedRef<TemplateContent<T>> {
  return computed(() => baselineFor(template))
}

/** A per-record document (service, case study, article), resolved over the baseline the caller builds from its catalogue. */
export function useCmsRecord<T extends Extract<TemplateKey, 'service' | 'case-study' | 'article'>>(template: T, _key: string, baseline: TemplateContent<T>): ComputedRef<TemplateContent<T>> {
  const content = resolveDocument(template, baseline, null).content
  return computed(() => content)
}
