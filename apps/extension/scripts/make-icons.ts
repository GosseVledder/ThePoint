// Generates the extension icons (public/icon/<size>.png) without external tools.
// Usage: npx tsx scripts/make-icons.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

type RGBA = [number, number, number, number];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size: number, pixel: (x: number, y: number) => RGBA): Buffer {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Shapes in a 0..1 coordinate space.
function inRoundedSquare(x: number, y: number): boolean {
  const r = 0.22;
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function inTriangle(x: number, y: number): boolean {
  // Play triangle, slightly left of centre.
  const ax = 0.33,
    ay = 0.27,
    bx = 0.33,
    by = 0.73,
    cx = 0.72,
    cy = 0.5;
  const s = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
  const d1 = s(x, y, ax, ay, bx, by);
  const d2 = s(x, y, bx, by, cx, cy);
  const d3 = s(x, y, cx, cy, ax, ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
function inSparkle(x: number, y: number): boolean {
  // Four-pointed star at the top right.
  const cx = 0.76,
    cy = 0.24,
    r = 0.17;
  const dx = Math.abs(x - cx) / r;
  const dy = Math.abs(y - cy) / r;
  return Math.sqrt(dx) + Math.sqrt(dy) <= 1;
}

function sample(x: number, y: number): RGBA {
  if (!inRoundedSquare(x, y)) return [0, 0, 0, 0];
  if (inSparkle(x, y)) return [255, 204, 0, 255];
  if (inTriangle(x, y)) return [255, 255, 255, 255];
  return [33, 33, 33, 255];
}

function render(size: number): Buffer {
  const ss = 4;
  return png(size, (px, py) => {
    const acc: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < ss; i++) {
      for (let j = 0; j < ss; j++) {
        const c = sample((px + (i + 0.5) / ss) / size, (py + (j + 0.5) / ss) / size);
        acc[0] += c[0] * c[3];
        acc[1] += c[1] * c[3];
        acc[2] += c[2] * c[3];
        acc[3] += c[3];
      }
    }
    const a = acc[3]!;
    return a === 0
      ? [0, 0, 0, 0]
      : [
          Math.round(acc[0]! / a),
          Math.round(acc[1]! / a),
          Math.round(acc[2]! / a),
          Math.round(a / (ss * ss)),
        ];
  });
}

const dir = join(import.meta.dirname, '..', 'public', 'icon');
mkdirSync(dir, { recursive: true });
for (const size of [16, 32, 48, 96, 128]) writeFileSync(join(dir, `${size}.png`), render(size));
console.log('icons written to', dir);
