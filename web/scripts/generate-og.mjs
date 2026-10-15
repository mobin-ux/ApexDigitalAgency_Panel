/**
 * Renders the default Open Graph / Twitter card (1200×630) to
 * `public/og-default.png`, and the iOS home-screen icon to
 * `public/apple-touch-icon.png`.
 *
 * Text is converted to outlines with the real Yellix font files, so the image
 * matches the site exactly without needing the font installed on the machine
 * that runs this. Re-run after a headline or brand change:
 *
 *   pnpm --filter @apex/web og
 */
import { Buffer } from 'node:buffer'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import sharp from 'sharp'

const root = new URL('../', import.meta.url)
const WIDTH = 1200
const HEIGHT = 630

async function loadFont(path) {
  const file = await readFile(new URL(path, root))
  return opentype.parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength))
}

const extraBold = await loadFont('public/fonts/yellix/Yellix-ExtraBold.woff')
const bold = await loadFont('public/fonts/yellix/Yellix-Bold.woff')

function text(font, value, x, y, size, fill, letterSpacing = 0) {
  const path = font.getPath(value, x, y, size, { letterSpacing })
  return `<path d="${path.toPathData(2)}" fill="${fill}"/>`
}

// Twelve dots, three filled: the "twelve small payments" motif from the site.
const dots = Array.from({ length: 12 }, (_, i) =>
  `<circle cx="${89 + i * 30}" cy="540" r="9" fill="${i < 3 ? '#7D53F2' : '#2B3F46'}"/>`).join('')

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#9B79F6" stop-opacity="0.55"/>
      <stop offset="55%" stop-color="#7D53F2" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#7D53F2" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0C1719"/>
  <circle cx="1010" cy="170" r="430" fill="url(#glow)"/>
  ${text(extraBold, 'Grow online.', 80, 318, 112, '#FFFFFF', -0.032)}
  ${text(extraBold, 'Pay monthly.', 80, 436, 112, '#FFFFFF', -0.032)}
  ${text(bold, 'Websites, marketing & software for UK businesses', 80, 500, 30, '#A9B2B8')}
  ${dots}
</svg>`

const wordmark = await sharp(fileURLToPath(new URL('scripts/assets/apex-wordmark-dark.svg', root)), { density: 300 })
  .resize({ height: 44 })
  .png()
  .toBuffer()

const png = await sharp(Buffer.from(svg))
  .composite([{ input: wordmark, left: 80, top: 72 }])
  .png({ compressionLevel: 9 })
  .toBuffer()

await writeFile(new URL('public/og-default.png', root), png)
console.log(`Wrote public/og-default.png (${(png.length / 1024).toFixed(0)} kB)`)

// iOS rounds and masks the icon itself, so it gets a solid page-colour square.
const icon = await sharp(fileURLToPath(new URL('public/favicon.svg', root)), { density: 300 })
  .resize({ width: 112, height: 112, fit: 'contain', background: '#FDFDFD' })
  .png()
  .toBuffer()
const touchIcon = await sharp({
  create: { width: 180, height: 180, channels: 3, background: '#FDFDFD' },
})
  .composite([{ input: icon, gravity: 'centre' }])
  .png({ compressionLevel: 9 })
  .toBuffer()
await writeFile(new URL('public/apple-touch-icon.png', root), touchIcon)
console.log('Wrote public/apple-touch-icon.png')
