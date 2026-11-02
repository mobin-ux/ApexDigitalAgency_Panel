/**
 * Staff roles and permissions — the single object this phase's screens read
 * AND the server enforces (Phase 9 Admin, badge 26).
 *
 * Documentation and enforcement live here together on purpose. The role
 * matrix on /admin/team renders straight out of `PERMISSIONS`, the sidebar
 * decides padlock-vs-link from `can()`, and every `/api/admin/**` route
 * gates on the same table via `requireStaffPermission()`. A tick on the
 * matrix and a hidden panel elsewhere therefore cannot disagree — there is
 * no second copy to fall out of step.
 *
 * Imported from both halves of the app by explicit path (server uses a
 * relative import, the app uses `~~/shared/...`), so it stays one module
 * rather than relying on an auto-import that only exists on one side.
 */

/**
 * The eight fixed staff roles. No per-user overrides — spec §3. Publisher
 * and Editor arrived with the website CMS (ADR-021): they hold the
 * `website.*` permissions and nothing else, so a content hire never sees
 * client money or project work.
 */
export const STAFF_ROLES = ['owner', 'admin', 'pm', 'support', 'finance', 'publisher', 'editor', 'readonly'] as const

export type StaffRole = typeof STAFF_ROLES[number]

/**
 * The nineteen things a staff member can be allowed to do. The Website group
 * (ADR-026) follows `Admin Console.dc.html`: project managers and support
 * agents draft content and handle enquiries, Owner and Admin publish and
 * run navigation, SEO and redirects, and only the Owner changes site
 * settings.
 */
export const PERMISSION_KEYS = [
  'work.view',
  'work.assign',
  'work.release',
  'money.view',
  'credit.approve',
  'money.refund',
  'clients.approve',
  'support.answer',
  'website.view',
  'website.edit',
  'website.media',
  'website.publish',
  'website.seo',
  'website.settings',
  'leads.handle',
  'analytics.view',
  'catalogue.edit',
  'team.manage',
  'platform.settings',
] as const

export type Permission = typeof PERMISSION_KEYS[number]

export interface RoleDef {
  key: StaffRole
  label: string
  /** Plain-English scope, shown on the blocked-page wall and in the role pickers. */
  covers: string
}

export const ROLES: Record<StaffRole, RoleDef> = {
  owner: {
    key: 'owner',
    label: 'Owner',
    covers: 'everything, including billing and ownership',
  },
  admin: {
    key: 'admin',
    label: 'Admin',
    covers: 'clients, projects, credit and access, but not platform settings',
  },
  pm: {
    key: 'pm',
    label: 'Project manager',
    covers: 'projects, briefs, deliverables, support, website drafts and enquiries',
  },
  support: {
    key: 'support',
    label: 'Support agent',
    covers: 'support requests, client contact details, website drafts and enquiries',
  },
  finance: {
    key: 'finance',
    label: 'Finance',
    covers: 'payments, refunds, reporting and website analytics',
  },
  publisher: {
    key: 'publisher',
    label: 'Publisher',
    covers: 'website content, media, publishing, SEO and redirects',
  },
  editor: {
    key: 'editor',
    label: 'Editor',
    covers: 'drafting website content and media, sent for review',
  },
  readonly: {
    key: 'readonly',
    label: 'Read-only',
    covers: 'reading projects, clients, website content and analytics',
  },
}

export interface PermissionDef {
  key: Permission
  label: string
  /** The concrete actions this permission covers, shown under the label. */
  detail: string
  allow: StaffRole[]
}

/**
 * The matrix. Row order is the order the screen renders, which runs from
 * the permission everyone has down to the one only an owner has.
 */
