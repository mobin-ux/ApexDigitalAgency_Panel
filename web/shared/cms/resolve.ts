import type { ZodIssue } from 'zod'
import type { FieldDef, FieldMap } from './fields.ts'
import type { Section } from './sections.ts'
import type { TemplateContent, TemplateKey } from './templates.ts'
import { mapToZod, toZod } from './fields.ts'
import { sectionSchema } from './sections.ts'
import { TEMPLATES } from './templates.ts'

/**
 * How the site turns a stored document into what it renders.
 *
 * The code baseline is always a complete, valid document. The overlay is
 * whatever the CMS published, resolved **field by field**: a field the
 * overlay does not set, or sets to something the template refuses, renders
 * from the baseline, so a bad save or an older document shape can degrade
 * one field, never a page. Warnings say what was ignored and why.
 */

/** Thrown when the code baseline itself fails its template: a bug, caught in tests. */
export class CmsBaselineError extends Error {}

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

function unwrap(def: FieldDef): FieldDef {
  return def.type === 'optional' ? def.inner : def
}

/** Validate every section on its own; drop the ones the site cannot render. */
export function resolveSections(value: unknown, path: string, warnings: ResolveWarning[]): Section[] {
  if (!Array.isArray(value)) {
    warnings.push({ path, message: 'Sections must be a list' })
    return []
  }
  const out: Section[] = []
  value.forEach((item, index) => {
    const parsed = sectionSchema.safeParse(item)
    if (parsed.success) {
      out.push(parsed.data as Section)
    }
    else {
      const type = isObject(item) && typeof item.type === 'string' ? item.type : 'unknown'
      warnings.push({ path: `${path}[${index}]`, message: `Dropped a "${type}" section: ${issuesToText(parsed.error.issues)}` })
    }
  })
  return out
}

function resolveField(def: FieldDef, baseline: unknown, overlay: unknown, path: string, warnings: ResolveWarning[]): { value: unknown, managed: boolean } {
  if (overlay === undefined || overlay === null) {
    return { value: baseline, managed: false }
  }
  const inner = unwrap(def)
  if (inner.type === 'object') {
    if (!isObject(overlay)) {
      warnings.push({ path, message: 'Expected an object; kept the baseline' })
      return { value: baseline, managed: false }
    }
    const base = isObject(baseline) ? baseline : {}
    const merged = resolveMap(inner.fields, base, overlay, path, warnings)
    return { value: merged.content, managed: merged.managed }
  }
  if (inner.type === 'custom' && inner.kind === 'sections') {
    return { value: resolveSections(overlay, path, warnings), managed: true }
  }
  const parsed = toZod(def).safeParse(overlay)
  if (parsed.success) {
    return { value: parsed.data, managed: true }
  }
  warnings.push({ path, message: `${issuesToText(parsed.error.issues)}; kept the baseline` })
  return { value: baseline, managed: false }
}

export function resolveMap<F extends FieldMap>(fields: F, baseline: Record<string, unknown>, overlay: Record<string, unknown>, prefix: string, warnings: ResolveWarning[]): Resolved<Record<string, unknown>> {
  const content: Record<string, unknown> = {}
  let managed = false
  for (const [key, def] of Object.entries(fields)) {
    const path = prefix ? `${prefix}.${key}` : key
    const result = resolveField(def, baseline[key], overlay[key], path, warnings)
    content[key] = result.value
    managed ||= result.managed
  }
  return { content, warnings, managed }
}

/**
 * The content the site renders for one document: `overlay ?? baseline`,
 * field by field, then checked as a whole against the template. A baseline
 * that fails its own template is a code bug and throws, so it is caught in
 * tests rather than at a visitor's request.
 */
export function resolveDocument<T extends TemplateKey>(template: T, baseline: TemplateContent<T>, overlay: unknown): Resolved<TemplateContent<T>> {
  const def = TEMPLATES[template]
  const warnings: ResolveWarning[] = []
  const base = baseline as Record<string, unknown>
  const whole = mapToZod(def.fields)

  const baseCheck = whole.safeParse(base)
  if (!baseCheck.success) {
    throw new CmsBaselineError(`The code baseline for "${template}" does not match its template: ${issuesToText(baseCheck.error.issues)}`)
  }

  if (!isObject(overlay)) {
    if (overlay !== undefined && overlay !== null) {
      warnings.push({ path: '', message: 'The stored document is not an object; rendered the baseline' })
    }
    return { content: baseCheck.data as TemplateContent<T>, warnings, managed: false }
  }

  const merged = resolveMap(def.fields, baseCheck.data as Record<string, unknown>, overlay, '', warnings)
  const finalCheck = whole.safeParse(merged.content)
  if (finalCheck.success) {
    return { content: finalCheck.data as TemplateContent<T>, warnings, managed: merged.managed }
  }
  warnings.push({ path: '', message: `The merged document failed the template (${issuesToText(finalCheck.error.issues)}); rendered the baseline` })
  return { content: baseCheck.data as TemplateContent<T>, warnings, managed: false }
}

/** Strict validation for a save: the whole document must pass, with paths the editor can point at. */
export function validateContent<T extends TemplateKey>(template: T, content: unknown): { ok: true, content: TemplateContent<T> } | { ok: false, issues: { path: string, message: string }[] } {
  const parsed = mapToZod(TEMPLATES[template].fields).safeParse(content)
  if (parsed.success) {
    return { ok: true, content: parsed.data as TemplateContent<T> }
  }
  return { ok: false, issues: parsed.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) }
}

export function issuesToText(issues: ZodIssue[]): string {
  return issues.slice(0, 3).map(issue => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message)).join('; ')
}
