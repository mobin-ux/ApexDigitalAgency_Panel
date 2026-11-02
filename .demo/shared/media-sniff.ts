import { Buffer } from 'node:buffer'

/**
 * Pure helpers for the website media library (ADR-021 §4): what a file is
 * by its first bytes, how big an image is by its header, and which media a
 * document refers to. No framework, no database, so the tests load them
 * directly.
 */

export type MediaKind = 'image' | 'pdf'

export interface Sniffed {
  mime: string
  ext: string[]
  kind: MediaKind
}

/** What the first bytes say the file is. SVG is absent on purpose: it can carry script. */
export function sniffType(buf: Buffer): Sniffed | null {
  if (buf.length < 12) {
    return null
  }
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return { mime: 'image/jpeg', ext: ['jpg', 'jpeg'], kind: 'image' }
  }
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
    return { mime: 'image/png', ext: ['png'], kind: 'image' }
  }
  if (buf.subarray(0, 6).toString('latin1') === 'GIF87a' || buf.subarray(0, 6).toString('latin1') === 'GIF89a') {
    return { mime: 'image/gif', ext: ['gif'], kind: 'image' }
  }
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { mime: 'image/webp', ext: ['webp'], kind: 'image' }
  }
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { mime: 'application/pdf', ext: ['pdf'], kind: 'pdf' }
  }
  return null
}

/** Width and height from the image header, or null when the format is not one we size. */
export function imageDimensions(buf: Buffer, mime: string): { width: number, height: number } | null {
  try {
    if (mime === 'image/png' && buf.length >= 24) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    }
    if (mime === 'image/gif' && buf.length >= 10) {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
    }
    if (mime === 'image/jpeg') {
      let offset = 2
      while (offset + 9 < buf.length) {
        if (buf[offset] !== 0xFF) {
          offset += 1
          continue
        }
        const marker = buf[offset + 1]!
        if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
          offset += 2
          continue
        }
        const length = buf.readUInt16BE(offset + 2)
        // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the frame size.
        if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) }
        }
        offset += 2 + length
      }
      return null
    }
    if (mime === 'image/webp' && buf.length >= 30) {
      const chunk = buf.subarray(12, 16).toString('latin1')
      if (chunk === 'VP8 ') {
        return { width: buf.readUInt16LE(26) & 0x3FFF, height: buf.readUInt16LE(28) & 0x3FFF }
      }
      if (chunk === 'VP8L') {
        const bits = buf.readUInt32LE(21)
        return { width: (bits & 0x3FFF) + 1, height: ((bits >> 14) & 0x3FFF) + 1 }
      }
      if (chunk === 'VP8X') {
        return { width: (buf.readUIntLE(24, 3)) + 1, height: (buf.readUIntLE(27, 3)) + 1 }
      }
    }
  }
  catch {
    return null
  }
  return null
}

/** Every media id a document's content refers to (any `{ mediaId }` object, at any depth). */
export function collectMediaIds(content: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(content)) {
    for (const item of content) {
      collectMediaIds(item, out)
    }
  }
  else if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>
    if (typeof record.mediaId === 'string' && record.mediaId) {
      out.add(record.mediaId)
    }
    for (const value of Object.values(record)) {
      collectMediaIds(value, out)
    }
  }
  return out
}
