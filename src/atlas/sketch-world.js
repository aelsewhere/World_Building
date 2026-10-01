// Builds a sampleable world from the hand-drawn map's geometry
// (sketch-data.json, produced by scripts/import-sketch.mjs).
//
// The map's polygons are rasterised once onto a lat/lon grid: land, nation,
// terrain. From those come smoothed height and colour fields and a signed
// distance to the drawn coastline.
//
// `natural` (0 = exactly as drawn) layers noise on top when sampling:
// - coastlines: fractal noise on the signed distance adds bays, headlands and
//   small islands; areas drawn as fjords get deeper, finer cuts;
// - terrain zones and borders: the lookup position is warped, so straight
//   polygon edges become organic;
// - relief and colour: ridged relief and exposed rock on mountainous
//   terrain, and gentle colour variation within each zone.
// Noise for Naropa is evaluated at its drawn position, so moving Naropa west
// doesn't change its shapes.
//
// Pure data, no Three.js, so it also runs in Node for the flat-map script.

import { createNoise3D, fbm, ridged, hashString, mulberry32 } from '../noise.js';
import { vecToLatLon, latLonToVec } from '../geo.js';
import { TERRAIN, PEAK_HEIGHTS } from './terrain-types.js';
import { CONTINENTS, NATION_ORDER, PROMINENT } from './naropa-nalanda.js';

const DEG = Math.PI / 180;
const RES = 0.125; // grid cell size in degrees (~14 km)
const SNOW = [0.95, 0.96, 0.98];
const DEEP = [0.03, 0.1, 0.28];
const SHALLOW = [0.13, 0.42, 0.62];
const ROCK = [0.43, 0.39, 0.35];
const BANKS = [0.24, 0.42, 0.2];

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Moves every Naropa (continent A) feature `shiftDeg` degrees of longitude
// west. Latitudes are untouched, so the tracker's 9–83°N still holds.
export function shiftNaropa(data, shiftDeg) {
  if (!shiftDeg) return data;
  const ring = (r) => r.map(([lat, lon]) => [lat, lon - shiftDeg]);
  const pt = (p) => (p ? [p[0], p[1] - shiftDeg] : p);
  const nations = {};
  for (const [code, n] of Object.entries(data.nations)) {
    nations[code] = code[0] === 'A' ? { ...n, rings: n.rings.map(ring), label: pt(n.label) } : n;
  }
  const founding = {};
  for (const [code, f] of Object.entries(data.founding)) {
    founding[code] = code === 'F1' ? { ...f, label: pt(f.label) } : f;
  }
  return {
    ...data,
    coasts: data.coasts.map((c) => (c.continent === 'A' ? { ...c, ring: ring(c.ring) } : c)),
    nations,
    founding,
    terrain: data.terrain.map((t) => (t.continent === 'A' ? { ...t, rings: t.rings.map(ring) } : t)),
    rivers: data.rivers.map((r) => (r.continent === 'A' ? { ...r, points: ring(r.points) } : r)),
  };
}

// Shortest coast-to-coast distance between the two continents, in km on an
// Earth-sized planet.
function continentGapKm(data) {
  const R = 6371, D = Math.PI / 180;
  const A = data.coasts.filter((c) => c.continent === 'A').flatMap((c) => c.ring);
  const B = data.coasts.filter((c) => c.continent === 'B').flatMap((c) => c.ring);
  let best = Infinity;
  for (const [a, b] of A) {
    const ca = Math.cos(a * D);
    for (const [c, e] of B) {
      const h = Math.sin((c - a) * D / 2) ** 2 + ca * Math.cos(c * D) * Math.sin((e - b) * D / 2) ** 2;
      if (h < best) best = h;
    }
  }
  return 2 * R * Math.asin(Math.sqrt(best));
}

