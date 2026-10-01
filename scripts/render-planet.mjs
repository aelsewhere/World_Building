// Renders a drawn planet (a planet file saved from the globe, or the saved
// database document) as a flat equirectangular PNG.
//
//   node scripts/render-planet.mjs worlds/planet.json out.png [width]

import { readFileSync, writeFileSync } from 'node:fs';
import { encodePNG } from './png.mjs';
import { createPaintState, createPaintWorld, decodeStrokes, replay } from '../src/paint/paint-world.js';
import { latLonToVec } from '../src/geo.js';

const [input, out = 'planet-map.png', w = '2048'] = process.argv.slice(2);
const doc = JSON.parse(readFileSync(input, 'utf8'));
const state = createPaintState();
state.strokes.push(...decodeStrokes(doc.strokes));
replay(state);
const world = createPaintWorld(state);

const width = parseInt(w, 10), height = width / 2;
const heights = new Float32Array(width * height);
const colors = new Float32Array(width * height * 3);
for (let y = 0; y < height; y++) {
  const lat = 90 - ((y + 0.5) / height) * 180;
  for (let x = 0; x < width; x++) {
    const s = world.sample(...latLonToVec(lat, -180 + ((x + 0.5) / width) * 360));
    heights[y * width + x] = s.height;
    colors.set(s.color, (y * width + x) * 3);
  }
}
const rgb = Buffer.alloc(width * height * 3);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = y * width + x;
    let shade = 1;
    if (heights[i] > 0) {
      const wv = heights[y * width + Math.max(0, x - 1)];
      const nv = heights[Math.max(0, y - 1) * width + x];
      shade = Math.max(0.55, Math.min(1.35, 1 + (wv - heights[i] + (nv - heights[i])) / 2500));
    }
    for (let k = 0; k < 3; k++) rgb[i * 3 + k] = Math.max(0, Math.min(255, Math.round(colors[i * 3 + k] * shade * 255)));
  }
}
writeFileSync(out, encodePNG(width, height, rgb));
console.log(`wrote ${out} (${width}×${height}, ${state.strokes.length} strokes)`);
