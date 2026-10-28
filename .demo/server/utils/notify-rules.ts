/**
 * Who a notification reaches (ADR-022), as a pure function the unit tests
 * can read without Prisma or Nuxt: everyone named gets the in-app row
 * (once, and never the person who caused the event); the email goes only
 * to accounts with an address that are not suspended and have either kept
 * notification emails on or are being told something about their account
 * (`always`).
 */
export interface RecipientRow {
  id: string
  email: string | null
  emailNotifications: boolean
  status: string
}

export interface RecipientRules {
  always?: boolean
  excludeUserId?: string | null
}

export function selectRecipients(users: RecipientRow[], rules: RecipientRules): { rows: string[], emails: { id: string, email: string }[] } {
  const seen = new Set<string>()
  const rows: string[] = []
  const emails: { id: string, email: string }[] = []
  for (const user of users) {
    if (seen.has(user.id) || user.id === rules.excludeUserId) {
      continue
    }
    seen.add(user.id)
    rows.push(user.id)
    if (user.email && user.status !== 'SUSPENDED' && (user.emailNotifications || rules.always)) {
      emails.push({ id: user.id, email: user.email })
    }
  }
  return { rows, emails }
}