// Placeholder terrain for draft lands, which have no terrain drawn yet.
function draftTerrainFor(lat) {
  const a = Math.abs(lat);
  if (a > 75) return 'ice';
  if (a > 64) return 'tundra';
  if (a > 52) return 'taiga';
  if (a > 40) return 'tforest';
  if (a > 30) return 'grassland';
  if (a > 22) return 'scrubland';
  if (a > 12) return 'savanna';
  return 'jungle';
}

// extraLands: draft landmasses ({ code, name, rings, label }) given in
// Naropa's drawn frame; they move with Naropa.
export function createSketchWorld(sourceData, { seed = 'naropa', naropaShift = 0, natural = 1, extraLands = [] } = {}) {
  const data = shiftNaropa(sourceData, naropaShift);
  const drafts = extraLands.map((l) => ({
    ...l,
    rings: l.rings.map((r) => r.map(([lat, lon]) => [lat, lon - naropaShift])),
    label: l.label ? [l.label[0], l.label[1] - naropaShift] : null,
  }));

  // ---------- Grid ----------
  let north = -90, south = 90, west = 180, east = -180;
  for (const ring of [...data.coasts.map((c) => c.ring), ...drafts.flatMap((l) => l.rings)]) {
    for (const [lat, lon] of ring) {
      north = Math.max(north, lat); south = Math.min(south, lat);
      east = Math.max(east, lon); west = Math.min(west, lon);
    }
  }
  const margin = 6;
  north = Math.min(90, north + margin); south = Math.max(-90, south - margin);
  west -= margin; east += margin;
  if (east - west > 360) throw new Error('Land spans more than 360° of longitude; move Naropa less far west.');
  const cols = Math.ceil((east - west) / RES);
  const rows = Math.ceil((north - south) / RES);
  const N = cols * rows;
  const rowLat = (r) => north - (r + 0.5) * RES;

  function cellIndex(lat, lon) {
    const r = Math.floor((north - lat) / RES);
    const c = Math.floor((lon - west) / RES);
    if (r < 0 || c < 0 || r >= rows || c >= cols) return -1;
    return r * cols + c;
  }

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

  // Gives every empty cell (land and sea) the value of its nearest assigned
  // cell, so noise-grown coastline has a nation and terrain. Returns how many
  // drawn-land cells had no value of their own.
  function fillEverywhere(values, empty) {
    let landGaps = 0;
    for (let i = 0; i < N; i++) if (land[i] && values[i] === empty) landGaps++;
    const queue = new Int32Array(N);
    let head = 0, tail = 0;
    for (let i = 0; i < N; i++) if (values[i] !== empty) queue[tail++] = i;
    while (head < tail) {
      const i = queue[head++];
      const r = (i / cols) | 0, c = i - r * cols;
      if (c > 0 && values[i - 1] === empty) { values[i - 1] = values[i]; queue[tail++] = i - 1; }
      if (c < cols - 1 && values[i + 1] === empty) { values[i + 1] = values[i]; queue[tail++] = i + 1; }
      if (r > 0 && values[i - cols] === empty) { values[i - cols] = values[i]; queue[tail++] = i - cols; }
      if (r < rows - 1 && values[i + cols] === empty) { values[i + cols] = values[i]; queue[tail++] = i + cols; }
    }
    return landGaps;
  }

  // ---------- Land, nations, terrain ----------
  const land = new Uint8Array(N);
  for (const { ring } of data.coasts) fill([ring], (i) => (land[i] = 1));
  for (const l of drafts) fill(l.rings, (i) => (land[i] = 1));

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
  const firstDraft = nations.length;
  for (const l of drafts) {
    nations.push({ code: l.code, name: l.name, continent: 'D', founding: null, prominent: false, draft: true, color: [0.72, 0.72, 0.66], label: l.label });
  }
  const founding = foundingCodes.map((code) => ({
    code,
    name: data.founding[code].name,
    color: hexToRgb(data.founding[code].color),
    label: data.founding[code].label,
  }));

  const nation = new Int8Array(N).fill(-1);
  codes.forEach((code, ni) => fill(data.nations[code].rings, (i) => { if (land[i]) nation[i] = ni; }));
  drafts.forEach((l, k) => fill(l.rings, (i) => (nation[i] = firstDraft + k)));
  const nationGaps = fillEverywhere(nation, -1);

  const typeKeys = Object.keys(TERRAIN);
  const terrain = new Uint8Array(N).fill(255);
  for (const t of data.terrain) {
    const ti = typeKeys.indexOf(t.type);
    if (ti < 0) throw new Error(`unknown terrain type "${t.type}"`);
    fill(t.rings, (i) => { if (land[i] && nation[i] < firstDraft) terrain[i] = ti; });
  }
  for (let r = 0; r < rows; r++) {
    const ti = typeKeys.indexOf(draftTerrainFor(rowLat(r)));
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (land[i] && nation[i] >= firstDraft) terrain[i] = ti;
    }
  }
  const terrainGaps = fillEverywhere(terrain, 255);

  // ---------- Signed distance to the drawn coast ----------
  // In latitude cells (~14 km); horizontal steps shrink with latitude.
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
  const sdf = new Float32Array(N);
  for (let i = 0; i < N; i++) sdf[i] = land[i] ? toSea[i] - 0.5 : 0.5 - toLand[i];

  // Distance to the nearest drawn river, for valleys and greener banks.
  const riverCell = new Uint8Array(N);
  for (const river of data.rivers) {
    const pts = river.points;
    for (let i = 0; i + 1 < pts.length; i++) {
      const steps = Math.ceil(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) / (RES / 2)) || 1;
      for (let k = 0; k <= steps; k++) {
        const ci = cellIndex(
          pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * k) / steps,
          pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * k) / steps,
        );
        if (ci >= 0) riverCell[ci] = river.kind === 'major' ? 2 : 1;
      }
    }
  }
  const toRiver = distanceField((i) => riverCell[i] === 0);

  // ---------- Base fields (defined everywhere) ----------
  const height = new Float32Array(N);
  const rough = new Float32Array(N);
  const ridge = new Float32Array(N);
  const fjord = new Float32Array(N);
  const cr = new Float32Array(N), cg = new Float32Array(N), cb = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = TERRAIN[typeKeys[terrain[i]]];
    height[i] = t.height;
    rough[i] = t.rough;
    ridge[i] = t.ridge || 0;
    fjord[i] = typeKeys[terrain[i]] === 'fjords' ? 1 : 0;
    [cr[i], cg[i], cb[i]] = t.color;
  }

  // Separable box blur.
  function blur(field, radius, passes) {
    const tmp = new Float32Array(N);
    const w = 2 * radius + 1;
    for (let p = 0; p < passes; p++) {
      for (let r = 0; r < rows; r++) {
        const base = r * cols;
        let sum = 0;
        for (let c = -radius; c <= radius; c++) sum += field[base + Math.min(cols - 1, Math.max(0, c))];
        for (let c = 0; c < cols; c++) {
          tmp[base + c] = sum / w;
          sum += field[base + Math.min(cols - 1, c + radius + 1)] - field[base + Math.max(0, c - radius)];
        }
      }
      for (let c = 0; c < cols; c++) {
        let sum = 0;
        for (let r = -radius; r <= radius; r++) sum += tmp[Math.min(rows - 1, Math.max(0, r)) * cols + c];
        for (let r = 0; r < rows; r++) {
          field[r * cols + c] = sum / w;
          sum += tmp[Math.min(rows - 1, r + radius + 1) * cols + c] - tmp[Math.max(0, r - radius) * cols + c];
        }
      }
    }
  }
  blur(height, 3, 2);
  blur(rough, 3, 2);
  blur(ridge, 3, 2);
  blur(fjord, 4, 2);
  for (const ch of [cr, cg, cb]) blur(ch, 2, 2);

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
    if (ci >= 0 && land[ci] && nation[ci] === bjIndex && (!firmamenta || area > firmamenta.area)) {
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
        if (TERRAIN[typeKeys[terrain[i]]].water) continue;
        const dLat = lat - pk.lat, dLon = (west + (c + 0.5) * RES - pk.lon) * k;
        const d = Math.hypot(dLat, dLon) / pk.r;
        height[i] += pk.height * Math.exp(-d * d * 1.6);
      }
    }
  }

  // Bilinear lookup of a float field at a lat/lon.
  function bilinear(field, lat, lon) {
    const fr = (north - lat) / RES - 0.5;
    const fc = (lon - west) / RES - 0.5;
    const r0 = Math.max(0, Math.min(rows - 2, Math.floor(fr)));
    const c0 = Math.max(0, Math.min(cols - 2, Math.floor(fc)));
    const tr = Math.max(0, Math.min(1, fr - r0)), tc = Math.max(0, Math.min(1, fc - c0));
    const i = r0 * cols + c0;
    return (field[i] * (1 - tc) + field[i + 1] * tc) * (1 - tr) + (field[i + cols] * (1 - tc) + field[i + cols + 1] * tc) * tr;
  }

  // ---------- Sampling ----------
  const rand = mulberry32(hashString(seed));
  const coastNoise = createNoise3D(rand);
  const fjordNoise = createNoise3D(rand);
  const warpLat = createNoise3D(rand);
  const warpLon = createNoise3D(rand);
  const reliefNoise = createNoise3D(rand);
  const ridgeNoise = createNoise3D(rand);
  const tintNoise = createNoise3D(rand);
  const snowNoise = createNoise3D(rand);

  function ocean(h, lat, lon) {
    const depth = smoothstep(60, 4860, -h);
    const color = SHALLOW.map((s, k) => s + (DEEP[k] - s) * Math.sqrt(depth));
    return { height: h, color, nationIndex: -1, foundingIndex: -1, lat, lon, terrain: 'Ocean' };
  }

  function sample(x, y, z) {
    const len = Math.hypot(x, y, z);
    x /= len; y /= len; z /= len;
    const { lat, lon: rawLon } = vecToLatLon(x, y, z);
    // The grid may run past ±180° (lands west of Naropa); wrap into it.
    const lon = rawLon > east ? rawLon - 360 : rawLon < west ? rawLon + 360 : rawLon;
    const ci = cellIndex(lat, lon);
    if (ci < 0) return ocean(-4860, lat, rawLon);

    // Noise is evaluated where the land was drawn, so shifting Naropa moves
    // its details with it.
    const moved = nations[nation[ci]].continent !== 'B';
    const [nx, ny, nz] = moved ? latLonToVec(lat, lon + naropaShift) : [x, y, z];

    // Coastline: signed distance (in ~14 km cells) plus noise.
    const fj = bilinear(fjord, lat, lon);
    let s = bilinear(sdf, lat, lon);
    if (natural > 0 && s > -20 && s < 20) {
      s += natural * (8 + 3 * fj) * fbm(coastNoise, nx, ny, nz, { octaves: 6, frequency: 10 });
      s += natural * (2 + 3.5 * fj) * fbm(fjordNoise, nx, ny, nz, { octaves: 4, frequency: 55 });
    }
    if (s <= 0) return ocean(-(60 + 4800 * smoothstep(0, 22, -s)), lat, rawLon);

    // Warped lookup: organic edges between terrain zones and nations.
    let wlat = lat, wlon = lon;
    if (natural > 0) {
      // Three scales: broad bends (~700 km), meanders (~200 km), fine fringe.
      const warp = (n, off) =>
        1.6 * n(nx * 4 + off, ny * 4, nz * 4) +
        0.6 * fbm(n, nx + off, ny, nz, { octaves: 2, frequency: 16 }) +
        0.2 * fbm(n, nx + off, ny, nz, { octaves: 2, frequency: 60 });
      wlat += natural * warp(warpLat, 0);
      wlon += (natural * warp(warpLon, 3.1)) / Math.max(0.2, Math.cos(lat * DEG));
    }
    let wi = cellIndex(wlat, wlon);
    if (wi < 0) wi = ci;
    const ni = nation[wi];
    const fi = foundingCodes.indexOf(nations[ni].founding);
    const t = TERRAIN[typeKeys[terrain[wi]]];
    const terrainName = nations[ni].draft ? `${t.name} (placeholder)` : t.name;

    if (t.water) {
      return { height: 0, color: t.color, nationIndex: ni, foundingIndex: fi, lat, lon: rawLon, terrain: terrainName };
    }

    // Relief: rolling noise, ridged on mountainous terrain.
    const base = bilinear(height, wlat, wlon);
    const rgh = bilinear(rough, wlat, wlon);
    const rdg = bilinear(ridge, wlat, wlon);
    const rolling = fbm(reliefNoise, nx, ny, nz, { octaves: 5, frequency: 14 });
    let crest = 0;
    if (rdg > 0.02) crest = ridged(ridgeNoise, nx, ny, nz, { octaves: 5, frequency: 11 });
    let h = base + rgh * ((1 - rdg) * rolling * 1.3 + rdg * (crest * 2.4 - 1));
    const dr = bilinear(toRiver, lat, lon); // in ~14 km cells
    const valley = Math.exp(-((dr / 3) ** 2));
    h *= 1 - 0.45 * valley; // rivers run in valleys
    h *= smoothstep(0, 5 * (1 - 0.7 * fj), s); // slope to the sea; fjords stay steep
    h = Math.max(3, h);

    let color = [bilinear(cr, wlat, wlon), bilinear(cg, wlat, wlon), bilinear(cb, wlat, wlon)];
    if (natural > 0) {
      // Gentle variation within a zone: brightness and a warm/cool shift.
      const v = fbm(tintNoise, nx, ny, nz, { octaves: 4, frequency: 30 });
      const w = fbm(tintNoise, nx + 7.3, ny, nz, { octaves: 3, frequency: 7 });
      const k = Math.min(1, natural);
      color = [
        color[0] * (1 + k * (0.1 * v + 0.07 * w)),
        color[1] * (1 + k * 0.1 * v),
        color[2] * (1 + k * (0.1 * v - 0.07 * w)),
      ];
      // Bare rock on the crests of mountainous terrain.
      const rock = rdg * smoothstep(0.45, 0.85, crest) * k;
      color = color.map((c, i) => c + (ROCK[i] - c) * rock * 0.75);
    }

    // Greener banks along rivers.
    const banks = 0.4 * Math.exp(-((dr / 1.3) ** 2)) * Math.min(1, natural + 0.5);
    color = color.map((c, i) => c + (BANKS[i] - c) * banks);

    const snowline = 5200 * Math.pow(Math.cos(lat * DEG), 1.4) + 150 + natural * 300 * fbm(snowNoise, nx, ny, nz, { octaves: 3, frequency: 20 });
    if (h > snowline) {
      const k = smoothstep(snowline, snowline + 600, h);
      color = color.map((v, i) => v + (SNOW[i] - v) * k);
    }

    return { height: h, color, nationIndex: ni, foundingIndex: fi, lat, lon: rawLon, terrain: terrainName };
  }

  const stats = {
    grid: `${cols}×${rows} cells at ${RES}°`,
    nationGapCells: nationGaps,
    terrainGapCells: terrainGaps,
    landCells: land.reduce((a, b) => a + b, 0),
    naropaShift,
    natural,
    draftLands: drafts.length,
    gapKm: Math.round(continentGapKm(data)),
  };

  return {
    kind: 'atlas',
    sample,
    nations,
    founding,
    continents: { ...CONTINENTS, D: { name: 'Draft lands' } },
    rivers: data.rivers.map((r) => ({ ...r, name: r.kind === 'major' ? 'Major river' : 'River' })),
    peaks,
    stats,
  };
}
