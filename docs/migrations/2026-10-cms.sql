-- CreateTable
CREATE TABLE "SiteDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en-GB',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "review" TEXT NOT NULL DEFAULT 'NONE',
    "draft" TEXT NOT NULL,
    "draftVersion" INTEGER NOT NULL DEFAULT 1,
    "draftUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "draftUpdatedById" TEXT,
    "publishedRevisionId" TEXT,
    "publishedAt" DATETIME,
    "publishedById" TEXT,
    "scheduledRevisionId" TEXT,
    "scheduledFor" DATETIME,
    "scheduledById" TEXT,
    "archivedAt" DATETIME,
    "lastPublishError" TEXT,
    "publishAttempts" INTEGER NOT NULL DEFAULT 0,
    "revalidatePending" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SiteDocument_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "SiteRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SiteDocument_scheduledRevisionId_fkey" FOREIGN KEY ("scheduledRevisionId") REFERENCES "SiteRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "note" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    CONSTRAINT "SiteRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SiteDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteRedirect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiteMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt" TEXT NOT NULL DEFAULT '',
    "caption" TEXT,
    "sha256" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedAt" DATETIME,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "SiteMediaRef" (
    "mediaId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,

    PRIMARY KEY ("mediaId", "documentId", "slot"),
    CONSTRAINT "SiteMediaRef_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "SiteMedia" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SiteMediaRef_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SiteDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteDocument_publishedRevisionId_key" ON "SiteDocument"("publishedRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteDocument_scheduledRevisionId_key" ON "SiteDocument"("scheduledRevisionId");

-- CreateIndex
CREATE INDEX "SiteDocument_status_scheduledFor_idx" ON "SiteDocument"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "SiteDocument_kind_template_idx" ON "SiteDocument"("kind", "template");

-- CreateIndex
CREATE UNIQUE INDEX "SiteDocument_kind_key_key" ON "SiteDocument"("kind", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SiteRevision_documentId_number_key" ON "SiteRevision"("documentId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SiteRedirect_fromPath_key" ON "SiteRedirect"("fromPath");

-- CreateIndex
CREATE INDEX "SiteRedirect_enabled_idx" ON "SiteRedirect"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "SiteMedia_key_key" ON "SiteMedia"("key");

-- CreateIndex
CREATE INDEX "SiteMedia_deletedAt_createdAt_idx" ON "SiteMedia"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "SiteMediaRef_documentId_idx" ON "SiteMediaRef"("documentId");

