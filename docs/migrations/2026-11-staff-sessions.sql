-- Staff sessions (ADR-025, admin console phase 1). Additive: one column with
-- a default, so every existing session stays a customer session. Prisma's
-- generated diff rebuilds the whole table for this; ADD COLUMN is the same
-- end state without copying rows.
--
-- Apply with the panel stopped, after a backup:
--   cp /opt/apex/dev.db /opt/apex/backups/dev.db.$(date +%Y%m%d-%H%M%S).pre-staff-sessions
--   sqlite3 /opt/apex/dev.db < 2026-11-staff-sessions.sql

BEGIN;
ALTER TABLE "Session" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'customer';
COMMIT;

-- Rollback (SQLite 3.35+). Run only with the panel stopped and the previous
-- build restored, since that build's Prisma client does not know the column:
--   BEGIN;
--   ALTER TABLE "Session" DROP COLUMN "kind";
--   COMMIT;
-- Staff sessions issued in the meantime then read as customer sessions,
-- which the previous build accepted on the admin API anyway.
