import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { validateBody } from '../../utils/validate'

/**
 * PUT /api/settings/profile — quick name/email update used by the
 * legacy Settings page. The page sends a single `name`; the schema
 * stores firstName/lastName, so we split on the first space (the old
 * version wrote a nonexistent `name` column and crashed).
 */

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email(),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const { name, email } = await validateBody(event, bodySchema)

  const [firstName, ...rest] = name.split(' ').filter(Boolean)
  const lastName = rest.join(' ') || null

  try {
    const updatedUser = await prisma.user.update({
      where: { id: session.id },
      data: { firstName, lastName, email },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    })

    return {
      status: 'success',
      user: {
        ...updatedUser,
        // Legacy consumers still read a combined `name`.
        name: [updatedUser.firstName, updatedUser.lastName].filter(Boolean).join(' '),
      },
    }
  }
  catch {
    // Unique-constraint violation on email.
    throw createError({ statusCode: 409, message: 'Email already in use' })
  }
})
