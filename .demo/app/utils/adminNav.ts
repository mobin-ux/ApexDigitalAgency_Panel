import type { Permission, StaffRole } from '~~/shared/permissions'
import { can, DEFAULT_STAFF_ROLE, isStaffRole } from '~~/shared/permissions'

/**
 * The admin console's destinations, grouped the way `Admin Console.dc.html`
 * draws the sidebar (Overview · Work · People · Money · Website · System),
 * each with the permission its screens need.
 *
 * Defined once so the sidebar, the header breadcrumb, the ⌘K palette, the
 * invite landing and the `/admin` guard agree: a new Editor is sent to the
 * first row their role can open rather than to an Overview that would 403
 * its own data request (ADR-021).
 *
 * The design's permission keys (`site.see`, `credit.review`…) are a
 * prototype's; the keys here are `shared/permissions.ts`, which the server
 * enforces. Rows the design does not draw but the console already had
 * (Contracts, Publishing, Panel content, Email, Tools) keep their place
 * in the group they belong to rather than being dropped.
 */

export type AdminCountKey = 'support' | 'clients' | 'credit' | 'pages' | 'insights' | 'work'

export interface AdminNavDef {
  /** Stable id, used by the palette and the counts. */
  key: string
  label: string
  icon: string
  to: string
  /** Permission this destination needs; omitted rows are open to all staff. */
  needs?: Permission
  /** Which live count the row carries, when it carries one. */
  count?: AdminCountKey
  /** Routes under `to` that belong to another row (longest prefix wins anyway). */
  exact?: boolean
}

export interface AdminNavGroup {
  /** Empty for the unlabelled first group. */
  heading: string
  items: AdminNavDef[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    heading: '',
    items: [
      { key: 'overview', label: 'Overview', icon: 'solar:widget-2-linear', to: '/admin', needs: 'work.view', exact: true },
    ],
  },
  {
    heading: 'Work',
    items: [
      { key: 'projects', label: 'Projects', icon: 'solar:suitcase-linear', to: '/admin/projects', needs: 'work.view' },
      { key: 'support', label: 'Support inbox', icon: 'solar:headphones-round-linear', to: '/admin/tickets', needs: 'support.answer', count: 'support' },
      { key: 'catalogue', label: 'Services & pricing', icon: 'solar:tag-price-linear', to: '/admin/services', needs: 'work.view' },
    ],
  },
  {
    heading: 'People',
    items: [
      { key: 'clients', label: 'Clients', icon: 'solar:users-group-rounded-linear', to: '/admin/users', needs: 'work.view', count: 'clients' },
      { key: 'team', label: 'Team & roles', icon: 'solar:shield-user-linear', to: '/admin/team', needs: 'team.manage' },
    ],
  },
  {
    heading: 'Money',
    items: [
      { key: 'money', label: 'Payments & credit', icon: 'solar:wallet-2-linear', to: '/admin/payments', needs: 'money.view' },
      { key: 'credit', label: 'Credit applications', icon: 'solar:card-recive-linear', to: '/admin/credit', needs: 'money.view', count: 'credit' },
      { key: 'contracts', label: 'Agreements', icon: 'solar:document-add-linear', to: '/admin/contracts', needs: 'money.view' },
    ],
  },
  {
    heading: 'Website',
    items: [
      { key: 'publishing', label: 'Publishing', icon: 'solar:global-linear', to: '/admin/website', needs: 'website.view', exact: true },
      { key: 'pages', label: 'Pages', icon: 'solar:document-text-linear', to: '/admin/website/pages', needs: 'website.view', count: 'pages' },
      { key: 'media', label: 'Media library', icon: 'solar:gallery-linear', to: '/admin/website/media', needs: 'website.view' },
      { key: 'nav', label: 'Navigation & footer', icon: 'solar:list-linear', to: '/admin/website/navigation', needs: 'website.view' },
      { key: 'seo', label: 'SEO & redirects', icon: 'solar:magnifer-linear', to: '/admin/website/seo', needs: 'website.seo' },
      { key: 'panel', label: 'Panel content', icon: 'solar:chat-square-like-linear', to: '/admin/website/panel', needs: 'website.view' },
    ],
  },
  {
    heading: 'System',
    items: [
      { key: 'sitesettings', label: 'Site settings', icon: 'solar:global-linear', to: '/admin/website/settings', needs: 'website.view' },
      { key: 'platform', label: 'Platform settings', icon: 'solar:settings-linear', to: '/admin/settings', needs: 'platform.settings' },
      { key: 'audit', label: 'Audit log', icon: 'solar:history-linear', to: '/admin/audit', needs: 'team.manage' },
      { key: 'mail', label: 'Email', icon: 'solar:letter-linear', to: '/admin/mail', needs: 'team.manage' },
      { key: 'tools', label: 'Tools', icon: 'solar:tuning-2-linear', to: '/admin/tools', needs: 'catalogue.edit' },
    ],
  },
]

export const ADMIN_NAV_ITEMS: (AdminNavDef & { group: string })[] = ADMIN_NAV.flatMap(g => g.items.map(i => ({ ...i, group: g.heading })))

/**
 * The row a path belongs to: the longest `to` that prefixes it, so
 * `/admin/projects/abc` lights Projects and `/admin/website/pages/x`
 * lights Pages rather than Publishing.
 */
export function navItemFor(path: string) {
  let best: (typeof ADMIN_NAV_ITEMS)[number] | null = null
  for (const item of ADMIN_NAV_ITEMS) {
    const hit = item.exact ? path === item.to || path === `${item.to}/` : path === item.to || path.startsWith(`${item.to}/`)
    if (hit && (!best || item.to.length > best.to.length)) {
      best = item
    }
  }
  return best
}

/** The first destination a role can open — where that role lands after sign-in or invite acceptance. */
export function homeFor(roleValue: unknown): string {
  const role: StaffRole = isStaffRole(roleValue) ? roleValue : DEFAULT_STAFF_ROLE
  for (const item of ADMIN_NAV_ITEMS) {
    if (!item.needs || can(role, item.needs)) {
      return item.to
    }
  }
  return '/admin'
}
