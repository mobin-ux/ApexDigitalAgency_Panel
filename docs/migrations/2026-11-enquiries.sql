-- Website group, phase E (ADR-026): enquiries from the site's contact form.
-- Additive only: two new tables, no existing column touched.
--
-- Check first (both should answer nothing):
--   sqlite3 /opt/apex/prisma/dev.db "SELECT name FROM sqlite_master WHERE name IN ('Enquiry','EnquiryNote');"
-- Apply with the panel stopped, after a backup:
--   cp -p /opt/apex/prisma/dev.db /opt/apex/backups/dev.db.$(date +%Y%m%d-%H%M%S).pre-enquiries
--   sqlite3 /opt/apex/prisma/dev.db < 2026-11-enquiries.sql

BEGIN;
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "business" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "services" TEXT NOT NULL DEFAULT '[]',
    "plan" TEXT NOT NULL DEFAULT '',
    "budget" TEXT NOT NULL DEFAULT '',
    "reply" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'new',
    "ownerId" TEXT,
    "lostReason" TEXT,
    "clientId" TEXT,
    "convertedAt" DATETIME,
    "convertedById" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "EnquiryNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enquiryId" TEXT NOT NULL,
    CONSTRAINT "EnquiryNote_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Enquiry_externalId_key" ON "Enquiry"("externalId");

CREATE INDEX "Enquiry_status_receivedAt_idx" ON "Enquiry"("status", "receivedAt");

CREATE INDEX "Enquiry_receivedAt_idx" ON "Enquiry"("receivedAt");

CREATE INDEX "Enquiry_clientId_idx" ON "Enquiry"("clientId");

CREATE INDEX "EnquiryNote_enquiryId_createdAt_idx" ON "EnquiryNote"("enquiryId", "createdAt");

COMMIT;

-- Rollback (panel stopped; deletes every stored enquiry and note):
--   BEGIN; DROP TABLE "EnquiryNote"; DROP TABLE "Enquiry"; COMMIT;
