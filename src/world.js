// World generation: turns a seed + settings into elevation, climate and biome
// values for any point on the unit sphere. Rendering lives elsewhere; this
// module is pure data so later iterations (rivers, regions, labels) can reuse it.

import { createNoise3D, fbm, ridged, hashString, mulberry32 } from './noise.js';

export const DEFAULT_SETTINGS = {
  seed: 'aelsewhere',
  seaLevel: 0.0,       // shifts the land/ocean split; higher = more ocean
  continentScale: 1.2, // lower = fewer, larger continents
  mountainStrength: 0.6,
  axialTemperature: 1.0, // how strongly latitude drives temperature
};

export const BIOMES = {
  DEEP_OCEAN: { name: 'Deep ocean', color: [0.04, 0.12, 0.32] },
  OCEAN: { name: 'Ocean', color: [0.07, 0.24, 0.52] },
  SHALLOWS: { name: 'Shallows', color: [0.16, 0.45, 0.66] },
  ICE: { name: 'Sea ice', color: [0.86, 0.92, 0.96] },
  BEACH: { name: 'Beach', color: [0.84, 0.78, 0.56] },
  DESERT: { name: 'Desert', color: [0.86, 0.73, 0.47] },
  SAVANNA: { name: 'Savanna', color: [0.66, 0.66, 0.34] },
  GRASSLAND: { name: 'Grassland', color: [0.42, 0.62, 0.28] },
  TEMPERATE_FOREST: { name: 'Temperate forest', color: [0.2, 0.45, 0.2] },
  RAINFOREST: { name: 'Rainforest', color: [0.08, 0.36, 0.14] },
  TAIGA: { name: 'Taiga', color: [0.24, 0.38, 0.3] },
  TUNDRA: { name: 'Tundra', color: [0.56, 0.58, 0.5] },
  MOUNTAIN: { name: 'Mountain', color: [0.45, 0.4, 0.36] },
  SNOW: { name: 'Snow', color: [0.95, 0.96, 0.98] },
};

export function createWorld(settings = {}) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const rand = mulberry32(hashString(String(s.seed)));
  const continentNoise = createNoise3D(rand);
  const detailNoise = createNoise3D(rand);
  const mountainNoise = createNoise3D(rand);
  const warpNoise = createNoise3D(rand);
  const moistureNoise = createNoise3D(rand);
  const tempNoise = createNoise3D(rand);
  const rangeNoise = createNoise3D(rand);

  // Elevation in roughly [-1, 1]; 0 is sea level.
  function elevation(x, y, z) {
    // Domain warp gives coastlines a less blobby, more organic shape.
    const w = 0.35;
    const wx = x + w * warpNoise(x * 1.5, y * 1.5, z * 1.5);
    const wy = y + w * warpNoise(x * 1.5 + 31.7, y * 1.5 + 11.3, z * 1.5 + 5.1);
    const wz = z + w * warpNoise(x * 1.5 + 17.2, y * 1.5 + 43.9, z * 1.5 + 23.4);

    const continents = fbm(continentNoise, wx, wy, wz, { octaves: 4, frequency: s.continentScale });
    const detail = fbm(detailNoise, wx, wy, wz, { octaves: 5, frequency: 4 });

    let e = continents * 1.1 + detail * 0.18 - s.seaLevel;

    // Mountains only rise on land, confined to a few belts (rangeMask) so
    // that most land stays lowland.
    if (e > 0) {
      const rangeMask = Math.max(0, fbm(rangeNoise, wx, wy, wz, { octaves: 3, frequency: 1.6 }) * 2.2 - 0.15);
      if (rangeMask > 0) {
        const ridges = ridged(mountainNoise, wx, wy, wz, { octaves: 4, frequency: 2.5 });
        const inland = Math.min(1, e * 5);
        e += Math.pow(ridges, 4) * s.mountainStrength * Math.min(1, rangeMask) * inland;
      }
    }
    return Math.max(-1, Math.min(1, e));
  }

  // y is the rotation axis, so |y| is the sine of latitude.
  function temperature(x, y, z, e) {
    const lat = Math.abs(y);
    let t = 1 - lat * 1.15 * s.axialTemperature;
    t += 0.12 * tempNoise(x * 2, y * 2, z * 2);
    if (e > 0) t -= e * 0.6; // colder with altitude
    return Math.max(0, Math.min(1, t));
  }

  function moisture(x, y, z, e) {
    let m = 0.5 + 0.5 * fbm(moistureNoise, x, y, z, { octaves: 4, frequency: 1.8 });
    // Rough stand-ins for climate bands: wet equator, dry ~30° latitude.
    const lat = Math.abs(y);
    m += 0.2 * Math.cos(lat * Math.PI * 3.2);
    if (e > 0.35) m -= (e - 0.35) * 0.5;
    return Math.max(0, Math.min(1, m));
  }

  function biome(e, t, m) {
    if (e < 0) {
      if (t < 0.12) return BIOMES.ICE;
      if (e < -0.35) return BIOMES.DEEP_OCEAN;
      if (e < -0.08) return BIOMES.OCEAN;
      return BIOMES.SHALLOWS;
    }
    if (e < 0.025 && t > 0.25) return BIOMES.BEACH;
    if (t < 0.12) return BIOMES.SNOW;
    if (e > 0.55) return t < 0.3 ? BIOMES.SNOW : BIOMES.MOUNTAIN;
    if (t < 0.28) return m > 0.45 ? BIOMES.TAIGA : BIOMES.TUNDRA;
    if (t < 0.6) {
      if (m < 0.3) return BIOMES.GRASSLAND;
      return BIOMES.TEMPERATE_FOREST;
    }
    if (m < 0.28) return BIOMES.DESERT;
    if (m < 0.5) return BIOMES.SAVANNA;
    return BIOMES.RAINFOREST;
  }

  // Everything known about one point on the unit sphere.
  function sample(x, y, z) {
    const e = elevation(x, y, z);
    const t = temperature(x, y, z, e);
    const m = moisture(x, y, z, e);
    return { elevation: e, temperature: t, moisture: m, biome: biome(e, t, m) };
  }

  return { settings: s, sample, elevation };
}
