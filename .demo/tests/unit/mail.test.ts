import assert from 'node:assert/strict'
import process from 'node:process'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { describe, it } from 'node:test'
import { absoluteUrl, escapeHtml, renderHtml, renderText } from '../../server/utils/mail/render.ts'
import { MAX_ATTEMPTS, nextAttemptFor } from '../../server/utils/mail/schedule.ts'
import { notificationMail, passwordResetMail } from '../../server/utils/mail/templates.ts'

/**
 * The renderer, the retry schedule and the templates, without Nuxt or a
 * database: what an email says, that nothing in it is unescaped, and that
 * every link is absolute.
 */
const brand = { siteName: 'Apex Digital Agency', supportEmail: 'support@example.test' }

describe('mail rendering', () => {
  it('escapes every slot in the HTML part and keeps the text part plain', () => {
    const content = {
      heading: 'Tom <script>alert(1)</script> & co',
      paragraphs: ['Line "one"\nline \'two\'', 'a < b > c'],
      action: { label: 'Open <it>', url: 'https://panel.example.test/x?a=1&b=2' },
      footer: 'Bye & thanks',
    }
    const html = renderHtml(content)
    assert.ok(!html.includes('<script>'), 'a script tag never reaches the HTML')
    assert.ok(html.includes('Tom &lt;script&gt;alert(1)&lt;/script&gt; &amp; co'))
    assert.ok(html.includes('Line &quot;one&quot;<br>line &#39;two&#39;'), 'line breaks become <br>, quotes are escaped')
    assert.ok(html.includes('href="https://panel.example.test/x?a=1&amp;b=2"'), 'the URL is attribute-escaped')
    assert.ok(html.includes('>Open &lt;it&gt;</a>'))
    assert.ok(html.includes('Bye &amp; thanks'))

    const text = renderText(content)
    assert.equal(text, 'Tom <script>alert(1)</script> & co\n\nLine "one"\nline \'two\'\n\na < b > c\n\nOpen <it>: https://panel.example.test/x?a=1&b=2\n\nBye & thanks\n')
  })

  it('refuses an action that is not an http(s) link', () => {
    assert.throws(() => renderText({ heading: 'x', paragraphs: [], action: { label: 'go', url: 'javascript:alert(1)' } }), /http\(s\)/)
    assert.throws(() => renderHtml({ heading: 'x', paragraphs: [], action: { label: 'go', url: '/relative' } }), /http\(s\)/)
  })

  it('builds absolute links from the public origin and refuses anything that is not a panel path', () => {
    const before = process.env.NUXT_PUBLIC_SITE_URL
    process.env.NUXT_PUBLIC_SITE_URL = 'https://panel.example.test/'
    try {
      assert.equal(absoluteUrl('/auth/recover?token=abc'), 'https://panel.example.test/auth/recover?token=abc')
      assert.throws(() => absoluteUrl('//evil.test/x'), /Not a panel path/)
      assert.throws(() => absoluteUrl('https://evil.test/x'), /Not a panel path/)
      assert.throws(() => absoluteUrl('auth/recover'), /Not a panel path/)
    }
    finally {
      if (before === undefined) {
        delete process.env.NUXT_PUBLIC_SITE_URL
      }
      else {
        process.env.NUXT_PUBLIC_SITE_URL = before
      }
    }
  })

  it('escapeHtml covers the five characters that matter', () => {
    assert.equal(escapeHtml(`<a href="x">it's & co</a>`), '&lt;a href=&quot;x&quot;&gt;it&#39;s &amp; co&lt;/a&gt;')
  })
})

describe('retry schedule', () => {
  it('doubles from one minute and caps at an hour', () => {
    const now = new Date('2026-10-28T10:00:00Z')
    const minutes = (attempts: number) => (nextAttemptFor(attempts, now).getTime() - now.getTime()) / 60_000
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 20].map(minutes), [1, 2, 4, 8, 16, 32, 60, 60])
    assert.equal(MAX_ATTEMPTS, 6)
  })
})

describe('templates', () => {
  it('a notification email carries the title, the message and the link, and says why it was sent', () => {
    const draft = notificationMail(brand, { title: 'Waiting on you', message: 'Your manager asked for the logo files.', url: 'https://panel.example.test/dashboards/orders?project=1' })
    assert.equal(draft.subject, 'Apex Digital Agency: Waiting on you')
    const text = renderText(draft.content)
    assert.match(text, /^Waiting on you\n/)
    assert.match(text, /Your manager asked for the logo files\./)
    assert.match(text, /Open in the panel: https:\/\/panel\.example\.test\/dashboards\/orders\?project=1/)
    assert.match(text, /notification emails are on/)
  })

  it('a reset email names the expiry and never claims the password changed', () => {
    const draft = passwordResetMail(brand, { url: 'https://panel.example.test/auth/recover?token=t', expiresMinutes: 60 })
    const text = renderText(draft.content)
    assert.match(text, /expires in 60 minutes/)
    assert.match(text, /your password has not changed/)
  })
})
