import { createError } from 'h3'
import { decryptField } from './crypto'
import prisma from './prisma'
import { matchTotp, useBackupCode } from './totp'

/**
 * Two-step verification state for one account, and the one check every
 * code-taking route uses: the sign-in step, turning it off, and new backup
 * codes. The secret only ever leaves `TwoFactor` decrypted inside this file.
 */

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
