-- Website group, phase F (ADR-026): visit totals counted by the site itself.
-- Additive only: one new table, no existing column touched. The rows hold
-- totals per London day, page and source; no personal data.
--
-- Check first (should answer nothing):
--   sqlite3 /opt/apex/prisma/dev.db "SELECT name FROM sqlite_master WHERE name = 'SiteVisit';"
-- Apply with the panel stopped, after a backup:
--   cp -p /opt/apex/prisma/dev.db /opt/apex/backups/dev.db.$(date +%Y%m%d-%H%M%S).pre-site-visits
--   sqlite3 /opt/apex/prisma/dev.db < 2026-11-site-visits.sql
-- Rollback:
--   sqlite3 /opt/apex/prisma/dev.db 'DROP TABLE "SiteVisit";'

BEGIN;
CREATE TABLE "SiteVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "views" INTEGER NOT NULL DEFAULT 0,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "SiteVisit_day_idx" ON "SiteVisit"("day");
CREATE UNIQUE INDEX "SiteVisit_day_path_source_key" ON "SiteVisit"("day", "path", "source");
COMMIT;
