import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { validateBody } from '../../utils/validate'

/**
 * PUT /api/settings/update-all — save the Settings page: profile fields
 * plus the one-to-one Company record (upserted). Email is deliberately
 * not updatable here — changing the login identity needs verification.
 */

const optionalTrimmed = (max: number) => z.string().trim().max(max).nullish()

const bodySchema = z.object({
  user: z
    .object({
      firstName: optionalTrimmed(100),
      lastName: optionalTrimmed(100),
      phone: optionalTrimmed(30),
      bio: optionalTrimmed(1000),
      gender: optionalTrimmed(30),
      avatar: optionalTrimmed(500),
      coverImage: optionalTrimmed(500),
      mailingAddress: z
        .object({
          city: optionalTrimmed(100),
          country: optionalTrimmed(100),
        })
        .nullish(),
    })
    .default({}),
  company: z
    .object({
      name: optionalTrimmed(200),
      email: optionalTrimmed(200),
      website: optionalTrimmed(300),
      phone: optionalTrimmed(30),
      taxId: optionalTrimmed(100),
      type: optionalTrimmed(100),
      income: optionalTrimmed(100),
      employees: optionalTrimmed(100),
      manager: optionalTrimmed(200),
      status: optionalTrimmed(50),
      notes: optionalTrimmed(2000),
      logo: optionalTrimmed(500),
    })
    .default({}),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const { user, company } = await validateBody(event, bodySchema)

  await prisma.user.update({
    where: { id: session.id },
    data: {
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      phone: user.phone ?? undefined,
      bio: user.bio ?? undefined,
      gender: user.gender ?? undefined,
      avatar: user.avatar ?? undefined,
      coverImage: user.coverImage ?? undefined,
      city: user.mailingAddress?.city ?? undefined,
      country: user.mailingAddress?.country ?? undefined,
    },
  })

  await prisma.company.upsert({
    where: { userId: session.id },
    update: {
      name: company.name || '',
      email: company.email ?? undefined,
      website: company.website ?? undefined,
      phone: company.phone ?? undefined,
      taxId: company.taxId ?? undefined,
      type: company.type ?? undefined,
      income: company.income ?? undefined,
      employees: company.employees ?? undefined,
      manager: company.manager ?? undefined,
      status: company.status ?? undefined,
      notes: company.notes ?? undefined,
      logo: company.logo ?? undefined,
    },
    create: {
      userId: session.id,
      name: company.name || 'My Company',
      email: company.email ?? undefined,
      website: company.website ?? undefined,
      phone: company.phone ?? undefined,
      type: company.type ?? undefined,
      status: 'Active',
    },
  })

  return { status: 'success', message: 'Settings saved successfully' }
})
