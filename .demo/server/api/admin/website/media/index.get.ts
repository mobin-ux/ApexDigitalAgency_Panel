import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { paginationQuerySchema } from '../../../../utils/http'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateQuery } from '../../../../utils/validate'
import { namesOf } from '../../../../utils/website/content'
import { MEDIA_SELECT, mediaDir, mediaPath, mediaUsage, siteMediaPath } from '../../../../utils/website/media'

/**
 * GET /api/admin/website/media — the Media library (`Admin Console.dc.html`
 * `v_40media`): every file with where it is used, and the design's filters
 * (All · Images · Documents · Missing alt text · Unused) with counts over
 * the whole library. `kind=image` narrows the list for the editor's
 * picker. The library is a few hundred files at most, so the filters run
 * over the rows rather than in the query.
 */

const querySchema = paginationQuerySchema.extend({
  filter: z.enum(['all', 'image', 'document', 'noalt', 'unused']).default('all'),
  kind: z.enum(['image', 'document']).optional(),
})

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const query = validateQuery(event, querySchema)
  const rows = await prisma.siteMedia.findMany({ where: { deletedAt: null }, select: MEDIA_SELECT, orderBy: { createdAt: 'desc' } })
  const usage = await mediaUsage(rows.map(r => r.id))
  const names = await namesOf(rows.map(r => r.uploadedById))
  // A row whose bytes are gone (a lost disk, a restored database) says so rather than showing a broken image.
  const dir = mediaDir()
  const stored = new Set((await Promise.all(rows.map(r => stat(join(dir, r.key)).then(() => r.id).catch(() => null)))).filter(Boolean))
  const publicUrl = ((useRuntimeConfig(event).website as { publicUrl?: string } | undefined)?.publicUrl ?? '').replace(/\/$/, '')

  const items = rows.map((row) => {
    const used = usage.get(row.id) ?? []
    const isImage = row.mime.startsWith('image/')
    return {
      id: row.id,
      name: row.filename,
      mime: row.mime,
      kind: isImage ? 'image' as const : 'document' as const,
      bytes: row.bytes,
      width: row.width,
      height: row.height,
      alt: row.alt,
      version: row.version,
      src: mediaPath(row),
      stored: stored.has(row.id),
      link: publicUrl ? `${publicUrl}${siteMediaPath(row)}` : null,
      uploadedAt: row.createdAt.toISOString(),
      uploadedBy: names.get(row.uploadedById) ?? 'Staff',
      used: used.map(d => ({ id: d.id, title: d.title, path: d.key, template: d.template })),
    }
  })
  type Item = typeof items[number]
  const tests: Record<typeof query.filter, (m: Item) => boolean> = {
    all: () => true,
    image: m => m.kind === 'image',
    document: m => m.kind === 'document',
    noalt: m => m.kind === 'image' && !m.alt.trim(),
    unused: m => m.used.length === 0,
  }
  const counts = Object.fromEntries(Object.entries(tests).map(([key, test]) => [key, items.filter(test).length])) as Record<typeof query.filter, number>
  const list = items.filter(tests[query.filter]).filter(m => !query.kind || m.kind === query.kind)
  const start = (query.page - 1) * query.pageSize
  return { items: list.slice(start, start + query.pageSize), total: list.length, page: query.page, pageSize: query.pageSize, pageCount: Math.max(1, Math.ceil(list.length / query.pageSize)), counts }
})
