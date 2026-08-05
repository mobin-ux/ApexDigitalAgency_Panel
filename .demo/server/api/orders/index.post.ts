import { createError, defineEventHandler, getRequestHeader, getRequestIP } from 'h3'
import { z } from 'zod'
import { AGREEMENT_VERSION, buildAgreementText, hashAgreement } from '../../utils/agreement'
import { recordAudit } from '../../utils/audit'
import { requireAuth } from '../../utils/auth'
import { nextContractReference } from '../../utils/contracts'
import { ensureCredit } from '../../utils/credit'
import { planFor, planIcon } from '../../utils/finance'
import prisma from '../../utils/prisma'
import { getSetting } from '../../utils/settings'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/orders — create a PENDING project from the New Order wizard,
 * financed against the customer's instant Apex credit facility.
 *
 * Flow (2026 strategy — no credit application, no manager approval):
 *  1. The project amount is checked against available Apex credit (≤ £20,000).
 *  2. Project + real Installment plan (ADR-011 math, computed here — never
 *     trusted from the client) + a signed Contract are created atomically.
 *  3. The contract is pushed to the admin panel (audit trail + admin
 *     notifications) so administrators see every agreement as it is signed.
 *
 * First installment is due `finance.first-installment-days` after creation
 * (Setting, default 30 — "£0 today").
 */

const bodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  budget: z.coerce.number().min(0).default(0),
  termMonths: z.union([z.literal(12), z.literal(24)]).default(12),
  // Drawn signature (data-URL PNG, ~10-100KB) or typed full name.
  signature: z.string().max(300_000).optional(),
  // How the signature was captured, and the signatory's printed legal name.
  signatureType: z.enum(['drawn', 'typed']).optional(),
  signerName: z.string().trim().min(2).max(120).optional(),
  // Client brief: the wizard's service-specific detail answers, already
  // resolved to human labels so the admin panel can render them generically.
  brief: z.array(z.object({
    label: z.string().trim().min(1).max(120),
    value: z.string().trim().min(1).max(2000),
  })).max(40).optional(),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const { title, category, budget, termMonths, signature, signatureType, signerName, brief } = await validateBody(event, bodySchema)

  if (termMonths === 24) {
    const enabled = await getSetting('finance.enable-24mo-plans', true)
    if (!enabled) {
      throw createError({ statusCode: 400, message: 'The 24-month plan is currently unavailable. Please choose 12 months.' })
    }
  }

  // --- Credit gate: financed projects draw on the instant Apex facility ------
  const financed = budget > 0
  if (financed) {
    const credit = await ensureCredit(session.id)
    if (credit.status === 'FROZEN') {
      throw createError({ statusCode: 403, message: 'Your Apex credit is currently on hold. Please contact support.' })
    }
    if (budget > credit.available) {
      throw createError({
        statusCode: 400,
        message: `This project (£${budget.toLocaleString('en-GB')}) exceeds your available Apex credit of £${credit.available.toLocaleString('en-GB')}. Reduce the scope or repay an existing plan first.`,
      })
    }
  }

  const firstDueDays = await getSetting('finance.first-installment-days', 30)
  const financing = planFor(budget, termMonths)
  const signedAt = new Date()
  const nextDue = new Date(signedAt.getTime() + firstDueDays * 24 * 60 * 60 * 1000)
  const monthly = Math.round(financing.monthlyAmount * 100) / 100
  const totalRepayable = Math.round(financing.totalAmount * 100) / 100
  const briefJson = brief && brief.length > 0 ? JSON.stringify(brief) : null

  // --- Electronic-signature evidence (see utils/agreement.ts for the legal
  // rationale). Captured server-side so it can't be spoofed by the client. ---
  const signedIp = getRequestIP(event, { xForwardedFor: true }) ?? null
  const signedUserAgent = (getRequestHeader(event, 'user-agent') ?? '').slice(0, 400) || null
  const signer = await prisma.user.findUnique({
    where: { id: session.id },
    select: { email: true, phone: true, firstName: true, lastName: true },
  })
  const signerContact = signer?.email || signer?.phone || '—'
  const accountName = [signer?.firstName, signer?.lastName].filter(Boolean).join(' ').trim()
  // Printed legal name: the value the customer typed, else their account name.
  const printedName = (signerName || accountName || signerContact).slice(0, 120)
  const agencyName = await getSetting('general.site-name', 'Apex Digital Agency')
  const vatRate = await getSetting('business.vat-rate', 20)

  // Project + installment plan + contract commit together (or not at all).
  const { project, contract } = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        name: title,
        category,
        amount: budget,
        status: 'PENDING',
        progress: 0,
        startDate: new Date(),
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        userId: session.id,
        termMonths,
        signature: signature ?? null,
        signedAt: signature ? signedAt : null,
        brief: briefJson,
        milestones: {
          create: [
            { title: 'Order Review', status: 'PENDING' },
            { title: 'Requirements', status: 'PENDING' },
            { title: 'Development', status: 'PENDING' },
            { title: 'Delivery', status: 'PENDING' },
          ],
        },
        installmentPlan: financed
          ? {
              create: {
                project: title,
                total: totalRepayable,
                paid: 0,
                amountDue: monthly,
                monthsTotal: termMonths,
                monthsPaid: 0,
                nextDue,
                status: 'active',
                icon: planIcon(category),
                monthlyAmount: monthly,
                termMonths,
                interestRate: financing.interestRate,
                userId: session.id,
              },
            }
          : undefined,
      },
      include: { installmentPlan: true },
    })

    let contractRow = null
    if (financed) {
      const reference = await nextContractReference(tx)
      // Build the exact agreed text with the real reference, then hash it —
      // the immutable, tamper-evident legal record of what was signed.
      const agreementText = buildAgreementText({
        agencyName,
        vatRate,
        reference,
        serviceName: category,
        planName: title,
        amount: budget,
        termMonths,
        interestRate: financing.interestRate,
        monthlyAmount: monthly,
        totalRepayable,
        firstDueDays,
        signerName: printedName,
        signerContact,
        signedAt,
      })
      contractRow = await tx.contract.create({
        data: {
          reference,
          status: 'ACTIVE',
          amount: budget,
          termMonths,
          interestRate: financing.interestRate,
          monthlyAmount: monthly,
          totalRepayable,
          signature: signature ?? null,
          signedAt,
          // --- Electronic-signature legal record ---
          signatureType: signatureType ?? (signature ? (signature.startsWith('data:image') ? 'drawn' : 'typed') : null),
          signerName: printedName,
          signerEmail: signer?.email ?? null,
          signerPhone: signer?.phone ?? null,
          signedIp,
          signedUserAgent,
          documentVersion: AGREEMENT_VERSION,
          documentHash: hashAgreement(agreementText),
          agreementText,
          userId: session.id,
          projectId: created.id,
        },
      })
    }

    return { project: created, contract: contractRow }
  })

  // Refresh the derived credit usage now the new plan exists.
  if (financed) {
    await ensureCredit(session.id)
  }

  // Push the signed contract to the admin panel: audit trail + admin inbox.
  if (contract) {
    try {
      await recordAudit(event, { id: session.id, email: session.email }, {
        action: 'contract.created',
        targetType: 'Contract',
        targetId: contract.id,
        metadata: {
          reference: contract.reference,
          projectId: project.id,
          project: project.name,
          amount: contract.amount,
          termMonths: contract.termMonths,
          monthlyAmount: contract.monthlyAmount,
        },
      })

      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map(a => ({
            userId: a.id,
            title: 'New contract signed',
            message: `${contract.reference}: ${project.name} — £${contract.amount.toLocaleString('en-GB')} over ${contract.termMonths} months.`,
            type: 'INFO',
            link: `/admin/contracts/${contract.id}`,
          })),
        })
      }
    }
    catch {
      // Best-effort notification — never fail the order because the admin
      // fan-out hiccuped. The Contract row itself is the source of truth.
    }
  }

  return { status: 'success', project, contract }
})
