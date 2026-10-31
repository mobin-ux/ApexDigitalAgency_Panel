import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { describe, it } from 'node:test'
import { can, PERMISSION_KEYS, PERMISSIONS, permissionsOf, ROLES, rolesWith, STAFF_ROLES } from '../../shared/permissions.ts'

describe('permission matrix (ADR-016 + ADR-021)', () => {
  it('declares eight roles and seventeen permissions, each defined once', () => {
    assert.equal(STAFF_ROLES.length, 8)
    assert.equal(PERMISSION_KEYS.length, 17)
    assert.deepEqual(PERMISSIONS.map(p => p.key).sort(), [...PERMISSION_KEYS].sort())
    for (const role of STAFF_ROLES) {
      assert.ok(ROLES[role], `${role} has a definition`)
    }
  })

  it('an owner holds everything and every permission names at least one role', () => {
    for (const perm of PERMISSIONS) {
      assert.ok(perm.allow.includes('owner'), perm.key)
      assert.ok(rolesWith(perm.key).length > 0, perm.key)
    }
  })

  it('editor and publisher hold website permissions and nothing else', () => {
    for (const role of ['editor', 'publisher'] as const) {
      const held = permissionsOf(role)
      assert.ok(held.length > 0)
      assert.ok(held.every(p => p.startsWith('website.')), `${role} holds only website.*: ${held.join(', ')}`)
    }
    assert.equal(can('editor', 'website.publish'), false)
    assert.equal(can('publisher', 'website.publish'), true)
    assert.equal(can('publisher', 'website.settings'), false)
    assert.equal(can('admin', 'website.settings'), true)
    assert.equal(can('readonly', 'website.view'), true)
    assert.equal(can('readonly', 'website.edit'), false)
  })

  it('the pre-CMS grants are unchanged', () => {
    const before: Record<string, string[]> = {
      'work.view': ['owner', 'admin', 'pm', 'support', 'finance', 'readonly'],
      'work.assign': ['owner', 'admin', 'pm'],
      'work.release': ['owner', 'admin', 'pm'],
      'money.view': ['owner', 'admin', 'finance'],
      'credit.approve': ['owner', 'admin'],
      'money.refund': ['owner', 'finance'],
      'clients.approve': ['owner', 'admin'],
      'support.answer': ['owner', 'admin', 'pm', 'support'],
      'catalogue.edit': ['owner', 'admin'],
      'team.manage': ['owner', 'admin'],
      'platform.settings': ['owner'],
    }
    for (const [key, allow] of Object.entries(before)) {
      assert.deepEqual(PERMISSIONS.find(p => p.key === key)?.allow, allow, key)
    }
  })
})
