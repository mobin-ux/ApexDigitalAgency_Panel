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

/** The six fixed staff roles. No per-user overrides — spec §3. */
export const STAFF_ROLES = ['owner', 'admin', 'pm', 'support', 'finance', 'readonly'] as const

export type StaffRole = typeof STAFF_ROLES[number]

/** The eleven things a staff member can be allowed to do. */
export const PERMISSION_KEYS = [
  'work.view',
  'work.assign',
  'work.release',
  'money.view',
  'credit.approve',
  'money.refund',
  'clients.approve',
  'support.answer',
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
    covers: 'projects, briefs, deliverables and support',
  },
  support: {
    key: 'support',
    label: 'Support agent',
    covers: 'support requests and client contact details',
  },
  finance: {
    key: 'finance',
    label: 'Finance',
    covers: 'payments, refunds and reporting',
  },
  readonly: {
    key: 'readonly',
    label: 'Read-only',
    covers: 'reading projects and clients',
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
