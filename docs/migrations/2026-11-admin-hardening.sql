-- Admin console phase 3 (ADR-025): indexes for the admin lists, and an
-- append-only audit log enforced by the database. Additive: nothing is
-- dropped or rewritten, and every statement is safe to run twice.
--
-- Apply with the panel stopped, after a backup:
--   cp /opt/apex/dev.db /opt/apex/backups/dev.db.$(date +%Y%m%d-%H%M%S).pre-admin-hardening
--   sqlite3 /opt/apex/dev.db < 2026-11-admin-hardening.sql

BEGIN;

-- Directory and inbox orderings and filters (server-side sort, ADR-025).
CREATE INDEX IF NOT EXISTS "Project_status_updatedAt_idx" ON "Project"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Project_userId_idx" ON "Project"("userId");
CREATE INDEX IF NOT EXISTS "Project_managerId_idx" ON "Project"("managerId");
CREATE INDEX IF NOT EXISTS "Ticket_status_updatedAt_idx" ON "Ticket"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Ticket_userId_idx" ON "Ticket"("userId");
CREATE INDEX IF NOT EXISTS "Ticket_assigneeId_idx" ON "Ticket"("assigneeId");
CREATE INDEX IF NOT EXISTS "User_role_createdAt_idx" ON "User"("role", "createdAt");
CREATE INDEX IF NOT EXISTS "Transaction_type_createdAt_idx" ON "Transaction"("type", "createdAt");

-- The audit log is append-only. No route updates or deletes a row; these
-- make the database refuse it too, so neither a bug nor someone with the
-- application's credentials can rewrite who did what. Prisma does not manage
-- triggers: a `prisma db push` that rebuilds "AuditLog" drops them, which the
-- panel reports at start-up (server/plugins/audit-guard.ts) — re-run this file.
CREATE TRIGGER IF NOT EXISTS "AuditLog_append_only_update"
BEFORE UPDATE ON "AuditLog"
BEGIN
  SELECT RAISE(ABORT, 'AuditLog is append-only');
END;

CREATE TRIGGER IF NOT EXISTS "AuditLog_append_only_delete"
BEFORE DELETE ON "AuditLog"
BEGIN
  SELECT RAISE(ABORT, 'AuditLog is append-only');
END;

COMMIT;

-- Rollback (panel stopped):
--   BEGIN;
--   DROP TRIGGER IF EXISTS "AuditLog_append_only_update";
--   DROP TRIGGER IF EXISTS "AuditLog_append_only_delete";
--   DROP INDEX IF EXISTS "Project_status_updatedAt_idx";
--   DROP INDEX IF EXISTS "Project_userId_idx";
--   DROP INDEX IF EXISTS "Project_managerId_idx";
--   DROP INDEX IF EXISTS "Ticket_status_updatedAt_idx";
--   DROP INDEX IF EXISTS "Ticket_userId_idx";
--   DROP INDEX IF EXISTS "Ticket_assigneeId_idx";
--   DROP INDEX IF EXISTS "User_role_createdAt_idx";
--   DROP INDEX IF EXISTS "Transaction_type_createdAt_idx";
--   COMMIT;
