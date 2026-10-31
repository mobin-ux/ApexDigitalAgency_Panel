import type { Brand } from './outbox'
import type { MailContent } from './render'

/**
 * Every email the panel sends, as the structured shape `render.ts` turns
 * into text and HTML. Pure: the brand (site name, support address) and
 * every link are passed in, so the unit tests can read what a message
 * says without a database. British English, sentence case, no emoji.
 */

export interface MailDraft {
  subject: string
  content: MailContent
}

function footer(brand: Brand): string {
  return `This email was sent by ${brand.siteName}. Reply to it, or write to ${brand.supportEmail}, if something looks wrong.`
}

export function testMail(brand: Brand, input: { name: string, from: string, panelUrl: string }): MailDraft {
  return {
    subject: `${brand.siteName}: test email`,
    content: {
      heading: 'Email is working',
      paragraphs: [
        `Hello ${input.name}. You asked the panel to send a test email, and this is it.`,
        `Messages are sent from ${input.from}, and replies go to ${brand.supportEmail}.`,
      ],
      action: { label: 'Open the panel', url: input.panelUrl },
      footer: footer(brand),
    },
  }
}

export function passwordResetMail(brand: Brand, input: { url: string, expiresMinutes: number }): MailDraft {
  return {
    subject: `${brand.siteName}: reset your password`,
    content: {
      heading: 'Reset your password',
      paragraphs: [
        'Someone asked to reset the password for this account. If that was you, choose a new password with the button below.',
        `The link works once and expires in ${input.expiresMinutes} minutes. If you did not ask for this, you can ignore this email: your password has not changed.`,
      ],
      action: { label: 'Choose a new password', url: input.url },
      footer: footer(brand),
    },
  }
}

export function verifyEmailMail(brand: Brand, input: { name: string | null, url: string, expiresHours: number }): MailDraft {
  return {
    subject: `${brand.siteName}: confirm your email address`,
    content: {
      heading: 'Confirm your email address',
      paragraphs: [
        `${input.name ? `Hello ${input.name}. ` : ''}Thanks for creating your ${brand.siteName} account. Please confirm that this address is yours so we can reach you about your projects.`,
        `The link expires in ${input.expiresHours} hours. If you did not create an account, you can ignore this email.`,
      ],
      action: { label: 'Confirm my email', url: input.url },
      footer: footer(brand),
    },
  }
}

/** Every in-app notification, mirrored (ADR-022). */
export function notificationMail(brand: Brand, input: { title: string, message: string, url: string | null }): MailDraft {
  return {
    subject: `${brand.siteName}: ${input.title}`,
    content: {
      heading: input.title,
      paragraphs: [input.message],
      ...(input.url ? { action: { label: 'Open in the panel', url: input.url } } : {}),
      footer: `You are receiving this because notification emails are on for your ${brand.siteName} account. Turn them off under Settings. ${footer(brand)}`,
    },
  }
}
