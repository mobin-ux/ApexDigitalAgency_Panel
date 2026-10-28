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

