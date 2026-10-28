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

export function staffInviteMail(brand: Brand, input: { name: string, role: string, inviter: string, url: string, expiresAt: Date }): MailDraft {
  const expires = input.expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return {
    subject: `${input.inviter} invited you to the ${brand.siteName} panel`,
    content: {
      heading: `You are invited to join ${brand.siteName}`,
      paragraphs: [
        `Hello ${input.name}. ${input.inviter} has invited you to the ${brand.siteName} staff panel as ${input.role}.`,
        `Accept the invitation to choose a password and sign in. The link works once and expires on ${expires}.`,
      ],
      action: { label: 'Accept the invitation', url: input.url },
      footer: footer(brand),
    },
  }
}

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

export function cmsReviewMail(brand: Brand, input: { heading: string, lines: string[], url: string }): MailDraft {
  return {
    subject: `${brand.siteName} website: ${input.heading}`,
    content: {
      heading: input.heading,
      paragraphs: input.lines,
      action: { label: 'Open the document', url: input.url },
      footer: footer(brand),
    },
  }
}
