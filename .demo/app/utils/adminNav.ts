import type { Permission, StaffRole } from '~~/shared/permissions'
import { can, DEFAULT_STAFF_ROLE, isStaffRole } from '~~/shared/permissions'

/**
 * The admin console's destinations, grouped the way `Admin Console.dc.html`
 * draws the sidebar (Overview · Work · People · Money · Website · System),
 * each with the permission its screens need. The Website group came back
 * with ADR-026, rebuilt from the design.
 *
 * Defined once so the sidebar, the header breadcrumb, the ⌘K palette, the
 * invite landing and the `/admin` guard agree: a role is sent to the first
 * row it can open rather than to an Overview that would 403 its own data
 * request.
 *
 * The design's permission keys (`site.see`, `credit.review`…) are a
 * prototype's; the keys here are `shared/permissions.ts`, which the server
 * enforces. Rows the design does not draw but the console already had
 * (Agreements, Email, Tools) keep their place
 * in the group they belong to rather than being dropped.
 */

export type AdminCountKey = 'support' | 'clients' | 'credit' | 'pages' | 'insights' | 'work' | 'leads'

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
      { key: 'pages', label: 'Pages', icon: 'solar:document-text-linear', to: '/admin/website/pages', needs: 'website.view', count: 'pages' },
      { key: 'insights', label: 'Insights', icon: 'solar:notebook-linear', to: '/admin/website/insights', needs: 'website.view', count: 'insights' },
      { key: 'work', label: 'Case studies', icon: 'solar:case-round-linear', to: '/admin/website/case-studies', needs: 'website.view', count: 'work' },
      { key: 'media', label: 'Media library', icon: 'solar:gallery-linear', to: '/admin/website/media', needs: 'website.view' },
      { key: 'nav', label: 'Navigation & footer', icon: 'solar:list-linear', to: '/admin/website/navigation', needs: 'website.view' },
      { key: 'seo', label: 'SEO & redirects', icon: 'solar:magnifer-linear', to: '/admin/website/seo', needs: 'website.seo' },
      { key: 'leads', label: 'Enquiries', icon: 'solar:inbox-linear', to: '/admin/website/enquiries', needs: 'leads.handle', count: 'leads' },
      { key: 'analytics', label: 'Analytics', icon: 'solar:chart-2-linear', to: '/admin/website/analytics', needs: 'analytics.view' },
    ],
  },
  {
    heading: 'System',
    items: [
      { key: 'sitesettings', label: 'Site settings', icon: 'solar:global-linear', to: '/admin/site-settings', needs: 'website.settings' },
      { key: 'platform', label: 'Platform settings', icon: 'solar:settings-linear', to: '/admin/settings', needs: 'platform.settings' },
      { key: 'audit', label: 'Audit log', icon: 'solar:history-linear', to: '/admin/audit', needs: 'team.manage' },
      { key: 'mail', label: 'Email', icon: 'solar:letter-linear', to: '/admin/mail', needs: 'team.manage' },
      { key: 'logs', label: 'Logs', icon: 'solar:document-text-linear', to: '/admin/logs', needs: 'platform.settings' },
      { key: 'tools', label: 'Tools', icon: 'solar:tuning-2-linear', to: '/admin/tools', needs: 'catalogue.edit' },
    ],
  },
]

export const ADMIN_NAV_ITEMS: (AdminNavDef & { group: string })[] = ADMIN_NAV.flatMap(g => g.items.map(i => ({ ...i, group: g.heading })))

/**
 * The row a path belongs to: the longest `to` that prefixes it, so
 * `/admin/projects/abc` lights Projects rather than Overview.
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

/**
 * Where the staff sign-in sends someone (ADR-025): the `?redirect=` they
 * came with when it is an admin console path, otherwise their role's home.
 * Like `safeRedirect`, nothing off-site or protocol-relative is honoured,
 * and the sign-in page itself is never a destination.
 */
export function adminDestination(redirect: unknown, roleValue: unknown): string {
  if (typeof redirect === 'string' && /^\/admin(?:[/?#]|$)/.test(redirect) && !redirect.startsWith('/admin/sign-in')) {
    return redirect
  }
  return homeFor(roleValue) ?? '/admin'
}

/** The staff sign-in for a guard to send `to` to, remembering `to`. */
export function adminSignInFor(to: { fullPath: string }) {
  return to.fullPath === '/admin' ? '/admin/sign-in' : { path: '/admin/sign-in', query: { redirect: to.fullPath } }
}

/**
 * The first destination a role can open — where that role lands after
 * sign-in or invite acceptance (Publisher and Editor land on Pages). Null
 * only for a role that can open nothing here; the layout's access wall
 * answers that rather than a redirect.
 */
export function homeFor(roleValue: unknown): string | null {
  const role: StaffRole = isStaffRole(roleValue) ? roleValue : DEFAULT_STAFF_ROLE
  for (const item of ADMIN_NAV_ITEMS) {
    if (!item.needs || can(role, item.needs)) {
      return item.to
    }
  }
  return null
}
