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

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
