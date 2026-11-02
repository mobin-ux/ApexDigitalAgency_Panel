import { defineNitroPlugin } from 'nitropack/runtime'
import { log } from '../utils/logger'
import prisma from '../utils/prisma'

/**
 * SQLite's write-ahead log (docs/audit AUD-03). In the default rollback
 * journal a write locks the whole file, readers included, so a burst of
 * writes made single-row reads wait seconds and fail after the 5-second busy
 * timeout. In WAL mode readers carry on while the one writer writes.
 *
 * The mode is stored in the database file, so this switches it once and is a
 * no-op on every later start. A switch needs a moment with no other
 * connection mid-transaction; if it does not take, the next start tries
 * again and the log says so. WAL keeps recent writes in `dev.db-wal` beside
 * the database until a checkpoint, so a backup is `sqlite3 dev.db ".backup
 * <file>"`, never a `cp` of `dev.db` alone (docs/DEPLOYMENT.md).
 */
const db = log('db')

export default defineNitroPlugin(() => {
  void (async () => {
    try {
      const rows = await prisma.$queryRawUnsafe<{ journal_mode: string }[]>('PRAGMA journal_mode = WAL')
      const mode = String(rows[0]?.journal_mode ?? '').toLowerCase()
      if (mode === 'wal') {
        db.info('db.journal-mode', 'SQLite is in WAL mode', { data: { mode } })
      }
      else {
        db.warn('db.journal-mode', `SQLite stayed in ${mode || 'an unknown'} journal mode; readers wait behind writers until it switches`, { data: { mode } })
      }
    }
    catch (error) {
      db.warn('db.journal-mode', 'Could not switch SQLite to WAL mode', { error })
    }
  })()
})
