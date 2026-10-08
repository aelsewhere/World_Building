// Turns a flat "world climate" map image (terrain colours plus a legend)
// into a planet file whose base map the globe can open.
//
//   node scripts/import-climate-map.mjs <map image> <out.json> [mapWidth]
//
// Assumptions, from the map it was written for (reference/climate-map.webp):
// - The map area runs from x = 0 to `mapWidth` (default 1794 px); the legend
//   sits to its right, 22 swatches 16.83 px apart starting at y = 46.5.
// - The map shows the whole globe: 360° of longitude across, 90°N at the top
//   and 90°S at the bottom (it's wider than 2:1, so it is stretched sideways).
// - Water is blue; sea is the water connected to the open ocean, any other
//   enclosed water is a lake. Rivers (thin blue lines), the white label
//   boxes and white snow on mid-latitude peaks are filled in from the
//   terrain around them.
//
// Decoding uses Chromium through Playwright, which this environment has
// installed globally; the image is only drawn to a canvas, never executed.

import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { encodeBase, BASE_RES } from '../src/paint/base-map.js';

const [input, out, mapWidthArg] = process.argv.slice(2);
if (!input || !out) {
  console.error('usage: node scripts/import-climate-map.mjs <map image> <out.json> [mapWidth]');
  process.exit(1);
}

