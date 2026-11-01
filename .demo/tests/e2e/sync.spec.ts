import { expect, test } from '@playwright/test'
import { customerClient, ownerClient, useSession } from './support.ts'

/**
 * One request across both panels: the client asks, the request is on the
 * staff screen; staff answer, the answer is on the client's screen.
 */
test('a client request reaches the console, and the staff answer reaches the client', async ({ browser }) => {
  const customer = await customerClient()
  const owner = await ownerClient()
  const subject = `Smoke ${Date.now().toString(36)}`

  const created = await customer.json<any>('/api/support/create', { method: 'POST', json: { subject, category: 'other', message: 'Can you check my last payment, please?' } })
  expect(created.status).toBe(200)
  const ticketId = created.body.ticket.id

  const staffSide = await browser.newContext()
  await useSession(staffSide, owner)
  const staffPage = await staffSide.newPage()
  await staffPage.goto(`/admin/tickets?ticket=${ticketId}`)
  await expect(staffPage.getByText(subject).first()).toBeVisible()
  await staffSide.close()

  const answer = `We checked it: all paid. (${subject})`
  const reply = await owner.json<any>(`/api/admin/tickets/${ticketId}/reply`, { method: 'POST', json: { content: answer } })
  expect(reply.status).toBe(200)

  const clientSide = await browser.newContext()
  await useSession(clientSide, customer)
  const clientPage = await clientSide.newPage()
  await clientPage.goto(`/dashboards/support?ticket=${ticketId}`)
  await expect(clientPage.getByText(answer)).toBeVisible()
  await clientSide.close()
})
