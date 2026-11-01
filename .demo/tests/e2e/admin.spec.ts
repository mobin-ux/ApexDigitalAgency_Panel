import { expect, test } from '@playwright/test'
import { nextCodeFor } from '../api/staff-session.ts'
import { hydrated, OWNER, ownerClient, roleClient, trapErrors, useSession } from './support.ts'

/**
 * The admin console in a browser: the staff sign-in with an authenticator
 * code, every screen opening for the owner, and the access wall standing
 * exactly where the role matrix withholds a permission.
 */

const SCREENS = ['/admin', '/admin/projects', '/admin/tickets', '/admin/services', '/admin/users', '/admin/team', '/admin/payments', '/admin/credit', '/admin/contracts', '/admin/settings', '/admin/audit', '/admin/mail', '/admin/tools']

const WALL = /This area needs/

test('signed out, the console sends you to the staff sign-in', async ({ page }) => {
  await page.goto('/admin/projects')
  await expect(page).toHaveURL(/\/admin\/sign-in/)
  await expect(page.locator('#staff-email')).toBeVisible()
})

test('the owner signs in with a password and an authenticator code', async ({ page }) => {
  // The harness enrols the owner first if it has to, and keeps the secret.
  await ownerClient()
  const errors = trapErrors(page)

  await page.goto('/admin/sign-in')
  await hydrated(page)
  await page.locator('#staff-email').fill(OWNER.identifier)
  await page.locator('#staff-password').fill(OWNER.password)
  await page.locator('form button[type="submit"]').first().click()

  await expect(page.locator('#staff-code')).toBeVisible()
  await page.locator('#staff-code').fill(await nextCodeFor(OWNER.identifier))
  await page.locator('form button[type="submit"]').first().click()

  await expect(page).toHaveURL(/\/admin\/?$/)
  await expect(page.locator('h1').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('every console screen opens for the owner, records included', async ({ page, context }) => {
  const owner = await ownerClient()
  await useSession(context, owner)
  const errors = trapErrors(page)

  const project = (await owner.json<any>('/api/admin/projects?pageSize=1')).body.items[0]
  const client = (await owner.json<any>('/api/admin/users?role=CUSTOMER&pageSize=1')).body.items[0]
  const screens = [...SCREENS, ...(project ? [`/admin/projects/${project.id}`] : []), ...(client ? [`/admin/users/${client.id}`] : [])]

  for (const path of screens) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(200)
    await expect(page.locator('h1').first(), path).toBeVisible()
    await expect(page.getByText(WALL), path).toHaveCount(0)
  }
  expect(errors).toEqual([])
})

test('a support agent meets the access wall exactly where the matrix withholds', async ({ page, context }) => {
  await useSession(context, await roleClient('support'))

  for (const path of ['/admin', '/admin/projects', '/admin/tickets', '/admin/users']) {
    await page.goto(path)
    await expect(page.locator('h1').first(), path).toBeVisible()
    await expect(page.getByText(WALL), path).toHaveCount(0)
  }
  for (const path of ['/admin/payments', '/admin/team', '/admin/settings', '/admin/audit']) {
    await page.goto(path)
    await expect(page.getByText(WALL), path).toBeVisible()
  }
})

test('an admin sees instalments but no Waive button: forgiving money needs money.refund', async ({ page, context }) => {
  await useSession(context, await roleClient('admin'))
  await page.goto('/admin/payments?tab=installments')
  await expect(page.locator('h1').first()).toBeVisible()
  await hydrated(page)
  // Only meaningful where some plan can be collected (Collect shows for any money role).
  const collectable = await page.getByRole('button', { name: 'Collect' }).count()
  test.skip(collectable === 0, 'no collectable instalment plan in this database')
  // Admin sees money but holds no refund permission (shared/permissions.ts).
  await expect(page.getByRole('button', { name: 'Waive' })).toHaveCount(0)
})
