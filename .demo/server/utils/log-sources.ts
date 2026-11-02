import path from 'node:path'
import { logConfig } from '../../shared/log'

/**
 * The log directories the console's Logs screen reads: the panel's own and,
 * when known, the public site's (`NUXT_LOG_SITE_DIR`; in development the
 * site's default `web/.data/logs` beside this checkout).
 */
export function logSources(): { app: string, dir: string }[] {
  const sources: { app: string, dir: string }[] = []
  const own = logConfig().dir
  if (own) {
    sources.push({ app: 'panel', dir: own })
  }
  const configured = (useRuntimeConfig().log as { siteDir?: string } | undefined)?.siteDir
  const siteDir = configured || (import.meta.dev ? path.resolve('../web/.data/logs') : '')
  if (siteDir) {
    sources.push({ app: 'site', dir: siteDir })
  }
  return sources
}

/** The UTC days from `end` back `count` days, newest first. */
export function daysBack(end: string, count: number): string[] {
  const out: string[] = []
  const t = Date.parse(`${end}T00:00:00Z`)
  for (let i = 0; i < count; i++) {
    out.push(new Date(t - i * 86_400_000).toISOString().slice(0, 10))
  }
  return out
}
