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

// Shapes in a 0..1 coordinate space. The logo (play triangle followed by a full
// stop) uses the same 24-unit geometry as ICONS.logo in @the-point/core.
function inRoundedSquare(x: number, y: number): boolean {
  const r = 0.22;
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

type Pt = [number, number];
const TRIANGLE: Pt[] = [
  [3, 4],
  [3, 20],
  [16.3, 12],
];
const CORNER = 1.3; // rounding radius of the triangle corners
const DOT: Pt = [19.6, 17.6];
const DOT_R = 2.4;

// Triangle shrunk towards its incentre by the corner radius; a point is inside the
// rounded triangle when it lies within CORNER of that inner triangle.
const INNER: Pt[] = (() => {
  const len = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const [a, b, c] = TRIANGLE as [Pt, Pt, Pt];
  const la = len(b, c),
    lb = len(c, a),
    lc = len(a, b);
  const p = la + lb + lc;
  const inc: Pt = [
    (la * a[0] + lb * b[0] + lc * c[0]) / p,
    (la * a[1] + lb * b[1] + lc * c[1]) / p,
  ];
  const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  const k = (area / (p / 2) - CORNER) / (area / (p / 2));
  return TRIANGLE.map(([x, y]) => [inc[0] + (x - inc[0]) * k, inc[1] + (y - inc[1]) * k] as Pt);
})();

function inTriangle(x: number, y: number, t: Pt[]): boolean {
  const s = (p: Pt, q: Pt) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]);
  const d = [s(t[0]!, t[1]!), s(t[1]!, t[2]!), s(t[2]!, t[0]!)];
  return d.every((v) => v <= 0) || d.every((v) => v >= 0);
}
function distToSegment(x: number, y: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
function inLogoTriangle(x: number, y: number): boolean {
  if (inTriangle(x, y, INNER)) return true;
  return INNER.some((a, i) => distToSegment(x, y, a, INNER[(i + 1) % 3]!) <= CORNER);
}

// Logo box: its centre (12.5, 12) sits in the middle of the tile, 26 units wide.
const SPAN = 26;
function sample(x: number, y: number): RGBA {
  if (!inRoundedSquare(x, y)) return [0, 0, 0, 0];
  const lx = 12.5 + (x - 0.5) * SPAN;
  const ly = 12 + (y - 0.5) * SPAN;
  if ((lx - DOT[0]) ** 2 + (ly - DOT[1]) ** 2 <= DOT_R ** 2) return [255, 204, 0, 255];
  if (inLogoTriangle(lx, ly)) return [255, 255, 255, 255];
  return [26, 86, 219, 255]; // #1A56DB, same as the app icon
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
