import { defineNitroPlugin } from 'nitropack/runtime'
import { isStaffRole } from '../../shared/permissions'
import { log } from '../utils/logger'
import prisma from '../utils/prisma'

/**
 * A staff account whose role was never chosen is treated as an owner (the
 * documented fallback in shared/permissions.ts, kept so no one is locked out),
 * which gives full access to an account nobody decided should have it
 * (AUD-17). The fallback stays; the panel says so once at start-up, and Team
 * & access marks the account until an owner picks its role.
 */
const security = log('security')

export default defineNitroPlugin(() => {
  void (async () => {
    try {
      const staff = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true, staffRole: true } })
      const unset = staff.filter(s => !isStaffRole(s.staffRole)).map(s => s.id)
      if (unset.length) {
        security.warn('security.staff-role-unset', `${unset.length} active staff account(s) have no role and act as owners; choose one in Team & access`, { data: { userIds: unset } })
      }
    }
    catch (error) {
      security.warn('security.staff-role-unset', 'Could not check staff roles', { error })
    }
  })()
})
