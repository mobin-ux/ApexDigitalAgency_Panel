import type { Permission, StaffRole } from '~~/shared/permissions'
import { can, DEFAULT_STAFF_ROLE, isStaffRole } from '~~/shared/permissions'

/**
 * The admin panel's destinations, grouped the way the design draws the
 * sidebar (Work · People · Money · Service · Website · System), each with
 * the permission its screens need.
 *
 * Defined once so the sidebar, the invite landing and the `/admin` guard
 * agree: a new Editor is sent to the first row their role can open rather
 * than to an Overview that would 403 its own data request (ADR-021).
 */

export interface AdminNavDef {
  label: string
  icon: string
  to: string
  /** Permission this destination needs; omitted rows are open to all staff. */
  needs?: Permission
}

export interface AdminNavGroup {
  heading: string
  items: AdminNavDef[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    heading: 'Work',
    items: [
      { label: 'Overview', icon: 'solar:widget-2-linear', to: '/admin', needs: 'work.view' },
      { label: 'Projects', icon: 'solar:suitcase-linear', to: '/admin/projects', needs: 'work.view' },
    ],
  },
  {
    heading: 'People',
    items: [
      { label: 'Clients', icon: 'solar:users-group-rounded-linear', to: '/admin/users', needs: 'work.view' },
      { label: 'Team & access', icon: 'solar:shield-user-linear', to: '/admin/team', needs: 'team.manage' },
    ],
  },
  {
    heading: 'Money',
    items: [
      { label: 'Payments', icon: 'solar:wallet-2-linear', to: '/admin/payments', needs: 'money.view' },
      { label: 'Credit lines', icon: 'solar:card-transfer-linear', to: '/admin/credit', needs: 'money.view' },
      { label: 'Contracts', icon: 'solar:document-text-linear', to: '/admin/contracts', needs: 'money.view' },
    ],
  },
  {
    heading: 'Service',
    items: [
      { label: 'Support', icon: 'solar:headphones-round-linear', to: '/admin/tickets', needs: 'support.answer' },
      { label: 'Catalogue', icon: 'solar:box-linear', to: '/admin/services', needs: 'work.view' },
    ],
  },
  {
    heading: 'Website',
    items: [
      // Rows are added here as their screens land (ADR-021 gates); a link to
      // a page that does not exist yet is the dead control the panel refuses.
      { label: 'Overview', icon: 'solar:global-linear', to: '/admin/website', needs: 'website.view' },
      { label: 'Pages', icon: 'solar:documents-linear', to: '/admin/website/pages', needs: 'website.view' },
      { label: 'Navigation', icon: 'solar:compass-linear', to: '/admin/website/navigation', needs: 'website.view' },
      { label: 'Media', icon: 'solar:gallery-linear', to: '/admin/website/media', needs: 'website.view' },
      { label: 'SEO & redirects', icon: 'solar:magnifer-linear', to: '/admin/website/seo', needs: 'website.seo' },
      { label: 'Site settings', icon: 'solar:settings-minimalistic-linear', to: '/admin/website/settings', needs: 'website.view' },
      { label: 'Panel content', icon: 'solar:chat-square-like-linear', to: '/admin/website/panel', needs: 'website.view' },
    ],
  },
  {
    heading: 'System',
    items: [
      { label: 'Platform settings', icon: 'solar:settings-linear', to: '/admin/settings', needs: 'platform.settings' },
      { label: 'Audit log', icon: 'solar:clock-circle-linear', to: '/admin/audit', needs: 'team.manage' },
      { label: 'Tools', icon: 'solar:tuning-2-linear', to: '/admin/tools', needs: 'catalogue.edit' },
    ],
  },
]

/** The first destination a role can open — where that role lands after sign-in or invite acceptance. */
export function homeFor(roleValue: unknown): string {
  const role: StaffRole = isStaffRole(roleValue) ? roleValue : DEFAULT_STAFF_ROLE
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (!item.needs || can(role, item.needs)) {
        return item.to
      }
    }
  }
  return '/admin'
}
