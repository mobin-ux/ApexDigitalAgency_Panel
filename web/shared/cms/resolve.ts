import type { ZodIssue } from 'zod'
import type { FieldDef, FieldMap } from './fields.ts'
import type { TemplateContent, TemplateKey } from './templates.ts'
import { mapToZod, toZod } from './fields.ts'
import { TEMPLATES } from './templates.ts'
import { CmsBaselineError } from './validate.ts'

/**
 * How the site lays a published coded document over its code baseline
 * (ADR-026). The baseline is always complete and valid; the overlay is
 * applied **field by field**, so a field the overlay leaves out, or sets to
 * something the template refuses, renders from the baseline. A bad save or
 * an older document shape degrades one field, never a page.
 */

export interface ResolveWarning {
  path: string
  message: string
}

export interface Resolved<T> {
  content: T
  warnings: ResolveWarning[]
  /** True when at least one field came from the overlay. */
  managed: boolean
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function issuesToText(issues: ZodIssue[]): string {
  return issues.slice(0, 3).map(issue => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message)).join('; ')
}

function resolveField(def: FieldDef, baseline: unknown, overlay: unknown, path: string, warnings: ResolveWarning[]): { value: unknown, managed: boolean } {
  if (overlay === undefined || overlay === null) {
    return { value: baseline, managed: false }
  }
  const inner = def.type === 'optional' ? def.inner : def
  if (inner.type === 'object') {
    if (!isObject(overlay)) {
      warnings.push({ path, message: 'Expected an object; kept the baseline' })
      return { value: baseline, managed: false }
    }
    const merged = resolveMap(inner.fields, isObject(baseline) ? baseline : {}, overlay, path, warnings)
    return { value: merged.content, managed: merged.managed }
  }
  const parsed = toZod(def).safeParse(overlay)
  if (parsed.success) {
    return { value: parsed.data, managed: true }
  }
  warnings.push({ path, message: `${issuesToText(parsed.error.issues)}; kept the baseline` })
  return { value: baseline, managed: false }
}

function resolveMap(fields: FieldMap, baseline: Record<string, unknown>, overlay: Record<string, unknown>, prefix: string, warnings: ResolveWarning[]): Resolved<Record<string, unknown>> {
  const content: Record<string, unknown> = {}
  let managed = false
  for (const [key, def] of Object.entries(fields)) {
    const result = resolveField(def, baseline[key], overlay[key], prefix ? `${prefix}.${key}` : key, warnings)
    content[key] = result.value
    managed ||= result.managed
  }
  return { content, warnings, managed }
}

/**
 * What the site renders for a coded document: `overlay ?? baseline`, field
 * by field, then checked as a whole. A baseline that fails its own
 * template is a code bug and throws, so the contract tests catch it.
 */
export function resolveDocument<T extends TemplateKey>(template: T, baseline: TemplateContent<T>, overlay: unknown): Resolved<TemplateContent<T>> {
  const whole = mapToZod(TEMPLATES[template].fields)
  const warnings: ResolveWarning[] = []
  const baseCheck = whole.safeParse(baseline)
  if (!baseCheck.success) {
    throw new CmsBaselineError(`The code baseline for "${template}" does not match its template: ${issuesToText(baseCheck.error.issues)}`)
  }
  if (!isObject(overlay)) {
    if (overlay !== undefined && overlay !== null) {
      warnings.push({ path: '', message: 'The stored document is not an object; rendered the baseline' })
    }
    return { content: baseCheck.data as TemplateContent<T>, warnings, managed: false }
  }
  const merged = resolveMap(TEMPLATES[template].fields, baseCheck.data as Record<string, unknown>, overlay, '', warnings)
  const finalCheck = whole.safeParse(merged.content)
  if (finalCheck.success) {
    return { content: finalCheck.data as TemplateContent<T>, warnings, managed: merged.managed }
  }
  warnings.push({ path: '', message: `The merged document failed the template (${issuesToText(finalCheck.error.issues)}); rendered the baseline` })
  return { content: baseCheck.data as TemplateContent<T>, warnings, managed: false }
}
