// Turns a hand-authored atlas (nations as blobs, terrain seeds, peaks) into a
// world that can be sampled at any point on the unit sphere. Pure data, no
// Three.js, so it also runs in Node for the flat map script.

import { createNoise3D, fbm, hashString, mulberry32 } from '../noise.js';
import { latLonToVec, vecToLatLon } from '../geo.js';
import { TERRAIN, COAST } from './terrain-types.js';

const DEG = Math.PI / 180;
const BLOB_REACH = 2.0; // blobs influence out to this multiple of their radius
const LAND_THRESHOLD = 0.5;
const TERRAIN_BLEND_DEG = 3; // width of softened edges between terrain zones
const COAST_BAND = 0.035;
const SNOW = [0.95, 0.96, 0.98];
const DEEP = [0.03, 0.1, 0.28];
const SHALLOW = [0.13, 0.42, 0.62];

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function mix3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function createAtlasWorld(atlas, { seed = 'naropa' } = {}) {
  const rand = mulberry32(hashString(seed));
  const warpX = createNoise3D(rand);
  const warpY = createNoise3D(rand);
  const warpZ = createNoise3D(rand);
  const coastNoise = createNoise3D(rand);
  const fjordNoise = createNoise3D(rand);
  const reliefNoise = createNoise3D(rand);

  const nations = atlas.NATIONS;
  const foundingCodes = Object.keys(atlas.FOUNDING);

  const blobs = [];
  const seeds = [];
  nations.forEach((n, ni) => {
    for (const [lat, lon, r] of n.blobs) {
      const reach = r * BLOB_REACH;
      blobs.push({ v: latLonToVec(lat, lon), reach, cosReach: Math.cos(reach * DEG), ni });
    }
    for (const [lat, lon, terrain, coast] of n.terrain) {
      if (!TERRAIN[terrain]) throw new Error(`${n.code}: unknown terrain "${terrain}"`);
      if (coast && !COAST[coast]) throw new Error(`${n.code}: unknown coast "${coast}"`);
      seeds.push({ v: latLonToVec(lat, lon), t: TERRAIN[terrain], coast: coast ? COAST[coast] : null, fjord: coast === 'fjords' ? 1 : 0 });
    }
  });
  const peaks = atlas.PEAKS.map(([lat, lon, height, r, label]) => ({
    v: latLonToVec(lat, lon), height, r, cosReach: Math.cos(r * 3 * DEG), label,
  }));

  const influence = new Float32Array(nations.length);

  function sample(x, y, z) {
    const len = Math.hypot(x, y, z);
    x /= len; y /= len; z /= len;

    // Warped position: gives borders and coastlines an organic wobble.
    const wx = x + 0.04 * warpX(x * 4, y * 4, z * 4);
    const wy = y + 0.04 * warpY(x * 4, y * 4, z * 4);
    const wz = z + 0.04 * warpZ(x * 4, y * 4, z * 4);
    const wl = Math.hypot(wx, wy, wz);
    const px = wx / wl, py = wy / wl, pz = wz / wl;

    // Nation influence (metaballs).
    influence.fill(0);
    for (const b of blobs) {
      const d = px * b.v[0] + py * b.v[1] + pz * b.v[2];
      if (d <= b.cosReach) continue;
      const s = Math.acos(Math.min(1, d)) / DEG / b.reach;
      const k = 1 - s * s;
      influence[b.ni] += k * k;
    }
    let field = 0;
    let ni = -1;
    let best = 0;
    for (let i = 0; i < influence.length; i++) {
      field += influence[i];
      if (influence[i] > best) { best = influence[i]; ni = i; }
    }

    // Two nearest terrain seeds.
    let d1 = -2, d2 = -2, s1 = null, s2 = null;
    for (const s of seeds) {
      const d = px * s.v[0] + py * s.v[1] + pz * s.v[2];
      if (d > d1) { d2 = d1; s2 = s1; d1 = d; s1 = s; }
      else if (d > d2) { d2 = d; s2 = s; }
    }
    const a1 = Math.acos(Math.min(1, d1)) / DEG;
    const a2 = Math.acos(Math.min(1, d2)) / DEG;
    const w1 = Math.max(0.5, Math.min(1, 0.5 + (a2 - a1) / (2 * TERRAIN_BLEND_DEG)));
    const fjord = s1.fjord * w1 + s2.fjord * (1 - w1);

    // Coastline: noise perturbs the land field; fjord coasts get extra, finer noise.
    const coast = fbm(coastNoise, x, y, z, { octaves: 5, frequency: 5 }) * 0.14
      + fjord * fbm(fjordNoise, x, y, z, { octaves: 4, frequency: 22 }) * 0.22;
    const t = field + coast - LAND_THRESHOLD;

    const { lat, lon } = vecToLatLon(x, y, z);

    if (t <= 0) {
      const depth = smoothstep(0, 0.3, -t);
      const height = -(60 + 4800 * depth);
      return { height, color: mix3(SHALLOW, DEEP, Math.sqrt(depth)), nationIndex: -1, foundingIndex: -1, lat, lon, terrain: 'Ocean' };
    }

    const T1 = s1.t, T2 = s2.t;
    let height = T2.height + (T1.height - T2.height) * w1;
    const rough = T2.rough + (T1.rough - T2.rough) * w1;
    height += rough * fbm(reliefNoise, x, y, z, { octaves: 5, frequency: 14 }) * 1.3;

    for (const pk of peaks) {
      const d = x * pk.v[0] + y * pk.v[1] + z * pk.v[2];
      if (d <= pk.cosReach) continue;
      const a = Math.acos(Math.min(1, d)) / DEG / pk.r;
      height += pk.height * Math.exp(-a * a * 2.2);
    }

    // Land slopes down to the sea; fjord coasts stay steep.
    height = Math.max(3, height * smoothstep(0, 0.12 * (1 - 0.75 * fjord), t));

    let color = mix3(T2.color, T1.color, w1);
    const coastType = w1 > 0.75 ? s1.coast : null;
    if (coastType && coastType.color && t < COAST_BAND) color = mix3(color, coastType.color, 0.85);

    // Permanent snow above a latitude-dependent snowline.
    const snowline = 5200 * Math.pow(Math.cos(lat * DEG), 1.4) + 150;
    if (height > snowline) color = mix3(color, SNOW, smoothstep(snowline, snowline + 700, height));

    const nation = nations[ni];
    return {
      height,
      color,
      nationIndex: ni,
      foundingIndex: foundingCodes.indexOf(nation.founding),
      lat,
      lon,
      terrain: w1 > 0.6 ? T1.name : `${T1.name} / ${T2.name}`,
      coast: coastType && t < COAST_BAND ? coastType.name : null,
    };
  }

  return {
    kind: 'atlas',
    sample,
    nations,
    founding: foundingCodes.map((code) => ({ code, ...atlas.FOUNDING[code] })),
    rivers: atlas.RIVERS,
    peaks: atlas.PEAKS,
    continents: atlas.CONTINENTS,
  };
}
