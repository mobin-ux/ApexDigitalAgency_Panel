import type { FieldMap, InferMap } from './fields.ts'
import { z } from 'zod'
import { f, mapToZod } from './fields.ts'

/**
 * Landing-page sections. A landing page is an ordered list of these; each
 * type declares its props with the field DSL, so the editor form, the
 * validation and the renderer's props come from the one table. A stored
 * section whose type the site does not know is dropped at render with a
 * warning, never shown as broken markup.
 */

const cta = f.object({
  label: 'Button',
  fields: {
    label: f.text({ label: 'Label', max: 40, required: true }),
    link: f.link({ label: 'Goes to' }),
  },
})

export const SECTION_DEFS = {
  hero: {
    label: 'Hero',
    detail: 'Headline, supporting line and up to two buttons',
    fields: {
      eyebrow: f.text({ label: 'Eyebrow', max: 60 }),
      title: f.text({ label: 'Headline', max: 140, required: true }),
      text: f.textarea({ label: 'Supporting text', max: 400 }),
      primary: f.optional(cta),
      secondary: f.optional(cta),
    },
  },
  richText: {
    label: 'Text',
    detail: 'Headings, paragraphs, lists, notes and tables',
    fields: {
      blocks: f.blocks({ label: 'Content', max: 80 }),
    },
  },
  features: {
    label: 'Feature grid',
    detail: 'Three to six short points with titles',
    fields: {
      title: f.text({ label: 'Heading', max: 120 }),
      text: f.textarea({ label: 'Intro', max: 300 }),
      items: f.list({
        label: 'Points',
        min: 1,
        max: 8,
        item: f.object({
          label: 'Point',
          fields: {
            title: f.text({ label: 'Title', max: 80, required: true }),
            text: f.textarea({ label: 'Text', max: 300 }),
          },
        }),
      }),
    },
  },
  stats: {
    label: 'Figures',
    detail: 'Two to four numbers with labels',
    fields: {
      items: f.list({
        label: 'Figures',
        min: 2,
        max: 4,
        item: f.object({
          label: 'Figure',
          fields: {
            value: f.text({ label: 'Value', max: 20, required: true }),
            label: f.text({ label: 'Label', max: 60, required: true }),
          },
        }),
      }),
      note: f.text({ label: 'Footnote', hint: 'Say how each figure is measured.', max: 200 }),
    },
  },
  testimonials: {
    label: 'Quotes',
    detail: 'Client quotes with a name and role',
    fields: {
      title: f.text({ label: 'Heading', max: 120 }),
      items: f.list({
        label: 'Quotes',
        min: 1,
        max: 6,
        item: f.object({
          label: 'Quote',
          fields: {
            quote: f.textarea({ label: 'Quote', max: 600, required: true }),
            name: f.text({ label: 'Name', max: 80, required: true }),
            role: f.text({ label: 'Role and company', max: 120 }),
          },
        }),
      }),
    },
  },
  faq: {
    label: 'Questions',
    detail: 'Expandable question and answer pairs',
    fields: {
      title: f.text({ label: 'Heading', max: 120 }),
      items: f.list({
        label: 'Questions',
        min: 1,
        max: 20,
        item: f.object({
          label: 'Question',
          fields: {
            question: f.text({ label: 'Question', max: 200, required: true }),
            answer: f.textarea({ label: 'Answer', max: 1200, required: true }),
          },
        }),
      }),
    },
  },
  cta: {
    label: 'Call to action',
    detail: 'A heading, a line and one button',
    fields: {
      title: f.text({ label: 'Heading', max: 120, required: true }),
      text: f.textarea({ label: 'Text', max: 300 }),
      button: cta,
    },
  },
  banner: {
    label: 'Banner',
    detail: 'A single line with an optional link',
    fields: {
      text: f.text({ label: 'Text', max: 200, required: true }),
      tone: f.select({ label: 'Tone', options: [
        { value: 'info', label: 'Neutral' },
        { value: 'success', label: 'Positive' },
        { value: 'warning', label: 'Attention' },
      ] }),
      link: f.optional(cta),
    },
  },
  imageText: {
    label: 'Image and text',
    detail: 'A picture beside a heading and text',
    fields: {
      title: f.text({ label: 'Heading', max: 120, required: true }),
      blocks: f.blocks({ label: 'Text', max: 20 }),
      image: f.media({ label: 'Image', accept: ['image'] }),
      imageSide: f.select({ label: 'Image side', options: [
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
      ] }),
      button: f.optional(cta),
    },
  },
  services: {
    label: 'Services',
    detail: 'The service cards from the catalogue, with your own heading',
    fields: {
      title: f.text({ label: 'Heading', max: 120 }),
      text: f.textarea({ label: 'Intro', max: 300 }),
    },
  },
  logos: {
    label: 'Logos',
    detail: 'A row of client or partner marks',
    fields: {
      title: f.text({ label: 'Heading', max: 120 }),
      items: f.list({ label: 'Logos', min: 1, max: 12, item: f.media({ label: 'Logo', accept: ['image'] }) }),
    },
  },
} as const satisfies Record<string, { label: string, detail: string, fields: FieldMap }>

export type SectionType = keyof typeof SECTION_DEFS

export const SECTION_TYPES = Object.keys(SECTION_DEFS) as SectionType[]

export type SectionProps<T extends SectionType> = InferMap<typeof SECTION_DEFS[T]['fields']>

export type Section = { [T in SectionType]: { id: string, type: T, hidden: boolean, props: SectionProps<T> } }[SectionType]

export const sectionIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/i, 'Letters, digits and dashes only')

/** One schema per type; the union is what a stored section list is checked against. */
export const sectionSchemas: Record<SectionType, z.ZodTypeAny> = Object.fromEntries(
  SECTION_TYPES.map(type => [type, z.object({
    id: sectionIdSchema,
    type: z.literal(type),
    hidden: z.boolean().default(false),
    props: mapToZod(SECTION_DEFS[type].fields),
  })]),
) as unknown as Record<SectionType, z.ZodTypeAny>

export const sectionSchema = z.discriminatedUnion('type', Object.values(sectionSchemas) as [z.ZodDiscriminatedUnionOption<'type'>, ...z.ZodDiscriminatedUnionOption<'type'>[]])

export const sectionsField = f.custom<Section[]>({
  kind: 'sections',
  label: 'Sections',
  hint: 'Top to bottom, as the page shows them. Hidden sections stay in the draft but are not published.',
  schema: z.array(sectionSchema).max(40),
})

export function isSectionType(value: unknown): value is SectionType {
  return typeof value === 'string' && value in SECTION_DEFS
}
