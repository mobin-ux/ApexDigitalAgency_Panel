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
