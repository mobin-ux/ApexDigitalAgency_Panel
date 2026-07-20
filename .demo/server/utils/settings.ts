import prisma from './prisma'

/**
 * Read application Settings (the key/value table managed from the admin
 * panel). Values are stored JSON-stringified; `getSetting` parses and
 * falls back to `fallback` when the key is missing or unparsable, so
 * features behave sensibly on a fresh database.
 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } })
  if (!row) {
    return fallback
  }
  try {
    return JSON.parse(row.value) as T
  }
  catch {
    return fallback
  }
}

/** Batch variant — one query for several keys. */
export async function getSettings(keys: Record<string, unknown>): Promise<Record<string, unknown>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.keys(keys) } } })
  const out: Record<string, unknown> = { ...keys }
  for (const row of rows) {
    try {
      out[row.key] = JSON.parse(row.value)
    }
    catch {
      // keep fallback
    }
  }
  return out
}
