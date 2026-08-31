import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * PUT /api/admin/services — replace the New Order catalogue. Writes the
 * `catalog.services` ({ services, plans }) and `catalog.from-prices` Setting
 * rows that `/api/config` serves to customers, so edits appear on the customer
 * New Order wizard immediately. Fully validated and audited.
 */

const planSchema = z.object({
  id: z.string().trim().min(1).max(60).regex(/^[\w-]+$/, 'Plan id: letters, numbers, dashes'),
  name: z.string().trim().min(1).max(80),
  base: z.coerce.number().min(0).max(1_000_000),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  popular: z.boolean().optional(),
  desc: z.string().trim().max(400).default(''),
  features: z.array(z.string().trim().min(1).max(200)).max(24).default([]),
})

const serviceSchema = z.object({
  id: z.string().trim().min(1).max(40).regex(/^[a-z0-9-]+$/, 'Service id: lowercase letters, numbers, dashes'),
  name: z.string().trim().min(1).max(80),
  desc: z.string().trim().max(300).default(''),
  icon: z.string().trim().min(1).max(60),
  tone: z.string().trim().min(1).max(160),
})

const bodySchema = z.object({
  services: z.array(serviceSchema).min(1).max(30),
  plans: z.record(z.string(), z.array(planSchema).max(12)),
  fromPrices: z.record(z.string(), z.coerce.number().min(0).max(1_000_000)).default({}),
})

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'catalogue.edit')
  const { services, plans, fromPrices } = await validateBody(event, bodySchema)

  // Every service must have at least one plan, and plan ids must be unique
  // within a service — the New Order wizard shows plans per selected service.
  const serviceIds = new Set(services.map(s => s.id))
  if (serviceIds.size !== services.length) {
    throw createError({ statusCode: 400, message: 'Duplicate service id — each service needs a unique id.' })
  }
  for (const service of services) {
    const servicePlans = plans[service.id] ?? []
    if (servicePlans.length === 0) {
      throw createError({ statusCode: 400, message: `“${service.name}” needs at least one plan.` })
    }
    const planIds = new Set(servicePlans.map(p => p.id))
    if (planIds.size !== servicePlans.length) {
      throw createError({ statusCode: 400, message: `“${service.name}” has duplicate plan ids.` })
    }
  }

  // Only keep plan groups for services that still exist.
  const cleanedPlans: Record<string, unknown> = {}
  for (const service of services) {
    cleanedPlans[service.id] = plans[service.id] ?? []
  }

  const catalog = { services, plans: cleanedPlans }

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: 'catalog.services' },
      create: { key: 'catalog.services', value: JSON.stringify(catalog), group: 'catalog', updatedBy: admin.email },
      update: { value: JSON.stringify(catalog), group: 'catalog', updatedBy: admin.email },
    }),
    prisma.setting.upsert({
      where: { key: 'catalog.from-prices' },
      create: { key: 'catalog.from-prices', value: JSON.stringify(fromPrices), group: 'catalog', updatedBy: admin.email },
      update: { value: JSON.stringify(fromPrices), group: 'catalog', updatedBy: admin.email },
    }),
  ])

  await recordAudit(event, admin, {
    action: 'admin.services.update',
    targetType: 'Setting',
    metadata: { services: services.length, plans: Object.values(cleanedPlans).reduce((n, p: any) => n + p.length, 0) },
  })

  return { status: 'success', services: services.length }
})
