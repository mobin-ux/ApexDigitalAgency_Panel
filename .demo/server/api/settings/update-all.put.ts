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
      // `Company.address` has existed in the schema since the beginning but was
      // never written here, so the Settings page had nowhere to put a business
      // address — which is why Wallet's "add your billing address in Settings"
      // pointed at a field that did not exist. Purely additive: no migration,
      // no change to any field already handled.
      address: optionalTrimmed(300),
      type: optionalTrimmed(100),
      income: optionalTrimmed(100),
      employees: optionalTrimmed(100),
      manager: optionalTrimmed(200),
      status: optionalTrimmed(50),
      notes: optionalTrimmed(2000),
      logo: optionalTrimmed(500),
    })
    /*
     * Optional, not `.default({})`. The mobile Settings page saves one section
     * at a time (V2 Phase 7 mobile, §13), so a profile save sends no `company`
     * key at all — and with a default the upsert still ran, creating a
     * "My Company" row for an account that has none. Omitting the key now means
     * "don't touch the company record"; sending it means what it always did.
     */
    .optional(),
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

  if (!company) {
    return { status: 'success', message: 'Settings saved successfully' }
  }

  await prisma.company.upsert({
    where: { userId: session.id },
    update: {
      /*
       * `?? undefined` like every other column, so a payload that omits the
       * name leaves it alone. It used to be `company.name || ''`, which meant a
       * partial save — Billing sending only a VAT number — would blank the
       * registered company name. An explicit empty string still clears it,
       * because `''` is not nullish.
       */
      name: company.name ?? undefined,
      email: company.email ?? undefined,
      website: company.website ?? undefined,
      phone: company.phone ?? undefined,
      taxId: company.taxId ?? undefined,
      address: company.address ?? undefined,
      type: company.type ?? undefined,
      income: company.income ?? undefined,
      employees: company.employees ?? undefined,
      manager: company.manager ?? undefined,
      status: company.status ?? undefined,
      notes: company.notes ?? undefined,
      logo: company.logo ?? undefined,
    },
    /*
     * The create branch has to accept everything the update branch does.
     * It used to take only name/email/website/phone/type, so a customer with
     * no company row yet silently lost their VAT number, address and notes on
     * their very first save — and got them to stick only on the second. The
     * fields are validated identically either way; only `status` is forced,
     * because a new record starts Active and customers do not set it.
     */
    create: {
      userId: session.id,
      name: company.name || 'My Company',
      email: company.email ?? undefined,
      website: company.website ?? undefined,
      phone: company.phone ?? undefined,
      taxId: company.taxId ?? undefined,
      address: company.address ?? undefined,
      type: company.type ?? undefined,
      income: company.income ?? undefined,
      employees: company.employees ?? undefined,
      manager: company.manager ?? undefined,
      notes: company.notes ?? undefined,
      logo: company.logo ?? undefined,
      status: 'Active',
    },
  })

  return { status: 'success', message: 'Settings saved successfully' }
})
