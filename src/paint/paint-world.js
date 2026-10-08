// A planet you draw yourself. Brush strokes are painted into lat/lon grids
// (land amount, height, roughness, ridges, colour, terrain type); sampling
// adds natural coastline and relief detail on top, the same way the
// Naropa & Nalanda atlas does. Pure data, no Three.js.
//
// The drawing is just its list of strokes, so it saves compactly, replays
// exactly, and undo is "drop the last stroke and replay".

import { createNoise3D, fbm, ridged, hashString, mulberry32 } from '../noise.js';
import { vecToLatLon, latLonToVec } from '../geo.js';
import { TERRAIN } from '../atlas/terrain-types.js';
import { decodeBase, BASE_RES } from './base-map.js';

const DEG = Math.PI / 180;
const RES = 0.25; // degrees per grid cell (~28 km)
const COLS = 360 / RES;
const ROWS = 180 / RES;
const SNOW = [0.95, 0.96, 0.98];
const DEEP = [0.03, 0.1, 0.28];
const SHALLOW = [0.13, 0.42, 0.62];
const ROCK = [0.43, 0.39, 0.35];

// The brush palette. `auto` land picks its terrain from latitude.
export const BRUSHES = [
  { id: 'land', name: 'Land', auto: true, swatch: '#8fae5a' },
  { id: 'sea', name: 'Sea', erase: true, swatch: '#1f5f9c' },
  { id: 'mountains', name: 'Mountains', terrain: 'mountains' },
  { id: 'hills', name: 'Hills', terrain: 'hills' },
  { id: 'forest', name: 'Forest', terrain: 'tforest' },
  { id: 'jungle', name: 'Jungle', terrain: 'jungle' },
  { id: 'grassland', name: 'Grassland', terrain: 'grassland' },
  { id: 'desert', name: 'Desert', terrain: 'desert' },
  { id: 'tundra', name: 'Tundra', terrain: 'tundra' },
  { id: 'ice', name: 'Ice', terrain: 'icefield' },
  { id: 'lake', name: 'Lake', terrain: 'lakes' },
].map((b) => {
  if (b.swatch) return b;
  const [r, g, bl] = TERRAIN[b.terrain].color.map((c) => Math.round(c * 255));
  return { ...b, swatch: `rgb(${r},${g},${bl})` };
});

const TYPE_KEYS = Object.keys(TERRAIN);
const AUTO = 255;

