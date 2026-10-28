import type { H3Event } from 'h3'
import type { Buffer } from 'node:buffer'
import type { Sniffed } from '../../../shared/media-sniff'
import type { AuditActor } from '../audit'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { createError, sendStream, setResponseHeaders } from 'h3'
import { collectMediaIds, imageDimensions, sniffType } from '../../../shared/media-sniff'
import { recordAudit } from '../audit'
import prisma from '../prisma'
import { cleanFileName, extensionOf } from '../uploads'

export { collectMediaIds, imageDimensions, sniffType } from '../../../shared/media-sniff'

/**
 * The website media library (ADR-021 §4). Separate from customer uploads:
 * public by design, served with long immutable caches, and checked by what
 * the bytes are rather than what the file is called.
 *
 * - Content is sniffed by magic bytes; the extension must agree with them.
 * - Image dimensions are parsed from the headers (no `sharp` in the panel:
 *   it is built on Windows and shipped to Linux). The site uses them for
 *   layout; its own image pipeline does the resizing.
 * - Files live under NUXT_SITE_MEDIA_DIR (default `.data/site-media`), by
 *   UUID, written with `wx` so a key is never overwritten. Replacing a file
 *   bumps `version`, which is in the public URL, so caches stay correct.
 * - A referenced file cannot be deleted; the refusal names the documents.
 *   Deleting is soft (the row stays, the bytes go).
 */

export const MAX_MEDIA_BYTES = 10 * 1024 * 1024
export const MAX_MEDIA_FILES = 10

export function mediaDir(): string {
  const configured = (useRuntimeConfig().website as { mediaDir?: string } | undefined)?.mediaDir
  return resolve(configured || process.env.NUXT_SITE_MEDIA_DIR || join(process.cwd(), '.data', 'site-media'))
}

export const MEDIA_SELECT = {
  id: true,
  key: true,
  filename: true,
  mime: true,
  bytes: true,
  width: true,
  height: true,
  alt: true,
  caption: true,
  sha256: true,
  version: true,
  uploadedById: true,
  createdAt: true,
  replacedAt: true,
  deletedAt: true,
} as const

export type MediaRow = { [K in keyof typeof MEDIA_SELECT]: K extends 'width' | 'height' ? number | null : K extends 'caption' ? string | null : K extends 'replacedAt' | 'deletedAt' ? Date | null : K extends 'bytes' | 'version' ? number : K extends 'createdAt' ? Date : string }

/** The public address of a file: the version is in it, so it can be cached for a year. */
export function mediaPath(row: Pick<MediaRow, 'id' | 'version' | 'filename'>): string {
  return `/api/site/media/${row.id}/${row.version}/${encodeURIComponent(row.filename)}`
}

export function publicMedia(row: MediaRow) {
  return { id: row.id, src: mediaPath(row), filename: row.filename, mime: row.mime, bytes: row.bytes, width: row.width, height: row.height, alt: row.alt, caption: row.caption, version: row.version, createdAt: row.createdAt, replacedAt: row.replacedAt }
}

interface Checked {
  name: string
  data: Buffer
  sniffed: Sniffed
  dims: { width: number, height: number } | null
}

function check(file: { filename?: string, data: Buffer }): Checked {
  const name = cleanFileName(file.filename ?? 'file')
  if (file.data.length === 0) {
    throw createError({ statusCode: 400, message: `${name} is empty.` })
  }
  if (file.data.length > MAX_MEDIA_BYTES) {
    throw createError({ statusCode: 413, message: `${name} is over 10 MB. Resize it before uploading.` })
  }
  const sniffed = sniffType(file.data)
  if (!sniffed) {
    throw createError({ statusCode: 415, message: `${name} is not a JPEG, PNG, GIF, WebP or PDF.` })
  }
  const ext = extensionOf(name)
  if (!sniffed.ext.includes(ext)) {
    throw createError({ statusCode: 415, message: `${name} says it is .${ext || '?'} but its contents are ${sniffed.mime}. Rename it to match or upload the right file.` })
  }
  return { name, data: file.data, sniffed, dims: sniffed.kind === 'image' ? imageDimensions(file.data, sniffed.mime) : null }
}

async function writeNew(data: Buffer): Promise<string> {
  const key = randomUUID()
  const dir = mediaDir()
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, key), data, { flag: 'wx' })
  return key
}

export async function storeMedia(event: H3Event, actor: AuditActor, file: { filename?: string, data: Buffer }, alt = ''): Promise<MediaRow> {
  const c = check(file)
  const key = await writeNew(c.data)
  const row = await prisma.siteMedia.create({
    data: {
      key,
      filename: c.name,
      mime: c.sniffed.mime,
      bytes: c.data.length,
      width: c.dims?.width ?? null,
      height: c.dims?.height ?? null,
      alt: alt.trim().slice(0, 300),
      sha256: createHash('sha256').update(c.data).digest('hex'),
      uploadedById: actor.id,
    },
    select: MEDIA_SELECT,
  })
  await recordAudit(event, actor, { action: 'admin.website.media.upload', targetType: 'SiteMedia', targetId: row.id, subject: row.filename, metadata: { mime: row.mime, bytes: row.bytes, width: row.width, height: row.height } })
  return row
}

export async function loadMedia(id: string): Promise<MediaRow> {
  const row = await prisma.siteMedia.findUnique({ where: { id }, select: MEDIA_SELECT })
  if (!row || row.deletedAt) {
    throw createError({ statusCode: 404, message: 'Media not found' })
  }
  return row
}