// ---------- Decode ----------
const browser = await chromium.launch();
const page = await browser.newPage();
const ext = input.split('.').pop().toLowerCase();
const mime = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }[ext] || 'image/png';
const decoded = await page.evaluate(async ({ b64, mime }) => {
  const img = new Image();
  img.src = `data:${mime};base64,${b64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let s = '';
  for (let i = 0; i < d.length; i += 4) s += String.fromCharCode(d[i], d[i + 1], d[i + 2]);
  return { w: c.width, h: c.height, rgb: btoa(s) };
}, { b64: readFileSync(input).toString('base64'), mime });
await browser.close();
const IW = decoded.w, H = decoded.h;
const rgb = Buffer.from(decoded.rgb, 'base64');
const W = parseInt(mapWidthArg || '1794', 10);
const px = (x, y) => { const i = (y * IW + x) * 3; return [rgb[i], rgb[i + 1], rgb[i + 2]]; };

// ---------- Legend ----------
// Legend entries in order, with the globe terrain type each becomes.
const LEGEND = [
  ['Jungle', 'jungle'], ['Seasonal tropical forest', 'forest'], ['Savanna', 'savanna'], ['Grassland', 'grassland'],
  ['Steppe', 'steppe'], ['Hot desert', 'desert'], ['Salt flats', 'saltflats'], ['Scrubland', 'scrubland'],
  ['Dry scrub', 'dryscrub'], ['Temperate forest', 'tforest'], ['Temperate rainforest', 'trainforest'],
  ['Conifer forest', 'conifer'], ['Moorland', 'moor'], ['Peat and tussock grass', 'tussock'], ['Cloud forest', 'cloudforest'],
  ['Farmland', 'farmland'], ['Marsh', 'marsh'], ['Mangroves', 'mangroves'], ['Coastal fog desert', 'fogdesert'],
  ['Tundra', 'tundra'], ['Ice cap / glacier', 'ice'], ['Mountains / hills / volcanoes', 'mountains'],
];
const legend = LEGEND.map(([name, key], i) => {
  const yc = Math.round(46.5 + i * 16.83);
  let s = [0, 0, 0], k = 0;
  for (let y = yc - 3; y <= yc + 3; y++) for (let x = W + 11; x <= W + 17; x++) { const c = px(x, y); s = s.map((v, j) => v + c[j]); k++; }
  return { name, key, color: s.map((v) => v / k) };
});

// ---------- Classify pixels ----------
const WATER = 254, UNKNOWN = 253;
const cls = new Uint8Array(W * H);
const latOf = (y) => 90 - ((y + 0.5) / H) * 180;
for (let y = 0; y < H; y++) {
  const lat = latOf(y);
  for (let x = 0; x < W; x++) {
    const [r, g, b] = px(x, y);
    const i = y * W + x;
    if (b > g + 12 && b > r + 35) { cls[i] = WATER; continue; }
    if (Math.max(r, g, b) < 55) { cls[i] = UNKNOWN; continue; } // label text
    if (Math.min(r, g, b) > 232 && Math.abs(lat) < 60) { cls[i] = UNKNOWN; continue; } // label boxes, peak snow
    // Nearest legend colour, allowing for the map's hillshade (a brightness scale).
    let best = 0, bestD = Infinity;
    legend.forEach((L, li) => {
      const [lr, lg, lb] = L.color;
      let k = (r * lr + g * lg + b * lb) / (lr * lr + lg * lg + lb * lb);
      k = Math.max(0.7, Math.min(1.3, k));
      const d = (r - k * lr) ** 2 + (g - k * lg) ** 2 + (b - k * lb) ** 2 + 2000 * (k - 1) ** 2;
      if (d < bestD) { bestD = d; best = li; }
    });
    cls[i] = best;
  }
}

// Label boxes (white rectangles with dark text, like "C1"): blank out each
// white blob away from the poles together with a small margin, so the
// lettering and box edges are filled from the land around them too.
{
  const seen = new Uint8Array(W * H);
  const white = (i) => { const y = (i / W) | 0, x = i - y * W; const [r, g, b] = px(x, y); return Math.min(r, g, b) > 225; };
  for (let start = 0; start < W * H; start++) {
    if (seen[start] || !white(start)) continue;
    const comp = [];
    const st = [start];
    seen[start] = 1;
    while (st.length) {
      const i = st.pop();
      comp.push(i);
      const y = (i / W) | 0, x = i - y * W;
      for (const j of [x + 1 < W ? i + 1 : -1, x > 0 ? i - 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && !seen[j] && white(j)) { seen[j] = 1; st.push(j); }
      }
    }
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (const i of comp) { const y = (i / W) | 0, x = i - y * W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (Math.abs(latOf((y0 + y1) / 2)) > 60 || comp.length < 40 || x1 - x0 > 80 || y1 - y0 > 60) continue;
    for (let y = Math.max(0, y0 - 2); y <= Math.min(H - 1, y1 + 2); y++) {
      for (let x = Math.max(0, x0 - 2); x <= Math.min(W - 1, x1 + 2); x++) {
        if (cls[y * W + x] !== WATER) cls[y * W + x] = UNKNOWN;
      }
    }
  }
}

// ---------- Water: drop rivers, split sea from lakes ----------
// Morphological opening (erode then dilate) of the water mask removes
// lines a few pixels wide (rivers) and keeps real coasts and lakes.
function morph(mask, radius, erode) {
  const outM = new Uint8Array(mask.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = erode ? 1 : 0;
      for (let dy = -radius; dy <= radius && (erode ? v : !v); dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          const xx = (x + dx + W) % W; // the map wraps east-west
          const m = mask[yy * W + xx];
          if (erode && !m) { v = 0; break; }
          if (!erode && m) { v = 1; break; }
        }
      }
      outM[y * W + x] = v;
    }
  }
  return outM;
}
const water = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) water[i] = cls[i] === WATER ? 1 : 0;
const opened = morph(morph(water, 2, true), 2, false);

// Sea = opened water connected to the map's left or right edge (open
// ocean); any other open water is a lake.
const sea = new Uint8Array(W * H);
const queue = new Int32Array(W * H);
let head = 0, tail = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (opened[i] && (x === 0 || x === W - 1) && !sea[i]) { sea[i] = 1; queue[tail++] = i; }
  }
}
while (head < tail) {
  const i = queue[head++];
  const y = (i / W) | 0, x = i - y * W;
  for (const j of [y * W + ((x + 1) % W), y * W + ((x - 1 + W) % W), y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
    if (j >= 0 && opened[j] && !sea[j]) { sea[j] = 1; queue[tail++] = j; }
  }
}
const LAKE = LEGEND.length; // extra class index
for (let i = 0; i < W * H; i++) {
  if (sea[i]) cls[i] = WATER;
  else if (opened[i]) cls[i] = LAKE;
  else if (cls[i] === WATER) cls[i] = UNKNOWN; // a river: becomes the land around it
}

// Fill unknown pixels from their nearest known land neighbour.
head = tail = 0;
for (let i = 0; i < W * H; i++) if (cls[i] !== UNKNOWN && cls[i] !== WATER) queue[tail++] = i;
while (head < tail) {
  const i = queue[head++];
  const y = (i / W) | 0, x = i - y * W;
  for (const j of [y * W + ((x + 1) % W), y * W + ((x - 1 + W) % W), y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
    if (j >= 0 && cls[j] === UNKNOWN) { cls[j] = cls[i]; queue[tail++] = j; }
  }
}
for (let i = 0; i < W * H; i++) if (cls[i] === UNKNOWN) cls[i] = WATER;

// ---------- Resample onto the globe's 0.25° grid ----------
const keys = [...legend.map((l) => l.key), 'lakes'];
const COLS = Math.round(360 / BASE_RES), ROWS = Math.round(180 / BASE_RES);
const cells = new Uint8Array(COLS * ROWS).fill(255);
for (let r = 0; r < ROWS; r++) {
  const lat = 90 - (r + 0.5) * BASE_RES;
  const y = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)));
  for (let c = 0; c < COLS; c++) {
    const lon = -180 + (c + 0.5) * BASE_RES;
    const x = Math.min(W - 1, Math.floor(((lon + 180) / 360) * W));
    const k = cls[y * W + x];
    if (k !== WATER) cells[r * COLS + c] = k;
  }
}

const base = encodeBase(cells, keys);
const counts = {};
for (const k of cells) if (k !== 255) counts[keys[k]] = (counts[keys[k]] || 0) + 1;
writeFileSync(out, JSON.stringify({
  format: 'world-building-planet',
  version: 2,
  savedAt: new Date().toISOString(),
  note: `Base map imported from ${input.split('/').pop()}: whole globe, 360° wide, pole to pole. Open it from the globe's "Open planet file" button.`,
  base,
  strokes: [],
}));
const land = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`wrote ${out}: base map ${COLS}×${ROWS}, ${(base.rle.length / 1024).toFixed(1)} KiB, land ${((100 * land) / (COLS * ROWS)).toFixed(1)}% of cells`);
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
