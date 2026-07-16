import { defineEventHandler } from 'h3'
import { requireAdmin } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

/**
 * GET /api/admin/settings — every Setting row, values JSON-parsed.
 * The client groups them by `group` for the Settings page sections.
 */

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const rows = await prisma.setting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] })

  return {
    settings: rows.map((row) => {
      let value: unknown = row.value
      try {
        value = JSON.parse(row.value)
      }
      catch {
        // Legacy/hand-edited plain-string value — pass through as-is.
      }
      return { key: row.key, value, group: row.group, updatedAt: row.updatedAt, updatedBy: row.updatedBy }
    }),
  }
})
