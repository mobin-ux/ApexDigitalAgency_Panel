import { defineNitroPlugin } from 'nitropack/runtime'
import { createLogger } from '../utils/logger'
import prisma from '../utils/prisma'

/**
 * The audit log is append-only in the database (ADR-025): two triggers refuse
 * any UPDATE or DELETE on "AuditLog". Prisma does not manage triggers, and a
 * `prisma db push` that rebuilds the table drops them silently, so the panel
 * looks for them once at start-up and says so when they are gone. A warning,
 * not a refusal to start: the log is still written, it is only no longer
 * protected, and `docs/migrations/2026-11-admin-hardening.sql` restores it.
 */
const log = createLogger('startup')
const TRIGGERS = ['AuditLog_append_only_update', 'AuditLog_append_only_delete']

export default defineNitroPlugin(() => {
  void (async () => {
    try {
      const rows = await prisma.$queryRaw<{ name: string }[]>`SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'AuditLog'`
      const found = new Set(rows.map(r => r.name))
      const missing = TRIGGERS.filter(t => !found.has(t))
      if (missing.length) {
        log.warn('[audit-append-only] the audit log is not protected: run docs/migrations/2026-11-admin-hardening.sql', { missing })
      }
    }
    catch (error) {
      log.warn('[audit-append-only] could not check the audit log triggers', { error: (error as Error).message })
    }
  })()
})
