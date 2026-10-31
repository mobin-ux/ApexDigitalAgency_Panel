import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { APPLICANT_ROLES, BUSINESS_TYPES, CREDIT_REQUEST_MIN, CREDIT_REQUEST_STEP, creditRef, dobProblem, isPostcode, TURNOVER_BANDS } from '../../../shared/credit'
import { recordAudit } from '../../utils/audit'
import { requireAuth } from '../../utils/auth'
import { creditLimit, ensureCredit } from '../../utils/credit'
import prisma from '../../utils/prisma'
import { rateLimit, RateLimits } from '../../utils/ratelimit'
import { getSetting } from '../../utils/settings'
import { unclaimedBy } from '../../utils/uploads'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/credit/application — apply for an Apex credit line
 * (Wallet.dc.html). Staff decide it; nothing is granted here.
 *
 * The photo ID and bank statements arrive first through `POST /api/uploads`
 * and are claimed here, so they must be the caller's own, unattached uploads.
 * One application at a time, and none while a line is already in place.
 */
const text = (max: number) => z.string().trim().min(1).max(max)

const bodySchema = z.object({
  businessType: z.enum(BUSINESS_TYPES.map(b => b[0]) as [string, ...string[]]),
  companyNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}$/, 'Company numbers are eight characters').optional(),
  companyName: z.string().trim().max(160).optional(),
  tradingName: z.string().trim().max(160).optional(),
  businessPostcode: z.string().trim().toUpperCase().max(8).optional(),
  turnover: z.enum(TURNOVER_BANDS),
  firstName: text(80),
  lastName: text(80),
  dateOfBirth: z.string().trim(),
  role: z.enum(APPLICANT_ROLES),
  homeAddress: text(300),
  requestedLimit: z.number().int().min(CREDIT_REQUEST_MIN),
  idAttachmentId: z.string().uuid(),
  statementIds: z.array(z.string().uuid()).min(1).max(6),
  consentTrue: z.literal(true),
  consentChecks: z.literal(true),
}).strict()

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.mutation, bucket: 'credit-apply', identity: session.id })
  if ((await getSetting('credit.applications-open', true)) === false) {
    throw createError({ statusCode: 409, message: 'Credit applications are closed at the moment. You can still order one plan at a time.' })
  }
  const body = await validateBody(event, bodySchema)

  const isCompany = body.businessType !== 'sole'
  const fieldErrors: Record<string, string[]> = {}
  if (isCompany && (!body.companyNumber || !body.companyName)) {
    fieldErrors.companyNumber = ['Choose your company, or enter its name and number']
  }
  if (!isCompany && !body.tradingName) {
    fieldErrors.tradingName = ['Add your trading name']
  }
  if (!isCompany && !isPostcode(body.businessPostcode ?? '')) {
    fieldErrors.businessPostcode = ['Add your business postcode']
  }
  const dob = dobProblem(body.dateOfBirth)
  if (dob) {
    fieldErrors.dateOfBirth = [dob]
  }
  const ceiling = await creditLimit()
  if (body.requestedLimit > Math.max(CREDIT_REQUEST_MIN, ceiling) || body.requestedLimit % CREDIT_REQUEST_STEP !== 0) {
    fieldErrors.requestedLimit = [`Choose an amount from £${CREDIT_REQUEST_MIN.toLocaleString('en-GB')} to £${ceiling.toLocaleString('en-GB')}`]
  }
  if (Object.keys(fieldErrors).length) {
    throw createError({ statusCode: 400, message: 'Check the highlighted answers.', data: { fieldErrors } })
  }

  const credit = await ensureCredit(session.id)
  if (credit.state === 'approved' || credit.state === 'frozen') {
    throw createError({ statusCode: 409, message: 'You already have a credit line. To change its limit, message us from Support.' })
  }
  if (credit.state === 'review') {
    throw createError({ statusCode: 409, message: 'Your application is already with us. You can follow it from your Wallet.' })
  }

  const fileIds = [...new Set([body.idAttachmentId, ...body.statementIds])]
  const created = await prisma.$transaction(async (tx) => {
    const app = await tx.creditApplication.create({
      data: {
        userId: session.id,
        businessType: body.businessType,
        companyNumber: isCompany ? body.companyNumber : null,
        companyName: isCompany ? body.companyName : null,
        tradingName: isCompany ? null : body.tradingName,
        businessPostcode: isCompany ? null : body.businessPostcode,
        turnover: body.turnover,
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: body.dateOfBirth,
        role: body.role,
        homeAddress: body.homeAddress,
        requestedLimit: body.requestedLimit,
        idAttachmentId: body.idAttachmentId,
      },
    })
    const claimed = await tx.attachment.updateMany({
      where: { id: { in: fileIds }, ...unclaimedBy(session.id) },
      data: { creditApplicationId: app.id },
    })
    if (claimed.count !== fileIds.length) {
      throw createError({ statusCode: 400, message: 'One of your files is no longer available. Please add it again.' })
    }
    return app
  })

  await notify({
    userIds: [session.id],
    title: 'Credit application received',
    message: `We are checking your business details for ${creditRef(created.id)}. We will update your Wallet with our decision.`,
    type: 'INFO',
    link: '/dashboards/wallet?credit=status',
  })
  await recordAudit(event, { id: session.id, email: session.email ?? session.id }, {
    action: 'credit.applied',
    targetType: 'CreditApplication',
    targetId: created.id,
    metadata: { requestedLimit: created.requestedLimit, businessType: created.businessType, files: fileIds.length },
  })

  return { application: { id: created.id, ref: creditRef(created.id), status: created.status, submittedAt: created.submittedAt } }
})