// Terrain for plain "Land", by latitude (nudged by noise so bands wobble).
function autoTerrain(lat) {
  const a = Math.abs(lat);
  if (a > 74) return 'ice';
  if (a > 63) return 'tundra';
  if (a > 52) return 'taiga';
  if (a > 40) return 'tforest';
  if (a > 30) return 'grassland';
  if (a > 22) return 'scrubland';
  if (a > 12) return 'savanna';
  return 'jungle';
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function createPaintState() {
  const N = COLS * ROWS;
  return {
    strokes: [],
    base: null, // an imported base map ({res, cols, rows, keys, rle}), painted under the strokes
    land: new Float32Array(N),
    height: new Float32Array(N),
    rough: new Float32Array(N),
    ridge: new Float32Array(N),
    r: new Float32Array(N),
    g: new Float32Array(N),
    b: new Float32Array(N),
    type: new Uint8Array(N).fill(AUTO),
  };
}

function resetFields(state) {
  state.land.fill(0);
  state.height.fill(0);
  state.rough.fill(0);
  state.ridge.fill(0);
  state.r.fill(0);
  state.g.fill(0);
  state.b.fill(0);
  state.type.fill(AUTO);
}

const bandNoise = createNoise3D(mulberry32(hashString('bands')));

// Trig tables for cell centres, so brush dabs avoid per-cell sin/cos.
const ROW_SIN = new Float64Array(ROWS), ROW_COS = new Float64Array(ROWS);
for (let r = 0; r < ROWS; r++) {
  const lat = (90 - (r + 0.5) * RES) * DEG;
  ROW_SIN[r] = Math.sin(lat);
  ROW_COS[r] = Math.cos(lat);
}
const COL_SIN = new Float64Array(COLS), COL_COS = new Float64Array(COLS);
for (let c = 0; c < COLS; c++) {
  const lon = (-180 + (c + 0.5) * RES) * DEG;
  COL_SIN[c] = Math.sin(lon);
  COL_COS[c] = Math.cos(lon);
}

// One circular brush dab at (lat, lon) with radius in degrees.
function dab(state, brush, lat, lon, radius) {
  const c = latLonToVec(lat, lon);
  const cosReach = Math.cos(radius * DEG);
  const r0 = Math.max(0, Math.floor((90 - lat - radius) / RES));
  const r1 = Math.min(ROWS - 1, Math.ceil((90 - lat + radius) / RES));
  for (let r = r0; r <= r1; r++) {
    const clat = 90 - (r + 0.5) * RES;
    const k = ROW_COS[r], sr = ROW_SIN[r];
    const span = k < 0.02 ? 180 : Math.min(180, radius / k + RES);
    const c0 = Math.floor((lon - span + 180) / RES);
    const c1 = Math.ceil((lon + span + 180) / RES);
    for (let cc = c0; cc <= c1; cc++) {
      const col = ((cc % COLS) + COLS) % COLS;
      const vx = k * COL_SIN[col], vz = k * COL_COS[col];
      const dot = vx * c[0] + sr * c[1] + vz * c[2];
      if (dot <= cosReach) continue;
      const d = Math.acos(Math.min(1, dot)) / DEG / radius; // 0 centre .. 1 edge
      const w = 1 - smoothstep(0.45, 1, d); // soft edge
      if (w <= 0) continue;
      const i = r * COLS + col;

      if (brush.erase) {
        state.land[i] = Math.min(state.land[i], 1 - w);
        if (state.land[i] < 0.2) state.type[i] = AUTO;
        continue;
      }
      state.land[i] = Math.max(state.land[i], w);

      let key = brush.terrain;
      if (brush.auto) {
        if (state.type[i] !== AUTO) continue; // plain land never paints over a chosen terrain
        key = autoTerrain(clat + 7 * bandNoise(vx * 3, sr * 3, vz * 3));
      } else if (w > 0.5) {
        state.type[i] = TYPE_KEYS.indexOf(key);
      }
      const t = TERRAIN[key];
      // Blend fields toward the brush's terrain, so zones meet softly.
      state.height[i] += (t.height - state.height[i]) * w;
      state.rough[i] += (t.rough - state.rough[i]) * w;
      state.ridge[i] += ((t.ridge || 0) - state.ridge[i]) * w;
      state.r[i] += (t.color[0] - state.r[i]) * w;
      state.g[i] += (t.color[1] - state.g[i]) * w;
      state.b[i] += (t.color[2] - state.b[i]) * w;
    }
  }
}

// Dab positions along a stroke, spaced a fraction of the brush radius.
export function strokeDabs(stroke) {
  const out = [];
  const { points, radius } = stroke;
  if (!points.length) return out;
  out.push(points[0]);
  const step = Math.max(0.1, radius * 0.3);
  for (let i = 1; i < points.length; i++) {
    const a = latLonToVec(...points[i - 1]);
    const b = latLonToVec(...points[i]);
    const ang = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) / DEG;
    const n = Math.max(1, Math.ceil(ang / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const v = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      const { lat, lon } = vecToLatLon(...v);
      out.push([lat, lon]);
    }
  }
  return out;
}

export function applyStroke(state, stroke, from = 0) {
  const brush = BRUSHES.find((b) => b.id === stroke.brush) || BRUSHES[0];
  const dabs = strokeDabs(stroke);
  for (let i = from; i < dabs.length; i++) dab(state, brush, dabs[i][0], dabs[i][1], stroke.radius);
  return dabs;
}

export function replay(state) {
  resetFields(state);
  if (state.base) applyBase(state);
  for (const s of state.strokes) applyStroke(state, s);
}

// Paints an imported base map into the fields, then softens the edges
// between zones (and the coastline a little) the way brushes would.
function applyBase(state) {
  if (BASE_RES !== RES) throw new Error('Base map resolution does not match the drawing grid.');
  const { cells, keys } = decodeBase(state.base);
  const types = keys.map((k) => (TERRAIN[k] ? k : 'grassland'));
  const N = COLS * ROWS;
  for (let i = 0; i < N; i++) {
    const k = cells[i];
    if (k === 255) continue;
    const key = types[k];
    const t = TERRAIN[key];
    state.land[i] = 1;
    state.type[i] = TYPE_KEYS.indexOf(key);
    state.height[i] = t.height;
    state.rough[i] = t.rough;
    state.ridge[i] = t.ridge || 0;
    state.r[i] = t.color[0];
    state.g[i] = t.color[1];
    state.b[i] = t.color[2];
  }
  const isLand = state.land.slice();
  for (const f of [state.height, state.rough, state.ridge, state.r, state.g, state.b]) blurOnLand(f, isLand, 2);
  blurOnLand(state.land, null, 1);
}

// Separable box blur, wrapping east-west. With `mask`, only masked cells
// are averaged (and changed), so the sea doesn't bleed into the land.
function blurOnLand(field, mask, radius) {
  const tmp = new Float32Array(field.length);
  for (let r = 0; r < ROWS; r++) {
    const base = r * COLS;
    for (let c = 0; c < COLS; c++) {
      let sum = 0, n = 0;
      for (let d = -radius; d <= radius; d++) {
        const j = base + ((c + d + COLS) % COLS);
        if (!mask || mask[j]) { sum += field[j]; n++; }
      }
      tmp[base + c] = n ? sum / n : field[base + c];
    }
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const i = r * COLS + c;
      if (mask && !mask[i]) { field[i] = tmp[i]; continue; }
      let sum = 0, n = 0;
      for (let d = -radius; d <= radius; d++) {
        const rr = r + d;
        if (rr < 0 || rr >= ROWS) continue;
        const j = rr * COLS + c;
        if (!mask || mask[j]) { sum += tmp[j]; n++; }
      }
      field[i] = n ? sum / n : tmp[i];
    }
  }
}

