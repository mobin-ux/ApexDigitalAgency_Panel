import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { describe, it } from 'node:test'
import { selectRecipients } from '../../server/utils/notify-rules.ts'

/**
 * Who a notification reaches (ADR-022): everyone named gets the in-app
 * row, once; the email follows the switch unless the message is about the
 * account itself.
 */
const people = [
  { id: 'a', email: 'a@example.test', emailNotifications: true, status: 'ACTIVE' },
  { id: 'b', email: 'b@example.test', emailNotifications: false, status: 'ACTIVE' },
  { id: 'c', email: null, emailNotifications: true, status: 'ACTIVE' },
  { id: 'd', email: 'd@example.test', emailNotifications: true, status: 'SUSPENDED' },
]

describe('notification recipients', () => {
  it('emails only accounts with an address that kept the switch on and are not suspended; every account gets the row', () => {
    const { rows, emails } = selectRecipients(people, {})
    assert.deepEqual(rows, ['a', 'b', 'c', 'd'])
    assert.deepEqual(emails.map(e => e.id), ['a'])
  })

  it('an account notice (`always`) ignores the switch but still needs an address and an active account', () => {
    const { emails } = selectRecipients(people, { always: true })
    assert.deepEqual(emails.map(e => e.id), ['a', 'b'])
  })

  it('leaves out the person who caused the event and collapses duplicates', () => {
    const { rows, emails } = selectRecipients([people[0]!, people[0]!, people[1]!], { excludeUserId: 'b' })
    assert.deepEqual(rows, ['a'])
    assert.deepEqual(emails.map(e => e.email), ['a@example.test'])
  })
})
