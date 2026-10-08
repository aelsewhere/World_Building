// Terrain classes from the hand-drawn map's topography layer (keys match its
// `t-*` classes; names follow its legend). Colours here are natural
// "satellite" tones, not the map's categorical colours. Heights are rough
// placeholders in metres; `rough` is how much noise relief is added on top;
// `ridge` (0–1) makes that relief sharp-crested, with bare rock on the crests.

export const TERRAIN = {
  ice: { name: 'Ice', color: [0.93, 0.95, 0.97], height: 900, rough: 200 },
  icefield: { name: 'Ice field / glaciers', color: [0.85, 0.9, 0.95], height: 2600, rough: 700, ridge: 0.8 },
  tundra: { name: 'Tundra', color: [0.58, 0.57, 0.49], height: 250, rough: 150 },
  taiga: { name: 'Taiga', color: [0.2, 0.34, 0.26], height: 350, rough: 250 },
  conifer: { name: 'Conifer forest', color: [0.17, 0.32, 0.22], height: 300, rough: 200 },
  alpine: { name: 'Alpine meadow', color: [0.5, 0.6, 0.36], height: 2300, rough: 700, ridge: 0.6 },
  mountains: { name: 'Mountains', color: [0.46, 0.41, 0.37], height: 2000, rough: 2200, ridge: 1 },
  volcanoes: { name: 'Volcanoes', color: [0.3, 0.26, 0.24], height: 1800, rough: 600, ridge: 0.8 },
  lava: { name: 'Lava fields (moss-covered)', color: [0.33, 0.38, 0.29], height: 400, rough: 150 },
  lava2: { name: 'Lava fields (moss-covered)', color: [0.33, 0.38, 0.29], height: 400, rough: 150 },
  valleys: { name: 'Valleys', color: [0.42, 0.6, 0.27], height: 250, rough: 120 },
  plains: { name: 'Plains', color: [0.55, 0.62, 0.35], height: 150, rough: 60 },
  grassland: { name: 'Grassland', color: [0.46, 0.62, 0.3], height: 250, rough: 120 },
  steppe: { name: 'Steppe (dry grassland)', color: [0.63, 0.63, 0.4], height: 450, rough: 120 },
  savanna: { name: 'Savanna', color: [0.68, 0.64, 0.36], height: 400, rough: 150 },
  wetlands: { name: 'Seasonal wetlands', color: [0.4, 0.52, 0.35], height: 60, rough: 20 },
  scrubland: { name: 'Scrubland', color: [0.58, 0.55, 0.36], height: 450, rough: 300 },
  dryscrub: { name: 'Dry scrub', color: [0.66, 0.58, 0.4], height: 800, rough: 300, ridge: 0.2 },
  desert: { name: 'Hot desert', color: [0.87, 0.74, 0.48], height: 450, rough: 200 },
  dunes: { name: 'Dunes', color: [0.91, 0.8, 0.55], height: 120, rough: 80 },
  fogdesert: { name: 'Coastal fog desert', color: [0.83, 0.79, 0.67], height: 200, rough: 120 },
  jungle: { name: 'Jungle', color: [0.06, 0.33, 0.11], height: 150, rough: 100 },
  forest: { name: 'Tropical forest (seasonal)', color: [0.22, 0.42, 0.16], height: 250, rough: 150 },
  trainforest: { name: 'Temperate rainforest', color: [0.11, 0.37, 0.22], height: 350, rough: 350 },
  tforest: { name: 'Temperate forest', color: [0.22, 0.44, 0.2], height: 300, rough: 200 },
  oldgrowth: { name: 'Old-growth forest', color: [0.13, 0.33, 0.15], height: 450, rough: 250 },
  patchwork: { name: 'Forest and farmland', color: [0.4, 0.54, 0.27], height: 250, rough: 120 },
  farmland: { name: 'Farmland', color: [0.56, 0.63, 0.32], height: 200, rough: 100 },
  hills: { name: 'Rolling hills', color: [0.42, 0.56, 0.28], height: 650, rough: 350, ridge: 0.15 },
  moor: { name: 'Moorland / hills', color: [0.47, 0.46, 0.38], height: 450, rough: 250, ridge: 0.2 },
  highlands: { name: 'Forested highlands', color: [0.25, 0.42, 0.24], height: 1500, rough: 500, ridge: 0.4 },
  plateau: { name: 'Highland plateau', color: [0.52, 0.6, 0.36], height: 1900, rough: 300, ridge: 0.2 },
  cloudforest: { name: 'Cloud forest', color: [0.15, 0.4, 0.27], height: 2000, rough: 700, ridge: 0.5 },
  tableland: { name: 'High tableland', color: [0.6, 0.58, 0.38], height: 1500, rough: 250, ridge: 0.25 },
  gorges: { name: 'Gorges', color: [0.5, 0.38, 0.28], height: 1000, rough: 700, ridge: 0.8 },
  tussock: { name: 'Peat and tussock grass', color: [0.55, 0.54, 0.4], height: 150, rough: 80 },
  mangroves: { name: 'Mangrove swamp', color: [0.17, 0.35, 0.24], height: 5, rough: 3 },
  marsh: { name: 'Marsh / swamp', color: [0.35, 0.47, 0.33], height: 10, rough: 5 },
  bogs: { name: 'Bogs', color: [0.4, 0.41, 0.31], height: 150, rough: 60 },
  saltflats: { name: 'Salt flats', color: [0.9, 0.88, 0.82], height: 15, rough: 5 },
  beaches: { name: 'Beaches', color: [0.86, 0.8, 0.6], height: 10, rough: 5 },
  blacksand: { name: 'Black sand beaches', color: [0.2, 0.2, 0.21], height: 10, rough: 5 },
  rocky: { name: 'Rocky cliffs', color: [0.5, 0.47, 0.44], height: 200, rough: 120, ridge: 0.5 },
  fjords: { name: 'Fjords', color: [0.3, 0.38, 0.33], height: 700, rough: 500, ridge: 0.8 },
  lakes: { name: 'Lake', color: [0.14, 0.36, 0.55], height: 0, rough: 0, water: true },
  lagoons: { name: 'Lagoon', color: [0.2, 0.5, 0.6], height: 0, rough: 0, water: true },
};

// Added as cones on top of the terrain. Mount Firmamenta is the tracker's
// tallest mountain in the world (BJ's central volcano with an icy summit).
export const PEAK_HEIGHTS = {
  volcanoes: 3200,
  firmamenta: 9500,
};
