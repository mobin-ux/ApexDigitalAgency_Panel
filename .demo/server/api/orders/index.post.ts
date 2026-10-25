import { createError, defineEventHandler, getRequestHeader, getRequestIP } from 'h3'
import { z } from 'zod'
import { findPlan, findService, firstPaymentDate, orderTerms } from '../../../shared/catalog'
import { AGREEMENT_VERSION_V2, buildAgreementTextV2, hashAgreement } from '../../utils/agreement'
import { recordAudit } from '../../utils/audit'
import { requireAuth } from '../../utils/auth'
import { getCatalog } from '../../utils/catalog-v2'
import { nextContractReference } from '../../utils/contracts'
import { creditAllows, ensureCredit } from '../../utils/credit'
import { planIcon } from '../../utils/finance'
import prisma from '../../utils/prisma'
import { getSetting } from '../../utils/settings'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/orders — place an order from the Panel v2 New order wizard.
 *
 * The client names a service, a plan and (for fixed plans) whether to pay
 * monthly or in full; the shared catalogue prices it with the same
 * `orderTerms()` the wizard displayed (ADR-019). Nothing is charged here:
 * the project is created PENDING ("Awaiting kickoff") and the kickoff amount
 * — payment 1 of a fixed plan (or its deposit, where the catalogue sets one),
 * full price, set-up plus first month, or the discovery fee — is collected
 * when work starts (`/api/orders/pay`, or staff from the project screen).
 * Instalment plans are created `pending` for the same reason, so auto-pay
 * cannot take a monthly payment before the kickoff payment.
 *
 * Every order is signed: the signed agreement text is stored and hashed, as
 * before, and pushed to the admin panel.
 */

const bodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  serviceId: z.string().trim().min(1).max(40),
  planId: z.string().trim().min(1).max(60),
  pay: z.enum(['monthly', 'full']).default('monthly'),
  // The total the customer was shown. If the catalogue moved since the page
  // loaded, the order stops rather than signing them up to another figure.
  quotedTotal: z.coerce.number().min(0).optional(),
  // Drawn signature (data-URL PNG) or the typed full name.
  signature: z.string().trim().min(2).max(300_000),
  signatureType: z.enum(['drawn', 'typed']),
  signerName: z.string().trim().min(2).max(120).optional(),
  // The brief, already resolved to labels so the admin panel renders it as is.
  brief: z.array(z.object({
    label: z.string().trim().min(1).max(120),
    value: z.string().trim().min(1).max(2000),
  })).max(40).optional(),
  // Files the customer uploaded with the brief (`POST /api/uploads`).
  attachmentIds: z.array(z.string().uuid()).max(20).optional(),
})

