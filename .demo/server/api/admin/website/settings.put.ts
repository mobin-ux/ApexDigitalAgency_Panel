import { createError, defineEventHandler, readBody } from 'h3'
import { can, rolesWith } from '../../../../shared/permissions'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'
import { revalidateSite } from '../../../utils/website/content'
import { getWebsiteSettings, isWebsiteSettingKey, parseWebsiteSetting, WEBSITE_SETTINGS } from '../../../utils/website/settings'

/**
 * PUT /api/admin/website/settings — save some website settings. Each key is
 * checked against its own schema (400 with errors by key) and its own
 * permission (403 naming the roles that hold it); unknown keys are refused.
 * Only keys whose value changed are written and named in the audit row,
 * and the site drops its cache so they show on the next request.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.view')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const body = await readBody<Record<string, unknown>>(event)
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length) {
    throw createError({ statusCode: 400, message: 'Send the settings to change.' })
  }
  const fieldErrors: Record<string, string[]> = {}
  const parsed: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (!isWebsiteSettingKey(key)) {
      fieldErrors[key] = ['Unknown setting']
      continue
    }
    const permission = WEBSITE_SETTINGS[key].permission
    if (!can(actor.staffRole, permission)) {
      throw createError({ statusCode: 403, message: `${WEBSITE_SETTINGS[key].label} needs ${rolesWith(permission).map(r => r.label).join(' or ')}.`, data: { permission } })
    }
    const result = parseWebsiteSetting(key, value)
    if (result.ok) {
      parsed[key] = result.value
    }
    else {
      fieldErrors[key] = [result.message]
    }
  }
  if (parsed['site.seo.ogImage']) {
    const image = await prisma.siteMedia.findFirst({ where: { id: String(parsed['site.seo.ogImage']), deletedAt: null, mime: { startsWith: 'image/' } }, select: { id: true } })
    if (!image) {
      fieldErrors['site.seo.ogImage'] = ['Choose an image from the media library']
    }
  }
  if (Object.keys(fieldErrors).length) {
    throw createError({ statusCode: 400, message: 'Some settings need another look.', data: { fieldErrors } })
  }

  const before = await getWebsiteSettings() as Record<string, unknown>
  const changed = Object.keys(parsed).filter(key => JSON.stringify(parsed[key]) !== JSON.stringify(before[key]))
  for (const key of changed) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(parsed[key]), group: 'website', updatedBy: actor.email },
      update: { value: JSON.stringify(parsed[key]), updatedBy: actor.email },
    })
  }
  if (changed.length) {
    await recordAudit(event, actor, {
      action: 'admin.website.settings.update',
      targetType: 'Setting',
      subject: changed.some(k => WEBSITE_SETTINGS[k as keyof typeof WEBSITE_SETTINGS].permission === 'website.settings') ? 'Site settings' : 'robots.txt',
      metadata: { changed, before: Object.fromEntries(changed.map(k => [k, before[k]])), after: Object.fromEntries(changed.map(k => [k, parsed[k]])) },
    })
  }
  return { changed, values: await getWebsiteSettings(), revalidated: changed.length ? await revalidateSite(event) : false }
})
