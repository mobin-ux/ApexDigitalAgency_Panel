import { createError } from 'h3'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'
import { getWebsiteSettings, isWebsiteSettingKey, parseWebsiteSetting } from '../../../utils/website/settings'

/**
 * Save site settings. Every key is validated against its own schema in the
 * registry (400 with fieldErrors by key); unknown keys are refused; only
 * keys whose value changed are written and named in the audit row. The
 * site reads them through its public settings endpoint on the next request.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.settings')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const body = await readBody<Record<string, unknown>>(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, message: 'Expected an object of settings' })
  }
  const fieldErrors: Record<string, string[]> = {}
  const parsed: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (!isWebsiteSettingKey(key)) {
      fieldErrors[key] = ['Unknown setting']
      continue
    }
    const result = parseWebsiteSetting(key, value)
    if (result.ok) {
      parsed[key] = result.value
    }
    else {
      fieldErrors[key] = [result.message]
    }
  }
  if (Object.keys(fieldErrors).length) {
    throw createError({ statusCode: 400, statusMessage: 'Validation failed', message: 'Some settings need another look.', data: { fieldErrors, formErrors: [] } })
  }
  const before = await getWebsiteSettings() as Record<string, unknown>
  const changed = Object.keys(parsed).filter(key => JSON.stringify(parsed[key]) !== JSON.stringify(before[key]))
  for (const key of changed) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(parsed[key]), group: 'website', updatedBy: actor.id },
      update: { value: JSON.stringify(parsed[key]), updatedBy: actor.id },
    })
  }
  if (changed.length) {
    await recordAudit(event, actor, {
      action: 'admin.website.settings.update',
      targetType: 'Setting',
      subject: 'Site settings',
      metadata: { changed, before: Object.fromEntries(changed.map(k => [k, before[k]])), after: Object.fromEntries(changed.map(k => [k, parsed[k]])) },
    })
  }
  return { changed, values: await getWebsiteSettings() }
})