const MILESTONES: Record<string, string[]> = {
  web: ['Kickoff call', 'Sitemap and wireframes', 'Design', 'Build', 'Content and SEO', 'Launch'],
  brand: ['Kickoff call', 'Directions', 'Refine', 'Roll out', 'Hand over'],
  uiux: ['Kickoff call', 'Research', 'Flows and prototype', 'Testing', 'Hand over'],
  retainer: ['Kickoff call', 'Audit', 'Strategy', 'Fix the foundations', 'Report and adjust'],
  call: ['Scoping call', 'Rough range and fit'],
  discovery: ['Kickoff call', 'Workshops', 'Clickable prototype', 'Specification and quote'],
}

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const body = await validateBody(event, bodySchema)

  const catalog = await getCatalog()
  const service = findService(catalog, body.serviceId)
  const plan = findPlan(service, body.planId)
  if (!service || !plan) {
    throw createError({ statusCode: 400, message: 'That plan is no longer on offer. Please choose a plan again.' })
  }
  const pay = service.kind === 'fixed' ? body.pay : 'monthly'
  const terms = orderTerms(service, plan, pay)
  if (body.quotedTotal !== undefined && Math.abs(body.quotedTotal - terms.total) >= 0.01) {
    throw createError({
      statusCode: 409,
      message: `The ${plan.name} plan now totals £${terms.total.toLocaleString('en-GB')}. Please check the new price before you sign.`,
    })
  }

  // Monthly payments on a fixed plan draw on the customer's Apex credit; a
  // retainer, a payment in full and discovery do not. One plan is allowed
  // without a credit line; more need one (`creditAllows`).
  if (terms.financed > 0) {
    const credit = await ensureCredit(session.id)
    if (credit.state === 'frozen') {
      throw createError({ statusCode: 403, message: 'Your Apex credit is on hold. Please contact support.' })
    }
    const refusal = creditAllows(credit, terms.financed)
    if (refusal) {
      throw createError({ statusCode: 400, message: refusal })
    }
  }

  // Uploads must be this customer's and not yet attached to anything.
  const attachmentIds = [...new Set(body.attachmentIds ?? [])]
  if (attachmentIds.length > 0) {
    const owned = await prisma.attachment.count({
      where: { id: { in: attachmentIds }, uploaderId: session.id, projectId: null, ticketMessageId: null },
    })
    if (owned !== attachmentIds.length) {
      throw createError({ statusCode: 400, message: 'One of the files is no longer available. Please add it again.' })
    }
  }

  const signedAt = new Date()
  const signedIp = getRequestIP(event, { xForwardedFor: true }) ?? null
  const signedUserAgent = (getRequestHeader(event, 'user-agent') ?? '').slice(0, 400) || null
  const signer = await prisma.user.findUnique({
    where: { id: session.id },
    select: { email: true, phone: true, firstName: true, lastName: true },
  })
  const signerContact = signer?.email || signer?.phone || '—'
  const accountName = [signer?.firstName, signer?.lastName].filter(Boolean).join(' ').trim()
  const printedName = (body.signerName || (body.signatureType === 'typed' ? body.signature : '') || accountName || signerContact).slice(0, 120)
  const agencyName = await getSetting('general.site-name', 'Apex Digital Agency')

  const payMode = service.kind === 'fixed' ? `fixed-${pay}` : service.kind
  const milestoneKey = service.kind === 'retainer' ? 'retainer' : service.kind === 'scope' ? plan.id : service.id
  const milestones = MILESTONES[milestoneKey] ?? ['Kickoff call', 'Delivery', 'Hand over']
  const hasPlan = (service.kind === 'fixed' && pay === 'monthly') || service.kind === 'retainer'

  const { project, contract } = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        name: body.title,
        category: service.name,
        amount: terms.total,
        status: 'PENDING',
        progress: 0,
        startDate: signedAt,
        userId: session.id,
        termMonths: terms.payments || null,
        signature: body.signature,
        signedAt,
        brief: body.brief?.length ? JSON.stringify(body.brief) : null,
        serviceId: service.id,
        planId: plan.id,
        planName: plan.name,
        payMode,
        kickoffAmount: terms.kickoff,
        milestones: {
          create: milestones.map((title, i) => ({ title, status: i === 0 ? 'CURRENT' : 'PENDING' })),
        },
        installmentPlan: hasPlan
          ? {
              create: {
                project: body.title,
                kind: service.kind === 'retainer' ? 'retainer' : 'fixed',
                total: terms.monthly * terms.payments,
                paid: 0,
                amountDue: terms.monthly,
                monthsTotal: terms.payments,
                monthsPaid: 0,
                // An estimate until the kickoff payment fixes the real date.
                nextDue: firstPaymentDate(signedAt),
                status: 'pending',
                icon: planIcon(service.name),
                monthlyAmount: terms.monthly,
                termMonths: terms.payments,
                interestRate: 0,
                depositAmount: terms.deposit,
                userId: session.id,
              },
            }
          : undefined,
      },
    })

    if (attachmentIds.length > 0) {
      await tx.attachment.updateMany({ where: { id: { in: attachmentIds }, uploaderId: session.id }, data: { projectId: created.id } })
    }

    const reference = await nextContractReference(tx)
    const agreementText = buildAgreementTextV2({
      agencyName,
      reference,
      serviceName: service.name,
      planName: plan.name,
      kind: service.kind,
      payInFull: pay === 'full',
      kickoff: terms.kickoff,
      deposit: terms.deposit,
      setup: terms.setup,
      monthly: terms.monthly,
      payments: terms.payments,
      minimumMonths: terms.minimumMonths,
      total: terms.total,
      signerName: printedName,
      signerContact,
      signedAt,
    })
    const contractRow = await tx.contract.create({
      data: {
        reference,
        status: 'ACTIVE',
        amount: terms.total,
        termMonths: terms.payments,
        interestRate: 0,
        monthlyAmount: terms.monthly,
        totalRepayable: terms.total,
        signature: body.signature,
        signedAt,
        signatureType: body.signatureType,
        signerName: printedName,
        signerEmail: signer?.email ?? null,
        signerPhone: signer?.phone ?? null,
        signedIp,
        signedUserAgent,
        documentVersion: AGREEMENT_VERSION_V2,
        documentHash: hashAgreement(agreementText),
        agreementText,
        userId: session.id,
        projectId: created.id,
      },
    })

    return { project: created, contract: contractRow }
  })

  if (terms.financed > 0) {
    await ensureCredit(session.id)
  }

  try {
    // A phone-only customer has no email; the audit row still needs a name.
    await recordAudit(event, { id: session.id, email: session.email ?? signerContact }, {
      action: 'contract.created',
      targetType: 'Contract',
      targetId: contract.id,
      metadata: {
        reference: contract.reference,
        projectId: project.id,
        project: project.name,
        service: service.name,
        plan: plan.name,
        payMode,
        kickoff: terms.kickoff,
        total: terms.total,
      },
    })
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(a => ({
          userId: a.id,
          title: 'New order signed',
          message: `${contract.reference}: ${project.name} · ${service.name}, ${plan.name}. Book the kickoff call.`,
          type: 'INFO',
          link: `/admin/projects/${project.id}`,
        })),
      })
    }
  }
  catch {
    // Best effort: the Contract row is the record, not the fan-out.
  }

  return { status: 'success', project: { id: project.id, name: project.name }, contract: { id: contract.id, reference: contract.reference } }
})
