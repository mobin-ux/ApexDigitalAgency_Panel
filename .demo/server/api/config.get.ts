import { defineEventHandler } from 'h3'
import { DEFAULT_REPLY_TARGETS, formatReplyEta, replyTargetKey } from '../../shared/support-eta'
import { requireAuth } from '../utils/auth'
import { DEFAULT_BANK_DETAILS, DEFAULT_CATALOG, DEFAULT_FAQ, DEFAULT_FROM_PRICES } from '../utils/catalog'
import { getSettings } from '../utils/settings'

/**
 * GET /api/config — the whitelisted, customer-safe slice of application
 * configuration. Every value is a Setting row (managed from the admin
 * panel) merged over a sensible default, so the admin panel actually
 * steers what customers see. NEVER add secrets or admin-only keys here.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)

  const s = await getSettings({
    'general.site-name': 'Apex Digital Agency',
    'general.support-email': 'support@apexdigi.co.uk',
    'general.maintenance-mode': false,
    'business.vat-rate': 20,
    'finance.enable-24mo-plans': true,
    'finance.first-installment-days': 30,
    'finance.withdrawal-min': 25,
    'finance.withdrawal-max': 10_000,
    'finance.bank-details': DEFAULT_BANK_DETAILS,
    [replyTargetKey('normal')]: DEFAULT_REPLY_TARGETS.normal,
    'support.hours': 'Mon–Fri · 9am–6pm GMT',
    'support.faq': DEFAULT_FAQ,
    'catalog.services': DEFAULT_CATALOG,
    'catalog.from-prices': DEFAULT_FROM_PRICES,
  })

  return {
    siteName: s['general.site-name'],
    supportEmail: s['general.support-email'],
    maintenanceMode: s['general.maintenance-mode'],
    finance: {
      enable24moPlans: s['finance.enable-24mo-plans'],
      firstInstallmentDays: s['finance.first-installment-days'],
      withdrawalMin: s['finance.withdrawal-min'],
      withdrawalMax: s['finance.withdrawal-max'],
      vatRate: s['business.vat-rate'],
    },
    bank: s['finance.bank-details'],
    support: {
      // Derived from the one stored number rather than a second string
      // setting, so the admin preview and this cannot disagree (badge 27).
      replyEta: formatReplyEta(Number(s[replyTargetKey('normal')]) || DEFAULT_REPLY_TARGETS.normal),
      hours: s['support.hours'],
      faq: s['support.faq'],
    },
    catalog: s['catalog.services'],
    fromPrices: s['catalog.from-prices'],
  }
})
