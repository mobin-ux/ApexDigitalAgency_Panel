import { encode } from 'uqr'

/**
 * A QR code as one SVG path: a 1×1 square per dark module, drawn in a
 * `viewBox="0 0 size size"`. Used for the authenticator setup in Settings
 * and in the staff sign-in, so the two scan identically.
 */
export function qrPath(text: string): { size: number, d: string } {
  const { data, size } = encode(text, { border: 0 })
  let d = ''
  data.forEach((row, y) => row.forEach((on, x) => {
    if (on) {
      d += `M${x} ${y}h1v1h-1z`
    }
  }))
  return { size, d }
}

/** An authenticator secret in groups of four, for typing it in by hand. */
export function groupSecret(secret: string | undefined): string {
  return secret?.match(/.{1,4}/g)?.join(' ') ?? ''
}
