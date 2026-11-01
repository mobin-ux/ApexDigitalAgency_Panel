import { expect, test } from '@playwright/test'
import { resetRateLimits } from '../api/helpers.ts'
import { CUSTOMER, hydrated, OWNER, trapErrors } from './support.ts'

/**
 * The customer panel in a browser: signing in, the five pages it is made
 * of, and a staff account being turned away to the staff sign-in.
 */

async function signIn(page: import('@playwright/test').Page, identifier: string, password: string) {
  await resetRateLimits()
  await page.goto('/auth/login-1')
  await hydrated(page)
  await page.locator('input[autocomplete="username"]').fill(identifier)
  await page.locator('input[autocomplete="current-password"]').fill(password)
  await page.locator('form button[type="submit"]').last().click()
}

test('a customer signs in and every panel page opens', async ({ page }) => {
  const errors = trapErrors(page)
  await signIn(page, CUSTOMER.identifier, CUSTOMER.password)
  await expect(page).toHaveURL(/\/dashboards\//)

  for (const path of ['/dashboards/balance', '/dashboards/orders', '/dashboards/wallet', '/dashboards/support', '/dashboards/settings']) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(200)
    await expect(page.locator('h1').first(), path).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('a staff account at the customer sign-in is sent to the staff sign-in', async ({ page }) => {
  await signIn(page, OWNER.identifier, OWNER.password)
  await expect(page.getByRole('alert')).toContainText(/staff/i)
  await expect(page).not.toHaveURL(/\/dashboards\//)
})
