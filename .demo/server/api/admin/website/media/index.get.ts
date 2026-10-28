import { z } from 'zod'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../../utils/http'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateQuery } from '../../../../utils/validate'
import { MEDIA_SELECT, publicMedia } from '../../../../utils/website/media'

const querySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  kind: z.enum(['image', 'pdf']).optional(),
})

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const { page, pageSize, q, kind } = validateQuery(event, querySchema)
  const where = {
    deletedAt: null,
    ...(kind === 'image' ? { mime: { startsWith: 'image/' } } : kind === 'pdf' ? { mime: 'application/pdf' } : {}),
    ...(q ? { OR: [{ filename: { contains: q } }, { alt: { contains: q } }, { caption: { contains: q } }] } : {}),
  }
  const [rows, total] = await prisma.$transaction([
    prisma.siteMedia.findMany({ where, select: MEDIA_SELECT, orderBy: { createdAt: 'desc' }, ...toSkipTake({ page, pageSize }) }),
    prisma.siteMedia.count({ where }),
  ])
  const refs = await prisma.siteMediaRef.groupBy({ by: ['mediaId'], _count: { _all: true } })
  const used = new Map(refs.map(r => [r.mediaId, r._count._all]))
  return paginated(rows.map(row => ({ ...publicMedia(row), uses: used.get(row.id) ?? 0 })), total, { page, pageSize })
})
