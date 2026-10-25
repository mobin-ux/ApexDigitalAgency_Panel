import type { H3Event } from 'h3'
import type { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { createError, sendStream, setResponseHeaders } from 'h3'
import prisma from './prisma'

/**
 * Client file uploads (Panel v2): brief files on a new order, the Files tab on
 * an order, and attachments on a support request. Before this there was no
 * upload path at all, and three phases had to remove pickers that silently
 * discarded what the customer chose.
 *
 * Files live on disk under `uploadDir`, named by a random UUID with no
 * extension, so a stored name can never be executable or guessable; the
 * original name, size and a server-derived MIME type are on the
 * `Attachment` row. They are only ever served through `/api/attachments/:id`,
 * which checks who is asking and sends `attachment` + `nosniff`.
 */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const MAX_FILES_PER_REQUEST = 5

/**
 * Allowed extensions → the MIME type we serve them as. The client's own
 * Content-Type is ignored. SVG and HTML are deliberately absent: both can
 * carry script.
 */
const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  key: 'application/octet-stream',
  pages: 'application/octet-stream',
  fig: 'application/octet-stream',
  ai: 'application/postscript',
  eps: 'application/postscript',
  psd: 'image/vnd.adobe.photoshop',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
}

export const ALLOWED_EXTENSIONS = Object.keys(TYPES)

export function uploadDir(): string {
  const { useRuntimeConfig } = globalThis as any
  const configured = typeof useRuntimeConfig === 'function' ? (useRuntimeConfig().uploadDir as string | undefined) : undefined
  return resolve(configured || process.env.NUXT_UPLOAD_DIR || join(process.cwd(), '.data', 'uploads'))
}

/** Strip anything path-like or control-like from a client file name. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file'
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001F\u007F<>:"|?*]/g, '').trim().slice(0, 140)
  return cleaned || 'file'
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Validate and store one file; returns the new, unlinked Attachment row. */
export async function storeUpload(uploaderId: string, file: { filename?: string, data: Buffer }) {
  const name = cleanFileName(file.filename ?? 'file')
  const ext = extensionOf(name)
  const mime = TYPES[ext]
  if (!mime) {
    throw createError({ statusCode: 415, message: `${name}: that file type is not accepted. Use PDF, an image, an Office document or a ZIP.` })
  }
  if (file.data.length === 0) {
    throw createError({ statusCode: 400, message: `${name} is empty.` })
  }
  if (file.data.length > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 413, message: `${name} is over 20 MB. Send larger files as a link.` })
  }

  const key = randomUUID()
  const dir = uploadDir()
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, key), file.data, { flag: 'wx' })

  return prisma.attachment.create({
    data: { name, path: key, size: file.data.length, mime, uploaderId },
    select: { id: true, name: true, size: true, mime: true, createdAt: true },
  })
}

/** Stream a stored attachment as a download. */
export async function sendAttachment(event: H3Event, row: { path: string, name: string, mime: string, size: number }) {
  // `path` is a UUID we generated; refuse anything else rather than trusting it.
  if (!/^[0-9a-f-]{36}$/i.test(row.path)) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  const file = join(uploadDir(), row.path)
  try {
    await stat(file)
  }
  catch {
    throw createError({ statusCode: 404, message: 'This file is no longer stored. Ask your team to send it again.' })
  }
  setResponseHeaders(event, {
    'Content-Type': row.mime,
    'Content-Length': String(row.size),
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  })
  return sendStream(event, createReadStream(file))
}

/**
 * Delete stored files and their rows — the bytes first, so a failure leaves a
 * row pointing at nothing rather than an unlisted file on disk. Used when a
 * credit application is withdrawn: its ID and statements are not kept.
 */
export async function deleteAttachments(rows: { id: string, path: string }[]) {
  for (const row of rows) {
    if (/^[0-9a-f-]{36}$/i.test(row.path)) {
      await rm(join(uploadDir(), row.path), { force: true })
    }
  }
  if (rows.length) {
    await prisma.attachment.deleteMany({ where: { id: { in: rows.map(r => r.id) } } })
  }
}

/** "4.2 MB", "120 KB" — the size line under a file name. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
