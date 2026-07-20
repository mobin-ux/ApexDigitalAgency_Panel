import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { planFor, planIcon } from '../../utils/finance'
import prisma from '../../utils/prisma'
import { getSetting } from '../../utils/settings'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/orders — create a PENDING project from the New Order wizard,
 * together with its real financing plan (ADR-011 math, computed here —
 * never trusted from the client) and the signed contract.
 *
 * First installment is due `finance.first-installment-days` after
 * creation (Setting, default 30 — "£0 today").
 */

const bodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  budget: z.coerce.number().min(0).default(0),
  termMonths: z.union([z.literal(12), z.literal(24)]).default(12),
  // Drawn signature (data-URL PNG, ~10-100KB) or typed full name.
  signature: z.string().max(300_000).optional(),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const { title, category, budget, termMonths, signature } = await validateBody(event, bodySchema)

  if (termMonths === 24) {
    const enabled = await getSetting('finance.enable-24mo-plans', true)
    if (!enabled) {
      throw createError({ statusCode: 400, message: 'The 24-month plan is currently unavailable. Please choose 12 months.' })
    }
  }

  const firstDueDays = await getSetting('finance.first-installment-days', 30)
  const financing = planFor(budget, termMonths)
  const nextDue = new Date(Date.now() + firstDueDays * 24 * 60 * 60 * 1000)

  const newProject = await prisma.project.create({
    data: {
      name: title,
      category,
      amount: budget,
      status: 'PENDING',
      progress: 0,
      startDate: new Date(),
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // default 2-week deadline
      userId: session.id,
      termMonths,
      signature: signature ?? null,
      signedAt: signature ? new Date() : null,
      // Default milestones so the order timeline renders immediately.
      milestones: {
        create: [
          { title: 'Order Review', status: 'PENDING' },
          { title: 'Requirements', status: 'PENDING' },
          { title: 'Development', status: 'PENDING' },
          { title: 'Delivery', status: 'PENDING' },
        ],
      },
      // The real payment schedule (replaces ADR-010's derived plans).
      installmentPlan: budget > 0
        ? {
            create: {
              project: title,
              total: Math.round(financing.totalAmount * 100) / 100,
              paid: 0,
              amountDue: Math.round(financing.monthlyAmount * 100) / 100,
              monthsTotal: termMonths,
              monthsPaid: 0,
              nextDue,
              status: 'active',
              icon: planIcon(category),
              monthlyAmount: Math.round(financing.monthlyAmount * 100) / 100,
              termMonths,
              interestRate: financing.interestRate,
              userId: session.id,
            },
          }
        : undefined,
    },
    include: { installmentPlan: true },
  })

  return { status: 'success', project: newProject }
})
