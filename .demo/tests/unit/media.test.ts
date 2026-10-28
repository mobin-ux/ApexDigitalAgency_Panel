import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { describe, it } from 'node:test'
import { collectMediaIds, imageDimensions, sniffType } from '../../shared/media-sniff.ts'

/**
 * The sniffer and the dimension parser on hand-built headers: what the
 * bytes say, never the file name.
 */
function png(width: number, height: number): Buffer {
  const b = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).copy(b, 0)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12, 'latin1')
  b.writeUInt32BE(width, 16)
  b.writeUInt32BE(height, 20)
  return b
}

function gif(width: number, height: number): Buffer {
  const b = Buffer.alloc(14)
  b.write('GIF89a', 0, 'latin1')
  b.writeUInt16LE(width, 6)
  b.writeUInt16LE(height, 8)
  return b
}

function jpeg(width: number, height: number): Buffer {
  // SOI, APP0 (16 bytes), SOF0 with the frame size, then nothing else.
  const app0 = Buffer.from([0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00])
  const sof = Buffer.alloc(11)
  sof[0] = 0xFF
  sof[1] = 0xC0
  sof.writeUInt16BE(9, 2)
  sof[4] = 8
  sof.writeUInt16BE(height, 5)
  sof.writeUInt16BE(width, 7)
  sof[9] = 1
  return Buffer.concat([Buffer.from([0xFF, 0xD8]), app0, sof, Buffer.alloc(4)])
}

function webpLossless(width: number, height: number): Buffer {
  const b = Buffer.alloc(32)
  b.write('RIFF', 0, 'latin1')
  b.write('WEBP', 8, 'latin1')
  b.write('VP8L', 12, 'latin1')
  b[20] = 0x2F
  const bits = (width - 1) | ((height - 1) << 14)
  b.writeUInt32LE(bits >>> 0, 21)
  return b
}

describe('media sniffing', () => {
  it('recognises the five accepted formats by their first bytes', () => {
    assert.equal(sniffType(png(1, 1))?.mime, 'image/png')
    assert.equal(sniffType(gif(1, 1))?.mime, 'image/gif')
    assert.equal(sniffType(jpeg(1, 1))?.mime, 'image/jpeg')
    assert.equal(sniffType(webpLossless(1, 1))?.mime, 'image/webp')
    assert.equal(sniffType(Buffer.from('%PDF-1.7\n%âãÏÓ\n', 'latin1'))?.mime, 'application/pdf')
  })

  it('refuses anything else, including SVG and HTML dressed as images', () => {
    assert.equal(sniffType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null)
    assert.equal(sniffType(Buffer.from('<!doctype html><html></html>')), null)
    assert.equal(sniffType(Buffer.alloc(4)), null)
  })

  it('reads dimensions from PNG, GIF, JPEG and WebP headers', () => {
    assert.deepEqual(imageDimensions(png(1200, 630), 'image/png'), { width: 1200, height: 630 })
    assert.deepEqual(imageDimensions(gif(320, 240), 'image/gif'), { width: 320, height: 240 })
    assert.deepEqual(imageDimensions(jpeg(1920, 1080), 'image/jpeg'), { width: 1920, height: 1080 })
    assert.deepEqual(imageDimensions(webpLossless(800, 600), 'image/webp'), { width: 800, height: 600 })
    assert.equal(imageDimensions(Buffer.alloc(8), 'image/png'), null)
  })
})

describe('media references in content', () => {
  it('finds every mediaId at any depth, once', () => {
    const ids = collectMediaIds({ hero: { image: { mediaId: 'a', alt: '' } }, sections: [{ props: { logos: [{ mediaId: 'b' }, { mediaId: 'a' }] } }], seo: { ogImage: undefined } })
    assert.deepEqual([...ids].sort(), ['a', 'b'])
    assert.equal(collectMediaIds(null).size, 0)
    assert.equal(collectMediaIds({ mediaId: '' }).size, 0)
  })
})
