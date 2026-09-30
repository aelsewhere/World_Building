// Renders Naropa & Nalanda (from the hand-drawn map) as a flat equirectangular PNG.
//
//   node scripts/render-map.mjs [terrain|nations|founding] [out.png] [width] [west,east,south,north] [naropaShift]
//
// By default it renders the whole planet (360° × 180°). The optional last
// argument crops to a lon/lat box, e.g. -90,70,-80,90. naropaShift moves
// Naropa that many degrees west (0 = as drawn). Continent A is on top
// because north is up.

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createSketchWorld } from '../src/atlas/sketch-world.js';
import { latLonToVec } from '../src/geo.js';

const view = process.argv[2] || 'terrain';
const out = process.argv[3] || `map-${view}.png`;
const width = parseInt(process.argv[4] || '1440', 10);
const [west, east, south, north] = (process.argv[5] || '-180,180,-90,90').split(',').map(Number);
const height = Math.round((width * (north - south)) / (east - west));

const naropaShift = Number(process.argv[6] || 0);
const world = createSketchWorld(JSON.parse(readFileSync(new URL('../src/atlas/sketch-data.json', import.meta.url))), { naropaShift });
console.log('grid', world.stats);

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const rgb = Buffer.alloc(width * height * 3);
const heights = new Float32Array(width * height);
const colors = new Float32Array(width * height * 3);

for (let py = 0; py < height; py++) {
  const lat = north - ((py + 0.5) / height) * (north - south);
  for (let px = 0; px < width; px++) {
    const lon = west + ((px + 0.5) / width) * (east - west);
    const s = world.sample(...latLonToVec(lat, lon));
    let c = s.color;
    if (s.nationIndex >= 0 && view === 'nations') c = world.nations[s.nationIndex].color;
    if (s.foundingIndex >= 0 && view === 'founding') c = world.founding[s.foundingIndex].color;
    const i = py * width + px;
    heights[i] = s.height;
    colors.set(c, i * 3);
  }
}

// Simple hillshade from the northwest so relief reads on the flat map.
for (let py = 0; py < height; py++) {
  for (let px = 0; px < width; px++) {
    const i = py * width + px;
    let shade = 1;
    if (heights[i] > 0) {
      const w = heights[py * width + Math.max(0, px - 1)];
      const n = heights[Math.max(0, py - 1) * width + px];
      shade = Math.max(0.55, Math.min(1.35, 1 + ((w - heights[i]) + (n - heights[i])) / 2500));
    }
    for (let k = 0; k < 3; k++) {
      rgb[i * 3 + k] = Math.max(0, Math.min(255, Math.round(colors[i * 3 + k] * shade * 255)));
    }
  }
}

// Equator and every 30° as faint lines.
for (let py = 0; py < height; py++) {
  const lat = north - ((py + 0.5) / height) * (north - south);
  const lat0 = north - ((py - 0.5) / height) * (north - south);
  const crossesGrid = Math.floor(lat0 / 30) !== Math.floor(lat / 30);
  if (!crossesGrid) continue;
  const isEquator = lat0 >= 0 && lat < 0;
  for (let px = 0; px < width; px++) {
    const i = (py * width + px) * 3;
    for (let k = 0; k < 3; k++) {
      rgb[i + k] = isEquator ? [255, 220, 90][k] : Math.min(255, rgb[i + k] + 40);
    }
  }
}

// Rivers.
for (const river of world.rivers) {
  const pts = river.points;
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k <= 200; k++) {
      const lat = pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * k) / 200;
      const lon = pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * k) / 200;
      const px = Math.floor(((lon - west) / (east - west)) * width);
      const py = Math.floor(((north - lat) / (north - south)) * height);
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      rgb.set([63, 143, 224], (py * width + px) * 3);
    }
  }
}

writeFileSync(out, encodePNG(width, height, rgb));
console.log(`wrote ${out} (${width}×${height}, ${view})`);
