// Genera las máscaras 1-bit (PNG) del sistema dither.
// Uso: node scripts/generate-dither-assets.mjs  → escribe en public/dither/
// Son máscaras (blanco opaco / transparente): el color lo pone el CSS con
// `mask-image` + `background-color`, así funcionan con cualquier token.
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const OUT = new URL('../public/dither/', import.meta.url)
mkdirSync(OUT, { recursive: true })

// Matriz Bayer 8x8 normalizada (0..1)
const B8 = [
  [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
].map(r => r.map(v => (v + 0.5) / 64))

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = buf => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
// PNG gris+alpha 8 bits; on(x,y) → pixel blanco opaco
function png(name, w, h, on) {
  const raw = Buffer.alloc((w * 2 + 1) * h)
  for (let y = 0; y < h; y++) {
    const row = y * (w * 2 + 1)
    for (let x = 0; x < w; x++) {
      const v = on(x, y) ? 255 : 0
      raw[row + 1 + x * 2] = 255
      raw[row + 2 + x * 2] = v
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 4 // 8 bits, gris + alpha
  const file = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(new URL(name, OUT), file)
  console.log(name, w + 'x' + h, file.length + ' bytes')
}

const PX = 2 // cada "pixel" dither = 2px CSS → se lee retro, no ruido
const bayer = (x, y) => B8[Math.floor(y / PX) % 8][Math.floor(x / PX) % 8]

// Degradado vertical tramado: denso arriba → vacío abajo (320px de alto)
const FADE_H = 320
png('fade.png', 8 * PX, FADE_H, (x, y) => 1 - y / (FADE_H - 1) > bayer(x, y))

// Tonos planos para rellenos (tile 16x16)
for (const t of [12, 25, 50]) png(`tone-${t}.png`, 8 * PX, 8 * PX, (x, y) => t / 100 > bayer(x, y))

// Grano 1-bit (ruido determinístico, ~7% de densidad) para la textura global
let s = 1337
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
const N = 96
const noise = Array.from({ length: (N / PX) ** 2 }, () => rnd() < 0.07)
png('noise.png', N, N, (x, y) => noise[Math.floor(y / PX) * (N / PX) + Math.floor(x / PX)])
