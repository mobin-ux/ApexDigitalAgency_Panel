import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * PUT /api/admin/settings — batch upsert of settings. Values are
 * JSON-stringified for storage (SQLite has no Json column) so strings,
 * numbers, booleans and small objects all round-trip. Audited with the
 * changed keys' before/after values.
 */

const bodySchema = z.object({
  settings: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(100).regex(/^[\w.-]+$/, 'Keys are dot/dash/word characters only'),
        value: z.union([z.string().max(5000), z.number(), z.boolean(), z.array(z.unknown()).max(200), z.record(z.string(), z.unknown())]),
        group: z.string().trim().min(1).max(50).default('general'),
      }),
    )
    .min(1)
    .max(100),
})

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'platform.settings')
  const { settings } = await validateBody(event, bodySchema)

  const keys = settings.map(s => s.key)
  const beforeRows = await prisma.setting.findMany({ where: { key: { in: keys } } })
  const before = Object.fromEntries(beforeRows.map(r => [r.key, r.value]))

  await prisma.$transaction(
    settings.map(s =>
      prisma.setting.upsert({
        where: { key: s.key },
        create: { key: s.key, value: JSON.stringify(s.value), group: s.group, updatedBy: admin.email },
        update: { value: JSON.stringify(s.value), group: s.group, updatedBy: admin.email },
      }),
    ),
  )

  // Only audit keys whose stored value actually changed.
  const changed = settings
    .filter(s => before[s.key] !== JSON.stringify(s.value))
    .map(s => ({ key: s.key, before: before[s.key] ?? null, after: JSON.stringify(s.value) }))

  if (changed.length > 0) {
    await recordAudit(event, admin, {
      action: 'admin.settings.update',
      targetType: 'Setting',
      metadata: { changed },
    })
  }

  return { status: 'success', updated: changed.length }
})
