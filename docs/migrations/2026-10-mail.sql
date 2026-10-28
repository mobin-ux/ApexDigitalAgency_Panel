-- CreateTable
CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "to" TEXT NOT NULL,
    "toUserId" TEXT,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "replyTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerId" TEXT,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "MailMessage_status_nextAttemptAt_idx" ON "MailMessage"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "MailMessage_to_createdAt_idx" ON "MailMessage"("to", "createdAt");

-- CreateIndex
CREATE INDEX "MailMessage_createdAt_idx" ON "MailMessage"("createdAt");


-- Notification emails (ADR-022, Gate 3): one switch per account. Written by
-- hand as ADD COLUMN; prisma migrate diff proposes a full table rebuild of
-- "User" that differs only in column order.
ALTER TABLE "User" ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT true;

-- Website review emails (ADR-022, Gate 4): who submitted a draft, so approve
-- and reject can answer them. Hand-written for the same reason as above.
ALTER TABLE "SiteDocument" ADD COLUMN "submittedById" TEXT;
