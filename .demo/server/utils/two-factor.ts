import { createError } from 'h3'
import { decryptField, encryptField } from './crypto'
import prisma from './prisma'
import { matchTotp, newBackupCodes, newTotpSecret, otpauthUri, useBackupCode } from './totp'

/**
 * Two-step verification state for one account, and the one check every
 * code-taking route uses: the sign-in step, turning it off, and new backup
 * codes. The secret only ever leaves `TwoFactor` decrypted inside this file,
 * apart from the moment of setup, when the app has to be shown it.
 *
 * Setup is two calls, used by Settings and by the staff sign-in's enrolment
 * (ADR-025): `beginTwoFactorSetup` keeps a new secret as `pending`, and
 * `confirmTwoFactorSetup` turns it on once a code proves the app has it.
 */

/** A new pending secret (replacing any earlier one) and the URI the QR code holds. */
export async function beginTwoFactorSetup(userId: string): Promise<{ secret: string, uri: string }> {
  const existing = await prisma.twoFactor.findUnique({ where: { userId }, select: { enabledAt: true } })
  if (existing?.enabledAt) {
    throw createError({ statusCode: 409, message: 'Two-step verification is already on.' })
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true } })
  const secret = newTotpSecret()
  const pending = encryptField(secret)
  await prisma.twoFactor.upsert({
    where: { userId },
    create: { userId, pending },
    update: { pending },
  })
  return { secret, uri: otpauthUri(secret, user?.email ?? user?.phone ?? 'Apex account') }
}

/**
 * Turn two-step on with a code for the pending secret. Returns the ten backup
 * codes, the only time they are shown: the server keeps their hashes.
 */
export async function confirmTwoFactorSetup(userId: string, code: string): Promise<string[]> {
  const row = await prisma.twoFactor.findUnique({ where: { userId } })
  if (row?.enabledAt) {
    throw createError({ statusCode: 409, message: 'Two-step verification is already on.' })
  }
  if (!row?.pending) {
    throw createError({ statusCode: 400, message: 'Start again: scan the new code first.' })
  }
  const secret = decryptField(row.pending)
  const step = matchTotp(secret, code, null)
  if (step === null) {
    throw createError({ statusCode: 400, message: 'That code did not match. Check the time on your phone and try the newest code.' })
  }
  const { codes, hashes } = newBackupCodes()
  const { count } = await prisma.twoFactor.updateMany({
    where: { userId, pending: row.pending, enabledAt: null },
    data: { secret: row.pending, pending: null, enabledAt: new Date(), lastStep: step, backupCodes: JSON.stringify(hashes) },
  })
  if (!count) {
    throw createError({ statusCode: 409, message: 'Two-step verification changed in another window. Reload and try again.' })
  }
  return codes
}

export async function twoFactorStatus(userId: string) {
  const row = await prisma.twoFactor.findUnique({ where: { userId }, select: { enabledAt: true, backupCodes: true } })
  return {
    enabled: Boolean(row?.enabledAt),
    enabledAt: row?.enabledAt ?? null,
    backupCodesLeft: row?.enabledAt ? (JSON.parse(row.backupCodes ?? '[]') as string[]).length : 0,
  }
}

/**
 * Check a code from the authenticator app or, if allowed, a backup code, and
 * record its use so it cannot be used again. The update is conditional on the
 * row being as it was read, so two requests racing with one code cannot both
 * succeed. Returns how it was verified, or null for a wrong code.
 */
export async function verifySecondFactor(userId: string, input: string, opts: { backup?: boolean } = {}): Promise<'app' | 'backup' | null> {
  const row = await prisma.twoFactor.findUnique({ where: { userId } })
  if (!row?.enabledAt || !row.secret) {
    throw createError({ statusCode: 400, message: 'Two-step verification is not on for this account.' })
  }
  let secret: string
  try {
    secret = decryptField(row.secret)
  }
  catch {
    throw createError({ statusCode: 500, message: 'Two-step verification could not be checked. Contact us.' })
  }
  const step = matchTotp(secret, input, row.lastStep)
  if (step !== null) {
    const { count } = await prisma.twoFactor.updateMany({ where: { userId, lastStep: row.lastStep }, data: { lastStep: step } })
    return count ? 'app' : null
  }
  if (opts.backup) {
    const left = useBackupCode(JSON.parse(row.backupCodes ?? '[]') as string[], input)
    if (left) {
      const { count } = await prisma.twoFactor.updateMany({ where: { userId, backupCodes: row.backupCodes }, data: { backupCodes: JSON.stringify(left) } })
      return count ? 'backup' : null
    }
  }
  return null
}
