#!/usr/bin/env node
/**
 * Create the first Super Admin (staff role `owner`) for the admin console
 * (ADR-025). There is no HTTP route for this on purpose: public signup only
 * ever makes customers, and invitations need an existing staff member to send
 * them, so the first owner is made here, by someone with shell access to the
 * database.
 *
 *   pnpm admin:create --email owner@apexdigi.co.uk --name "Firstname Lastname"
 *   DATABASE_URL=file:/opt/apex/dev.db node scripts/create-super-admin.mjs --email … --name …
 *
 * The account gets no usable password. The script prints a one-time link,
 * valid for 60 minutes, to the panel's own reset page, where the owner
 * chooses one; the staff sign-in then has them set up an authenticator app
 * before the first session. Nothing secret is written to the terminal except
 * that link.
 *
 * Refuses when an active owner already exists, unless `--allow-additional`
 * is passed (add further staff through Team & roles instead), and refuses an
 * address that already has an account.
 */
import { randomBytes } from 'node:crypto'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { PrismaClient } from '@prisma/client'

const LINK_TTL_MINUTES = 60
/** Every staff role but owner (shared/permissions.ts STAFF_ROLES); keep the two in step. */
const NARROWER_ROLES = ['admin', 'pm', 'support', 'finance', 'publisher', 'editor', 'readonly']

const { values } = parseArgs({
  options: {
    'email': { type: 'string' },
    'name': { type: 'string' },
    'site-url': { type: 'string' },
    'allow-additional': { type: 'boolean', default: false },
  },
})

function fail(message) {
  console.error(`create-super-admin: ${message}`)
  process.exit(1)
}

const email = (values.email ?? '').trim().toLowerCase()
const name = (values.name ?? '').trim().replace(/\s+/g, ' ')
if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email)) {
  fail('--email must be an email address')
}
if (name.length < 2 || name.length > 120) {
  fail('--name must be the person\'s name (2 to 120 characters)')
}
const siteUrl = (values['site-url'] ?? process.env.NUXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

const prisma = new PrismaClient(process.env.DATABASE_URL ? { datasources: { db: { url: process.env.DATABASE_URL } } } : undefined)

try {
  // Counted the way the server reads roles: an empty or unknown staffRole is
  // treated as `owner` (shared/permissions.ts DEFAULT_STAFF_ROLE).
  const owners = await prisma.user.count({
    where: { role: 'ADMIN', status: { not: 'SUSPENDED' }, OR: [{ staffRole: null }, { staffRole: { notIn: NARROWER_ROLES } }] },
  })
  if (owners > 0 && !values['allow-additional']) {
    fail(`${owners} active owner account${owners === 1 ? '' : 's'} already exist${owners === 1 ? 's' : ''}. Invite staff from Team & roles, or pass --allow-additional.`)
  }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    fail(`an account already exists for ${email}`)
  }

  const [first, ...rest] = name.split(' ')
  const token = randomBytes(32).toString('hex')
  const now = new Date()
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        // Not a bcrypt hash, so no password ever matches it: the reset link
        // below is the only way to set one.
        password: `!unset:${randomBytes(16).toString('hex')}`,
        firstName: first,
        lastName: rest.join(' ') || null,
        role: 'ADMIN',
        staffRole: 'owner',
        staffJoinedAt: now,
        verifiedAt: now,
      },
      select: { id: true, email: true },
    })
    await tx.passwordResetToken.create({
      data: { email, token, userId: created.id, expiresAt: new Date(now.getTime() + LINK_TTL_MINUTES * 60_000) },
    })
    await tx.auditLog.create({
      data: {
        actorId: 'cli',
        actorEmail: 'scripts/create-super-admin',
        action: 'admin.team.bootstrap-owner',
        targetType: 'User',
        targetId: created.id,
        metadata: JSON.stringify({ email, name, additional: owners > 0 }),
        roleAtTime: null,
      },
    })
    return created
  })

  console.log(`Created owner ${user.email}.`)
  console.log(`Set the password within ${LINK_TTL_MINUTES} minutes:`)
  console.log(`  ${siteUrl}/auth/recover?token=${token}`)
  console.log(`Then sign in at ${siteUrl}/admin/sign-in and set up an authenticator app.`)
}
finally {
  await prisma.$disconnect()
}
