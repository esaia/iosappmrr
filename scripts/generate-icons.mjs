/*
 * Renders the site's mark — the white star on an accent squircle from
 * components/logo.tsx — into the raster icons browsers and app launchers ask
 * for, and writes them into src/app and public.
 *
 * Written by hand rather than with an image library because the mark is two
 * polygons: the iOS superellipse (shared with components/squircle-defs.tsx) and
 * a ten-point star. Point-in-polygon over a 4x supersampled grid gets both
 * antialiased correctly and keeps the repo free of a rasteriser dependency.
 *
 * Run with `npm run icons` after changing the mark or the accent colour.
 * Everything it writes is committed, so a build never depends on it.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ACCENT = [0x0a, 0x84, 0xff]
const STAR = [0xff, 0xff, 0xff]
/** How much of the tile's width the star spans. Wider than the header logo's
 *  ratio: at 16px a smaller star turns into a dot. */
const STAR_SPAN = 0.62
const SS = 4 // supersampling factor per axis

/* -------------------------------------------------------------------------- */
/*                                  Geometry                                  */
/* -------------------------------------------------------------------------- */

/** |x|^5 + |y|^5 = 1 in a unit box, the shape iOS clips app icons to. */
function squircle(steps = 256) {
  const points = []
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * 2 * Math.PI
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    // Superellipse in polar form, exponent 5.
    const r = 1 / Math.pow(Math.pow(Math.abs(c), 5) + Math.pow(Math.abs(s), 5), 1 / 5)
    points.push([0.5 + 0.5 * r * c, 0.5 + 0.5 * r * s])
  }
  return points
}

/** The star from logo.tsx, its path resolved to points in a 24x24 box. */
const STAR_POINTS = [
  [12, 1.5],
  [15.09, 7.76],
  [22, 8.76],
  [17, 13.63],
  [18.18, 20.5],
  [12, 17.27],
  [5.82, 20.5],
  [7, 13.63],
  [2, 8.76],
  [8.91, 7.76],
]

function inside(polygon, x, y) {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** Scales the star to `span` of the canvas and centres it on the tile. */
function starFor(size) {
  const xs = STAR_POINTS.map((p) => p[0])
  const ys = STAR_POINTS.map((p) => p[1])
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)]
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)]
  const scale = (size * STAR_SPAN) / (maxX - minX)
  const offsetX = (size - (maxX - minX) * scale) / 2 - minX * scale
  const offsetY = (size - (maxY - minY) * scale) / 2 - minY * scale
  return STAR_POINTS.map(([x, y]) => [x * scale + offsetX, y * scale + offsetY])
}

/**
 * RGBA pixels for one icon. `bleed` fills the whole square instead of clipping
 * to the squircle — what a maskable icon wants, since the launcher applies its
 * own platform shape and a pre-clipped icon would be rounded twice.
 */
function render(size, { bleed = false } = {}) {
  const tile = squircle().map(([x, y]) => [x * size, y * size])
  const star = starFor(size)
  const pixels = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inTile = 0
      let inStar = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          if (bleed || inside(tile, px, py)) inTile++
          if (inside(star, px, py)) inStar++
        }
      }
      const samples = SS * SS
      const tileAlpha = inTile / samples
      const starAlpha = (inStar / samples) * tileAlpha // the star never spills past the tile
      const i = (y * size + x) * 4
      // Star over accent, un-premultiplied so the edge pixels keep their hue.
      for (let c = 0; c < 3; c++) {
        const premultiplied = STAR[c] * starAlpha + ACCENT[c] * (tileAlpha - starAlpha)
        pixels[i + c] = tileAlpha ? Math.round(premultiplied / tileAlpha) : 0
      }
      pixels[i + 3] = Math.round(tileAlpha * 255)
    }
  }
  return pixels
}

/* -------------------------------------------------------------------------- */
/*                                  Encoding                                  */
/* -------------------------------------------------------------------------- */

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function png(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // truecolour with alpha
  // Raw scanlines, each prefixed with filter type 0.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** An .ico is a directory of images; since Vista each entry may be a PNG. */
function ico(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(entries.length, 4)

  const directory = Buffer.alloc(16 * entries.length)
  let offset = header.length + directory.length
  entries.forEach(({ size, data }, i) => {
    const at = i * 16
    directory[at] = size === 256 ? 0 : size // 0 means 256
    directory[at + 1] = size === 256 ? 0 : size
    directory[at + 4] = 1 // colour planes
    directory.writeUInt16LE(32, at + 6) // bits per pixel
    directory.writeUInt32LE(data.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += data.length
  })

  return Buffer.concat([header, directory, ...entries.map((e) => e.data)])
}

/* -------------------------------------------------------------------------- */
/*                                    Write                                   */
/* -------------------------------------------------------------------------- */

const root = fileURLToPath(new URL('..', import.meta.url))
const app = join(root, 'src', 'app')
const pub = join(root, 'public')

/*
 * The scalable favicon, which is what every current browser actually picks up.
 * Emitted from the same two polygons as the rasters so the shapes can never
 * drift apart, at 64 units for legible path precision.
 */
const UNITS = 64
const path = (points) =>
  points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join('') + 'Z'

writeFileSync(
  join(app, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${UNITS} ${UNITS}">` +
    `<path fill="#${ACCENT.map((c) => c.toString(16).padStart(2, '0')).join('')}" d="${path(
      squircle(96).map(([x, y]) => [x * UNITS, y * UNITS]),
    )}"/>` +
    `<path fill="#ffffff" d="${path(starFor(UNITS))}"/>` +
    `</svg>\n`,
)

const icoSizes = [16, 32, 48]
writeFileSync(
  join(app, 'favicon.ico'),
  ico(icoSizes.map((size) => ({ size, data: png(size, render(size)) }))),
)

// Apple wants no transparency and no rounding — iOS masks it itself.
writeFileSync(join(app, 'apple-icon.png'), png(180, render(180, { bleed: true })))
writeFileSync(join(pub, 'icon-192.png'), png(192, render(192)))
writeFileSync(join(pub, 'icon-512.png'), png(512, render(512)))
writeFileSync(join(pub, 'icon-maskable-512.png'), png(512, render(512, { bleed: true })))

console.log(`wrote icon.svg, favicon.ico (${icoSizes.join(', ')}), apple-icon.png, and 3 manifest icons`)