// ---------- Saving: strokes as compact integer arrays ----------
// [brushIndex, radius*10, lat*10, lon*10, lat*10, lon*10, ...]
export function encodeStrokes(strokes) {
  return strokes.map((s) => [
    Math.max(0, BRUSHES.findIndex((b) => b.id === s.brush)),
    Math.round(s.radius * 10),
    ...s.points.flatMap(([lat, lon]) => [Math.round(lat * 10), Math.round(lon * 10)]),
  ]);
}

export function decodeStrokes(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => Array.isArray(r) && r.length >= 4)
    .map((r) => {
      const points = [];
      for (let i = 2; i + 1 < r.length; i += 2) points.push([r[i] / 10, r[i + 1] / 10]);
      return { brush: (BRUSHES[r[0]] || BRUSHES[0]).id, radius: r[1] / 10, points };
    });
}

// ---------- Sampling ----------
export function createPaintWorld(state, { seed = 'blank', natural = 1 } = {}) {
  const rand = mulberry32(hashString(seed));
  const coastNoise = createNoise3D(rand);
  const warpLat = createNoise3D(rand);
  const warpLon = createNoise3D(rand);
  const reliefNoise = createNoise3D(rand);
  const ridgeNoise = createNoise3D(rand);
  const tintNoise = createNoise3D(rand);
  const snowNoise = createNoise3D(rand);

  function bilinear(field, lat, lon) {
    const fr = (90 - lat) / RES - 0.5;
    const fc = (lon + 180) / RES - 0.5;
    const r0 = Math.max(0, Math.min(ROWS - 2, Math.floor(fr)));
    const tr = Math.max(0, Math.min(1, fr - r0));
    const c0f = Math.floor(fc);
    const tc = fc - c0f;
    const ca = ((c0f % COLS) + COLS) % COLS, cb = (ca + 1) % COLS;
    const i0 = r0 * COLS, i1 = i0 + COLS;
    return (field[i0 + ca] * (1 - tc) + field[i0 + cb] * tc) * (1 - tr) + (field[i1 + ca] * (1 - tc) + field[i1 + cb] * tc) * tr;
  }

  function cell(lat, lon) {
    const r = Math.max(0, Math.min(ROWS - 1, Math.floor((90 - lat) / RES)));
    const c = (((Math.floor((lon + 180) / RES)) % COLS) + COLS) % COLS;
    return r * COLS + c;
  }

  function ocean(h, lat, lon) {
    const depth = smoothstep(60, 4860, -h);
    const color = SHALLOW.map((s, k) => s + (DEEP[k] - s) * Math.sqrt(depth));
    return { height: h, color, nationIndex: -1, foundingIndex: -1, lat, lon, terrain: 'Ocean' };
  }

  function sample(x, y, z) {
    const len = Math.hypot(x, y, z);
    x /= len; y /= len; z /= len;
    const { lat, lon } = vecToLatLon(x, y, z);
    const L = bilinear(state.land, lat, lon);
    if (L < 0.02) return ocean(-4860, lat, lon); // open sea: skip the noise

    // Coastline: the brush's soft edge plus noise.
    let s = L - 0.5;
    if (natural > 0) s += natural * 0.16 * fbm(coastNoise, x, y, z, { octaves: 5, frequency: 12 });
    if (s <= 0) return ocean(-(60 + 4800 * smoothstep(0, 0.45, -s)), lat, lon);

    // Warped lookup: zone edges wobble instead of following brush circles.
    let wlat = lat, wlon = lon;
    if (natural > 0) {
      wlat += natural * (0.5 * fbm(warpLat, x, y, z, { octaves: 3, frequency: 8 }));
      wlon += (natural * (0.5 * fbm(warpLon, x, y, z, { octaves: 3, frequency: 8 }))) / Math.max(0.2, Math.cos(lat * DEG));
    }
    const typeIndex = state.type[cell(wlat, wlon)];
    const t = typeIndex === AUTO ? null : TERRAIN[TYPE_KEYS[typeIndex]];
    if (t?.water) return { height: 0, color: t.color, nationIndex: -1, foundingIndex: -1, lat, lon, terrain: t.name };

    const base = bilinear(state.height, wlat, wlon);
    const rgh = bilinear(state.rough, wlat, wlon);
    const rdg = bilinear(state.ridge, wlat, wlon);
    const rolling = fbm(reliefNoise, x, y, z, { octaves: 5, frequency: 14 });
    const crest = rdg > 0.02 ? ridged(ridgeNoise, x, y, z, { octaves: 5, frequency: 11 }) : 0;
    let h = base + rgh * ((1 - rdg) * rolling * 1.3 + rdg * (crest * 2.4 - 1));
    h = Math.max(3, h * smoothstep(0, 0.15, s));

    let color = [bilinear(state.r, wlat, wlon), bilinear(state.g, wlat, wlon), bilinear(state.b, wlat, wlon)];
    if (natural > 0) {
      const v = fbm(tintNoise, x, y, z, { octaves: 4, frequency: 30 });
      const w = fbm(tintNoise, x + 7.3, y, z, { octaves: 3, frequency: 7 });
      const k = Math.min(1, natural);
      color = [color[0] * (1 + k * (0.1 * v + 0.07 * w)), color[1] * (1 + k * 0.1 * v), color[2] * (1 + k * (0.1 * v - 0.07 * w))];
      const rock = rdg * smoothstep(0.45, 0.85, crest) * k;
      color = color.map((c, i) => c + (ROCK[i] - c) * rock * 0.75);
    }
    const snowline = 5200 * Math.pow(Math.cos(lat * DEG), 1.4) + 150 + natural * 300 * fbm(snowNoise, x, y, z, { octaves: 3, frequency: 20 });
    if (h > snowline) {
      const kk = smoothstep(snowline, snowline + 600, h);
      color = color.map((c, i) => c + (SNOW[i] - c) * kk);
    }

    const name = typeIndex === AUTO ? `Land (${TERRAIN[autoTerrain(lat)].name.toLowerCase()})` : t.name;
    return { height: h, color, nationIndex: -1, foundingIndex: -1, lat, lon, terrain: name };
  }

  return { kind: 'paint', sample, nations: [], founding: [], rivers: [], continents: {}, stats: null };
}
