import process from 'node:process'
import { defineEventHandler, setResponseStatus } from 'h3'
import { log } from '../utils/logger'
import prisma from '../utils/prisma'

/**
 * GET /api/health — for the deploy scripts and an uptime monitor: is the
 * process up and can it reach its database. Says nothing else (no version,
 * no configuration), and needs no session. 503 when the database does not
 * answer, with the failure in the log.
 */
export default defineEventHandler(async (event) => {
  const started = performance.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok', db: 'ok', dbMs: Math.round(performance.now() - started), uptimeSeconds: Math.round(process.uptime()) }
  }
  catch (error) {
    log('system').error('system.health.db', 'Health check could not reach the database', { outcome: 'failure', error })
    setResponseStatus(event, 503)
    return { status: 'degraded', db: 'unreachable', uptimeSeconds: Math.round(process.uptime()) }
  }
})
