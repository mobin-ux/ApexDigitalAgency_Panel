-- Website group rebuilt (ADR-026): retire the documents the removed CMS left
-- behind (ADR-021, removed by ADR-024). Their words date from October and
-- the site's code has moved on since, so serving them would put old copy
-- back on the live site. Nothing is deleted: each row is archived and its
-- address moved aside (`~legacy-<id>` appended), which keeps its revisions
-- for the record and frees the address for a fresh import from the site.
--
-- Run ONCE, before the first import in the rebuilt console. Check first:
--   sqlite3 /opt/apex/prisma/dev.db 'SELECT kind, template, key, status FROM "SiteDocument" WHERE "archivedAt" IS NULL;'
-- Apply with the panel stopped, after a backup:
--   cp -p /opt/apex/prisma/dev.db /opt/apex/backups/dev.db.$(date +%Y%m%d-%H%M%S).pre-website-legacy
--   sqlite3 /opt/apex/prisma/dev.db < 2026-11-website-legacy.sql

BEGIN;
UPDATE "SiteDocument"
SET "archivedAt" = COALESCE("archivedAt", CURRENT_TIMESTAMP),
    "key" = "key" || '~legacy-' || "id",
    "review" = 'NONE',
    "scheduledRevisionId" = NULL,
    "scheduledFor" = NULL
WHERE "key" NOT LIKE '%~legacy-%';
DELETE FROM "SiteMediaRef" WHERE "documentId" IN (SELECT "id" FROM "SiteDocument" WHERE "key" LIKE '%~legacy-%');
COMMIT;

-- Rollback (panel stopped): restore the backup taken above. The media
-- references removed here only recorded which archived documents used which
-- files; nothing else reads them for an archived document.
