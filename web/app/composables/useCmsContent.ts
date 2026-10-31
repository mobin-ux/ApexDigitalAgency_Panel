import type { TemplateContent, TemplateKey } from '#shared/cms'
import type { ComputedRef } from 'vue'
import type { FixedBaselineKey } from '~/data/cms-baseline'
import { baselineContent } from '#shared/cms'
import { fixedBaselines } from '~/data/cms-baseline'

/**
 * The words a page or a piece of chrome renders: its document in the code
 * baseline (`data/cms-baseline.ts`), checked against its template. The
 * panel could once overlay these with published documents (ADR-021); that
 * CMS was removed on 2026-10-31, so the baseline is the only source. The
 * computed shape stays so the components did not have to change.
 */

/** A fixed-key document: the six core pages and the chrome globals. */
export function useCmsContent<T extends FixedBaselineKey>(template: T): ComputedRef<TemplateContent<T>> {
  const content = baselineContent(template, fixedBaselines[template] as TemplateContent<T>)
  return computed(() => content)
}

/** A per-record document (service, case study, article), built from the catalogue. */
export function useCmsRecord<T extends Extract<TemplateKey, 'service' | 'case-study' | 'article'>>(template: T, baseline: TemplateContent<T>): ComputedRef<TemplateContent<T>> {
  const content = baselineContent(template, baseline)
  return computed(() => content)
}
