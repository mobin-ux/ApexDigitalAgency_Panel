import type { FieldDef, FieldMap } from '~~/shared/cms'

/**
 * Helpers the website editor shares (ADR-021): an empty, valid value for a
 * field so "Add" and "Set" produce something the template accepts, and a
 * flat diff of two documents for the revisions screen.
 */

export function emptyValue(def: FieldDef): unknown {
  switch (def.type) {
    case 'text':
    case 'textarea':
      return ''
    case 'number':
      return def.min ?? 0
    case 'boolean':
      return false
    case 'select':
      return def.options[0]?.value ?? ''
    case 'link':
      return { kind: 'internal', path: '/' }
    case 'media':
      return { mediaId: '', alt: '' }
    case 'blocks':
      return []
    case 'object':
      return emptyMap(def.fields)
    case 'list':
      return Array.from({ length: def.min ?? 0 }, () => emptyValue(def.item))
    case 'optional':
      return undefined
    case 'custom':
      return []
  }
}

export function emptyMap(fields: FieldMap): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(fields)) {
    out[key] = emptyValue(def)
  }
  return out
}

/** Every leaf of a document as `path → text`, for comparing two revisions. */
export function flattenDocument(value: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (value === null || value === undefined) {
    return out
  }
  if (typeof value !== 'object') {
    out[prefix || '(root)'] = String(value)
    return out
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => flattenDocument(item, `${prefix}[${i}]`, out))
    return out
  }
  for (const [key, inner] of Object.entries(value)) {
    flattenDocument(inner, prefix ? `${prefix}.${key}` : key, out)
  }
  return out
}

export interface DiffRow {
  path: string
  before: string | null
  after: string | null
}

export function diffDocuments(before: unknown, after: unknown): DiffRow[] {
  const a = flattenDocument(before)
  const b = flattenDocument(after)
  const paths = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  return paths
    .filter(path => a[path] !== b[path])
    .map(path => ({ path, before: a[path] ?? null, after: b[path] ?? null }))
}
