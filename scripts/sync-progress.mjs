#!/usr/bin/env node
/**
 * Bring every project's stored progress back in line with its milestone
 * timeline (docs/audit AUD-05): the share of milestones completed, the rule
 * `syncProgress()` applies on every write since the fix. Projects written
 * before it (kickoff and full payment set a fixed 5%, and older seeds set
 * any figure) keep a number the timeline contradicts until a stage moves.
 *
 * Lists the projects it would change and changes nothing, unless --apply.
 * A project with no milestones keeps its figure.
 *
 *   node scripts/sync-progress.mjs
 *   DATABASE_URL=file:/opt/apex/prisma/dev.db node scripts/sync-progress.mjs --apply
 */
import process from 'node:process'
import { parseArgs } from 'node:util'
import { PrismaClient } from '@prisma/client'

const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false } } })
const url = process.env.DATABASE_URL
const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined)

try {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, progress: true, milestones: { select: { status: true } } },
  })
  const changes = []
  for (const p of projects) {
    if (p.milestones.length === 0) {
      continue
    }
    const share = Math.round((p.milestones.filter(m => m.status === 'COMPLETED').length / p.milestones.length) * 100)
    if (share !== p.progress) {
      changes.push({ id: p.id, name: p.name, from: p.progress, to: share })
    }
  }
  for (const c of changes) {
    console.log(`${c.id.slice(0, 8)}  ${String(c.from).padStart(3)}% -> ${String(c.to).padStart(3)}%  ${c.name}`)
  }
  if (values.apply) {
    for (const c of changes) {
      await prisma.project.update({ where: { id: c.id }, data: { progress: c.to } })
    }
    console.log(`Updated ${changes.length} of ${projects.length} projects.`)
  }
  else {
    console.log(`${changes.length} of ${projects.length} projects disagree with their timeline. Nothing changed; run with --apply to update them.`)
  }
}
finally {
  await prisma.$disconnect()
}
