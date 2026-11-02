import type { Permission, StaffRole } from '../../shared/permissions.ts'
import { expect, test } from '@playwright/test'
import { can } from '../../shared/permissions.ts'
import { ownerClient, roleClient, trapErrors, useSession } from './support.ts'

/**
 * The console's Website group and Site settings in a browser (ADR-026,
 * phase G): every screen opens for the owner, an editor record included,
 * and for each other role the access wall stands exactly where
 * `shared/permissions.ts` withholds the screen's permission. The table
 * mirrors the Website and System rows of `app/utils/adminNav.ts`.
 *
 * The site's visit beacon is not exercised here: a browser under
 * automation sends none (`navigator.webdriver`). `analytics.test.ts`
 * covers it over HTTP.
 */

const SCREENS: [path: string, needs: Permission][] = [
  ['/admin/website/pages', 'website.view'],
  ['/admin/website/insights', 'website.view'],
  ['/admin/website/case-studies', 'website.view'],
  ['/admin/website/media', 'website.view'],
  ['/admin/website/navigation', 'website.view'],
  ['/admin/website/seo', 'website.seo'],
  ['/admin/website/enquiries', 'leads.handle'],
  ['/admin/website/analytics', 'analytics.view'],
  ['/admin/site-settings', 'website.settings'],
]

const WALL = /This area needs/

test('every Website screen and Site settings opens for the owner', async ({ page, context }) => {
  const owner = await ownerClient()
  await useSession(context, owner)
  const errors = trapErrors(page)

  const doc = (await owner.json<any>('/api/admin/website/documents?collection=pages&pageSize=1')).body.items?.[0]
  const screens = [...SCREENS.map(([path]) => path), ...(doc ? [`/admin/website/pages/${doc.id}`] : [])]

  for (const path of screens) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(200)
    await expect(page.locator('h1').first(), path).toBeVisible()
    await expect(page.getByText(WALL), path).toHaveCount(0)
  }
  expect(errors).toEqual([])
})

for (const role of ['admin', 'pm', 'support', 'finance', 'readonly'] as StaffRole[]) {
  test(`${role}: the wall stands exactly where the matrix withholds`, async ({ page, context }) => {
    await useSession(context, await roleClient(role))
    for (const [path, needs] of SCREENS) {
      await page.goto(path)
      if (can(role, needs)) {
        await expect(page.locator('h1').first(), `${role} ${path}`).toBeVisible()
        await expect(page.getByText(WALL), `${role} ${path}`).toHaveCount(0)
      }
      else {
        await expect(page.getByText(WALL), `${role} ${path}`).toBeVisible()
      }
    }
  })
}
