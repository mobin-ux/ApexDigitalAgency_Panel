import type { H3Event } from 'h3'
import type { z } from 'zod'
import { createError, getQuery, readBody } from 'h3'

/**
 * Zod-backed request validation. Handlers receive fully-typed data or
 * the client receives a structured 400 — no ad-hoc null checks.
 *
 * Error shape (stable contract for the front-end):
 *   { statusCode: 400, statusMessage: 'Validation failed',
 *     data: { fieldErrors: { field: [messages] }, formErrors: [messages] } }
 */

function validationError(error: z.ZodError): never {
  const { fieldErrors, formErrors } = error.flatten()
  throw createError({
    statusCode: 400,
    statusMessage: 'Validation failed',
    message: 'Validation failed',
    data: { fieldErrors, formErrors },
  })
}

/** Parse + validate the JSON body. A missing/non-JSON body fails validation, not with a 500. */
export async function validateBody<T extends z.ZodTypeAny>(event: H3Event, schema: T): Promise<z.infer<T>> {
  const body = await readBody(event).catch(() => undefined)
  const result = schema.safeParse(body)
  if (!result.success) {
    validationError(result.error)
  }
  return result.data
}

/** Validate query-string parameters (all values arrive as strings — use z.coerce for numbers). */
export function validateQuery<T extends z.ZodTypeAny>(event: H3Event, schema: T): z.infer<T> {
  const result = schema.safeParse(getQuery(event))
  if (!result.success) {
    validationError(result.error)
  }
  return result.data
}
