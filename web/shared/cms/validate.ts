import type { TemplateContent, TemplateKey } from './templates.ts'
import { mapToZod } from './fields.ts'
import { TEMPLATES } from './templates.ts'

/**
 * Checks a document against its template. The site's pages render the
 * code baseline (`app/data/cms-baseline.ts`) through `baselineContent()`,
 * which parses it once so a field the template trims or defaults renders
 * the same way it always has, and throws if the baseline no longer fits
 * its template — a code bug, caught by the contract tests rather than at a
 * visitor's request.
 */

/** Thrown when the code baseline fails its template. */
export class CmsBaselineError extends Error {}

export function validateContent<T extends TemplateKey>(template: T, content: unknown): { ok: true, content: TemplateContent<T> } | { ok: false, issues: { path: string, message: string }[] } {
  const parsed = mapToZod(TEMPLATES[template].fields).safeParse(content)
  if (parsed.success) {
    return { ok: true, content: parsed.data as TemplateContent<T> }
  }
  return { ok: false, issues: parsed.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) }
}

export function baselineContent<T extends TemplateKey>(template: T, baseline: TemplateContent<T>): TemplateContent<T> {
  const result = validateContent(template, baseline)
  if (!result.ok) {
    throw new CmsBaselineError(`The code baseline for "${template}" does not match its template: ${result.issues.slice(0, 3).map(i => `${i.path}: ${i.message}`).join('; ')}`)
  }
  return result.content
}
