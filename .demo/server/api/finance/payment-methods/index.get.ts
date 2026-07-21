import { defineEventHandler } from 'h3'
import { requireAuth } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

/**
 * GET /api/finance/payment-methods — the customer's saved instruments.
 *
 * Returns display metadata only. There is nothing sensitive to withhold
 * because nothing sensitive is stored: the provider token is the only
 * secret-ish field and it is useless without our API credentials, but it
 * is still omitted — the client never needs it.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)

  const methods = await prisma.paymentMethod.findMany({
    where: { userId: session.id, status: 'active' },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      provider: true,
      kind: true,
      brand: true,
      last4: true,
      expMonth: true,
      expYear: true,
      accountHolder: true,
      mandateStatus: true,
      isDefault: true,
      createdAt: true,
    },
  })

  const now = new Date()
  return {
    methods: methods.map(method => ({
      ...method,
      // Direct debit is only chargeable once the mandate is active; the UI
      // needs to distinguish "added" from "usable".
      usable: method.kind === 'bacs_debit'
        ? method.mandateStatus === 'active'
        : !isExpired(method, now),
      expired: isExpired(method, now),
      label: describe(method),
    })),
  }
})

function isExpired(method: { expMonth: number | null, expYear: number | null }, now: Date): boolean {
  if (!method.expMonth || !method.expYear) {
    return false
  }
  // A card is valid through the LAST day of its expiry month.
  const expiry = new Date(method.expYear, method.expMonth, 1)
  return expiry <= now
}

function describe(method: { kind: string, brand: string | null, last4: string | null }): string {
  const brand = method.brand ?? (method.kind === 'bacs_debit' ? 'Bank account' : 'Card')
  return method.last4 ? `${brand} •••• ${method.last4}` : brand
}
