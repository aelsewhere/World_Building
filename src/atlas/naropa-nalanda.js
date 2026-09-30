// Naropa & Nalanda: hand-authored layout, drafted from the Nations tracker
// (Sep 27–30, 2026).
//
// SOURCE OF EACH NUMBER
// - Latitude ranges, neighbours, terrain per nation, rivers and the AF–BA
//   crossing come from the tracker.
// - Longitudes, exact outlines and blob sizes are PLACEHOLDERS: the tracker
//   positions were read from a sketch that isn't in this repo yet. Replace them
//   once the sketch or a land mask is available.
//
// HOW SHAPES WORK
// Each nation is a set of blobs [lat, lon, radiusDeg]. Blobs from all nations
// merge smoothly (metaballs) to form land; each point belongs to the nation
// with the strongest blob influence. Radius is roughly the blob's own reach in
// great-circle degrees (1° ≈ 111 km on an Earth-sized planet).
//
// Terrain seeds are [lat, lon, terrainType, coastType?]. Each land point takes
// the terrain of its nearest seeds, blended at the edges. Coast types colour a
// thin band along the shore; see terrain-types.js for the type lists.
//
// Peaks are [lat, lon, heightMetres, radiusDeg, label] and are added on top.

export const CONTINENTS = {
  A: { name: 'Naropa' },
  B: { name: 'Nalanda' },
};

export const FOUNDING = {
  F1: { name: 'Naropa', color: [0.72, 0.5, 0.3] },
  F2: { name: 'Nascenta', color: [0.3, 0.62, 0.52] },
  F3: { name: 'Nalu', color: [0.92, 0.82, 0.4] },
  F4: { name: 'Naboca', color: [0.78, 0.36, 0.34] },
  F5: { name: 'Nagrandia', color: [0.45, 0.45, 0.75] },
};

