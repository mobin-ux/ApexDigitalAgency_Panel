import { z } from 'zod'

/**
 * Shared conventions for list endpoints: a bounded pagination query
 * and a stable response envelope, so every paginated API in the app
 * looks the same to the front-end.
 */

/** `?page=&pageSize=` — 1-based, defaults 1/20, pageSize capped at 100. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export interface PageParams {
  page: number
  pageSize: number
}

/** Prisma-ready offsets for a validated page request. */
export function toSkipTake({ page, pageSize }: PageParams): { skip: number, take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize }
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type SortDir = 'asc' | 'desc'

/**
 * `?sort=&dir=` over a list's own whitelist of columns (ADR-025). An unknown
 * column is a 400 from the schema, never a raw field name handed to Prisma.
 */
export function sortQuerySchema<K extends string>(keys: readonly [K, ...K[]]) {
  return z.object({
    sort: z.enum(keys).optional(),
    dir: z.enum(['asc', 'desc']).optional(),
  })
}

/**
 * The Prisma `orderBy` for a validated sort: the column's ordering, then the
 * id in the same direction, so rows that tie keep a stable order across
 * pages and nothing repeats or goes missing between page 1 and page 2.
 */
export function orderFor<O>(
  columns: Record<string, (dir: SortDir) => O>,
  sort: string | undefined,
  dir: SortDir | undefined,
  fallback: { sort: string, dir: SortDir },
): O[] {
  const key = sort && columns[sort] ? sort : fallback.sort
  const direction = dir ?? (sort ? 'asc' : fallback.dir)
  // Every model here keys on `id`, so the tiebreak fits the same order type.
  return [columns[key]!(direction), { id: direction } as O]
}

/** Standard list-response envelope. */
export function paginated<T>(items: T[], total: number, { page, pageSize }: PageParams): Paginated<T> {
  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}
