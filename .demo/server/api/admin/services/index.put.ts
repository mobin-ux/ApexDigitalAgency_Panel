import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { DEFAULT_CATALOG } from '../../../../shared/catalog'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * PUT /api/admin/services — save the Panel v2 catalogue (Setting `catalog.v2`,
 * ADR-019). Prices and copy are editable; the set of services, their kinds and
 * the plan ids are not, because orders, glyphs and the payment rules are keyed
 * on them — a renamed id would orphan every order placed under it. The figures
 * each kind needs are required here, so a fixed plan cannot be saved without a
 * deposit and the wizard can never price one at nothing by accident.
 */
const money = z.coerce.number().min(0).max(1_000_000)

const planSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(60),
  summary: z.string().trim().max(240).default(''),
  features: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
  featured: z.boolean().optional(),
  flag: z.string().trim().max(24).optional(),
  monthly: money.optional(),
  deposit: money.optional(),
  payments: z.coerce.number().int().min(1).max(36).optional(),
  setup: money.optional(),
  price: money.optional(),
  note: z.string().trim().max(60).optional(),
})

const serviceSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(80),
  line: z.string().trim().max(160).default(''),
  heading: z.string().trim().max(120).default(''),
  sub: z.string().trim().max(300).default(''),
  foot: z.string().trim().max(400).default(''),
  payments: z.coerce.number().int().min(1).max(36).optional(),
  minimumMonths: z.coerce.number().int().min(1).max(24).optional(),
  plans: z.array(planSchema).min(1).max(6),
})

const bodySchema = z.object({ services: z.array(serviceSchema).min(1).max(12) })

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'catalogue.edit')
  const { services } = await validateBody(event, bodySchema)

  const merged = DEFAULT_CATALOG.services.map((base) => {
    const edit = services.find(s => s.id === base.id)
    if (!edit) {
      throw createError({ statusCode: 400, message: `${base.name} is missing from the catalogue.` })
    }
    const plans = base.plans.map((bp) => {
      const p = edit.plans.find(x => x.id === bp.id)
      if (!p) {
        throw createError({ statusCode: 400, message: `${base.name}: the ${bp.name} plan is missing.` })
      }
      if (base.kind === 'fixed' && (!p.monthly || p.deposit === undefined)) {
        throw createError({ statusCode: 400, message: `${base.name} · ${p.name}: a monthly payment and a deposit are required.` })
      }
      if (base.kind === 'retainer' && !p.monthly) {
        throw createError({ statusCode: 400, message: `${base.name} · ${p.name}: a monthly fee is required.` })
      }
      if (base.kind === 'scope' && p.price === undefined) {
        throw createError({ statusCode: 400, message: `${base.name} · ${p.name}: a price is required (0 for free).` })
      }
      return { ...p, id: bp.id }
    })
    if (plans.filter(p => p.featured).length > 1) {
      throw createError({ statusCode: 400, message: `${base.name}: only one plan can be featured.` })
    }
    return { ...edit, id: base.id, slug: base.slug, kind: base.kind, plans }
  })

  const catalog = { version: 2 as const, services: merged }
  await prisma.setting.upsert({
    where: { key: 'catalog.v2' },
    create: { key: 'catalog.v2', value: JSON.stringify(catalog), group: 'catalog', updatedBy: admin.email },
    update: { value: JSON.stringify(catalog), group: 'catalog', updatedBy: admin.email },
  })

  await recordAudit(event, admin, {
    action: 'admin.services.update',
    targetType: 'Setting',
    metadata: { key: 'catalog.v2', services: merged.length, plans: merged.reduce((n, s) => n + s.plans.length, 0) },
  })
  return { status: 'success', catalog }
})
