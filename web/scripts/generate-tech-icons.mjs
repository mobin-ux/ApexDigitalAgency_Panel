/**
 * Builds public/icons/tech.svg: an SVG sprite of every technology mark the
 * site's content refers to, from the Simple Icons set (CC0).
 *
 * The design hot-linked each logo from cdn.simpleicons.org. That breaks the
 * site's CSP (`img-src 'self'`), leaks every visitor's IP to a third party and
 * makes the page depend on someone else's uptime. A local sprite does none of
 * that and is one cached request.
 *
 * The list of marks is not maintained here: the script scans app/data for
 * `icon: '<slug>'` and fails if a slug does not exist in Simple Icons.
 * Each mark is one symbol in its brand colour; dark panels flatten it to a
 * single grey with a CSS filter rather than shipping a second copy.
 *
 * Run after adding a mark: `pnpm icons` (or `node scripts/generate-tech-icons.mjs`).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import * as simpleIcons from 'simple-icons'

const root = fileURLToPath(new URL('..', import.meta.url))
const dataDir = join(root, 'app', 'data')
const outFile = join(root, 'public', 'icons', 'tech.svg')

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const slugs = new Set()
for (const file of walk(dataDir).filter(f => f.endsWith('.ts'))) {
  for (const match of readFileSync(file, 'utf8').matchAll(/\bicon: '([a-z0-9]+)'/g)) {
    slugs.add(match[1])
  }
}

const bySlug = new Map(Object.values(simpleIcons).filter(icon => icon?.slug).map(icon => [icon.slug, icon]))
const missing = [...slugs].filter(slug => !bySlug.has(slug))
if (missing.length) {
  console.error(`Unknown Simple Icons slug(s): ${missing.join(', ')}`)
  process.exit(1)
}

const symbols = [...slugs].sort().map((slug) => {
  const { path, hex } = bySlug.get(slug)
  return `<symbol id="${slug}" viewBox="0 0 24 24"><path fill="#${hex}" d="${path}"/></symbol>`
})

writeFileSync(outFile, `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>\n`)
console.log(`Wrote ${slugs.size} marks to public/icons/tech.svg`)