export const PERMISSIONS: PermissionDef[] = [
  { key: 'work.view', label: 'See project work', detail: 'Orders queue, briefs, stages', allow: ['owner', 'admin', 'pm', 'support', 'finance', 'readonly'] },
  { key: 'work.assign', label: 'Assign and move stages', detail: 'Own a project, advance it', allow: ['owner', 'admin', 'pm'] },
  { key: 'work.release', label: 'Release deliverables', detail: 'Hand over source files', allow: ['owner', 'admin', 'pm'] },
  { key: 'money.view', label: 'See money', detail: 'Values, plans, payments', allow: ['owner', 'admin', 'finance'] },
  { key: 'credit.approve', label: 'Approve credit lines', detail: 'Set and adjust limits', allow: ['owner', 'admin'] },
  { key: 'money.refund', label: 'Refund a payment', detail: 'Full or partial', allow: ['owner', 'finance'] },
  { key: 'clients.approve', label: 'Approve client accounts', detail: 'Portal signup, suspend, restore', allow: ['owner', 'admin'] },
  { key: 'support.answer', label: 'Answer support', detail: 'Reply, assign, resolve', allow: ['owner', 'admin', 'pm', 'support'] },
  { key: 'website.view', label: 'See website content', detail: 'Pages, articles, case studies, media, menus', allow: ['owner', 'admin', 'pm', 'support', 'finance', 'publisher', 'editor', 'readonly'] },
  { key: 'website.edit', label: 'Draft website content', detail: 'Pages, articles and case studies, sent for review', allow: ['owner', 'admin', 'pm', 'support', 'publisher', 'editor'] },
  { key: 'website.media', label: 'Upload and edit media', detail: 'Upload, alt text, delete unused files', allow: ['owner', 'admin', 'pm', 'support', 'publisher', 'editor'] },
  { key: 'website.publish', label: 'Approve and publish', detail: 'Publish, request changes, restore', allow: ['owner', 'admin', 'publisher'] },
  { key: 'website.seo', label: 'Navigation, SEO and redirects', detail: 'Menus, search settings, sitemap, redirects', allow: ['owner', 'admin', 'publisher'] },
  { key: 'website.settings', label: 'Site settings', detail: 'Company details, sharing, availability', allow: ['owner'] },
  { key: 'leads.handle', label: 'Handle enquiries', detail: 'Read, assign, note, mark won or lost', allow: ['owner', 'admin', 'pm', 'support'] },
  { key: 'analytics.view', label: 'See website analytics', detail: 'Visits, pages, sources, enquiries', allow: ['owner', 'admin', 'pm', 'finance', 'readonly'] },
  { key: 'catalogue.edit', label: 'Edit services and prices', detail: 'Catalogue and help articles', allow: ['owner', 'admin'] },
  { key: 'team.manage', label: 'Manage team and roles', detail: 'Invite, change role, suspend', allow: ['owner', 'admin'] },
  { key: 'platform.settings', label: 'Platform settings', detail: 'Reply promise, credit rules', allow: ['owner'] },
]

const BY_KEY = new Map<Permission, PermissionDef>(PERMISSIONS.map(p => [p.key, p]))

/** True when `role` holds `permission`. Unknown roles hold nothing. */
export function can(role: StaffRole | null | undefined, permission: Permission): boolean {
  if (!role) {
    return false
  }
  return BY_KEY.get(permission)?.allow.includes(role) ?? false
}

/** Every permission a role holds, in matrix order. */
export function permissionsOf(role: StaffRole | null | undefined): Permission[] {
  return role ? PERMISSIONS.filter(p => p.allow.includes(role)).map(p => p.key) : []
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value)
}

/**
 * The role an existing admin account holds when it has no `staffRole` yet.
 *
 * Every account that could reach `/admin/**` before this phase had the full
 * panel, so the backfill — and the fallback for any row the migration
 * missed — is `owner`. That is what makes retrofitting the permission gate
 * onto the existing endpoints behaviour-identical rather than a lockout.
 */
export const DEFAULT_STAFF_ROLE: StaffRole = 'owner'

/** Which roles hold a permission, as labels — for the blocked-page wall. */
export function rolesWith(permission: Permission): RoleDef[] {
  return (BY_KEY.get(permission)?.allow ?? []).map(key => ROLES[key])
}
