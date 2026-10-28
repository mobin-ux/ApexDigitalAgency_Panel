import { defineEventHandler } from 'h3'
import { DEFAULT_REPLY_TARGETS, formatReplyEta, replyTargetKey } from '../../shared/support-eta'
import { getAuthSession } from '../utils/auth'
import { DEFAULT_BANK_DETAILS, DEFAULT_FAQ } from '../utils/catalog'
import { getCatalog } from '../utils/catalog-v2'
import { mailConfigured } from '../utils/mail/transport'
import { getSettings } from '../utils/settings'
import { panelContent } from '../utils/website/content-api'

/** An announcement shows only when it is on, has text, and is inside its window (if one is set). */
function liveAnnouncement(a: { enabled: boolean, text: string, link?: { label: string, link: unknown }, tone: string, startsAt: string, endsAt: string }) {
  if (!a.enabled || !a.text.trim()) {
    return null
  }
  const now = Date.now()
  if (a.startsAt && Date.parse(a.startsAt) > now) {
    return null
  }
  if (a.endsAt && Date.parse(a.endsAt) < now) {
    return null
  }
  return { text: a.text, tone: a.tone, link: a.link ?? null }
}

/**
 * GET /api/config — the whitelisted, customer-safe slice of application
 * configuration. Every value is a Setting row (managed from the admin
 * panel) merged over a sensible default, so the admin panel actually
 * steers what customers see. NEVER add secrets or admin-only keys here.
 */
export default defineEventHandler(async (event) => {
  /*
   * The legal pages are public and read the support address from here, so a
   * signed-out visitor got a 401 on every view of the Terms. They get the two
   * public facts; bank details, prices and the rest stay with customers.
   */
  const panel = await panelContent()
  const legal = {
    terms: panel.legal.terms ? { title: panel.legal.terms.title, ...(panel.legal.terms.content as object) } : null,
    privacy: panel.legal.privacy ? { title: panel.legal.privacy.title, ...(panel.legal.privacy.content as object) } : null,
  }
  const announcement = liveAnnouncement(panel.announcement)

  if (!getAuthSession(event)) {
    const pub = await getSettings({
      'general.site-name': 'Apex Digital Agency',
      'general.support-email': 'support@apexdigi.co.uk',
    })
    // `features.mail` is public because the sign-in and recover pages read it:
    // with no provider configured they say reset-by-email is unavailable
    // rather than "check your inbox" (ADR-022).
    return { siteName: pub['general.site-name'], supportEmail: pub['general.support-email'], legal, announcement, features: { mail: mailConfigured() } }
  }

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
    'credit.applications-open': true,
  })
  const runtime = useRuntimeConfig(event)

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
    // Panel v2 catalogue (ADR-019): the same object `POST /api/orders` prices
    // from, so the wizard can only ever show the figure the order is signed at.
    catalog: await getCatalog(),
    // Settings offers the Companies House lookup only when it can work.
    companiesHouseLookup: Boolean(runtime.companiesHouseKey),
    // Website CMS (ADR-021): the customer-facing documents the panel renders.
    legal,
    announcement,
    dashboardPromo: panel.promo,
    features: { creditApplications: s['credit.applications-open'] !== false, mail: mailConfigured() },
  }
})
