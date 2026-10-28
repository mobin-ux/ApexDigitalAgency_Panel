import process from 'node:process'

/**
 * One shape for every email the panel sends, rendered twice: plain text,
 * and a minimal HTML document with every string escaped. Templates build
 * the shape; nothing else writes markup, so an email cannot carry a
 * customer's text unescaped or a link that is not an absolute http(s) URL.
 * Pure functions: the unit tests run them without Nuxt.
 */
export interface MailContent {
  /** The first line, and the HTML heading. */
  heading: string
  /** Short paragraphs, in order. Text only; line breaks are kept. */
  paragraphs: string[]
  /** One button, rendered as "label: url" in the text part. */
  action?: { label: string, url: string }
  /** A closing line, for example who to reply to. */
  footer?: string
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** The panel's public origin, without a trailing slash. */
export function panelOrigin(): string {
  const configured = (process.env.NUXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/$/, '')
  if (configured) {
    return configured
  }
  if (process.env.NODE_ENV === 'production') {
    // A relative link in an email points at the reader's mail client, not at the panel.
    throw new MailRenderError('NUXT_PUBLIC_SITE_URL is unset, so links in emails cannot be built')
  }
  return 'http://localhost:3000'
}

/** An absolute panel link for a path such as `/auth/recover?token=…`. */
export function absoluteUrl(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new MailRenderError(`Not a panel path: ${path}`)
  }
  return `${panelOrigin()}${path}`
}

export class MailRenderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MailRenderError'
  }
}

function assertHttpUrl(url: string): void {
  if (!/^https?:\/\//.test(url)) {
    throw new MailRenderError(`An email action must link to an http(s) address, got ${url}`)
  }
}

export function renderText(content: MailContent): string {
  const lines: string[] = [content.heading, '']
  for (const paragraph of content.paragraphs) {
    lines.push(paragraph, '')
  }
  if (content.action) {
    assertHttpUrl(content.action.url)
    lines.push(`${content.action.label}: ${content.action.url}`, '')
  }
  if (content.footer) {
    lines.push(content.footer, '')
  }
  return lines.join('\n').replace(/\n+$/, '\n')
}

/**
 * Deliberately plain: no images, no external styles, one column, and
 * colours written inline because mail clients read nothing else. The
 * violet is the brand accent (DESIGN_SYSTEM.md §2); the greys are the
 * light theme's ink and muted text.
 */
export function renderHtml(content: MailContent): string {
  const paragraphs = content.paragraphs
    .map(p => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2b3236;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
  let action = ''
  if (content.action) {
    assertHttpUrl(content.action.url)
    const href = escapeHtml(content.action.url)
    action = `<p style="margin:8px 0 24px;"><a href="${href}" style="display:inline-block;background:#7d53f2;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:1;padding:14px 22px;border-radius:999px;">${escapeHtml(content.action.label)}</a></p>\n<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#6b747b;">If the button does not work, copy this address into your browser:<br><a href="${href}" style="color:#7d53f2;word-break:break-all;">${href}</a></p>`
  }
  const footer = content.footer
    ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b747b;">${escapeHtml(content.footer)}</p>`
    : ''
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f8f9;font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">
<div style="background:#ffffff;border:1px solid #e3e6e8;border-radius:16px;padding:28px 28px 24px;">
<h1 style="margin:0 0 20px;font-size:22px;line-height:1.25;font-weight:800;color:#0b1517;">${escapeHtml(content.heading)}</h1>
${paragraphs}
${action}
${footer}
</div>
</div>
</body>
</html>
`
}
