import process from 'node:process'
import { PrismaClient } from '@prisma/client'

/**
 * Shared PrismaClient singleton — every server route must use this
 * instead of instantiating its own client.
 *
 * In development, Nitro hot-reloads route modules on every change; a
 * per-module `new PrismaClient()` would leak one connection pool per
 * reload. Caching the instance on `globalThis` survives HMR. In
 * production the module is evaluated once, so a plain instance is fine.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/**
 * The schema names the database literally (`file:./dev.db`, resolved next to
 * the schema), so the environment cannot normally move it. The CMS test
 * suites run a dev server against a *copy* of the local database, and need
 * to: an absolute `DATABASE_URL` (`file:/abs/path.db` or a Windows drive)
 * overrides the schema's path. A relative value is ignored on purpose —
 * Prisma would resolve it against the working directory, which differs
 * between the dev server and the CLI, and silently open a second, empty
 * database.
 */
function datasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  return url && /^file:(?:\/|[A-Za-z]:[\\/])/.test(url) ? url : undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient(datasourceUrl() ? { datasourceUrl: datasourceUrl() } : undefined)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
