import type { FieldDef, FieldMap } from '~~/shared/cms'

/**
 * Helpers for the website editor's generated forms (ADR-026): the empty
 * value a new list item or optional group starts from, and the short line
 * a section shows under its name in the editor's section list.
 */

/** The value a field starts from when it is added: empty words, the first option, an internal link to nowhere yet. */
export function emptyValue(def: FieldDef): unknown {
  switch (def.type) {
    case 'text':
    case 'textarea':
      return ''
    case 'link':
      return { kind: 'internal', path: '/' }
    case 'select':
      return def.options[0]?.value ?? ''
    case 'boolean':
      return false
    case 'number':
      return def.min ?? 0
    case 'object':
      return emptyObject(def.fields)
    case 'list':
      return Array.from({ length: def.min ?? 0 }, () => emptyValue(def.item))
    case 'optional':
      return undefined
  }
}

export function emptyObject(fields: FieldMap): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, def]) => [key, emptyValue(def)]))
}

/** The first non-empty words in a value, for a one-line summary. */
export function firstWords(value: unknown, depth = 0): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (depth > 3 || value === null || typeof value !== 'object') {
    return ''
  }
  const entries = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>)
  for (const entry of entries) {
    const words = firstWords(entry, depth + 1)
    if (words && !words.startsWith('/')) {
      return words
    }
  }
  return ''
}

/** Server field errors under a dotted path prefix, e.g. every error inside `sections.2`. */
export function errorsUnder(errors: Record<string, string[]>, prefix: string): number {
  return Object.keys(errors).filter(key => key === prefix || key.startsWith(`${prefix}.`)).length
}
