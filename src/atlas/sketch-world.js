// Builds a sampleable world from the hand-drawn map's geometry
// (sketch-data.json, produced by scripts/import-sketch.mjs).
//
// The map's polygons are rasterised once onto a lat/lon grid: land, nation,
// terrain. From those come smoothed height and colour fields (terrain zone
// edges softened, as in the satellite draft) and distances to the coast.
// Coastlines are kept exactly as drawn. Pure data, no Three.js, so it also
// runs in Node for the flat-map script.

import { createNoise3D, fbm, hashString, mulberry32 } from '../noise.js';
import { vecToLatLon } from '../geo.js';
import { TERRAIN, PEAK_HEIGHTS } from './terrain-types.js';
import { CONTINENTS, NATION_ORDER, PROMINENT } from './naropa-nalanda.js';

const DEG = Math.PI / 180;
const RES = 0.125; // grid cell size in degrees (~14 km)
const SNOW = [0.95, 0.96, 0.98];
const DEEP = [0.03, 0.1, 0.28];
const SHALLOW = [0.13, 0.42, 0.62];

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function createSketchWorld(data, { seed = 'naropa' } = {}) {
  // ---------- Grid ----------
  let north = -90, south = 90, west = 180, east = -180;
  for (const ring of data.coasts) {
    for (const [lat, lon] of ring) {
      north = Math.max(north, lat); south = Math.min(south, lat);
      east = Math.max(east, lon); west = Math.min(west, lon);
    }
  }
  const margin = 6;
  north = Math.min(90, north + margin); south = Math.max(-90, south - margin);
  west -= margin; east += margin;
  const cols = Math.ceil((east - west) / RES);
  const rows = Math.ceil((north - south) / RES);
  const N = cols * rows;
  const rowLat = (r) => north - (r + 0.5) * RES;

  // Even-odd scanline fill of a set of rings; calls fn(cellIndex).
  function fill(rings, fn) {
    let top = -90, bottom = 90;
    for (const ring of rings) for (const [lat] of ring) { top = Math.max(top, lat); bottom = Math.min(bottom, lat); }
    const r0 = Math.max(0, Math.floor((north - top) / RES));
    const r1 = Math.min(rows - 1, Math.ceil((north - bottom) / RES));
    const xs = [];
    for (let r = r0; r <= r1; r++) {
      const lat = rowLat(r);
      xs.length = 0;
      for (const ring of rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [aLat, aLon] = ring[i];
          const [bLat, bLon] = ring[j];
          if ((aLat > lat) !== (bLat > lat)) xs.push(aLon + ((lat - aLat) * (bLon - aLon)) / (bLat - aLat));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k] - west) / RES - 0.5));
        const c1 = Math.min(cols - 1, Math.floor((xs[k + 1] - west) / RES - 0.5));
        for (let c = c0; c <= c1; c++) fn(r * cols + c);
      }
    }
  }

  // Assigns every land cell with no value the value of its nearest assigned
  // land cell (breadth-first). Returns how many cells were filled this way.
  function fillGaps(values, empty) {
    const queue = new Int32Array(N);
    let head = 0, tail = 0, filled = 0;
    for (let i = 0; i < N; i++) if (land[i] && values[i] !== empty) queue[tail++] = i;
    while (head < tail) {
      const i = queue[head++];
      const r = (i / cols) | 0, c = i - r * cols;
      for (const j of [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, r > 0 ? i - cols : -1, r < rows - 1 ? i + cols : -1]) {
        if (j >= 0 && land[j] && values[j] === empty) {
          values[j] = values[i];
          queue[tail++] = j;
          filled++;
        }
      }
    }
    return filled;
  }

  // ---------- Land, nations, terrain ----------
  const land = new Uint8Array(N);
  for (const ring of data.coasts) fill([ring], (i) => (land[i] = 1));

  const codes = NATION_ORDER.filter((c) => data.nations[c]);
  const foundingCodes = Object.keys(data.founding);
  const nations = codes.map((code) => {
    const n = data.nations[code];
    return {
      code,
      name: n.name,
      continent: code[0],
      founding: n.founding,
      prominent: PROMINENT.has(code),
      color: hexToRgb(n.color),
      label: n.label,
    };
  });
  const founding = foundingCodes.map((code) => ({
    code,
    name: data.founding[code].name,
    color: hexToRgb(data.founding[code].color),
    label: data.founding[code].label,
  }));

  const nation = new Int8Array(N).fill(-1);
  codes.forEach((code, ni) => fill(data.nations[code].rings, (i) => { if (land[i]) nation[i] = ni; }));
  const nationGaps = fillGaps(nation, -1);

  const typeKeys = Object.keys(TERRAIN);
  const terrain = new Uint8Array(N).fill(255);
  for (const t of data.terrain) {
    const ti = typeKeys.indexOf(t.type);
    if (ti < 0) throw new Error(`unknown terrain type "${t.type}"`);
    fill(t.rings, (i) => { if (land[i]) terrain[i] = ti; });
  }
  const terrainGaps = fillGaps(terrain, 255);

  // ---------- Distance to coast (in km-ish cells, chamfer) ----------
  // Horizontal steps shrink with latitude on a lat/lon grid.
  function distanceField(inside) {
    const d = new Float32Array(N);
    for (let i = 0; i < N; i++) d[i] = inside(i) ? 1e9 : 0;
    const cosRow = Array.from({ length: rows }, (_, r) => Math.max(0.05, Math.cos(rowLat(r) * DEG)));
    for (let r = 0; r < rows; r++) {
      const h = cosRow[r], dg = Math.hypot(1, h);
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (d[i] === 0) continue;
        let v = d[i];
        if (c > 0) v = Math.min(v, d[i - 1] + h);
        if (r > 0) {
          v = Math.min(v, d[i - cols] + 1);
          if (c > 0) v = Math.min(v, d[i - cols - 1] + dg);
          if (c < cols - 1) v = Math.min(v, d[i - cols + 1] + dg);
        }
        d[i] = v;
      }
    }
    for (let r = rows - 1; r >= 0; r--) {
      const h = cosRow[r], dg = Math.hypot(1, h);
      for (let c = cols - 1; c >= 0; c--) {
        const i = r * cols + c;
        if (d[i] === 0) continue;
        let v = d[i];
        if (c < cols - 1) v = Math.min(v, d[i + 1] + h);
        if (r < rows - 1) {
          v = Math.min(v, d[i + cols] + 1);
          if (c < cols - 1) v = Math.min(v, d[i + cols + 1] + dg);
          if (c > 0) v = Math.min(v, d[i + cols - 1] + dg);
        }
        d[i] = v;
      }
    }
    return d;
  }
  const toSea = distanceField((i) => land[i] === 1);
  const toLand = distanceField((i) => land[i] === 0);

  // ---------- Height, roughness, colour ----------
  const height = new Float32Array(N);
  const rough = new Float32Array(N);
  const cr = new Float32Array(N), cg = new Float32Array(N), cb = new Float32Array(N);
  const water = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!land[i]) continue;
    const t = TERRAIN[typeKeys[terrain[i]]];
    height[i] = t.height;
    rough[i] = t.rough;
    [cr[i], cg[i], cb[i]] = t.color;
    if (t.water) water[i] = 1;
  }

  // Box blur over land cells only, so the ocean doesn't bleed into the coast.
  function blur(field, radius, passes) {
    const tmp = new Float32Array(N);
    for (let p = 0; p < passes; p++) {
      for (let r = 0; r < rows; r++) {
        let sum = 0, cnt = 0;
        const base = r * cols;
        for (let c = -radius; c < cols; c++) {
          const add = c + radius, sub = c - radius - 1;
          if (add < cols && land[base + add]) { sum += field[base + add]; cnt++; }
          if (sub >= 0 && land[base + sub]) { sum -= field[base + sub]; cnt--; }
          if (c >= 0) tmp[base + c] = land[base + c] && cnt ? sum / cnt : field[base + c];
        }
      }
      for (let c = 0; c < cols; c++) {
        let sum = 0, cnt = 0;
        for (let r = -radius; r < rows; r++) {
          const add = r + radius, sub = r - radius - 1;
          if (add < rows && land[add * cols + c]) { sum += tmp[add * cols + c]; cnt++; }
          if (sub >= 0 && land[sub * cols + c]) { sum -= tmp[sub * cols + c]; cnt--; }
          if (r >= 0) field[r * cols + c] = land[r * cols + c] && cnt ? sum / cnt : tmp[r * cols + c];
        }
      }
    }
  }
  blur(height, 3, 2);
  blur(rough, 3, 2);
  for (const ch of [cr, cg, cb]) blur(ch, 1, 2);

  // Peaks: a cone per volcano polygon, and Mount Firmamenta on BJ's central
  // mountain (the largest mountain/volcano polygon inside BJ).
  const peaks = [];
  const bjIndex = codes.indexOf('BJ');
  let firmamenta = null;
  for (const t of data.terrain) {
    if (t.type !== 'volcanoes' && t.type !== 'mountains') continue;
    const ring = t.rings[0];
    let lat = 0, lon = 0, area = 0;
    for (const [a, b] of ring) { lat += a; lon += b; }
    lat /= ring.length; lon /= ring.length;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      area += (ring[j][1] - ring[i][1]) * (ring[j][0] + ring[i][0]);
    }
    area = Math.abs(area / 2) * Math.cos(lat * DEG);
    const r = Math.max(0.5, Math.sqrt(area / Math.PI));
    const ci = cellIndex(lat, lon);
    if (ci >= 0 && nation[ci] === bjIndex && (!firmamenta || area > firmamenta.area)) {
      firmamenta = { lat, lon, r, area };
    }
    if (t.type === 'volcanoes') peaks.push({ lat, lon, r, height: PEAK_HEIGHTS.volcanoes, name: 'Volcano' });
  }
  if (firmamenta) {
    peaks.push({ lat: firmamenta.lat, lon: firmamenta.lon, r: Math.max(1.5, firmamenta.r), height: PEAK_HEIGHTS.firmamenta, name: 'Mount Firmamenta' });
  }
  for (const pk of peaks) {
    const reach = pk.r * 2.5;
    const r0 = Math.max(0, Math.floor((north - pk.lat - reach) / RES));
    const r1 = Math.min(rows - 1, Math.ceil((north - pk.lat + reach) / RES));
    for (let r = r0; r <= r1; r++) {
      const lat = rowLat(r);
      const k = Math.cos(lat * DEG);
      const span = reach / Math.max(0.1, k);
      const c0 = Math.max(0, Math.floor((pk.lon - span - west) / RES));
      const c1 = Math.min(cols - 1, Math.ceil((pk.lon + span - west) / RES));
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        if (!land[i] || water[i]) continue;
        const dLat = lat - pk.lat, dLon = (west + (c + 0.5) * RES - pk.lon) * k;
        const d = Math.hypot(dLat, dLon) / pk.r;
        height[i] += pk.height * Math.exp(-d * d * 1.6);
      }
    }
  }

  // Land slopes to the sea; ocean deepens away from the coast. Lakes sit flat.
  for (let i = 0; i < N; i++) {
    if (land[i]) {
      height[i] = water[i] ? 0 : Math.max(3, height[i] * smoothstep(0, 6, toSea[i]));
      rough[i] *= smoothstep(0, 6, toSea[i]);
    } else {
      height[i] = -(60 + 4800 * smoothstep(0, 22, toLand[i]));
    }
  }

  function cellIndex(lat, lon) {
    const r = Math.floor((north - lat) / RES);
    const c = Math.floor((lon - west) / RES);
    if (r < 0 || c < 0 || r >= rows || c >= cols) return -1;
    return r * cols + c;
  }

  // Bilinear lookup of a float field at fractional grid coordinates.
  function bilinear(field, fr, fc) {
    const r0 = Math.max(0, Math.min(rows - 2, Math.floor(fr)));
    const c0 = Math.max(0, Math.min(cols - 2, Math.floor(fc)));
    const tr = Math.max(0, Math.min(1, fr - r0)), tc = Math.max(0, Math.min(1, fc - c0));
    const i = r0 * cols + c0;
    return (field[i] * (1 - tc) + field[i + 1] * tc) * (1 - tr) + (field[i + cols] * (1 - tc) + field[i + cols + 1] * tc) * tr;
  }

  // ---------- Sampling ----------
  const rand = mulberry32(hashString(seed));
  const reliefNoise = createNoise3D(rand);

  function sample(x, y, z) {
    const len = Math.hypot(x, y, z);
    x /= len; y /= len; z /= len;
    const { lat, lon } = vecToLatLon(x, y, z);
    const fr = (north - lat) / RES - 0.5;
    const fc = (lon - west) / RES - 0.5;
    const ci = cellIndex(lat, lon);

    if (ci < 0 || !land[ci]) {
      const h = ci < 0 ? -4860 : bilinear(height, fr, fc);
      const depth = smoothstep(60, 4860, -h);
      const color = SHALLOW.map((s, k) => s + (DEEP[k] - s) * Math.sqrt(depth));
      return { height: h, color, nationIndex: -1, foundingIndex: -1, lat, lon, terrain: 'Ocean' };
    }

    const ni = nation[ci];
    const fi = foundingCodes.indexOf(nations[ni].founding);
    const t = TERRAIN[typeKeys[terrain[ci]]];

    if (water[ci]) {
      return { height: 0, color: t.color, nationIndex: ni, foundingIndex: fi, lat, lon, terrain: t.name };
    }

    let h = bilinear(height, fr, fc);
    h += bilinear(rough, fr, fc) * fbm(reliefNoise, x, y, z, { octaves: 5, frequency: 14 }) * 1.3;
    h = Math.max(3, h);

    let color = [bilinear(cr, fr, fc), bilinear(cg, fr, fc), bilinear(cb, fr, fc)];
    const snowline = 5200 * Math.pow(Math.cos(lat * DEG), 1.4) + 150;
    if (h > snowline) {
      const s = smoothstep(snowline, snowline + 700, h);
      color = color.map((v, k) => v + (SNOW[k] - v) * s);
    }

    return { height: h, color, nationIndex: ni, foundingIndex: fi, lat, lon, terrain: t.name };
  }

  const stats = {
    grid: `${cols}×${rows} cells at ${RES}°`,
    nationGapCells: nationGaps,
    terrainGapCells: terrainGaps,
    landCells: land.reduce((a, b) => a + b, 0),
  };

  return {
    kind: 'atlas',
    sample,
    nations,
    founding,
    continents: CONTINENTS,
    rivers: data.rivers.map((r) => ({ ...r, name: r.kind === 'major' ? 'Major river' : 'River' })),
    peaks,
    stats,
  };
}