export const NATIONS = [
  // ---------- Continent A: Naropa ----------
  {
    code: 'AA', name: 'Eschatia', continent: 'A', founding: 'F1',
    color: [0.86, 0.9, 0.96],
    blobs: [[80, -52, 3.6], [82.5, -42, 2.4]],
    terrain: [
      [82.5, -42, 'ice_cap', 'fjords'],
      [80, -52, 'ice_cap', 'fjords'],
      [79, -54, 'tundra'],
    ],
  },
  {
    code: 'AB', name: 'Agapyr', continent: 'A', founding: 'F1',
    color: [0.36, 0.62, 0.72],
    blobs: [[58, -63, 3.2], [52, -65, 3.4], [46, -65, 3.4], [40, -64, 3.4], [34, -62, 3.2], [30, -60, 2.6]],
    terrain: [
      [58, -64, 'taiga', 'fjords'],
      [52, -66, 'taiga', 'black_sand'],
      [45, -66, 'scrubland', 'beach'],
      [40, -65, 'valley', 'beach'],
      [35, -63, 'scrubland', 'beach'],
      [31, -61, 'valley', 'beach'],
    ],
  },
  {
    code: 'AC', name: 'Borea', continent: 'A', founding: 'F1',
    color: [0.6, 0.52, 0.48],
    blobs: [[70, -48, 3.5], [64, -52, 4.5], [57, -55, 4.5], [50, -56, 4.5], [43, -56, 4.5], [37, -54, 4.5], [30, -50, 4], [24, -46, 3.8], [19, -42, 3]],
    terrain: [
      [68, -52, 'volcanic'],
      [64, -53, 'volcanic'],
      [57, -56, 'glacier'],
      [51, -57, 'mountains'],
      [46, -54, 'alpine_meadow'],
      [41, -57, 'glacier'],
      [36, -54, 'alpine_meadow'],
      [28, -48, 'valley'],
      [20, -43, 'valley'],
    ],
  },
  {
    code: 'AD', name: 'Prasinagos', continent: 'A', founding: 'F1',
    color: [0.3, 0.55, 0.36],
    blobs: [[77, -36, 3.5], [72, -38, 4.5], [66, -40, 5], [60, -40, 5], [54, -41, 5], [48, -40, 4.5], [43, -38, 3.5], [67, -28, 4], [59, -28, 4.5], [51, -31, 4], [46, -46, 4], [40, -44, 3]],
    terrain: [
      [77, -36, 'tundra', 'fjords'],
      [71, -40, 'tundra'],
      [65, -33, 'bog_forest', 'fjords'],
      [61, -40, 'glacier'],
      [57, -30, 'bog_forest', 'fjords'],
      [53, -38, 'bog_forest'],
      [48, -34, 'temperate_forest', 'beach'],
      [44, -39, 'temperate_forest', 'beach'],
    ],
  },
  {
    code: 'AE', name: 'Notia', continent: 'A', founding: 'F1',
    color: [0.84, 0.72, 0.42],
    blobs: [[31, -55, 3], [26, -57, 3.6], [20, -57, 4.2], [14, -55, 4.2], [11, -48, 3.6], [18, -50, 3.6]],
    terrain: [
      [31, -55, 'valley'],
      [25, -58, 'steppe'],
      [21, -51, 'steppe'],
      [14, -57, 'savanna'],
      [11, -48, 'wetland'],
      [16, -51, 'wetland'],
    ],
  },
  {
    code: 'AF', name: 'Propylaia', continent: 'A', founding: 'F1', prominent: true,
    color: [0.85, 0.45, 0.3],
    blobs: [[44, -31, 3], [39, -33, 4], [34, -35, 4.3], [28, -36, 4.3], [22, -34, 3.8], [31, -27, 4], [25, -27, 4], [33, -41, 3.5]],
    terrain: [
      [44, -31, 'marsh'],
      [40, -34, 'temperate_forest'],
      [34, -38, 'grassland'],
      [27, -39, 'grassland'],
      [22, -32, 'seasonal_tropical'],
      [27, -28, 'seasonal_tropical'],
      [32, -25, 'mangrove', 'mangrove'],
    ],
  },
  {
    code: 'AG', name: 'Moiran', continent: 'A', founding: 'F1',
    color: [0.55, 0.42, 0.66],
    blobs: [
      [41.5, -25, 2.2], // mainland on the southeast coast
      [52, -10, 2.6], // largest island
      [60, -6, 2], // Iceland-style island
      [67, -8, 1.3], // smallest island
    ],
    terrain: [
      [41.5, -25, 'conifer', 'rocky'],
      [52, -11, 'taiga', 'fjords'],
      [52, -9, 'alpine_meadow'],
      [60, -6, 'lava_field', 'black_sand'],
      [67, -8, 'tundra', 'cliffs'],
    ],
  },

  // ---------- Continent B: Nalanda ----------
  {
    code: 'BA', name: 'Nalu', continent: 'B', founding: 'F3', prominent: true,
    color: [0.95, 0.85, 0.45],
    blobs: [[26, -14, 3.2], [31, -13, 2.3], [21.5, -15, 2.3]],
    terrain: [
      [26, -14, 'highlands'],
      [22, -15, 'farmland', 'beach'],
      [26, -17, 'farmland', 'beach'],
      [25, -11, 'temperate_forest', 'beach'],
      [31, -13, 'dunes', 'beach'],
      [32, -11, 'salt_flats', 'beach'],
    ],
  },
  {
    code: 'BB', name: 'Partselva', continent: 'B', founding: 'F4',
    color: [0.35, 0.58, 0.55],
    blobs: [[-38, -20, 3.2], [-45, -19, 3.6], [-52, -17, 4], [-58, -15, 3.6], [-62, -13, 2.6]],
    terrain: [
      [-42, -21, 'temperate_rainforest', 'beach'],
      [-49, -20, 'temperate_rainforest'],
      [-50, -15, 'moorland'],
      [-57, -14, 'taiga'],
      [-62, -13, 'taiga', 'fjords'],
    ],
  },
  {
    code: 'BC', name: 'Vendella', continent: 'B', founding: 'F4',
    color: [0.72, 0.36, 0.5],
    blobs: [[-9, -15, 3.6], [-16, -16, 4.3], [-23, -16, 4.3], [-30, -14, 4.3], [-37, -12, 4.3], [-44, -12, 3.6], [-15, -9, 4], [-24, -8, 4], [-31, -7, 4], [-18, -6, 3.5]],
    terrain: [
      [-9, -14, 'savanna'],
      [-18, -18, 'dunes', 'beach'],
      [-21, -13, 'desert'],
      [-30, -13, 'wine_country'],
      [-37, -9, 'wine_country'],
      [-45, -11, 'temperate_rainforest'],
    ],
  },
  {
    code: 'BD', name: 'Abocara', continent: 'B', founding: 'F4', prominent: true,
    color: [0.4, 0.7, 0.35],
    blobs: [[15, -12, 2.4], [9, -12, 3.6], [3, -12, 5], [-4, -10, 5], [-10, -7, 4], [4, -4, 4.3], [-5, -2, 4]],
    terrain: [
      [15, -12, 'marsh', 'mangrove'],
      [5, -9, 'jungle'],
      [-4, -7, 'jungle'],
      [0, -16, 'river_jungle', 'mangrove'],
      [7, -15, 'jungle', 'beach'],
      [-9, -2, 'river_jungle'],
      [-11, -7, 'seasonal_tropical'],
    ],
  },
  {
    code: 'BE', name: 'Gehmaroza', continent: 'B', founding: 'F5',
    color: [0.62, 0.66, 0.72],
    blobs: [[-57, -7, 3.6], [-62, -5, 4], [-67, -1, 3.6], [-61, 2, 3.4], [-54, -3, 3]],
    terrain: [
      [-56, -7, 'peat_tussock'],
      [-62, -4, 'tundra'],
      [-67, -1, 'ice_cap'],
      [-61, 3, 'mountains'],
    ],
  },
  {
    code: 'BF', name: 'Agrandia', continent: 'B', founding: 'F5',
    color: [0.48, 0.52, 0.82],
    blobs: [[-32, 3, 3.6], [-37, -2, 3.6], [-44, -2, 3.6], [-40, 5, 4.3], [-47, 7, 4.3], [-54, 8, 4.3], [-60, 10, 4], [-45, 14, 3.6], [-53, 15, 3.6], [-63, 14, 3], [-30, -2, 4], [-50, 0, 4], [-35, 10, 3.5]],
    terrain: [
      [-40, -1, 'farmland'],
      [-34, 5, 'hills'],
      [-44, 7, 'valley'],
      [-46, 14, 'old_growth'],
      [-53, 13, 'old_growth'],
      [-60, 8, 'mountains'],
      [-63, 14, 'volcanic', 'black_sand'],
    ],
  },
  {
    code: 'BG', name: 'Sunazumi', continent: 'B', founding: 'F5',
    color: [0.86, 0.62, 0.3],
    blobs: [[10, 6, 2], [5, 6, 3.2], [0, 10, 3.6], [-3, 4, 4.3], [-10, 4, 4.3], [-18, 4, 4.3], [-25, 5, 4], [-30, 7, 3.2], [-8, 13, 3.6], [-15, 12, 3.6], [-22, 12, 3.6], [-28, 12, 3.5]],
    terrain: [
      [10, 6, 'marsh', 'mangrove'],
      [-6, 1, 'lake_basin'],
      [-14, 0, 'lake_basin'],
      [-22, 1, 'savanna'],
      [-4, 10, 'savanna'],
      [-20, 9, 'desert'],
      [-28, 7, 'desert'],
      [-11, 13, 'mountains'],
    ],
  },
  {
    code: 'BH', name: 'Kusta', continent: 'B', founding: 'F5',
    color: [0.7, 0.5, 0.42],
    blobs: [[-15, 19, 3.6], [-22, 20, 4.3], [-30, 20, 4.3], [-38, 19, 4.3], [-46, 18, 4], [-54, 18, 3.6], [-20, 16, 3]],
    terrain: [
      [-16, 18, 'mountains'],
      [-25, 19, 'tableland'],
      [-35, 18, 'tableland'],
      [-38, 22, 'tableland', 'cliffs'],
      [-48, 21, 'tableland', 'fjords'],
      [-52, 20, 'volcanic'],
    ],
  },
  {
    code: 'BI', name: 'Ascenta', continent: 'B', founding: 'F2',
    color: [0.36, 0.72, 0.62],
    blobs: [[21, 22, 2.6], [15, 22, 3.6], [8, 21, 4.3], [0, 21, 4.3], [-8, 22, 4.3], [-16, 24, 3.6], [-23, 26, 3.4], [-28, 28, 2.6], [10, 26, 3.5], [-2, 26, 3.5], [-12, 28, 3], [-3, 17, 2.5]],
    terrain: [
      [2, 21, 'highlands'],
      [7, 19, 'cloud_forest'],
      [-4, 19, 'cloud_forest'],
      [1, 25, 'jungle'],
      [12, 25, 'seasonal_tropical'],
      [19, 22, 'seasonal_tropical', 'beach'],
      [-14, 24, 'jungle'],
      [-25, 27, 'seasonal_tropical', 'beach'],
    ],
  },
  {
    code: 'BJ', name: 'Firmara', continent: 'B', founding: 'F2', prominent: true,
    color: [0.8, 0.3, 0.25],
    blobs: [[2, 31, 3.6], [8, 31, 4.3], [15, 31, 4.3], [22, 31, 4], [28, 33, 3.2], [32, 38, 2.2], [30, 42, 2.2], [26, 44, 2], [9, 37, 3.6], [3, 37, 3], [15, 27, 3]],
    terrain: [
      [26, 32, 'dry_scrub'],
      [21, 29, 'highlands'],
      [14, 32, 'cloud_forest'],
      [6, 32, 'seasonal_tropical'],
      [9, 37, 'savanna'],
      [30, 40, 'seasonal_tropical', 'beach'],
      [26, 44, 'seasonal_tropical', 'beach'],
      [1, 38, 'hills'],
    ],
  },
  {
    code: 'BK', name: 'Risorga', continent: 'B', founding: 'F2',
    color: [0.45, 0.62, 0.3],
    blobs: [[1, 33, 3], [-5, 34, 3.6], [-12, 35, 4], [-20, 35, 4], [-28, 35, 3.6], [-36, 36, 3.6], [-44, 37, 3.6], [-51, 37, 3.2], [-55, 38, 2.2], [-18, 31, 3]],
    terrain: [
      [1, 33, 'mangrove', 'mangrove'],
      [-10, 32, 'jungle'],
      [-18, 37, 'hills'],
      [-30, 37, 'hills'],
      [-26, 33, 'grassland'],
      [-40, 36, 'grassland'],
      [-52, 37, 'glacier'],
    ],
  },
  {
    code: 'BL', name: 'Tessera', continent: 'B', founding: 'F2',
    color: [0.5, 0.4, 0.62],
    blobs: [[-10, 41, 3], [-18, 42, 3.6], [-26, 42, 3.6], [-34, 42, 3.6], [-42, 42, 3.6], [-49, 42, 3.2], [-26, 39, 3], [-38, 39, 3]],
    terrain: [
      [-16, 43, 'marsh', 'beach'],
      [-28, 45, 'marsh', 'beach'],
      [-22, 41, 'grassland'],
      [-36, 39, 'farmland'],
      [-44, 43, 'mountains'],
      [-50, 42, 'glacier'],
    ],
  },
];

