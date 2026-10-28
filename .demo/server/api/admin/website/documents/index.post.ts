import type { TEMPLATES } from '../../../../../shared/cms'
import { z } from 'zod'
import { creatableTemplates, EMPTY_SEO } from '../../../../../shared/cms'
import { requireStaffPermission } from '../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../utils/ratelimit'
import { validateBody } from '../../../../utils/validate'
import { createDocument, summarise } from '../../../../utils/website/documents'

const bodySchema = z.object({
  template: z.enum(creatableTemplates() as [string, ...string[]]),
  key: z.string().trim().max(200).optional(),
  title: z.string().trim().min(1).max(120),
  content: z.unknown().optional(),
})

/**
 * A new document from a creatable template. A landing page starts with its
 * name, no sections and empty SEO; a legal document with its title and no
 * text. Fixed-key templates are created by the baseline import, not here.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.edit')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const body = await validateBody(event, bodySchema)
  const template = body.template as keyof typeof TEMPLATES
  const content = body.content ?? (template === 'landing'
    ? { title: body.title, sections: [], seo: EMPTY_SEO }
    : template === 'legal'
      ? { title: body.title, updated: '', blocks: [] }
      : {})
  const doc = await createDocument(event, actor, { template, key: body.key, title: body.title, content })
  return summarise(doc)
})
