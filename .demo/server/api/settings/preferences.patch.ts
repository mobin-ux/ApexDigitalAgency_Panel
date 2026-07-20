import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { validateBody } from '../../utils/validate'

/** PATCH /api/settings/preferences — persisted account toggles (auto-pay, …). */

const bodySchema = z
  .object({
    autoPayInstallments: z.boolean().optional(),
  })
  .strict()
  .refine(data => Object.keys(data).length > 0, { message: 'At least one preference must be provided' })

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const updates = await validateBody(event, bodySchema)

  const user = await prisma.user.update({
    where: { id: session.id },
    data: updates,
    select: { autoPayInstallments: true },
  })

  return { status: 'success', preferences: user }
})