export const PEAKS = [
  [14, 32, 9500, 3, 'Mount Firmamenta (tallest in the world)'],
  [68, -52, 3400, 2, 'AC northern volcanoes'],
  [64, -54, 3200, 2, 'AC northern volcanoes'],
  [61, -40, 2600, 2.5, 'AD mountain ice field'],
  [26, -14, 1800, 1.8, 'Nalu central highlands'],
  [52, -9, 2200, 1, 'AG largest island mountain'],
  [60, -6, 1900, 0.9, 'AG ice-capped volcano'],
  [-14, 15, 5200, 3, 'BG/BH mountain block peak'],
  [-60, 9, 3400, 1.5, 'BF volcanic chain'],
  [-63, 14, 3000, 1.2, 'BF volcanic chain'],
  [-52, 20.5, 2800, 1.2, 'BH coastal volcano'],
  [2, 21, 2600, 4, 'BI equatorial highlands'],
];

// Rivers as [lat, lon] polylines from source to mouth.
export const RIVERS = [
  {
    name: 'Wetland river',
    note: 'Rises in AC (Borea), feeds the seasonal wetlands of AE (Notia).',
    points: [[37, -53], [32, -52], [26, -52], [20, -51], [15, -50], [11, -48], [8.5, -47]],
  },
  {
    name: 'Equatorial river',
    note: 'Rises in BI (Ascenta), runs the BI/BJ border, then crosses BI and BG to a delta on BD\'s west coast. CONFLICT: with BG between BI and BD, it must cross the northern twin river; here the twin river joins it as a tributary. See README.',
    points: [[10, 27], [6, 27], [2, 26.5], [0.5, 22], [0, 17], [0, 13.5], [1, 9], [1, 3], [1, -4], [0.5, -11], [0, -16], [-0.5, -19.5]],
  },
  {
    name: 'Desert river',
    note: 'Rises at the BG/BH mountain block, crosses BC, estuary on the BB/BC border.',
    points: [[-14, 15], [-17, 10], [-22, 4], [-28, -3], [-33, -9], [-36, -15], [-37.5, -21]],
  },
  {
    name: 'Northern twin river',
    note: 'Rises at BI\'s southwest corner and marks the BG/BI border. Tracker: reaches the sea at BG\'s northern tip. Here it joins the equatorial river instead (see the conflict note above).',
    points: [[-11, 17.5], [-7, 16], [-3, 14.2], [0, 13.5]],
  },
  {
    name: 'Southern twin river',
    note: 'Rises at BI\'s southwest corner, marks the BH/BI border, reaches the gulf.',
    points: [[-15, 18], [-19, 22], [-24, 24], [-29, 26], [-32, 27.5]],
  },
  {
    name: 'BK/BL border river',
    note: 'River valley farmland along the BK/BL border.',
    points: [[-14, 38.5], [-22, 38.5], [-30, 39], [-38, 39.5], [-44, 40]],
  },
];
