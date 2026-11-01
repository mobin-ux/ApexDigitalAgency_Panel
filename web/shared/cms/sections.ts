import type { FieldMap, InferMap } from './fields.ts'
import { z } from 'zod'
import { f, mapToZod } from './fields.ts'

/**
 * The section types a page, article or case study built in the admin
 * console is made of (ADR-026, `Admin Console.dc.html` `TYPES`). The site
 * renders each one with its own component, so a section can only ever hold
 * plain words and the few links and media ids declared here: no HTML, no
 * styles, no scripts.
 *
 * Lists the design types into one textarea ("one per line") are stored that
 * way and split when rendered, so the editor and the site read the same
 * value. Buttons carry a destination beside their label: the design draws
 * only the label, and a button with nowhere to go is a dead control.
 */

const buttonLink = (label: string) => f.text({ label, hint: 'A path on this site, such as /contact, or a full https:// address.', max: 512, format: 'path-or-https' })

export const SECTION_TYPES = {
  hero: {
    label: 'Hero',
    fields: {
      eyebrow: f.text({ label: 'Eyebrow', max: 80 }),
      title: f.text({ label: 'Headline', max: 140, required: true }),
      body: f.textarea({ label: 'Intro', max: 500 }),
      primary: f.text({ label: 'Primary button', max: 40 }),
      primaryLink: buttonLink('Primary button goes to'),
      secondary: f.text({ label: 'Secondary button (optional)', max: 40 }),
      secondaryLink: buttonLink('Secondary button goes to'),
    },
  },
  text: {
    label: 'Text',
    fields: {
      heading: f.text({ label: 'Heading', max: 140 }),
      body: f.textarea({ label: 'Body', hint: 'A blank line starts a new paragraph.', max: 6000 }),
    },
  },
  services: {
    label: 'Service tiles',
    note: 'Tiles, names and prices come from the site\'s service catalogue.',
    fields: {
      heading: f.text({ label: 'Heading', max: 140 }),
      body: f.textarea({ label: 'Intro', max: 500 }),
    },
  },
  steps: {
    label: 'Steps',
    fields: {
      heading: f.text({ label: 'Heading', max: 140 }),
      items: f.textarea({ label: 'Steps, one per line', max: 2000, required: true }),
    },
  },
  cards: {
    label: 'Case study picks',
    note: 'Shows the three most recent published case studies.',
    fields: {
      heading: f.text({ label: 'Heading', max: 140 }),
    },
  },
  faq: {
    label: 'FAQ',
    fields: {
      heading: f.text({ label: 'Heading', max: 140 }),
      items: f.textarea({ label: 'One per line: question, then answer after the ?', max: 8000, required: true }),
    },
  },
  quote: {
    label: 'Quote',
    fields: {
      quote: f.textarea({ label: 'Quote', max: 600, required: true }),
      name: f.text({ label: 'Name and company', max: 120 }),
    },
  },
  image: {
    label: 'Image',
    fields: {
      media: f.text({ label: 'Image', max: 64 }),
      caption: f.text({ label: 'Caption', max: 200 }),
    },
  },
  cta: {
    label: 'Call to action',
    fields: {
      title: f.text({ label: 'Headline', max: 140, required: true }),
      body: f.text({ label: 'Line', max: 240 }),
      button: f.text({ label: 'Button', max: 40, required: true }),
      buttonLink: buttonLink('Button goes to'),
    },
  },
} as const satisfies Record<string, { label: string, note?: string, fields: FieldMap }>

export type SectionType = keyof typeof SECTION_TYPES

export const SECTION_TYPE_KEYS = Object.keys(SECTION_TYPES) as SectionType[]

export type SectionFields<T extends SectionType> = InferMap<typeof SECTION_TYPES[T]['fields']>

export interface Section<T extends SectionType = SectionType> {
  /** Stable within the document, so the editor can select and reorder it. */
  id: string
  type: T
  hidden: boolean
  fields: SectionFields<T>
}

export const MAX_SECTIONS = 30

const sectionId = z.string().regex(/^[\w-]{1,40}$/, 'Section ids are letters, digits, - and _')

export const sectionSchema = z.discriminatedUnion('type', SECTION_TYPE_KEYS.map(type => z.object({
  id: sectionId,
  type: z.literal(type),
  hidden: z.boolean().default(false),
  fields: mapToZod(SECTION_TYPES[type].fields),
})) as unknown as [z.ZodDiscriminatedUnionOption<'type'>, ...z.ZodDiscriminatedUnionOption<'type'>[]])

export const sectionsSchema = z.array(sectionSchema).min(1, 'Keep at least one section').max(MAX_SECTIONS, `At most ${MAX_SECTIONS} sections`).refine(list => new Set(list.map(s => s.id)).size === list.length, 'Section ids must be unique')

/** A section of `type` with empty fields, ready to be filled in. */
export function emptySection<T extends SectionType>(type: T, id: string): Section<T> {
  const fields: Record<string, string> = {}
  for (const key of Object.keys(SECTION_TYPES[type].fields)) {
    fields[key] = ''
  }
  return { id, type, hidden: false, fields: fields as SectionFields<T> }
}

/** "One per line" values, trimmed, blanks dropped. */
export function lines(value: string): string[] {
  return value.split('\n').map(l => l.trim()).filter(Boolean)
}

/** FAQ lines: the question runs to the first "?", the answer is the rest. */
export function faqItems(value: string): { question: string, answer: string }[] {
  return lines(value).map((line) => {
    const at = line.indexOf('?')
    return at === -1 ? { question: line, answer: '' } : { question: line.slice(0, at + 1), answer: line.slice(at + 1).trim() }
  })
}

/** Paragraphs of a text body: split on blank lines. */
export function paragraphs(value: string): string[] {
  return value.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
}

/** The media ids a list of sections refers to, for the media library's usage. */
export function sectionMediaIds(sections: readonly Section[]): string[] {
  return [...new Set(sections.filter(s => s.type === 'image').map(s => (s.fields as SectionFields<'image'>).media).filter(Boolean))]
}
