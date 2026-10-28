import { z } from 'zod'

/**
 * Rich text, as structured blocks.
 *
 * The site never renders stored HTML: a document's prose is a list of typed
 * blocks that the article page already knows how to draw (`ArticleBlock` in
 * `app/data/articles.ts`), plus `heading` and `bullets` for pages that are
 * not articles. Every string is plain text; the renderer escapes it.
 */

const text = (max: number) => z.string().trim().min(1).max(max)

export const blockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('heading'), text: text(160), level: z.union([z.literal(2), z.literal(3)]).default(2) }),
  z.object({ kind: z.literal('paragraph'), text: text(4000) }),
  z.object({ kind: z.literal('bullets'), items: z.array(text(600)).min(1).max(30) }),
  z.object({ kind: z.literal('note'), text: text(1200) }),
  z.object({ kind: z.literal('quote'), text: text(1200), by: z.string().trim().max(160).default('') }),
  z.object({
    kind: z.literal('checklist'),
    items: z.array(z.object({ lead: z.string().trim().max(120).optional(), text: text(600) })).min(1).max(30),
  }),
  z.object({
    kind: z.literal('costs'),
    items: z.array(z.object({ label: text(120), value: text(60) })).min(1).max(20),
  }),
  z.object({
    kind: z.literal('table'),
    caption: text(200),
    columns: z.tuple([text(60), text(60), text(60)]),
    rows: z.array(z.object({
      label: text(120),
      detail: z.string().trim().max(240).optional(),
      values: z.tuple([z.string().trim().max(80), z.string().trim().max(80)]),
    })).min(1).max(40),
  }),
])

export type Block = z.infer<typeof blockSchema>

export const BLOCK_KINDS = ['heading', 'paragraph', 'bullets', 'note', 'quote', 'checklist', 'costs', 'table'] as const

export type BlockKind = typeof BLOCK_KINDS[number]

/** An empty, valid block of each kind — what the editor inserts. */
export function emptyBlock(kind: BlockKind): Block {
  switch (kind) {
    case 'heading':
      return { kind, text: 'Heading', level: 2 }
    case 'paragraph':
      return { kind, text: 'Text' }
    case 'bullets':
      return { kind, items: ['Point'] }
    case 'note':
      return { kind, text: 'Note' }
    case 'quote':
      return { kind, text: 'Quote', by: '' }
    case 'checklist':
      return { kind, items: [{ text: 'Item' }] }
    case 'costs':
      return { kind, items: [{ label: 'Item', value: '£0' }] }
    case 'table':
      return { kind, caption: 'Table', columns: ['Item', 'Low', 'High'], rows: [{ label: 'Row', values: ['', ''] }] }
  }
}