/** New bytes behind the same id: the version changes, every document keeps pointing at it, caches miss. */
export async function replaceMedia(event: H3Event, actor: AuditActor, id: string, file: { filename?: string, data: Buffer }): Promise<MediaRow> {
  const current = await loadMedia(id)
  const c = check(file)
  if (c.sniffed.kind !== (current.mime === 'application/pdf' ? 'pdf' : 'image')) {
    throw createError({ statusCode: 415, message: 'Replace an image with an image and a PDF with a PDF, so every page that uses it keeps working.' })
  }
  const key = await writeNew(c.data)
  const row = await prisma.siteMedia.update({
    where: { id },
    data: { key, filename: c.name, mime: c.sniffed.mime, bytes: c.data.length, width: c.dims?.width ?? null, height: c.dims?.height ?? null, sha256: createHash('sha256').update(c.data).digest('hex'), version: { increment: 1 }, replacedAt: new Date() },
    select: MEDIA_SELECT,
  })
  await unlink(join(mediaDir(), current.key)).catch(() => {})
  await recordAudit(event, actor, { action: 'admin.website.media.replace', targetType: 'SiteMedia', targetId: id, subject: row.filename, metadata: { version: row.version, bytes: row.bytes } })
  return row
}

export async function updateMedia(event: H3Event, actor: AuditActor, id: string, input: { alt?: string, caption?: string | null }): Promise<MediaRow> {
  await loadMedia(id)
  const row = await prisma.siteMedia.update({
    where: { id },
    data: { ...(input.alt !== undefined ? { alt: input.alt.trim().slice(0, 300) } : {}), ...(input.caption !== undefined ? { caption: input.caption?.trim().slice(0, 300) || null } : {}) },
    select: MEDIA_SELECT,
  })
  await recordAudit(event, actor, { action: 'admin.website.media.update', targetType: 'SiteMedia', targetId: id, subject: row.filename, metadata: { alt: row.alt } })
  return row
}

/** The documents that use a file, by slot, so a delete can say what would break. */
export async function mediaUsage(id: string) {
  const refs = await prisma.siteMediaRef.findMany({ where: { mediaId: id }, include: { document: { select: { id: true, title: true, key: true, kind: true, template: true } } } })
  const byDoc = new Map<string, { id: string, title: string, key: string, kind: string, template: string, slots: string[] }>()
  for (const ref of refs) {
    const entry = byDoc.get(ref.documentId) ?? { ...ref.document, slots: [] }
    entry.slots.push(ref.slot)
    byDoc.set(ref.documentId, entry)
  }
  return [...byDoc.values()]
}

export async function deleteMedia(event: H3Event, actor: AuditActor, id: string): Promise<void> {
  const row = await loadMedia(id)
  const usage = await mediaUsage(id)
  if (usage.length) {
    throw createError({
      statusCode: 409,
      message: `${row.filename} is used by ${usage.length === 1 ? usage[0]!.title : `${usage.length} documents`}. Remove it from them first.`,
      data: { usage },
    })
  }
  await prisma.siteMedia.update({ where: { id }, data: { deletedAt: new Date() } })
  await unlink(join(mediaDir(), row.key)).catch(() => {})
  await recordAudit(event, actor, { action: 'admin.website.media.delete', targetType: 'SiteMedia', targetId: id, subject: row.filename, metadata: { bytes: row.bytes } })
}

/** Make the references for one slot of one document match its content. */
export async function syncMediaRefs(tx: { siteMediaRef: typeof prisma.siteMediaRef, siteMedia: typeof prisma.siteMedia }, documentId: string, slot: 'draft' | 'published' | 'scheduled', content: unknown): Promise<void> {
  const wanted = [...collectMediaIds(content)]
  const existing = wanted.length ? await tx.siteMedia.findMany({ where: { id: { in: wanted }, deletedAt: null }, select: { id: true } }) : []
  const ids = existing.map(m => m.id)
  await tx.siteMediaRef.deleteMany({ where: { documentId, slot, ...(ids.length ? { mediaId: { notIn: ids } } : {}) } })
  for (const mediaId of ids) {
    await tx.siteMediaRef.upsert({ where: { mediaId_documentId_slot: { mediaId, documentId, slot } }, create: { mediaId, documentId, slot }, update: {} })
  }
}

/** The media a document's content refers to, as the site needs it: address, size, alt. */
export async function mediaIndex(content: unknown): Promise<Record<string, { src: string, width: number | null, height: number | null, mime: string, alt: string, filename: string }>> {
  const ids = [...collectMediaIds(content)]
  if (!ids.length) {
    return {}
  }
  const rows = await prisma.siteMedia.findMany({ where: { id: { in: ids }, deletedAt: null }, select: MEDIA_SELECT })
  return Object.fromEntries(rows.map(row => [row.id, { src: mediaPath(row), width: row.width, height: row.height, mime: row.mime, alt: row.alt, filename: row.filename }]))
}

/**
 * Serve a file publicly: GET and HEAD (the site's image pipeline asks HEAD
 * first), a year of immutable cache because the version is in the URL,
 * `nosniff`, images inline and PDFs as attachments.
 */
export async function sendMedia(event: H3Event, row: MediaRow): Promise<unknown> {
  const file = join(mediaDir(), row.key)
  let size: number
  try {
    size = (await stat(file)).size
  }
  catch {
    throw createError({ statusCode: 404, message: 'This file is no longer stored.' })
  }
  setResponseHeaders(event, {
    'Content-Type': row.mime,
    'Content-Length': String(size),
    'Content-Disposition': `${row.mime === 'application/pdf' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'ETag': `"${row.sha256.slice(0, 32)}"`,
    'Last-Modified': (row.replacedAt ?? row.createdAt).toUTCString(),
    'Accept-Ranges': 'none',
  })
  if (event.method === 'HEAD') {
    event.node.res.statusCode = 200
    return ''
  }
  return sendStream(event, createReadStream(file))
}
