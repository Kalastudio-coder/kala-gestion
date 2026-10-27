// Genera build/icon.png (512x512): cuadrado redondeado violeta con una "K".
// Uso: node scripts/make-icon.cjs
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const S = 512;
const px = Buffer.alloc(S * S * 4);
const from = [139, 92, 246]; // violeta
const to = [217, 70, 239]; // fucsia

function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

const R = 112; // radio de las esquinas
const strokes = [
  [190, 140, 190, 372],
  [330, 140, 200, 262],
  [228, 240, 335, 372],
];
const W = 26; // medio ancho del trazo

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    // Cobertura del cuadrado redondeado (con suavizado de 1px).
    const cx = Math.max(R - x, 0, x - (S - 1 - R));
    const cy = Math.max(R - y, 0, y - (S - 1 - R));
    const shape = Math.max(0, Math.min(1, R + 0.5 - Math.hypot(cx, cy)));
    if (shape === 0) continue;
    const t = (x + y) / (2 * S);
    let rgb = from.map((a, i) => a + (to[i] - a) * t);
    const d = Math.min(...strokes.map((s) => segDist(x, y, ...s)));
    const k = Math.max(0, Math.min(1, W + 0.5 - d));
    rgb = rgb.map((c) => c + (255 - c) * k);
    const i = (y * S + x) * 4;
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
    px[i + 3] = Math.round(shape * 255);
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
fs.writeFileSync(path.join(__dirname, "..", "build", "icon.png"), png);
console.log("build/icon.png listo");
