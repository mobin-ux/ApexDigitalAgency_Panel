import type { LinkValue } from './links.ts'
import { z } from 'zod'
import { isHttpsUrl, isSafeInternalPath, linkSchema } from './links.ts'

/**
 * The field DSL: one declaration per value a page template holds, which
 * yields both its TypeScript type and the zod schema the baseline is
 * checked against. Only plain data types: no HTML, no style, no scripts.
 */

export interface TextField {
  type: 'text'
  label: string
  hint?: string
  max: number
  /** Empty strings are refused when true; otherwise an empty field means "hidden". */
  required?: boolean
  /** Tokens such as `{year}` the site fills at render. Anything else in braces is refused. */
  placeholders?: readonly string[]
  /** A shape the text must have, beyond its length. */
  format?: 'path' | 'https' | 'path-or-https' | 'email' | 'date' | 'datetime'
}
export interface TextareaField extends Omit<TextField, 'type'> { type: 'textarea' }
export interface LinkField { type: 'link', label: string, hint?: string }
export interface SelectField<V extends string = string> {
  type: 'select'
  label: string
  hint?: string
  options: readonly { value: V, label: string }[]
}
export interface BooleanField { type: 'boolean', label: string, hint?: string }
export interface NumberField { type: 'number', label: string, hint?: string, min?: number, max?: number, integer?: boolean }
export interface ObjectField<F extends FieldMap = FieldMap> { type: 'object', label: string, hint?: string, fields: F }
export interface ListField<I extends FieldDef = FieldDef> { type: 'list', label: string, hint?: string, item: I, min?: number, max?: number }
export interface OptionalField<I extends FieldDef = FieldDef> { type: 'optional', inner: I }

export type FieldDef
  = | TextField
    | TextareaField
    | LinkField
    | SelectField
    | BooleanField
    | NumberField
    | ObjectField
    | ListField
    | OptionalField

export type FieldMap = Record<string, FieldDef>

/** The TypeScript value a field definition stores. */
export type Infer<D>
  = D extends TextField | TextareaField ? string
    : D extends LinkField ? LinkValue
      : D extends SelectField<infer V> ? V
        : D extends BooleanField ? boolean
          : D extends NumberField ? number
            : D extends ObjectField<infer F> ? InferMap<F>
              : D extends ListField<infer I> ? Infer<I>[]
                : D extends OptionalField<infer I> ? Infer<I> | undefined
                  : never

export type InferMap<F extends FieldMap> = { [K in keyof F]: Infer<F[K]> }

const BRACE = /\{([^{}]*)\}/g

const FORMATS: Record<NonNullable<TextField['format']>, (value: string) => boolean> = {
  'path': isSafeInternalPath,
  'https': isHttpsUrl,
  'path-or-https': value => isSafeInternalPath(value) || isHttpsUrl(value),
  'email': value => /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(value) && value.length <= 254,
  'date': value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)),
  'datetime': value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !Number.isNaN(Date.parse(value)),
}

const FORMAT_MESSAGE: Record<NonNullable<TextField['format']>, string> = {
  'path': 'Must be a path on this site, such as /services',
  'https': 'Must be a full https:// address',
  'path-or-https': 'Must be a path on this site or a full https:// address',
  'email': 'Must be an email address',
  'date': 'Must be a date as YYYY-MM-DD',
  'datetime': 'Must be a date and time as YYYY-MM-DDTHH:MM',
}

function textSchema(def: TextField | TextareaField) {
  let schema = z.string().trim().max(def.max, `At most ${def.max} characters`)
  if (def.required) {
    schema = schema.min(1, 'Required')
  }
  const allowed = new Set(def.placeholders ?? [])
  const shaped = def.format ? schema.refine(value => value === '' || FORMATS[def.format!](value), FORMAT_MESSAGE[def.format]) : schema
  return shaped.refine((value) => {
    for (const match of value.matchAll(BRACE)) {
      if (!allowed.has(match[1]!)) {
        return false
      }
    }
    return true
  }, allowed.size
    ? `Only ${[...allowed].map(p => `{${p}}`).join(', ')} may appear in braces`
    : 'Braces are not allowed here')
}

/** The zod schema for one field definition. */
export function toZod(def: FieldDef): z.ZodTypeAny {
  switch (def.type) {
    case 'text':
    case 'textarea':
      return textSchema(def)
    case 'link':
      return linkSchema
    case 'select':
      return z.enum(def.options.map(o => o.value) as [string, ...string[]])
    case 'boolean':
      return z.boolean()
    case 'number': {
      let n = z.number().finite()
      if (def.integer) {
        n = n.int()
      }
      if (def.min !== undefined) {
        n = n.min(def.min)
      }
      if (def.max !== undefined) {
        n = n.max(def.max)
      }
      return n
    }
    case 'object':
      return mapToZod(def.fields)
    case 'list': {
      let list = z.array(toZod(def.item))
      if (def.min !== undefined) {
        list = list.min(def.min)
      }
      if (def.max !== undefined) {
        list = list.max(def.max)
      }
      return list
    }
    case 'optional':
      return toZod(def.inner).optional()
  }
}

/** The zod object for a map of fields: unknown keys are stripped, not refused. */
export function mapToZod(fields: FieldMap): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [key, def] of Object.entries(fields)) {
    shape[key] = toZod(def)
  }
  return z.object(shape)
}

/** Substitute the declared placeholders; unknown tokens are left as typed (the schema already refused them). */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(BRACE, (whole, key: string) => (key in values ? String(values[key]) : whole))
}

type Opts<T> = Omit<T, 'type'>

/** Constructors, so a template reads as a form rather than a schema. */
export const f = {
  text: (o: Opts<TextField>): TextField => ({ type: 'text', ...o }),
  textarea: (o: Opts<TextareaField>): TextareaField => ({ type: 'textarea', ...o }),
  link: (o: Opts<LinkField>): LinkField => ({ type: 'link', ...o }),
  select: <const V extends string>(o: Opts<SelectField<V>>): SelectField<V> => ({ type: 'select', ...o }),
  boolean: (o: Opts<BooleanField>): BooleanField => ({ type: 'boolean', ...o }),
  number: (o: Opts<NumberField>): NumberField => ({ type: 'number', ...o }),
  object: <const F extends FieldMap>(o: Opts<ObjectField<F>>): ObjectField<F> => ({ type: 'object', ...o }),
  list: <const I extends FieldDef>(o: Opts<ListField<I>>): ListField<I> => ({ type: 'list', ...o }),
  optional: <const I extends FieldDef>(inner: I): OptionalField<I> => ({ type: 'optional', inner }),
}
