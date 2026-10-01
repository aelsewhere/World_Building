// Exports: a flat world-map image, a picture of the globe, and the drawn
// planet as a file that can be opened again later.

import { latLonToVec } from '../geo.js';

export const PLANET_FORMAT = 'world-building-planet';

// Equirectangular map of any world (2:1), with a light hillshade so relief
// reads. Returns a PNG Blob. Yields to the browser between rows so the page
// stays responsive; `onProgress(0..1)` reports how far it got.
export async function renderMapImage(world, width = 2048, onProgress = () => {}) {
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const heights = new Float32Array(width * height);
  const colors = new Float32Array(width * height * 3);

  let lastYield = performance.now();
  for (let y = 0; y < height; y++) {
    const lat = 90 - ((y + 0.5) / height) * 180;
    for (let x = 0; x < width; x++) {
      const lon = -180 + ((x + 0.5) / width) * 360;
      const s = world.sample(...latLonToVec(lat, lon));
      const i = y * width + x;
      heights[i] = s.height;
      colors[i * 3] = s.color[0];
      colors[i * 3 + 1] = s.color[1];
      colors[i * 3 + 2] = s.color[2];
    }
    if (performance.now() - lastYield > 30) {
      onProgress(y / height);
      await new Promise((r) => setTimeout(r, 0));
      lastYield = performance.now();
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let shade = 1;
      if (heights[i] > 0) {
        const w = heights[y * width + Math.max(0, x - 1)];
        const n = heights[Math.max(0, y - 1) * width + x];
        shade = Math.max(0.55, Math.min(1.35, 1 + (w - heights[i] + (n - heights[i])) / 2500));
      }
      for (let k = 0; k < 3; k++) img.data[i * 4 + k] = Math.max(0, Math.min(255, Math.round(colors[i * 3 + k] * shade * 255)));
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  onProgress(1);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function canvasToPng(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function planetFileText(encodedStrokes) {
  return JSON.stringify({
    format: PLANET_FORMAT,
    version: 1,
    savedAt: new Date().toISOString(),
    note: 'Brush strokes: [brush, radius×10, lat×10, lon×10, ...]. Open it from the globe\'s "Open planet file" button.',
    strokes: encodedStrokes,
  });
}

// Accepts a planet file, or the bare saved document ({strokes}).
export function parsePlanetFile(text) {
  const doc = JSON.parse(text);
  if (!doc || !Array.isArray(doc.strokes)) throw new Error('This file has no planet strokes in it.');
  if (doc.format && doc.format !== PLANET_FORMAT) throw new Error('This is not a planet file from this globe.');
  return doc.strokes;
}

// Hands a file to the viewer: through the claude.ai page's download prompt
// when available, otherwise as a normal browser download.
export async function offerFile(filename, data) {
  try {
    const downloads = await window.claude?.use?.('downloads');
    if (downloads) {
      await downloads.save({ filename, data });
      return 'saved';
    }
  } catch (e) {
    if (e?.code === 'declined') return 'declined';
    if (e?.code && e.code !== 'unavailable' && e.code !== 'not_granted') return 'failed';
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'saved';
  } catch {
    return 'failed';
  }
}
