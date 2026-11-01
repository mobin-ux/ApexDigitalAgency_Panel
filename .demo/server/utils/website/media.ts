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
import { imageDimensions, sniffType } from '../../../shared/media-sniff'
import { recordAudit } from '../audit'
import prisma from '../prisma'
import { cleanFileName, extensionOf } from '../uploads'
import { revalidateSite } from './content'

/**
 * The website media library (ADR-026; first built for ADR-021). Separate
 * from customer uploads: public by design, served with long immutable
 * caches, and checked by what the bytes are rather than what the file is
 * called.
 *
 * - Content is sniffed by magic bytes (JPEG, PNG, GIF, WebP, PDF; never
 *   SVG, which can carry script); the extension must agree with them.
 * - Image dimensions come from the headers (no `sharp` in the panel: it is
 *   built on Windows and shipped to Linux).
 * - Files live under `runtimeConfig.website.mediaDir`, named by a UUID and
 *   written with `wx`, so a key is never overwritten.
 * - A file a document uses cannot be deleted; the refusal names the
 *   documents. Deleting is soft (the row stays, the bytes go).
 */

export const MAX_MEDIA_BYTES = 10 * 1024 * 1024
export const MAX_MEDIA_FILES = 10

export function mediaDir(): string {
  const configured = (useRuntimeConfig().website as { mediaDir?: string } | undefined)?.mediaDir
  return resolve(configured || join(process.cwd(), '.data', 'site-media'))
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

export interface MediaRow {
  id: string
  key: string
  filename: string
  mime: string
  bytes: number
  width: number | null
  height: number | null
  alt: string
  caption: string | null
  sha256: string
  version: number
  uploadedById: string
  createdAt: Date
  replacedAt: Date | null
  deletedAt: Date | null
}

/** Where the panel serves a file; the version is in it, so it can be cached for a year. */
export function mediaPath(row: Pick<MediaRow, 'id' | 'version' | 'filename'>): string {
  return `/api/site/media/${row.id}/${row.version}/${encodeURIComponent(row.filename)}`
}

/** Where the site serves the same file (its `/media/**` route passes it through). */
export function siteMediaPath(row: Pick<MediaRow, 'id' | 'version' | 'filename'>): string {
  return `/media/${row.id}/${row.version}/${encodeURIComponent(row.filename)}`
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

export async function storeMedia(event: H3Event, actor: AuditActor, file: { filename?: string, data: Buffer }): Promise<MediaRow> {
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

/** The documents that use a file (draft or live), so a delete can say what would break. */
export async function mediaUsage(ids: string[]): Promise<Map<string, { id: string, title: string, key: string, template: string }[]>> {
  const refs = ids.length
    ? await prisma.siteMediaRef.findMany({ where: { mediaId: { in: ids }, document: { archivedAt: null } }, include: { document: { select: { id: true, title: true, key: true, template: true } } } })
    : []
  const out = new Map<string, { id: string, title: string, key: string, template: string }[]>()
  for (const ref of refs) {
    const list = out.get(ref.mediaId) ?? []
    if (!list.some(d => d.id === ref.document.id)) {
      list.push(ref.document)
    }
    out.set(ref.mediaId, list)
  }
  return out
}

export async function deleteMedia(event: H3Event, actor: AuditActor, id: string): Promise<void> {
  const row = await loadMedia(id)
  const usage = (await mediaUsage([id])).get(id) ?? []
  if (usage.length) {
    throw createError({
      statusCode: 409,
      message: `${row.filename} is used on ${usage.length === 1 ? `"${usage[0]!.title}"` : `${usage.length} pages`}. Remove it there first.`,
      data: { usage },
    })
  }
  const inSettings = await prisma.setting.findFirst({ where: { key: 'site.seo.ogImage', value: JSON.stringify(id) }, select: { id: true } })
  if (inSettings) {
    throw createError({ statusCode: 409, message: `${row.filename} is the default social image in Site settings. Choose another there first.` })
  }
  await prisma.siteMedia.update({ where: { id }, data: { deletedAt: new Date() } })
  await unlink(join(mediaDir(), row.key)).catch(() => {})
  await recordAudit(event, actor, { action: 'admin.website.media.delete', targetType: 'SiteMedia', targetId: id, subject: row.filename, metadata: { bytes: row.bytes } })
}

/** After a change the site shows (alt text), drop its cache if a live page uses the file. */
export async function revalidateIfUsed(event: H3Event, id: string): Promise<boolean> {
  const live = await prisma.siteMediaRef.count({ where: { mediaId: id, slot: 'published' } })
  return live ? revalidateSite(event) : false
}

/** The files a set of ids names, as the site needs them: its own address, size and alt text. */
export async function mediaIndex(ids: string[]): Promise<Record<string, { src: string, width: number | null, height: number | null, mime: string, alt: string }>> {
  if (!ids.length) {
    return {}
  }
  const rows = await prisma.siteMedia.findMany({ where: { id: { in: ids }, deletedAt: null }, select: MEDIA_SELECT })
  return Object.fromEntries(rows.map(row => [row.id, { src: siteMediaPath(row), width: row.width, height: row.height, mime: row.mime, alt: row.alt }]))
}

/**
 * Serve a file publicly: GET and HEAD, a year of immutable cache because
 * the version is in the URL, `nosniff`, images inline and PDFs as
 * attachments.
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
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'ETag': `"${row.sha256.slice(0, 32)}"`,
    'Last-Modified': (row.replacedAt ?? row.createdAt).toUTCString(),
  })
  if (event.method === 'HEAD') {
    event.node.res.statusCode = 200
    return ''
  }
  return sendStream(event, createReadStream(file))
}
